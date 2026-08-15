import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { toCssColor } from '../core/color';

// Every string on screen. Invariant 18: a scene that calls `this.add.text()` directly has
// bypassed the kit, and the next restyle will miss it.
//
// The variants are roles, not sizes. `TITLE` is "the one thing this screen is about", not
// "46px" — which is why changing what a title looks like is an edit here and nowhere else.

export const LabelVariant = {
  TITLE: 'title',
  HEADING: 'heading',
  BODY: 'body',
  /** Secondary information: hints, records, anything the player may ignore. */
  DIM: 'dim',
  /** The one thing on the screen worth acting on. */
  ACCENT: 'accent',
  DANGER: 'danger',
  /** Small print. Upgrade rows, key hints, counters. */
  SMALL: 'small',
} as const;

export type LabelVariant = (typeof LabelVariant)[keyof typeof LabelVariant];

interface VariantStyle {
  readonly size: string;
  readonly color: number;
}

const VARIANTS: Readonly<Record<LabelVariant, VariantStyle>> = {
  [LabelVariant.TITLE]: { size: BALANCE.ui.font.titleSize, color: BALANCE.palette.uiText },
  [LabelVariant.HEADING]: { size: BALANCE.ui.font.headingSize, color: BALANCE.palette.uiText },
  [LabelVariant.BODY]: { size: BALANCE.ui.font.bodySize, color: BALANCE.palette.uiText },
  [LabelVariant.DIM]: { size: BALANCE.ui.font.bodySize, color: BALANCE.palette.uiDim },
  [LabelVariant.ACCENT]: { size: BALANCE.ui.font.bodySize, color: BALANCE.palette.uiAccent },
  [LabelVariant.DANGER]: { size: BALANCE.ui.font.bodySize, color: BALANCE.palette.danger },
  [LabelVariant.SMALL]: { size: BALANCE.ui.font.smallSize, color: BALANCE.palette.uiDim },
};

export class Label extends Phaser.GameObjects.Text {
  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    variant: LabelVariant = LabelVariant.BODY,
  ) {
    const style = VARIANTS[variant];

    super(scene, x, y, text, {
      fontFamily: BALANCE.ui.font.family,
      fontSize: style.size,
      color: toCssColor(style.color),
    });

    scene.add.existing(this);
    this.setDepth(Depth.UI);
  }

  /** Recolours without changing size, for the few labels that carry state. */
  public setVariantColor(color: number): this {
    this.setColor(toCssColor(color));
    return this;
  }
}
