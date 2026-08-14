import * as Phaser from 'phaser';
import { BALANCE } from './constants/balance';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';

// Scene registration order is the boot order: the first entry starts automatically and
// every other scene waits to be started by name.

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: BALANCE.world.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HUDScene, GameOverScene],
};
