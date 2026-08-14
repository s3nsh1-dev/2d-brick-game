import { BALANCE } from '../constants/balance';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { ObjectPool } from '../core/ObjectPool';
import type { SpawnEntry, WaveData } from '../data/schema';
import type { Enemy } from '../entities/Enemy';
import type { System } from './System';

// Walks the wave timeline and puts enemies on the ring just outside the arena.
//
// After the final wave it holds there rather than ending the run: Stage 1 ends on death,
// not on a clear condition.

export class SpawnSystem implements System {
  private waveIndex = 0;
  private waveElapsed = 0;
  private waveAnnounced = false;

  /** Per-spawn-entry state for the current wave, sized once to the widest wave. */
  private readonly entryTimers: number[];
  private readonly entrySpawned: number[];

  public constructor(
    private readonly waves: WaveData,
    private readonly enemies: ObjectPool<Enemy>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    const widestWave = Math.max(...this.waves.waves.map((wave) => wave.spawns.length));
    this.entryTimers = new Array<number>(widestWave).fill(0);
    this.entrySpawned = new Array<number>(widestWave).fill(0);
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
    }
  }

  public destroy(): void {
    // Nothing to unsubscribe: this system only emits. The enemy pool it writes into is
    // owned and released by GameScene.
    this.waveAnnounced = false;
  }

  private advanceWave(): void {
    this.waveIndex += 1;
    this.waveElapsed = 0;
    this.waveAnnounced = false;
    this.entryTimers.fill(0);
    this.entrySpawned.fill(0);
  }

  private spawn(entry: SpawnEntry): void {
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

    enemy.spawn(
      x,
      y,
      BALANCE.enemy.baseHp * entry.hpScale,
      BALANCE.enemy.baseSpeed * entry.speedScale,
    );
  }
}
