import * as Phaser from 'phaser';
import { z } from 'zod';

// Runtime shape of everything under src/data. Parsed with `.parse()`, never `.safeParse()`:
// malformed content must crash at boot, loudly, not produce an empty wave 7.

/**
 * Stage 1 ships one enemy. The field exists because the wave has to name what it spawns —
 * without it, adding a type in Stage 2 would mean editing SpawnSystem instead of the JSON.
 * It is a bare literal, not a registry: there is nothing yet to register.
 */
export const enemyIdSchema = z.literal('grunt');

export const spawnEntrySchema = z.strictObject({
  enemy: enemyIdSchema,
  count: z.number().int().positive(),
  intervalSeconds: z.number().positive(),
  /** Multipliers against the base stats in constants/balance.ts. */
  hpScale: z.number().positive(),
  speedScale: z.number().positive(),
});

export const waveSchema = z.strictObject({
  durationSeconds: z.number().positive(),
  spawns: z.array(spawnEntrySchema).min(1),
});

export const waveDataSchema = z.strictObject({
  waves: z.array(waveSchema).min(1),
});

export type EnemyId = z.infer<typeof enemyIdSchema>;
export type SpawnEntry = z.infer<typeof spawnEntrySchema>;
export type Wave = z.infer<typeof waveSchema>;
export type WaveData = z.infer<typeof waveDataSchema>;

// The two functions below are the only places Phaser's untyped stores are read.
//
// `Cache.get` and `DataManager.get` are both declared `any`, which would spread through
// every caller and quietly defeat the no-`any` rule. Widening to `unknown` here and running
// the schema costs nothing on a file this size, and buys a typed result with no cast
// anywhere else in the codebase.

/** Reads the loaded JSON out of the loader cache and validates it. Throws if malformed. */
export function readWaveDataFromCache(cache: Phaser.Cache.CacheManager): WaveData {
  throw new Error('not implemented');
}

/** Reads the validated wave data back out of the game registry. */
export function getWaveData(registry: Phaser.Data.DataManager): WaveData {
  throw new Error('not implemented');
}
