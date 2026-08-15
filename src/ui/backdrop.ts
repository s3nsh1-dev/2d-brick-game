import type * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { StaticTextureKey } from '../constants/keys';

// The two things a screen can have behind it.
//
// `addArenaBackdrop` puts the same composited arena texture behind the menu and the run
// summary that the run itself is played on. That is the cheapest possible way to make the
// screens read as one place: they *are* one place.
//
// `addScrim` is for the screens that layer over a paused run — pause and level-up. It dims
// what is underneath without hiding it, so the frozen arena stays legible behind the sheet.

export function addArenaBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, StaticTextureKey.ARENA).setOrigin(0).setDepth(Depth.BACKGROUND);
}

export function addScrim(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const { width, height } = BALANCE.world;

  return scene.add
    .rectangle(0, 0, width, height, BALANCE.palette.backdrop, BALANCE.ui.scrimAlpha)
    .setOrigin(0)
    .setDepth(Depth.SCRIM);
}
