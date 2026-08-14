// Fire-rate bookkeeping. Deliberately knows nothing about projectiles, targets or the
// scene: it answers "may I fire this frame?" and CombatSystem does the rest. That is what
// keeps it framework-free and unit testable.

export class Weapon {
  private cooldownRemaining = 0;

  public constructor(
    public readonly damage: number,
    public readonly cooldownSeconds: number,
    public readonly range: number,
  ) {}

  public get isReady(): boolean {
    throw new Error('not implemented');
  }

  public update(dt: number): void {
    throw new Error('not implemented');
  }

  /** Consumes the cooldown and returns true, or returns false and consumes nothing. */
  public tryFire(): boolean {
    throw new Error('not implemented');
  }

  /** Clears the cooldown so a restarted run fires immediately. */
  public reset(): void {
    throw new Error('not implemented');
  }
}
