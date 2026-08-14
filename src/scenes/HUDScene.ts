import * as Phaser from 'phaser';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';

// Runs in parallel with GameScene and knows nothing about it. Every number on screen
// arrives as a bus event; there is no reference to Player anywhere in this file.
//
// The display is seeded with the run's starting values in `create` rather than waiting for
// a first event, which removes any dependence on whether this scene finishes booting before
// or after GameScene's first update.

export class HUDScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;

  private readonly handleHealthChanged = (current: number, max: number): void => {
    throw new Error('not implemented');
  };

  private readonly handleWaveStarted = (waveNumber: number): void => {
    throw new Error('not implemented');
  };

  private readonly handleXpChanged = (total: number): void => {
    throw new Error('not implemented');
  };

  public constructor() {
    super(SceneKey.HUD);
  }

  public create(): void {
    throw new Error('not implemented');
  }

  private drawHpBar(current: number, max: number): void {
    throw new Error('not implemented');
  }

  private shutdown(): void {
    eventBus.off('player:health-changed', this.handleHealthChanged);
    eventBus.off('wave:started', this.handleWaveStarted);
    eventBus.off('xp:changed', this.handleXpChanged);
  }
}
