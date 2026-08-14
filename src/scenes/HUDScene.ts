import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';
import { toCssColor } from '../core/color';
import { eventBus } from '../core/EventBus';
import { clamp } from '../core/math';

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
  private levelText!: Phaser.GameObjects.Text;

  private readonly handleHealthChanged = (current: number, max: number): void => {
    this.drawHpBar(current, max);
  };

  private readonly handleWaveStarted = (waveNumber: number): void => {
    this.waveText.setText(`WAVE ${String(waveNumber)}`);
  };

  private readonly handleXpChanged = (total: number): void => {
    this.xpText.setText(`XP ${String(total)}`);
  };

  private readonly handleLevelUp = (level: number): void => {
    this.levelText.setText(`LV ${String(level)}`);
  };

  private readonly shutdown = (): void => {
    eventBus.off('player:health-changed', this.handleHealthChanged);
    eventBus.off('wave:started', this.handleWaveStarted);
    eventBus.off('xp:changed', this.handleXpChanged);
    eventBus.off('level:up', this.handleLevelUp);
  };

  public constructor() {
    super(SceneKey.HUD);
  }

  public create(): void {
    const { margin, hpBar, font } = BALANCE.ui;
    const textStyle = {
      fontFamily: font.family,
      fontSize: font.bodySize,
      color: toCssColor(BALANCE.palette.uiText),
    };

    this.hpBar = this.add.graphics().setDepth(Depth.UI);
    this.waveText = this.add
      .text(margin, margin + hpBar.height + 10, '', textStyle)
      .setDepth(Depth.UI);
    this.xpText = this.add
      .text(BALANCE.world.width - margin, margin, '', textStyle)
      .setOrigin(1, 0)
      .setDepth(Depth.UI);

    this.levelText = this.add
      .text(BALANCE.world.width - margin, margin + 26, '', textStyle)
      .setOrigin(1, 0)
      .setDepth(Depth.UI);

    this.drawHpBar(BALANCE.player.maxHp, BALANCE.player.maxHp);
    this.handleWaveStarted(1);
    this.handleXpChanged(0);
    this.handleLevelUp(1);

    eventBus.on('player:health-changed', this.handleHealthChanged);
    eventBus.on('wave:started', this.handleWaveStarted);
    eventBus.on('xp:changed', this.handleXpChanged);
    eventBus.on('level:up', this.handleLevelUp);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);
  }

  private drawHpBar(current: number, max: number): void {
    const { margin, hpBar } = BALANCE.ui;
    const ratio = max <= 0 ? 0 : clamp(current / max, 0, 1);

    this.hpBar.clear();
    this.hpBar.fillStyle(hpBar.backgroundColor, 1);
    this.hpBar.fillRect(margin, margin, hpBar.width, hpBar.height);
    this.hpBar.fillStyle(hpBar.fillColor, 1);
    this.hpBar.fillRect(margin, margin, hpBar.width * ratio, hpBar.height);
  }
}
