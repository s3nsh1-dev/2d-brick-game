import { BALANCE } from '../constants/balance';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { ObjectPool } from '../core/ObjectPool';
import type { WaveData } from '../data/schema';
import type { Enemy } from '../entities/Enemy';
import type { System } from './System';

// Walks the wave timeline and puts enemies on the ring just outside the arena.
//
// After the final wave it holds there rather than ending the run: Stage 1 ends on death,
// not on a clear condition.

export class SpawnSystem implements System {
  private waveIndex = 0;
  private waveElapsed = 0;

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
    throw new Error('not implemented');
  }

  public destroy(): void {
    throw new Error('not implemented');
  }
}
