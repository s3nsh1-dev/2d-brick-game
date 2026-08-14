import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';

// A damage number that drifts upward and fades. Pooled like everything else spawned at
// runtime, and owned by VfxSystem rather than by GameScene: deleting that system must take
// its effects with it, which it cannot do if the scene holds the pool.
//
// Advanced by `tickLife` rather than by a tween. A tween per hit is an allocation in the
// hot path, which invariant 6 forbids; Projectile already ages the same way.

export class FloatingText extends Phaser.GameObjects.Text {
  private lifeRemaining = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, '', {
      fontFamily: BALANCE.ui.font.family,
      fontSize: BALANCE.vfx.floatingText.fontSize,
      color: BALANCE.vfx.floatingText.color,
    });

    scene.add.existing(this);

    this.setOrigin(0.5);
    this.setDepth(Depth.FLOATING_TEXT);
    this.despawn();
  }

  public show(x: number, y: number, label: string, color: string): void {
    this.lifeRemaining = BALANCE.vfx.floatingText.lifetimeSeconds;

    this.setText(label);
    this.setColor(color);
    this.setPosition(x, y);
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

    this.y -= BALANCE.vfx.floatingText.riseSpeed * dt;
    this.setAlpha(this.lifeRemaining / BALANCE.vfx.floatingText.lifetimeSeconds);
    return false;
  }

  public despawn(): void {
    this.lifeRemaining = 0;
    this.setActive(false);
    this.setVisible(false);
  }
}
