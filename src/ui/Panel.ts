import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';

// A framed box. Every grouping on every screen is one of these, which is what makes the
// menu, the pause sheet and the game-over summary read as the same product.
//
// Square corners on purpose. Every entity in this game is a square; a rounded UI would be
// the only thing on screen with a curve on it. It is also the cheaper shape — a Rectangle
// batches with every other shape, where a rounded rect needs a Graphics of its own.

export class Panel extends Phaser.GameObjects.Rectangle {
  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number = BALANCE.palette.uiPanel,
  ) {
    super(scene, x, y, width, height, fillColor, BALANCE.ui.panel.fillAlpha);

    scene.add.existing(this);

    this.setStrokeStyle(BALANCE.ui.panel.borderWidth, BALANCE.palette.uiPanelEdge);
    this.setDepth(Depth.PANEL);
  }
}
