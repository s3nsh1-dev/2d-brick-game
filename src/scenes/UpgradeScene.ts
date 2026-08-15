import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { getUpgradeData, type UpgradeDefinition } from '../data/schema';
import { addScrim } from '../ui/backdrop';
import { Label, LabelVariant } from '../ui/Label';
import { bloomIn } from '../ui/transitions';
import { UpgradeCard } from '../ui/UpgradeCard';

export interface UpgradeSceneData {
  readonly level: number;
  readonly offers: readonly string[];
}

// The level-up menu. Runs on top of a *paused* GameScene, so the frozen run stays visible
// underneath — `sleep` would stop rendering it and leave this floating over a black screen.
//
// It resolves offer ids against `upgrades.json` in the registry rather than being handed
// definitions, for the same reason HUDScene holds no Player: a scene that reached into the
// run for its content would be a reference across an ownership boundary.

export class UpgradeScene extends Phaser.Scene {
  private level = 1;
  private offers: readonly UpgradeDefinition[] = [];

  private readonly cards: UpgradeCard[] = [];

  private readonly choose = (upgradeId: string): void => {
    eventBus.emit('upgrade:chosen', upgradeId);

    // Resuming is this scene's job rather than GameScene's: GameScene is paused, so it
    // cannot act on the event that would tell it to wake up.
    this.scene.resume(SceneKey.GAME);
    this.scene.stop();
  };

  private readonly handleKey = (event: KeyboardEvent): void => {
    const index = Number.parseInt(event.key, 10) - 1;
    const upgrade = this.offers[index];
    if (upgrade !== undefined) {
      this.choose(upgrade.id);
    }
  };

  private readonly shutdown = (): void => {
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey);
    this.cards.length = 0;
  };

  public constructor() {
    super(SceneKey.UPGRADE);
  }

  public init(data: UpgradeSceneData): void {
    this.level = data.level;

    const catalogue = getUpgradeData(this.registry);
    const byId = new Map(catalogue.upgrades.map((upgrade) => [upgrade.id, upgrade]));

    // Filtered rather than mapped: an id with no definition cannot happen — the same file
    // produced both — but an `undefined` card would be a crash rather than a missing option.
    this.offers = data.offers
      .map((id) => byId.get(id))
      .filter((upgrade): upgrade is UpgradeDefinition => upgrade !== undefined);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { card } = BALANCE.ui.upgrade;

    addScrim(this);

    new Label(this, width / 2, height / 2 - card.height / 2 - 96, `LEVEL ${String(this.level)}`, LabelVariant.TITLE)
      .setOrigin(0.5);
    new Label(this, width / 2, height / 2 - card.height / 2 - 48, 'choose an upgrade', LabelVariant.DIM)
      .setOrigin(0.5);

    const span = card.width + card.gap;
    const left = width / 2 - (span * (this.offers.length - 1)) / 2;

    for (const [index, upgrade] of this.offers.entries()) {
      this.cards.push(
        new UpgradeCard(this, left + span * index, height / 2, index, upgrade, this.choose),
      );
    }

    new Label(this, width / 2, height / 2 + card.height / 2 + 44, 'click a card, or press its number', LabelVariant.SMALL)
      .setOrigin(0.5);

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);

    bloomIn(this);
  }
}
