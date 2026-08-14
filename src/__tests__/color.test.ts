import { describe, expect, it } from 'vitest';
import { toCssColor } from '../core/color';

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
