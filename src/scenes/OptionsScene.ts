import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { eventBus } from '../core/EventBus';
import { clamp } from '../core/math';
import type { Settings } from '../core/settings';
import { persistSettings, settings } from '../platform/settings';
import { addArenaBackdrop, addScrim } from '../ui/backdrop';
import { Button } from '../ui/Button';
import { Label, LabelVariant } from '../ui/Label';
import { Panel } from '../ui/Panel';

export interface OptionsSceneData {
  /** Where BACK goes. The menu and the pause sheet both open this screen. */
  readonly returnTo: SceneKey;
}

/**
 * One editable setting. `step` moves it; `describe` renders it.
 *
 * A table rather than a class per row: every row is the same two widgets with a different
 * function behind them, and five rows do not justify a widget of their own.
 */
interface OptionRow {
  readonly name: string;
  readonly describe: () => string;
  readonly step: (direction: number) => void;
}

// Volumes and accessibility. Reachable from the menu and from a paused run.
//
// This screen is the reason `AGENTS.md` and both earlier stage briefs listed a settings menu
// under "explicitly not planned". That was right when there was nothing to configure; Stage 2
// then shipped three volume fields with no UI able to reach them, which is a half-built
// feature, and a game that cannot be muted is not shippable. The reversal is deliberate and
// recorded — in `docs/STAGE_3_instructions.md` §7 Pass E, and here.

export class OptionsScene extends Phaser.Scene {
  private returnTo: SceneKey = SceneKey.MENU;

  private rows: readonly OptionRow[] = [];
  private readonly controls: Button[] = [];
  private selected = 0;

  private readonly handleKey = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowUp':
        this.moveSelection(-1);
        break;
      case 'ArrowDown':
        this.moveSelection(1);
        break;
      case 'ArrowLeft':
        this.stepSelected(-1);
        break;
      case 'ArrowRight':
      case 'Enter':
      case ' ':
        this.stepSelected(1);
        break;
      case 'Escape':
        this.back();
        break;
      default:
        break;
    }
  };

  private readonly back = (): void => {
    // `start`, not `stop`: this scene replaced whichever screen opened it, and that screen
    // rebuilds itself cleanly. When the caller was the pause sheet, GameScene stayed paused
    // underneath the whole time and is still waiting.
    this.scene.start(this.returnTo);
  };

  private readonly shutdown = (): void => {
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey);
    this.controls.length = 0;
    this.rows = [];
  };

  public constructor() {
    super(SceneKey.OPTIONS);
  }

  public init(data: OptionsSceneData): void {
    this.returnTo = data.returnTo;
    this.selected = 0;
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { options, button } = BALANCE.ui;

    // Over a paused run it dims; from the menu it stands on the arena, like every other
    // full screen. Same scene, two contexts, one line to tell them apart.
    if (this.returnTo === SceneKey.PAUSE) {
      addScrim(this);
    } else {
      addArenaBackdrop(this);
    }

    this.rows = this.buildRows();

    const top = height / 2 - (options.rowHeight * this.rows.length) / 2 - 30;

    new Panel(this, width / 2, height / 2 - 26, 720, options.rowHeight * this.rows.length + 230);
    new Label(this, width / 2, top - 74, 'OPTIONS', LabelVariant.TITLE).setOrigin(0.5);

    for (const [index, row] of this.rows.entries()) {
      const y = top + options.rowHeight * index;

      new Label(this, options.labelX, y, row.name, LabelVariant.BODY).setOrigin(0, 0.5);
      this.controls.push(
        new Button(this, options.controlX, y, options.controlWidth, row.describe(), () => {
          this.select(index);
          this.stepSelected(1);
        }),
      );
    }

    const bottom = top + options.rowHeight * this.rows.length;
    new Button(this, width / 2, bottom + 34, button.width, 'BACK', this.back);
    new Label(
      this,
      width / 2,
      bottom + 76,
      'arrows to change  ·  escape to go back',
      LabelVariant.SMALL,
    ).setOrigin(0.5);

    this.select(0);

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown);
  }

  private buildRows(): readonly OptionRow[] {
    return [
      this.volumeRow('MASTER VOLUME', 'masterVolume'),
      this.volumeRow('SOUND EFFECTS', 'sfxVolume'),
      this.volumeRow('MUSIC', 'musicVolume'),
      this.toggleRow('REDUCED MOTION', 'reducedMotion'),
      this.toggleRow('COLOURBLIND PALETTE', 'colourblind'),
    ];
  }

  private volumeRow(name: string, key: 'masterVolume' | 'sfxVolume' | 'musicVolume'): OptionRow {
    return {
      name,
      describe: () => meter(settings.get()[key]),
      step: (direction) => {
        const next = clamp(
          settings.get()[key] + direction * BALANCE.ui.options.volumeStep,
          0,
          1,
        );

        // Rounded to the step, or repeated float additions drift to 0.7000000000000001 and
        // the meter stops landing on whole notches.
        this.commit(key, Math.round(next / BALANCE.ui.options.volumeStep) * BALANCE.ui.options.volumeStep);
      },
    };
  }

  private toggleRow(name: string, key: 'reducedMotion' | 'colourblind'): OptionRow {
    return {
      name,
      describe: () => (settings.get()[key] ? 'ON' : 'OFF'),
      // Direction is ignored: a boolean has one other value whichever way you push it.
      step: () => {
        this.commit(key, !settings.get()[key]);
      },
    };
  }

  /**
   * Writes one change, saves it, and tells the running game.
   *
   * The bus event rather than a poll: this screen can be open over a *paused* run, whose
   * systems are not ticking, and a volume change has to be audible the moment it is made.
   */
  private commit<K extends keyof Settings>(key: K, value: Settings[K]): void {
    settings.set(key, value);
    persistSettings();
    eventBus.emit('options:changed');

    this.controls[this.selected]?.setText(this.rows[this.selected]?.describe() ?? '');
  }

  private moveSelection(direction: number): void {
    this.select((this.selected + direction + this.rows.length) % this.rows.length);
  }

  private select(index: number): void {
    this.selected = index;

    for (const [i, control] of this.controls.entries()) {
      control.setHighlighted(i === index);
    }
  }

  private stepSelected(direction: number): void {
    this.rows[this.selected]?.step(direction);
  }
}

/** A volume as ten notches, because a bar reads faster than "0.7" and needs no widget. */
function meter(value: number): string {
  const filled = Math.round(value * 10);
  return `${'|'.repeat(filled)}${'.'.repeat(10 - filled)}  ${String(Math.round(value * 100))}%`;
}
