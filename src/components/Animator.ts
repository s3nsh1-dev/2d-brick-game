import type * as Phaser from 'phaser';
import { AnimState, animKey } from '../core/animKeys';

// Animation playback for one sprite. Owns which loop the sprite should be sitting in, so
// callers can say "walk" every frame without restarting the animation every frame.
//
// A one-shot returns to the standing loop through Phaser's own `chain`, not through an
// `animationcomplete` listener. A pooled sprite released mid-animation would leave a `once`
// listener that never fires, and that is a leak across a restart — exactly the class of bug
// invariant 9 exists to prevent.

export class Animator {
  /** Undefined until the first `play`, so a pooled sprite reused as another actor replays. */
  private looping: AnimState | undefined;

  public constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    private actorId: string,
  ) {}

  /**
   * Points this animator at another actor's animations. Pooled enemies are reused across
   * types, and the frames a brute plays are not the frames a swarmer plays.
   */
  public retarget(actorId: string): void {
    this.actorId = actorId;
    this.looping = undefined;
  }

  /** Sets the standing loop. Cheap to call every frame; repeats are ignored. */
  public play(state: AnimState): void {
    if (state === this.looping) {
      return;
    }

    this.looping = state;
    this.sprite.play(animKey(this.actorId, state), true);
  }

  /**
   * Plays a state once and returns to the standing loop.
   *
   * Does nothing before a loop is established: a one-shot with nothing to chain back to
   * would leave the sprite frozen on its last frame.
   */
  public playOnce(state: AnimState): void {
    if (this.looping === undefined) {
      return;
    }

    this.sprite.play(animKey(this.actorId, state));
    this.sprite.chain(animKey(this.actorId, this.looping));
  }

  /** Drops the standing loop so the next `play` reissues it. Called on despawn. */
  public reset(): void {
    this.looping = undefined;
  }
}
