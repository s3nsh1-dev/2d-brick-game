import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { clamp } from '../core/math';
import { levelForXp, levelProgress, totalXpForLevel, xpToAdvance } from '../core/xpCurve';
import { getEnemyData, getUpgradeData, getWaveData, type UpgradeData } from '../data/schema';
import { Bar } from '../ui/Bar';
import { Label, LabelVariant } from '../ui/Label';
import { UpgradeList } from '../ui/UpgradeList';

// Runs in parallel with GameScene and knows nothing about it. Every number on screen arrives
// as a bus event; there is no reference to Player anywhere in this file (invariant 3).
//
// Two of the numbers are *derived* rather than delivered. The level, and the distance to the
// next one, come from `core/xpCurve` applied to the XP total — the same pure function
// `ProgressionSystem` uses, on the same input, so the two cannot disagree. That is also the
// fix for a real Stage 2 bug: the level was painted only when `level:up` fired, and that
// event stops firing once fewer than three upgrades remain uncapped, so a long run showed a
// level frozen at whatever it had reached when the offers ran out.
//
// The display is seeded with the run's starting values in `create` rather than waiting for a
// first event, which removes any dependence on whether this scene boots before or after
// GameScene's first update.

export class HUDScene extends Phaser.Scene {
  private healthBar!: Bar;
  private xpBar!: Bar;
  private healthText!: Label;
  private xpText!: Label;
  private levelText!: Label;
  private waveText!: Label;
  private upgradeList!: UpgradeList;
  private upgradeHeading!: Label;

  private upgradeCatalogue!: UpgradeData;
  private readonly takenUpgrades: string[] = [];

  private totalWaves = 1;

  /** Where the bar is drawn, chasing `healthRatio`. Both are 0–1. */
  private displayedHealth = 1;
  private healthRatio = 1;
  private flashRemaining = 0;

  private readonly handleHealthChanged = (current: number, max: number): void => {
    const ratio = max <= 0 ? 0 : clamp(current / max, 0, 1);

    if (ratio < this.healthRatio) {
      this.flashRemaining = BALANCE.ui.hud.flashSeconds;
    } else {
      // Only losses drain. A gain jumping straight to its new length reads as a gift rather
      // than as the bar lagging behind the number beside it.
      this.displayedHealth = ratio;
    }

    this.healthRatio = ratio;
    this.healthText.setText(`HP ${String(Math.ceil(current))} / ${String(Math.round(max))}`);
  };

  private readonly handleWaveStarted = (waveNumber: number): void => {
    this.waveText.setText(`WAVE ${String(waveNumber)} / ${String(this.totalWaves)}`);
  };

  private readonly handleXpChanged = (total: number): void => {
    const spec = BALANCE.progression.xp;
    const level = levelForXp(total, spec);
    const intoLevel = total - totalXpForLevel(level, spec);

    this.levelText.setText(`LV ${String(level)}`);
    this.xpText.setText(`${String(intoLevel)} / ${String(xpToAdvance(level, spec))}`);
    this.xpBar.setRatio(levelProgress(total, spec));
  };

  private readonly handleUpgradeChosen = (upgradeId: string): void => {
    this.takenUpgrades.push(upgradeId);
    this.upgradeList.setFromIds(this.takenUpgrades, this.upgradeCatalogue);
    this.upgradeHeading.setVisible(true);
  };

  private readonly shutdown = (): void => {
    eventBus.off('player:health-changed', this.handleHealthChanged);
    eventBus.off('wave:started', this.handleWaveStarted);
    eventBus.off('xp:changed', this.handleXpChanged);
    eventBus.off('upgrade:chosen', this.handleUpgradeChosen);

    // Phaser reuses the scene instance across restarts, so field initialisers do not run
    // again and a surviving entry would put last run's upgrades on this run's HUD.
    this.takenUpgrades.length = 0;
    this.displayedHealth = 1;
    this.healthRatio = 1;
    this.flashRemaining = 0;
  };

  public constructor() {
    super(SceneKey.HUD);
  }

  public create(): void {
    const { margin, hud, upgradeList } = BALANCE.ui;
    const { width, height } = BALANCE.world;

    this.upgradeCatalogue = getUpgradeData(this.registry);
    this.totalWaves = getWaveData(this.registry, getEnemyData(this.registry)).waves.length;

    this.healthBar = new Bar(
      this,
      margin,
      margin,
      hud.barWidth,
      hud.barHeight,
      BALANCE.palette.playerBody,
    );
    this.healthText = new Label(this, margin + hud.barWidth + 12, margin, '', LabelVariant.SMALL);

    const xpTop = margin + hud.rowGap;
    this.xpBar = new Bar(this, margin, xpTop, hud.barWidth, hud.barHeight, BALANCE.palette.gem);
    this.xpText = new Label(this, margin + hud.barWidth + 12, xpTop, '', LabelVariant.SMALL);

    this.levelText = new Label(this, width - margin, margin, '', LabelVariant.BODY).setOrigin(1, 0);
    this.waveText = new Label(this, width - margin, margin + hud.rowGap, '', LabelVariant.DIM)
      .setOrigin(1, 0);

    // Bottom-left, away from the fight, which happens around the player in the middle. It
    // answers "what have I actually picked up?" without asking for a menu.
    const listTop = height - margin - upgradeList.rowHeight * upgradeList.capacity;
    this.upgradeHeading = new Label(this, margin, listTop - 22, 'PICKED UP', LabelVariant.SMALL);
    this.upgradeHeading.setVisible(false);
    this.upgradeList = new UpgradeList(this, margin, listTop, upgradeList.capacity);

    this.handleHealthChanged(BALANCE.player.maxHp, BALANCE.player.maxHp);
    this.handleWaveStarted(1);
    this.handleXpChanged(0);

    eventBus.on('player:health-changed', this.handleHealthChanged);
    eventBus.on('wave:started', this.handleWaveStarted);
    eventBus.on('xp:changed', this.handleXpChanged);
    eventBus.on('upgrade:chosen', this.handleUpgradeChosen);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);
  }

  /**
   * Drains the health bar toward the number, and spends the hit flash.
   *
   * The second and last place in the codebase that converts milliseconds to seconds.
   * Invariant 8 puts the simulation's conversion in `GameScene.update`, and this scene is not
   * downstream of it — it runs in parallel and owns one clock of its own. Inventing an event
   * to carry `dt` across the bus would honour the letter of the rule and defeat its point.
   */
  public override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, BALANCE.time.maxDeltaSeconds);

    if (this.flashRemaining > 0) {
      this.flashRemaining -= dt;
      this.healthBar.setFillColor(
        this.flashRemaining > 0 ? BALANCE.palette.danger : BALANCE.palette.playerBody,
      );
    }

    if (this.displayedHealth > this.healthRatio) {
      this.displayedHealth = Math.max(
        this.healthRatio,
        this.displayedHealth - BALANCE.ui.hud.drainPerSecond * dt,
      );
    }

    this.healthBar.setRatio(this.displayedHealth);
  }
}
