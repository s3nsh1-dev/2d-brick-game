import * as Phaser from 'phaser';
import { Controls } from '../components/Controls';
import { Health } from '../components/Health';
import { Weapon } from '../components/Weapon';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { TextureKey } from '../constants/keys';

// The player. Composes Health, Weapon and Controls; inherits only from Phaser's sprite.
//
// This is the one entity with an `update`. Enemies, projectiles and gems are driven by
// systems instead, which keeps them out of reach of Phaser's own `update` conventions.

export class Player extends Phaser.Physics.Arcade.Sprite {
  public readonly health = new Health(BALANCE.player.maxHp);
  public readonly weapon = new Weapon(
    BALANCE.weapon.damage,
    BALANCE.weapon.cooldownSeconds,
    BALANCE.weapon.range,
  );

  private readonly controls: Controls;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKey.PLAYER);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.PLAYER);
    // The arena is exactly the world, so the engine's own bounds handling is the clamp.
    this.setCollideWorldBounds(true);

    this.controls = new Controls(scene);
  }

  /** Called by GameScene with dt in seconds. Reads input and drives velocity. */
  public override update(dt: number): void {
    throw new Error('not implemented');
  }

  public override destroy(fromScene?: boolean): void {
    throw new Error('not implemented');
  }
}
