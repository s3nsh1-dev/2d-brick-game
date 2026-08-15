// The stats an upgrade is allowed to touch.
//
// Here rather than beside `Stats` itself because two unrelated folders need the vocabulary:
// `components/Stats.ts` builds a block per id, and `data/schema.ts` validates that every
// entry in `upgrades.json` names one that exists. A shared constant is the only way both get
// it without one importing the other.

export const StatId = {
  MOVE_SPEED: 'moveSpeed',
  WEAPON_DAMAGE: 'weaponDamage',
  /** Seconds between shots, so upgrades to it are negative multipliers. */
  WEAPON_COOLDOWN: 'weaponCooldown',
  WEAPON_RANGE: 'weaponRange',
  MAGNET_RADIUS: 'magnetRadius',
} as const;

export type StatId = (typeof StatId)[keyof typeof StatId];

/** Every id, for the places that need to iterate or validate against the whole set. */
export const STAT_IDS = [
  StatId.MOVE_SPEED,
  StatId.WEAPON_DAMAGE,
  StatId.WEAPON_COOLDOWN,
  StatId.WEAPON_RANGE,
  StatId.MAGNET_RADIUS,
] as const;
