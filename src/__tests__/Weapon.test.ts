import { describe, expect, it } from 'vitest';
import { Weapon } from '../components/Weapon';

// The weapon is a pure fire-rate timer. It stopped holding damage, range and cooldown when
// those became upgradeable: invariant 14 makes them computed values owned by `Stats`, and a
// copy cached in here would be stale the moment a level-up landed. So the cooldown to spend
// arrives with each `tryFire`.

const COOLDOWN = 0.5;

describe('Weapon', () => {
  it('is ready the moment it is created, so a run starts firing immediately', () => {
    expect(new Weapon().isReady).toBe(true);
  });

  it('fires once then goes on cooldown', () => {
    const weapon = new Weapon();

    expect(weapon.tryFire(COOLDOWN)).toBe(true);
    expect(weapon.isReady).toBe(false);
    expect(weapon.tryFire(COOLDOWN)).toBe(false);
  });

  it('becomes ready again after the cooldown elapses', () => {
    const weapon = new Weapon();

    weapon.tryFire(COOLDOWN);
    weapon.update(0.25);
    expect(weapon.isReady).toBe(false);

    weapon.update(0.25);
    expect(weapon.isReady).toBe(true);
    expect(weapon.tryFire(COOLDOWN)).toBe(true);
  });

  it('does not extend the cooldown when a blocked fire is attempted', () => {
    const weapon = new Weapon();

    weapon.tryFire(COOLDOWN);
    weapon.update(0.4);
    weapon.tryFire(COOLDOWN);
    weapon.update(0.1);

    expect(weapon.isReady).toBe(true);
  });

  it('does not accumulate readiness beyond one shot while idle', () => {
    const weapon = new Weapon();

    weapon.tryFire(COOLDOWN);
    weapon.update(10);

    expect(weapon.tryFire(COOLDOWN)).toBe(true);
    expect(weapon.tryFire(COOLDOWN)).toBe(false);
  });

  it('clears the cooldown on reset', () => {
    const weapon = new Weapon();

    weapon.tryFire(COOLDOWN);
    weapon.reset();

    expect(weapon.isReady).toBe(true);
  });

  it('spends whatever cooldown it is handed, so an upgrade takes effect on the next shot', () => {
    const weapon = new Weapon();

    weapon.tryFire(COOLDOWN);
    weapon.update(COOLDOWN);

    // Attack speed improved between the two shots.
    weapon.tryFire(0.2);
    weapon.update(0.2);

    expect(weapon.isReady).toBe(true);
  });
});
