import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { ObjectPool } from '../core/ObjectPool';
import { getWaveData } from '../data/schema';
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

  public constructor() {
    super(SceneKey.GAME);
  }

  public create(): void {
    throw new Error('not implemented');
  }

  /**
   * The only place milliseconds become seconds. Every `update(dt)` downstream is in
   * seconds, and the delta is capped so returning to a backgrounded tab steps the
   * simulation forward gently instead of teleporting bodies through one another.
   */
  public override update(_time: number, delta: number): void {
    throw new Error('not implemented');
  }

  /**
   * Registered against SHUTDOWN. Destroys the systems, empties the pools and clears the
   * bus, so a second restart behaves exactly like the first.
   */
  private shutdown(): void {
    throw new Error('not implemented');
  }
}
