import type * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import type { UpgradeData } from '../data/schema';
import { Label, LabelVariant } from './Label';

// What the run has picked up so far, as `Sharper Rounds ×3` rows.
//
// Three screens show it — the live HUD, the pause sheet and the run summary — because "what
// have I actually got?" is a question a player asks during a run, not only after it. Nothing
// in the game ever removes an upgrade, so this is a tally rather than a history.
//
// The rows are built once and hidden, not created per update: this list is rebuilt on every
// upgrade taken, and allocating six Text objects each time would be six canvases a level.

export class UpgradeList {
  private readonly rows: readonly Label[];

  public constructor(scene: Phaser.Scene, x: number, y: number, capacity: number) {
    const rows: Label[] = [];
    for (let index = 0; index < capacity; index += 1) {
      const row = new Label(scene, x, y + index * BALANCE.ui.upgradeList.rowHeight, '', LabelVariant.SMALL);
      row.setVisible(false);
      rows.push(row);
    }

    this.rows = rows;
  }

  /**
   * Tallies ids into named rows, in the order they were first taken.
   *
   * Insertion order rather than alphabetical: the list then reads as the shape of this
   * particular run, which is the only reason to show it rather than a stat block.
   */
  public setFromIds(ids: readonly string[], catalogue: UpgradeData): void {
    const counts = new Map<string, number>();
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const names = new Map(catalogue.upgrades.map((upgrade) => [upgrade.id, upgrade.name]));

    let index = 0;
    for (const [id, count] of counts) {
      const row = this.rows[index];
      if (row === undefined) {
        break;
      }

      const name = names.get(id) ?? id;
      row.setText(count > 1 ? `${name} ×${String(count)}` : name);
      row.setVisible(true);
      index += 1;
    }

    for (let hidden = index; hidden < this.rows.length; hidden += 1) {
      this.rows[hidden]?.setVisible(false);
    }
  }

  /** True when the run has taken nothing, so a caller can show a placeholder instead. */
  public get isEmpty(): boolean {
    return this.rows[0]?.visible !== true;
  }

  public setOrigin(originX: number): void {
    for (const row of this.rows) {
      row.setOrigin(originX, 0);
    }
  }
}
