import * as Phaser from 'phaser';
import { BALANCE } from './constants/balance';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { MenuScene } from './scenes/MenuScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { UpgradeScene } from './scenes/UpgradeScene';

// Scene registration order is the boot order: the first entry starts automatically and
// every other scene waits to be started by name.

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: BALANCE.world.backgroundColor,
  scale: {
    // FIT scales the 1280x720 world to the largest size that fits the window, keeping its
    // aspect ratio. The ratio is not negotiable: the arena *is* the viewport — the wall the
    // player reads as the world boundary is the screen edge — so stretching would distort
    // the art and resizing the world would change how far a player can kite, which is
    // gameplay (invariant 16).
    //
    // NO_CENTER because `index.html` centres the canvas with flexbox instead. Both the
    // scale factor and the centring margins are computed from one number — the parent
    // element's measured bounds — so a parent that collapses gets you native size in the
    // top-left corner. The comment in `index.html` is the full account.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: BALANCE.world.width,
    height: BALANCE.world.height,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // Top-down: nothing falls.
      gravity: { x: 0, y: 0 },
      debug: BALANCE.debug.physicsBodies,
    },
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    HUDScene,
    GameOverScene,
    UpgradeScene,
    PauseScene,
    OptionsScene,
  ],
};
