import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { Label, LabelVariant } from './Label';
import { Panel } from './Panel';

// A thing you can click. Hover, press and release states, and a caller that never sees an
// input event.
//
// The states are instant rather than tweened. Every clock in this codebase is a number
// decremented by `dt` inside something a scene can stop — `ARCHITECTURE.md` calls that out
// as the reason pausing is safe rather than delicate — and a tween manager running behind a
// paused game would be the first exception. A UI made of squares reads better sharp anyway.

export class Button {
  private readonly panel: Panel;
  private readonly label: Label;

  private readonly handleOver = (): void => {
    this.panel.setFillStyle(BALANCE.palette.uiPanelHover, BALANCE.ui.panel.fillAlpha);
    this.panel.setStrokeStyle(BALANCE.ui.panel.borderWidth, BALANCE.palette.uiAccent);
  };

  private readonly handleOut = (): void => {
    this.panel.setFillStyle(BALANCE.palette.uiPanel, BALANCE.ui.panel.fillAlpha);
    this.panel.setStrokeStyle(BALANCE.ui.panel.borderWidth, BALANCE.palette.uiPanelEdge);
    this.label.setVariantColor(BALANCE.palette.uiText);
  };

  private readonly handleDown = (): void => {
    this.panel.setFillStyle(BALANCE.palette.uiAccent, BALANCE.ui.panel.fillAlpha);
    this.label.setVariantColor(BALANCE.palette.backdrop);
  };

  private readonly handleUp = (): void => {
    this.handleOver();
    this.label.setVariantColor(BALANCE.palette.uiText);
    this.activate();
  };

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    text: string,
    private readonly activate: () => void,
  ) {
    const height = BALANCE.ui.button.height;

    this.panel = new Panel(scene, x, y, width, height);
    this.label = new Label(scene, x, y, text, LabelVariant.BODY);
    this.label.setOrigin(0.5).setDepth(Depth.UI);

    this.panel.setInteractive({ useHandCursor: true });
    this.panel.on(Phaser.Input.Events.POINTER_OVER, this.handleOver);
    this.panel.on(Phaser.Input.Events.POINTER_OUT, this.handleOut);
    this.panel.on(Phaser.Input.Events.POINTER_DOWN, this.handleDown);
    this.panel.on(Phaser.Input.Events.POINTER_UP, this.handleUp);
  }

  public setText(text: string): void {
    this.label.setText(text);
  }

  /** Listeners come off with the objects they are on, which the scene destroys for us. */
  public destroy(): void {
    this.panel.destroy();
    this.label.destroy();
  }
}
