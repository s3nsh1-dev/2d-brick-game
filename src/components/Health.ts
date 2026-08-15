// Hit points and the rules around them. Owned by composition — Player and Enemy each hold
// one; neither inherits from anything of ours. Framework-free, so it is unit tested.

export class Health {
  private currentMax: number;
  private currentHp: number;

  public constructor(max: number) {
    this.currentMax = max;
    this.currentHp = max;
  }

  public get max(): number {
    return this.currentMax;
  }

  public get current(): number {
    return this.currentHp;
  }

  public get isDead(): boolean {
    return this.currentHp <= 0;
  }

  /** Non-positive amounts are ignored. Health floors at zero, it does not go negative. */
  public damage(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.currentHp = Math.max(0, this.currentHp - amount);
  }

  /** Non-positive amounts are ignored. Health caps at `max`. */
  public heal(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.currentHp = Math.min(this.currentMax, this.currentHp + amount);
  }

  /**
   * Refills to full. Takes a new maximum because pooled enemies are re-used across waves
   * that scale their HP — reallocating a Health per spawn would allocate in the hot path.
   */
  public reset(max?: number): void {
    if (max !== undefined) {
      this.currentMax = max;
    }
    this.currentHp = this.currentMax;
  }
}
