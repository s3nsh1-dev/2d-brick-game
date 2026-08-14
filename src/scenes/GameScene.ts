import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { ObjectPool } from '../core/ObjectPool';
import { getEnemyData, getWaveData } from '../data/schema';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { XpGem } from '../entities/XpGem';
import { CombatSystem } from '../systems/CombatSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import type { System } from '../systems/System';

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

  private readonly handleRunEnded = (waveReached: number, xpTotal: number): void => {
    this.scene.stop(SceneKey.HUD);
    this.scene.start(SceneKey.GAME_OVER, { waveReached, xpTotal });
  };

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

    this.scene.stop(SceneKey.HUD);
  };

  public constructor() {
    super(SceneKey.GAME);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    this.physics.world.setBounds(0, 0, width, height);

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
    );

    this.physics.add.overlap(projectileGroup, enemyGroup, this.handleProjectileHitEnemy);
    this.physics.add.overlap(this.player, enemyGroup, this.handleEnemyTouchedPlayer);
    this.physics.add.overlap(this.player, gemGroup, this.handlePlayerTouchedGem);

    eventBus.on('run:ended', this.handleRunEnded);

    this.scene.launch(SceneKey.HUD);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);
  }

  /**
   * The only place milliseconds become seconds. Every `update(dt)` downstream is in
   * seconds, and the delta is capped so returning to a backgrounded tab steps the
   * simulation forward gently instead of teleporting bodies through one another.
   */
  public override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, BALANCE.time.maxDeltaSeconds);

    this.player.update(dt);
    for (const system of this.systems) {
      system.update(dt);
    }
  }

}
