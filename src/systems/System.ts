// The contract every system honours.
//
// `dt` is seconds, always. GameScene converts Phaser's milliseconds exactly once and every
// signature downstream of it is in seconds.
//
// `destroy` releases whatever the system subscribed to or holds. GameScene calls it on
// SHUTDOWN, which is what makes a second restart behave identically to the first.

export interface System {
  update(dt: number): void;
  destroy(): void;
}
