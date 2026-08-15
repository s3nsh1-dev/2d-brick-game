// Colour arithmetic and formatting. Portable TypeScript: no Phaser, no DOM.
//
// It exists because of two rules pulling against each other. Invariant 17 says every colour
// comes from `BALANCE.palette`, which stores them as the integers Phaser's tint and fill APIs
// want; Phaser's *text* styles want CSS strings. Storing both forms in the palette would be
// two definitions of one colour, and the second one would drift. Converting at the use site
// keeps a single source and costs a string built once per scene, not per frame.

/** `0x6ce5b1` → `'#6ce5b1'`. Always six digits, so CSS never sees a short form. */
export function toCssColor(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.round(value)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

/**
 * A multiply tint that reads as "hurt" on any base colour.
 *
 * Red is left untouched and green and blue are pulled down as health falls, so a damaged
 * enemy goes darker *and* redder whatever colour it started as. That matters because the
 * three enemy types are red, pink and purple: a plain grey darkening would be nearly
 * invisible on the red one, and a red overlay would be invisible on it too.
 *
 * Multiplicative rather than additive because that is what `setTint` does — it cannot make a
 * sprite brighter than its texture, only darker, so the effect has to live in what it removes.
 *
 * @param ratio Health remaining, 0–1. Values outside the range are clamped.
 * @param floor How much green and blue survive at zero health. 0 would be pure red.
 */
export function damageTint(ratio: number, floor: number): number {
  const health = Math.max(0, Math.min(1, ratio));
  const channel = Math.round(255 * (floor + (1 - floor) * health));

  return (0xff << 16) | (channel << 8) | channel;
}

/**
 * Relative luminance, 0–1, per the WCAG definition.
 *
 * Here so the colourblind palette can be *tested* rather than eyeballed. Separating colours
 * by luminance is what makes them survive every colour deficiency instead of the one they
 * were drawn against, and a number is the only way to assert that in a test.
 */
export function relativeLuminance(color: number): number {
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  const r = channel((color >> 16) & 0xff);
  const g = channel((color >> 8) & 0xff);
  const b = channel(color & 0xff);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
