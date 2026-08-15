import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import type { UpgradeDefinition } from '../data/schema';
import { Label, LabelVariant } from './Label';
import { Panel } from './Panel';

// One offer on the level-up screen. The only widget in the kit with a single caller, which
// the Stage 3 brief allows explicitly — a widget with *zero* callers is the thing to avoid.
//
// It exists as a widget rather than as a method on `UpgradeScene` because the card is where
// most of that screen's styling lives, and leaving it in the scene is what made every scene
// in Stage 2 look like a different program.

export class UpgradeCard {
  private readonly panel: Panel;
  private readonly children: readonly Phaser.GameObjects.GameObject[];

  private readonly handleOver = (): void => {
    this.panel.setFillStyle(BALANCE.palette.uiPanelHover, BALANCE.ui.panel.fillAlpha);
  };

  private readonly handleOut = (): void => {
    this.panel.setFillStyle(BALANCE.palette.uiPanel, BALANCE.ui.panel.fillAlpha);
  };

  private readonly handleDown = (): void => {
    this.choose(this.upgrade.id);
  };

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    index: number,
    private readonly upgrade: UpgradeDefinition,
    private readonly choose: (upgradeId: string) => void,
  ) {
    const { card } = BALANCE.ui.upgrade;

    this.panel = new Panel(scene, x, y, card.width, card.height);
    this.panel.setStrokeStyle(card.borderWidth, BALANCE.palette.uiAccent);

    const key = new Label(scene, x, y - card.height / 2 + 24, `[${String(index + 1)}]`, LabelVariant.SMALL)
      .setOrigin(0.5);

    const name = new Label(scene, x, y - 18, upgrade.name, LabelVariant.HEADING).setOrigin(0.5);
    name.setWordWrapWidth(card.width - card.padding * 2);
    name.setAlign('center');

    const description = new Label(scene, x, y + 34, upgrade.description, LabelVariant.ACCENT)
      .setOrigin(0.5);
    description.setWordWrapWidth(card.width - card.padding * 2);
    description.setAlign('center');

    this.children = [key, name, description];

    this.panel.setInteractive({ useHandCursor: true });
    this.panel.on(Phaser.Input.Events.POINTER_OVER, this.handleOver);
    this.panel.on(Phaser.Input.Events.POINTER_OUT, this.handleOut);
    this.panel.on(Phaser.Input.Events.POINTER_DOWN, this.handleDown);

    // Above the panel it sits on, but below nothing else: the whole screen is one layer.
    for (const child of this.children) {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setDepth(Depth.UI);
      }
    }
  }

  public destroy(): void {
    for (const child of this.children) {
      child.destroy();
    }
    this.panel.destroy();
  }
}
