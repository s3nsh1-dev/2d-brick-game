import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { clamp } from '../core/math';

// A value bar: health, experience, anything with a floor and a ceiling.
//
// Two Rectangles rather than a Graphics redrawn per frame. Stage 2's HP bar cleared and
// refilled a Graphics on every health change, which rebuilds its geometry; scaling a
// fixed-size rectangle is a transform and touches no geometry at all. That matters here
// because the health bar now moves on every frame it is draining rather than only on a hit.
//
// Not a GameObject itself. It owns two of them and is positioned once, at construction —
// wrapping that in a Container would buy a transform nothing in this game needs.

export class Bar {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    height: number,
    fillColor: number,
  ) {
    this.background = scene.add
      .rectangle(x, y, width, height, BALANCE.palette.uiPanelEdge)
      .setOrigin(0, 0)
      .setDepth(Depth.UI);

    this.fill = scene.add
      .rectangle(x, y, width, height, fillColor)
      .setOrigin(0, 0)
      .setDepth(Depth.UI);
  }

  /** Clamped, because a stat driven past its own maximum should not draw past the frame. */
  public setRatio(ratio: number): void {
    this.fill.setScale(clamp(ratio, 0, 1), 1);
  }

  public setFillColor(color: number): void {
    this.fill.setFillStyle(color);
  }

  /** The bar's own width, so a caller can place a label at its end without repeating it. */
  public get displayWidth(): number {
    return this.width;
  }

  public destroy(): void {
    this.background.destroy();
    this.fill.destroy();
  }
}
