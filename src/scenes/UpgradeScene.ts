import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';
import { toCssColor } from '../core/color';
import { eventBus } from '../core/EventBus';
import { getUpgradeData, type UpgradeDefinition } from '../data/schema';

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

  /** Bound once per card so each keeps its own id, and all of them come off on shutdown. */
  private readonly cards: Phaser.GameObjects.Container[] = [];

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
    const { font } = BALANCE.ui;
    const { card } = BALANCE.ui.upgrade;

    // Dims the frozen run without hiding it, so the menu reads as a layer rather than a
    // scene change.
    this.add
      .rectangle(0, 0, width, height, BALANCE.world.backgroundColor, BALANCE.ui.upgrade.dim)
      .setOrigin(0)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 - card.height / 2 - 80, `LEVEL ${String(this.level)}`, {
        fontFamily: font.family,
        fontSize: font.titleSize,
        color: toCssColor(BALANCE.palette.uiText),
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 - card.height / 2 - 34, 'choose an upgrade', {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: toCssColor(BALANCE.palette.uiDim),
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    const span = card.width + card.gap;
    const left = width / 2 - (span * (this.offers.length - 1)) / 2;

    for (const [index, upgrade] of this.offers.entries()) {
      this.cards.push(this.createCard(left + span * index, height / 2, index, upgrade));
    }

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);
  }

  private createCard(
    x: number,
    y: number,
    index: number,
    upgrade: UpgradeDefinition,
  ): Phaser.GameObjects.Container {
    const { font } = BALANCE.ui;
    const { card } = BALANCE.ui.upgrade;

    const background = this.add
      .rectangle(0, 0, card.width, card.height, card.backgroundColor)
      .setStrokeStyle(card.borderWidth, card.borderColor);

    const number = this.add
      .text(0, -card.height / 2 + 26, `[${String(index + 1)}]`, {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: toCssColor(BALANCE.palette.uiDim),
      })
      .setOrigin(0.5);

    const name = this.add
      .text(0, -14, upgrade.name, {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: toCssColor(BALANCE.palette.uiText),
        align: 'center',
        wordWrap: { width: card.width - 28 },
      })
      .setOrigin(0.5);

    const description = this.add
      .text(0, 30, upgrade.description, {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: toCssColor(BALANCE.palette.uiAccent),
        align: 'center',
        wordWrap: { width: card.width - 28 },
      })
      .setOrigin(0.5);

    const container = this.add
      .container(x, y, [background, number, name, description])
      .setDepth(Depth.UI)
      .setSize(card.width, card.height)
      .setInteractive({ useHandCursor: true });

    container.on(Phaser.Input.Events.POINTER_OVER, () => {
      background.setFillStyle(card.hoverColor);
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      background.setFillStyle(card.backgroundColor);
    });
    container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.choose(upgrade.id);
    });

    return container;
  }

  /**
   * Announces the pick, then hands control back.
   *
   * Resuming is this scene's job rather than GameScene's: GameScene is paused, so it cannot
   * act on the event that would tell it to wake up.
   */
  private choose(upgradeId: string): void {
    eventBus.emit('upgrade:chosen', upgradeId);

    this.scene.resume(SceneKey.GAME);
    this.scene.stop();
  }
}
