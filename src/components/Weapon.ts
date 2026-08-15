// Fire-rate bookkeeping. Deliberately knows nothing about projectiles, targets or the
// scene: it answers "may I fire this frame?" and CombatSystem does the rest. That is what
// keeps it framework-free and unit testable.
//
// It holds no damage, range or cooldown of its own. Those are upgradeable, and invariant 14
// says an upgradeable number is computed on read from `Stats` — a copy cached here would be
// stale the moment a level-up landed. So the cooldown to spend arrives with `tryFire`.

export class Weapon {
  private cooldownRemaining = 0;

  public get isReady(): boolean {
    return this.cooldownRemaining <= 0;
  }

  public update(dt: number): void {
    // Guarded so an idle weapon does not accumulate unbounded negative cooldown, which
    // would buy free shots the moment a target appears.
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= dt;
    }
  }

  /** Consumes the cooldown and returns true, or returns false and consumes nothing. */
  public tryFire(cooldownSeconds: number): boolean {
    if (this.cooldownRemaining > 0) {
      return false;
    }

    this.cooldownRemaining = cooldownSeconds;
    return true;
  }

  /** Clears the cooldown so a restarted run fires immediately. */
  public reset(): void {
    this.cooldownRemaining = 0;
  }
}
