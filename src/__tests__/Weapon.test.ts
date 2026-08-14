import { describe, expect, it } from 'vitest';
import { Weapon } from '../components/Weapon';

function makeWeapon(): Weapon {
  return new Weapon(12, 0.5, 300);
}

describe('Weapon', () => {
  it('exposes its stats', () => {
    const weapon = makeWeapon();

    expect(weapon.damage).toBe(12);
    expect(weapon.cooldownSeconds).toBe(0.5);
    expect(weapon.range).toBe(300);
  });

  it('is ready the moment it is created, so a run starts firing immediately', () => {
    expect(makeWeapon().isReady).toBe(true);
  });

  it('fires once then goes on cooldown', () => {
    const weapon = makeWeapon();

    expect(weapon.tryFire()).toBe(true);
    expect(weapon.isReady).toBe(false);
    expect(weapon.tryFire()).toBe(false);
  });

  it('becomes ready again after the cooldown elapses', () => {
    const weapon = makeWeapon();

    weapon.tryFire();
    weapon.update(0.25);
    expect(weapon.isReady).toBe(false);

    weapon.update(0.25);
    expect(weapon.isReady).toBe(true);
    expect(weapon.tryFire()).toBe(true);
  });

  it('does not extend the cooldown when a blocked fire is attempted', () => {
    const weapon = makeWeapon();

    weapon.tryFire();
    weapon.update(0.4);
    weapon.tryFire();
    weapon.update(0.1);

    expect(weapon.isReady).toBe(true);
  });

  it('does not accumulate readiness beyond one shot while idle', () => {
    const weapon = makeWeapon();

    weapon.tryFire();
    weapon.update(10);

    expect(weapon.tryFire()).toBe(true);
    expect(weapon.tryFire()).toBe(false);
  });

  it('clears the cooldown on reset', () => {
    const weapon = makeWeapon();

    weapon.tryFire();
    weapon.reset();

    expect(weapon.isReady).toBe(true);
  });
});
