import { BALANCE } from '../constants/balance';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { ObjectPool } from '../core/ObjectPool';
import type { EnemyData, EnemyDefinition, SpawnEntry, Wave, WaveData } from '../data/schema';
import type { Enemy } from '../entities/Enemy';
import type { System } from './System';

// Walks the wave timeline and puts enemies on the ring just outside the arena.
//
// It does not end the run. When the timeline is exhausted it says so once, and `CombatSystem`
// decides what a cleared board is worth — it owns the deaths, so it is the only system that
// can tell whether the arena is actually empty.

export class SpawnSystem implements System {
  private waveIndex = 0;
  private waveElapsed = 0;
  private waveAnnounced = false;
  private clearedAnnounced = false;

  /** Per-spawn-entry state for the current wave, sized once to the widest wave. */
  private readonly entryTimers: number[];
  private readonly entrySpawned: number[];

  /** Keyed by id so a spawn entry resolves its type without scanning the definitions. */
  private readonly definitions: ReadonlyMap<string, EnemyDefinition>;

  public constructor(
    private readonly waves: WaveData,
    enemyData: EnemyData,
    private readonly enemies: ObjectPool<Enemy>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    const widestWave = Math.max(...this.waves.waves.map((wave) => wave.spawns.length));
    this.entryTimers = new Array<number>(widestWave).fill(0);
    this.entrySpawned = new Array<number>(widestWave).fill(0);

    this.definitions = new Map(enemyData.enemies.map((enemy) => [enemy.id, enemy]));

    // Inert at its default of 1. See `BALANCE.debug.startWave` for why it exists at all.
    this.waveIndex = Math.min(
      Math.max(0, BALANCE.debug.startWave - 1),
      this.waves.waves.length - 1,
    );
  }

  /** 1-based, for display. */
  public get waveNumber(): number {
    return this.waveIndex + 1;
  }

  public update(dt: number): void {
    const wave = this.waves.waves[this.waveIndex];
    if (wave === undefined) {
      return;
    }

    if (!this.waveAnnounced) {
      this.waveAnnounced = true;
      this.bus.emit('wave:started', this.waveNumber);
    }

    this.waveElapsed += dt;

    for (let i = 0; i < wave.spawns.length; i += 1) {
      const entry = wave.spawns[i];
      if (entry === undefined) {
        continue;
      }

      const alreadySpawned = this.entrySpawned[i] ?? 0;
      if (alreadySpawned >= entry.count) {
        continue;
      }

      const timer = (this.entryTimers[i] ?? 0) + dt;
      if (timer < entry.intervalSeconds) {
        this.entryTimers[i] = timer;
        continue;
      }

      // Carry the remainder rather than zeroing, so spawn cadence does not drift with the
      // frame rate.
      this.entryTimers[i] = timer - entry.intervalSeconds;
      this.entrySpawned[i] = alreadySpawned + 1;
      this.spawn(entry);
    }

    const isFinalWave = this.waveIndex >= this.waves.waves.length - 1;
    if (this.waveElapsed >= wave.durationSeconds && !isFinalWave) {
      this.advanceWave();
      return;
    }

    // The timeline is finished when the last wave has run its full length *and* issued every
    // spawn it owed. Both conditions matter: the duration alone would announce a clear while
    // enemies were still queued, and the counts alone would announce it early on a wave whose
    // spawns finish before its clock does — which every wave's do.
    if (isFinalWave && !this.clearedAnnounced && this.waveElapsed >= wave.durationSeconds) {
      if (this.allSpawnsIssued(wave)) {
        this.clearedAnnounced = true;
        this.bus.emit('waves:cleared');
      }
    }
  }

  /**
   * True once every entry in `wave` has issued its full count.
   *
   * Counted against what was *scheduled*, not what reached the arena: an exhausted enemy pool
   * drops a spawn silently, and waiting for a body that was never built would hang the run
   * one enemy short of a win forever.
   */
  private allSpawnsIssued(wave: Wave): boolean {
    for (let i = 0; i < wave.spawns.length; i += 1) {
      const entry = wave.spawns[i];
      if (entry !== undefined && (this.entrySpawned[i] ?? 0) < entry.count) {
        return false;
      }
    }

    return true;
  }

  public destroy(): void {
    // Nothing to unsubscribe: this system only emits. The enemy pool it writes into is
    // owned and released by GameScene.
    this.waveAnnounced = false;
    this.clearedAnnounced = false;
  }

  private advanceWave(): void {
    this.waveIndex += 1;
    this.waveElapsed = 0;
    this.waveAnnounced = false;
    this.entryTimers.fill(0);
    this.entrySpawned.fill(0);
  }

  private spawn(entry: SpawnEntry): void {
    // Unreachable: the wave schema is a union built from these very ids, so an entry that
    // named an unknown type would have failed at boot. Resolved before acquiring, so an
    // impossible entry cannot leak a pooled enemy.
    const definition = this.definitions.get(entry.enemy);
    if (definition === undefined) {
      return;
    }

    const enemy = this.enemies.acquire();
    if (enemy === undefined) {
      return;
    }

    const { width, height } = BALANCE.world;
    const margin = BALANCE.spawn.ringMargin;
    let x: number;
    let y: number;

    // Pick an edge, then a point along it, so every enemy walks in from off-screen.
    switch (Math.floor(Math.random() * 4)) {
      case 0:
        x = Math.random() * width;
        y = -margin;
        break;
      case 1:
        x = Math.random() * width;
        y = height + margin;
        break;
      case 2:
        x = -margin;
        y = Math.random() * height;
        break;
      default:
        x = width + margin;
        y = Math.random() * height;
        break;
    }

    // base × type × wave. The definition says how a brute differs from a grunt; the wave
    // says how far into the run this one is.
    enemy.spawn(
      x,
      y,
      definition,
      BALANCE.enemy.baseHp * definition.hpScale * entry.hpScale,
      BALANCE.enemy.baseSpeed * definition.speedScale * entry.speedScale,
    );

    // Presentation only. This system decides nothing about the telegraph and does not know
    // whether anything is listening — the same relationship `CombatSystem` has with the
    // damage numbers it announces.
    this.bus.emit('enemy:spawned', x, y);
  }
}
