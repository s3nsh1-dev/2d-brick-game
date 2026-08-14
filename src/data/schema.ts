import * as Phaser from 'phaser';
import { z } from 'zod';
import { DataKey } from '../constants/keys';

// Runtime shape of everything under src/data. Parsed with `.parse()`, never `.safeParse()`:
// malformed content must crash at boot, loudly, not produce an empty wave 7.

/**
 * One enemy type. `id` doubles as the key of the texture baked for it in `PreloadScene`,
 * which is what keeps `Enemy.spawn` from having to build a key string per spawn.
 *
 * The two scales are multipliers against `BALANCE.enemy`, not absolute stats: `balance.ts`
 * owns what an enemy costs, this file owns how the types differ from one another, and
 * `waves.json` owns how both escalate. A stat is `base × definition × wave`.
 */
export const enemyDefinitionSchema = z.strictObject({
  id: z.string().min(1),
  size: z.number().int().positive(),
  // A hex string rather than the decimal integer Phaser wants, because content is read by
  // people. `PreloadScene` converts it once, at bake time.
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hpScale: z.number().positive(),
  speedScale: z.number().positive(),
});

export const enemyDataSchema = z.strictObject({
  // A tuple with a rest element, not `array().nonempty()`. Both reject an empty list at
  // runtime, but only this spelling infers `[T, ...T[]]`, which is what lets a caller read
  // the first definition without a guard against a case the schema has already excluded.
  enemies: z.tuple([enemyDefinitionSchema], enemyDefinitionSchema),
});

export type EnemyDefinition = z.infer<typeof enemyDefinitionSchema>;
export type EnemyData = z.infer<typeof enemyDataSchema>;

/**
 * The wave schema is a factory because the set of legal enemy ids is content, not a
 * constant: it is a union over whatever `enemies.json` defines. A wave naming an enemy that
 * does not exist then fails at boot, naming the exact path and every id that would have
 * worked — which is the whole reason the ids are validated rather than typed as `string`.
 */
export function makeWaveDataSchema(enemies: EnemyData) {
  const enemyIdSchema = z.enum(enemies.enemies.map((enemy) => enemy.id));

  const spawnEntrySchema = z.strictObject({
    enemy: enemyIdSchema,
    count: z.number().int().positive(),
    intervalSeconds: z.number().positive(),
    /** Multipliers against the base stats in constants/balance.ts. */
    hpScale: z.number().positive(),
    speedScale: z.number().positive(),
  });

  const waveSchema = z.strictObject({
    durationSeconds: z.number().positive(),
    spawns: z.array(spawnEntrySchema).min(1),
  });

  return z.strictObject({
    waves: z.array(waveSchema).min(1),
  });
}

export type WaveData = z.infer<ReturnType<typeof makeWaveDataSchema>>;
export type Wave = WaveData['waves'][number];
export type SpawnEntry = Wave['spawns'][number];

// The functions below are the only places Phaser's untyped stores are read.
//
// `Cache.get` and `DataManager.get` are both declared `any`, which would spread through
// every caller and quietly defeat the no-`any` rule. Widening to `unknown` here and running
// the schema costs nothing on files this size, and buys a typed result with no cast
// anywhere else in the codebase.

/** Reads the loaded JSON out of the loader cache and validates it. Throws if malformed. */
export function readEnemyDataFromCache(cache: Phaser.Cache.CacheManager): EnemyData {
  return enemyDataSchema.parse(cache.json.get(DataKey.ENEMIES) as unknown);
}

/** As above, for waves. Needs the enemy data: the legal ids come from it. */
export function readWaveDataFromCache(
  cache: Phaser.Cache.CacheManager,
  enemies: EnemyData,
): WaveData {
  return makeWaveDataSchema(enemies).parse(cache.json.get(DataKey.WAVES) as unknown);
}

/** Reads the validated enemy definitions back out of the game registry. */
export function getEnemyData(registry: Phaser.Data.DataManager): EnemyData {
  return enemyDataSchema.parse(registry.get(DataKey.ENEMIES) as unknown);
}

/** Reads the validated wave data back out of the game registry. */
export function getWaveData(registry: Phaser.Data.DataManager, enemies: EnemyData): WaveData {
  return makeWaveDataSchema(enemies).parse(registry.get(DataKey.WAVES) as unknown);
}
