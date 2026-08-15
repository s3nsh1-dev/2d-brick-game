import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { ObjectPool } from '../core/ObjectPool';
import { getEnemyData, getUpgradeData, getWaveData } from '../data/schema';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { XpGem } from '../entities/XpGem';
import { AudioSystem } from '../systems/AudioSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import type { System } from '../systems/System';
import { VfxSystem } from '../systems/VfxSystem';
import { addArenaBackdrop } from '../ui/backdrop';
import { fadeIn, fadeToScene } from '../ui/transitions';

/** Phaser names per-key events by suffix. Declared once so a typo is a compile error. */
const PAUSE_KEY = 'keydown-ESC';

// The wiring hub. It builds the world, hands the pieces to the systems, and tears
// everything down again. No game rule is decided in this file.
//
// Pools and physics groups keep separate books on purpose: every pooled sprite joins its
// group once, at construction, and stays a member for the scene's whole life. The group is
// what the colliders see; the pool is what the systems see. Nothing is added to or removed
// from a group at runtime.

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: ObjectPool<Enemy>;
  private projectiles!: ObjectPool<Projectile>;
  private gems!: ObjectPool<XpGem>;
  private combat!: CombatSystem;
  private pickups!: PickupSystem;

  private readonly systems: System[] = [];

  private readonly handleProjectileHitEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback =
    (first, second) => {
      if (first instanceof Projectile && second instanceof Enemy) {
        this.combat.onProjectileHitEnemy(first, second);
      }
    };

  private readonly handleEnemyTouchedPlayer: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback =
    (_first, second) => {
      if (second instanceof Enemy) {
        this.combat.onEnemyTouchedPlayer(second);
      }
    };

  private readonly handlePlayerTouchedGem: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    _first,
    second,
  ) => {
    if (second instanceof XpGem) {
      this.pickups.onPlayerTouchedGem(second);
    }
  };

  /**
   * The run's picks, in the order taken, for the summary screen to report.
   *
   * Collected here rather than sent through `run:ended` because bus payloads are positional
   * primitives (an array payload would allocate), and because this scene already forwards
   * the run's other totals into the scene that displays them. It decides nothing with the
   * list — it carries it.
   */
  private readonly takenUpgrades: string[] = [];

  private readonly handleUpgradeChosen = (upgradeId: string): void => {
    this.takenUpgrades.push(upgradeId);
  };

  private readonly handleRunEnded = (waveReached: number, xpTotal: number): void => {
    // Copied, not passed: `shutdown` empties this array, and it runs before the next scene
    // reads its data.
    const upgrades = [...this.takenUpgrades];

    this.scene.stop(SceneKey.HUD);
    fadeToScene(this, SceneKey.GAME_OVER, { waveReached, xpTotal, upgrades });
  };

  /**
   * Freezes the run and layers the offer menu over it.
   *
   * `pause` rather than `sleep`: a paused scene stops updating but keeps rendering, so the
   * frozen arena stays visible under the cards. `UpgradeScene` resumes this one, because a
   * paused scene cannot act on the event that would tell it to wake up.
   */
  private readonly handleLevelUp = (
    level: number,
    offerA: string,
    offerB: string,
    offerC: string,
  ): void => {
    this.scene.pause();
    this.scene.launch(SceneKey.UPGRADE, { level, offers: [offerA, offerB, offerC] });
    this.liftHud();
  };

  /**
   * Guarded, because this scene's keyboard listener still receives events while the scene
   * is paused — pausing halts `update`, not input. Without the guard, Escape during the
   * upgrade menu would stack a second frozen layer over the first.
   */
  private readonly handlePauseRequested = (): void => {
    if (this.scene.isPaused() || this.scene.isActive(SceneKey.UPGRADE)) {
      return;
    }

    this.scene.pause();
    this.scene.launch(SceneKey.PAUSE);
    this.liftHud();
  };

  /**
   * Puts the HUD above the sheet that was just launched over the run.
   *
   * A launched scene renders on top of every scene started before it, so without this the
   * scrim dims the player's own health and upgrade list along with the arena. Those are
   * exactly the numbers worth reading while a level-up menu is open, and it is why neither
   * sheet repeats them.
   */
  private liftHud(): void {
    this.scene.bringToTop(SceneKey.HUD);
  }

  /**
   * Registered against SHUTDOWN. Destroys the systems, empties the pools and clears the
   * bus, so a second restart behaves exactly like the first.
   */
  private readonly shutdown = (): void => {
    // Listener hygiene first. Anything that throws later in this handler would otherwise
    // skip it, and a bus listener surviving a restart is the exact bug invariant 9 exists
    // to prevent.
    for (const system of this.systems) {
      system.destroy();
    }
    eventBus.clear();

    // Emptied rather than reassigned: Phaser reuses the scene instance across restarts, so
    // field initialisers do not run again and a surviving entry would be updated twice.
    this.systems.length = 0;

    this.enemies.releaseAll();
    this.projectiles.releaseAll();
    this.gems.releaseAll();

    // Emptied for the same reason the system array is: Phaser reuses the scene instance, so
    // last run's picks would otherwise appear on the next run's summary.
    this.takenUpgrades.length = 0;

    this.input.keyboard?.off(PAUSE_KEY, this.handlePauseRequested);

    this.scene.stop(SceneKey.HUD);
    // A run can end while a layered scene is open. Stopping them unconditionally is cheaper
    // than asking whether either is running, and leaving one up would survive the restart.
    this.scene.stop(SceneKey.UPGRADE);
    this.scene.stop(SceneKey.PAUSE);
  };

  public constructor() {
    super(SceneKey.GAME);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    this.physics.world.setBounds(0, 0, width, height);

    // The arena is one texture composited at boot, not a stack of live shapes. Placed before
    // anything else so the display list order matches the depth order for free, and through
    // the kit so the menu and the summary stand on it the same way this scene does.
    addArenaBackdrop(this);

    this.player = new Player(this, width / 2, height / 2);

    // Read once and passed down: the definitions decide what SpawnSystem may spawn, and the
    // first of them is an arbitrary but real texture for pooled enemies to hold until they
    // are given a type.
    const enemyData = getEnemyData(this.registry);
    const [firstEnemyDefinition] = enemyData.enemies;

    // A group per pooled type. Membership is fixed for the scene's life: the factory adds
    // each sprite once, at construction, and nothing ever leaves.
    const enemyGroup = this.physics.add.group();
    const projectileGroup = this.physics.add.group();
    const gemGroup = this.physics.add.group();

    this.enemies = new ObjectPool<Enemy>(
      BALANCE.enemy.poolSize,
      () => {
        const enemy = new Enemy(this, firstEnemyDefinition.id);
        enemyGroup.add(enemy);
        return enemy;
      },
      (enemy) => {
        enemy.despawn();
      },
    );

    this.projectiles = new ObjectPool<Projectile>(
      BALANCE.projectile.poolSize,
      () => {
        const projectile = new Projectile(this);
        projectileGroup.add(projectile);
        return projectile;
      },
      (projectile) => {
        projectile.despawn();
      },
    );

    this.gems = new ObjectPool<XpGem>(
      BALANCE.gem.poolSize,
      () => {
        const gem = new XpGem(this);
        gemGroup.add(gem);
        return gem;
      },
      (gem) => {
        gem.despawn();
      },
    );

    this.combat = new CombatSystem(this.player, this.enemies, this.projectiles, eventBus);
    this.pickups = new PickupSystem(this.player, this.gems, eventBus);
    this.systems.push(
      new SpawnSystem(getWaveData(this.registry, enemyData), enemyData, this.enemies, eventBus),
      this.combat,
      this.pickups,
      new ProgressionSystem(this.player.stats, getUpgradeData(this.registry), eventBus),
      // Presentation, and last on purpose: they only ever react to what the systems above
      // have already decided. Deleting these two lines leaves a playable, silent, unadorned
      // game with identical timing — which is the test invariant 11 exists to pass.
      new AudioSystem(this, eventBus),
      new VfxSystem(this, eventBus),
    );

    this.physics.add.overlap(projectileGroup, enemyGroup, this.handleProjectileHitEnemy);
    this.physics.add.overlap(this.player, enemyGroup, this.handleEnemyTouchedPlayer);
    this.physics.add.overlap(this.player, gemGroup, this.handlePlayerTouchedGem);

    eventBus.on('run:ended', this.handleRunEnded);
    eventBus.on('level:up', this.handleLevelUp);
    eventBus.on('upgrade:chosen', this.handleUpgradeChosen);

    this.input.keyboard?.on(PAUSE_KEY, this.handlePauseRequested);

    this.scene.launch(SceneKey.HUD);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);

    fadeIn(this);
  }

  /**
   * The only place milliseconds become seconds. Every `update(dt)` downstream is in
   * seconds, and the delta is capped so returning to a backgrounded tab steps the
   * simulation forward gently instead of teleporting bodies through one another.
   */
  public override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, BALANCE.time.maxDeltaSeconds);

    // Hit-stop. `CombatSystem` owns the clock because it owns the death that started it;
    // the scene only asks whether this frame happens, and stops the physics world to match.
    // Skipping the systems alone would not be a freeze — Phaser steps the world after this
    // method returns, so every body would keep drifting through the pause.
    if (this.combat.tickHitStop(dt)) {
      this.physics.world.pause();
      return;
    }

    if (this.physics.world.isPaused) {
      this.physics.world.resume();
    }

    this.player.update(dt);
    for (const system of this.systems) {
      system.update(dt);
    }
  }

}
