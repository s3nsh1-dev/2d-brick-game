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
