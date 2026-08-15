import { describe, expect, it } from 'vitest';
import { damageTint, toCssColor } from '../core/color';

describe('toCssColor', () => {
  it('formats a colour as six hex digits with a leading hash', () => {
    expect(toCssColor(0x6ce5b1)).toBe('#6ce5b1');
  });

  it('pads colours whose leading channels are dark', () => {
    expect(toCssColor(0x000000)).toBe('#000000');
    expect(toCssColor(0x0000ff)).toBe('#0000ff');
    expect(toCssColor(0x00ff00)).toBe('#00ff00');
  });

  it('formats the brightest colour', () => {
    expect(toCssColor(0xffffff)).toBe('#ffffff');
  });

  it('clamps values outside the 24-bit range rather than emitting invalid CSS', () => {
    expect(toCssColor(-1)).toBe('#000000');
    expect(toCssColor(0x1000000)).toBe('#ffffff');
  });

  it('rounds rather than truncating, so an averaged colour still formats', () => {
    expect(toCssColor(0.6)).toBe('#000001');
  });
});

describe('damageTint', () => {
  it('leaves a sprite untouched at full health', () => {
    expect(damageTint(1, 0.35)).toBe(0xffffff);
  });

  it('keeps red at full strength however hurt the target is', () => {
    for (const ratio of [1, 0.75, 0.5, 0.25, 0]) {
      expect((damageTint(ratio, 0.35) >> 16) & 0xff).toBe(0xff);
    }
  });

  it('pulls green and blue down to the floor at zero health', () => {
    const tint = damageTint(0, 0.4);
    expect((tint >> 8) & 0xff).toBe(102);
    expect(tint & 0xff).toBe(102);
  });

  it('moves green and blue together, so the tint never shifts hue sideways', () => {
    const tint = damageTint(0.5, 0.2);
    expect((tint >> 8) & 0xff).toBe(tint & 0xff);
  });

  it('darkens monotonically as health falls', () => {
    const full = damageTint(1, 0.3) & 0xff;
    const half = damageTint(0.5, 0.3) & 0xff;
    const empty = damageTint(0, 0.3) & 0xff;

    expect(full).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(empty);
  });

  it('clamps a ratio outside 0–1 rather than producing an out-of-range channel', () => {
    expect(damageTint(2, 0.35)).toBe(0xffffff);
    expect(damageTint(-1, 0.35)).toBe(damageTint(0, 0.35));
  });

  it('is a pure floor of 1 when nothing should ever darken', () => {
    expect(damageTint(0, 1)).toBe(0xffffff);
  });
});
