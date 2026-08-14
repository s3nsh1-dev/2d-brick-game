import { describe, expect, it } from 'vitest';
import { Health } from '../components/Health';

describe('Health', () => {
  it('starts full', () => {
    const health = new Health(100);

    expect(health.max).toBe(100);
    expect(health.current).toBe(100);
    expect(health.isDead).toBe(false);
  });

  it('subtracts damage', () => {
    const health = new Health(100);

    health.damage(30);

    expect(health.current).toBe(70);
    expect(health.isDead).toBe(false);
  });

  it('floors at zero rather than going negative', () => {
    const health = new Health(20);

    health.damage(50);

    expect(health.current).toBe(0);
    expect(health.isDead).toBe(true);
  });

  it('is dead at exactly zero', () => {
    const health = new Health(20);

    health.damage(20);

    expect(health.isDead).toBe(true);
  });

  it('ignores non-positive damage', () => {
    const health = new Health(100);

    health.damage(0);
    health.damage(-25);

    expect(health.current).toBe(100);
  });

  it('caps healing at max', () => {
    const health = new Health(100);

    health.damage(10);
    health.heal(999);

    expect(health.current).toBe(100);
  });

  it('ignores non-positive healing', () => {
    const health = new Health(100);

    health.damage(40);
    health.heal(-10);

    expect(health.current).toBe(60);
  });

  it('refills on reset, keeping the existing max', () => {
    const health = new Health(50);

    health.damage(50);
    health.reset();

    expect(health.max).toBe(50);
    expect(health.current).toBe(50);
    expect(health.isDead).toBe(false);
  });

  it('takes a new max on reset, so a pooled enemy can be rescaled without reallocating', () => {
    const health = new Health(20);

    health.damage(20);
    health.reset(35);

    expect(health.max).toBe(35);
    expect(health.current).toBe(35);
    expect(health.isDead).toBe(false);
  });
});
