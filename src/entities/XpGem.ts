import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { TextureKey } from '../constants/keys';

// An XP pickup. Sits where its enemy died until the player comes within magnet range,
// after which PickupSystem pulls it in.

export class XpGem extends Phaser.Physics.Arcade.Sprite {
  public readonly value = BALANCE.gem.value;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKey.XP_GEM);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.GEM);
    this.disableBody(true, true);
  }

  public spawn(x: number, y: number): void {
    this.enableBody(true, x, y, true, true);
  }

  public despawn(): void {
    // See Enemy.despawn: the body is already gone by the time a pool is released during
    // scene teardown.
    if (!this.body) {
      return;
    }

    this.disableBody(true, true);
  }
}
