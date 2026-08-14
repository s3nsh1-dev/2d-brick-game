import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { StaticTextureKey } from '../constants/keys';

// The bar that appears on the wall a moment before an enemy walks through it.
//
// Pooled and ticked by `dt`, exactly like `FloatingText`, and owned by `VfxSystem` rather
// than by the scene: deleting that system must take its effects with it, which it cannot do
// if the scene holds the pool.
//
// It lives in `entities/` rather than in the system because it holds per-instance state — a
// position, a rotation and a clock — and `VfxSystem` holds one of everything else.

export class SpawnMarker extends Phaser.GameObjects.Image {
  private lifeRemaining = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, StaticTextureKey.SPAWN_MARKER);

    scene.add.existing(this);

    this.setOrigin(0.5);
    this.setDepth(Depth.PARTICLE);
    this.despawn();
  }

  /**
   * Shows the marker lying along the wall at (x, y).
   *
   * @param vertical True on the left and right walls, where the bar has to stand on end.
   */
  public show(x: number, y: number, vertical: boolean): void {
    this.lifeRemaining = BALANCE.vfx.spawnMarker.lifetimeSeconds;

    this.setPosition(x, y);
    this.setRotation(vertical ? Math.PI / 2 : 0);
    this.setScale(BALANCE.vfx.spawnMarker.scaleStart, 1);
    this.setAlpha(1);
    this.setActive(true);
    this.setVisible(true);
  }

  /** Returns true once it has finished and should be released. */
  public tickLife(dt: number): boolean {
    this.lifeRemaining -= dt;
    if (this.lifeRemaining <= 0) {
      return true;
    }

    const remaining = this.lifeRemaining / BALANCE.vfx.spawnMarker.lifetimeSeconds;

    // Shrinking along its own length while fading, so the marker reads as a countdown rather
    // than as a decoration that happens to be there.
    this.setAlpha(remaining);
    this.setScale(BALANCE.vfx.spawnMarker.scaleStart * remaining, 1);
    return false;
  }

  public despawn(): void {
    this.lifeRemaining = 0;
    this.setActive(false);
    this.setVisible(false);
  }
}
