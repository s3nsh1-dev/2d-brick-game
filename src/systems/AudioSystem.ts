import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SoundKey } from '../constants/keys';
import {
  mixLayers,
  normalise,
  renderSequence,
  renderTone,
  toWav,
  type ToneSpec,
} from '../core/audioSynth';
import type { EventBus, GameEvents } from '../core/EventBus';
import { settings } from '../platform/settings';
import type { System } from './System';

// Every sound in the game. Subscribes to the bus and never calls into gameplay — deleting
// this file leaves a fully playable, silent game (invariant 11).
//
// The audio is synthesised at init from the numbers in `balance.ts` and handed to Phaser's
// decoder as WAV buffers, so the repo ships no audio files. The synthesis itself has no
// Phaser in it and lives in `core/audioSynth.ts`, where it is unit tested.
//
// Phaser resumes the AudioContext itself on the first input event, so nothing here unlocks
// audio by hand. `locked` is only read to decide when the music may start.

interface Voice {
  sound: Phaser.Sound.BaseSound | undefined;
  /** Seconds until this sound may play again. Invariant 13. */
  cooldown: number;
}

const SFX_KEYS = [
  SoundKey.SHOOT,
  SoundKey.ENEMY_HIT,
  SoundKey.ENEMY_DEATH,
  SoundKey.PLAYER_DAMAGE,
  SoundKey.PICKUP,
  SoundKey.HEAL,
  SoundKey.LEVEL_UP,
] as const;

export class AudioSystem implements System {
  /** Built once in the constructor, so `play` never allocates. */
  private readonly voices = new Map<string, Voice>();
  private music: Phaser.Sound.BaseSound | undefined;

  /**
   * Undefined unless the device gave us the Web Audio backend. `decodeAudio` exists only
   * there, and it is the only way to get a synthesised buffer into the cache — so on the
   * HTML5 fallback the game is simply silent rather than broken.
   */
  private readonly webAudio: Phaser.Sound.WebAudioSoundManager | undefined;

  private readonly handleWeaponFired = (): void => {
    this.play(SoundKey.SHOOT);
  };

  private readonly handleEnemyDamaged = (): void => {
    this.play(SoundKey.ENEMY_HIT);
  };

  private readonly handleEnemyDied = (): void => {
    this.play(SoundKey.ENEMY_DEATH);
  };

  private readonly handlePlayerDamaged = (): void => {
    this.play(SoundKey.PLAYER_DAMAGE);
  };

  private readonly handleGemCollected = (): void => {
    this.play(SoundKey.PICKUP);
  };

  private readonly handleHealthTaken = (): void => {
    this.play(SoundKey.HEAL);
  };

  private readonly handleLevelUp = (): void => {
    this.play(SoundKey.LEVEL_UP);
  };

  /** Invariant 12: every Sound instance in the game is created here, exactly once. */
  private readonly handleDecoded = (): void => {
    const { sfxVolume, musicVolume } = settings.get();

    for (const key of SFX_KEYS) {
      const voice = this.voices.get(key);
      if (voice === undefined) {
        continue;
      }

      voice.sound = this.scene.sound.add(key, { volume: sfxVolume });
    }

    this.music = this.scene.sound.add(SoundKey.MUSIC, { volume: musicVolume, loop: true });
    this.startMusic();
  };

  private readonly handleUnlocked = (): void => {
    this.music?.play();
  };

  private readonly handleOptionsChanged = (): void => {
    this.applyVolumes();
  };

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.scene.sound.volume = settings.get().masterVolume;

    for (const key of SFX_KEYS) {
      this.voices.set(key, { sound: undefined, cooldown: 0 });
    }

    const manager = this.scene.sound;
    this.webAudio = 'decodeAudio' in manager ? manager : undefined;
    this.decode();

    this.bus.on('weapon:fired', this.handleWeaponFired);
    this.bus.on('enemy:damaged', this.handleEnemyDamaged);
    this.bus.on('enemy:died', this.handleEnemyDied);
    this.bus.on('player:damaged', this.handlePlayerDamaged);
    this.bus.on('gem:collected', this.handleGemCollected);
    this.bus.on('pickup:health', this.handleHealthTaken);
    this.bus.on('level:up', this.handleLevelUp);
    this.bus.on('options:changed', this.handleOptionsChanged);
  }

  public update(dt: number): void {
    for (const voice of this.voices.values()) {
      if (voice.cooldown > 0) {
        voice.cooldown -= dt;
      }
    }
  }

  public destroy(): void {
    this.bus.off('weapon:fired', this.handleWeaponFired);
    this.bus.off('enemy:damaged', this.handleEnemyDamaged);
    this.bus.off('enemy:died', this.handleEnemyDied);
    this.bus.off('player:damaged', this.handlePlayerDamaged);
    this.bus.off('gem:collected', this.handleGemCollected);
    this.bus.off('pickup:health', this.handleHealthTaken);
    this.bus.off('level:up', this.handleLevelUp);
    this.bus.off('options:changed', this.handleOptionsChanged);

    // The SoundManager is global and outlives this scene, so a listener left on it and a
    // sound left playing both survive a restart. Neither is the manager's job to clean up.
    this.webAudio?.off(Phaser.Sound.Events.DECODED_ALL, this.handleDecoded);
    this.scene.sound.off(Phaser.Sound.Events.UNLOCKED, this.handleUnlocked);

    for (const voice of this.voices.values()) {
      voice.sound?.destroy();
      voice.sound = undefined;
    }

    this.music?.destroy();
    this.music = undefined;
  }

  /**
   * Renders the whole sound set and queues it for decoding.
   *
   * Skips anything already in the audio cache: the cache is global, so on the second run of
   * a session every buffer is still there and re-synthesising them would be pure waste.
   */
  private decode(): void {
    if (this.webAudio === undefined) {
      return;
    }

    const { sampleRate, peak, sfx, music } = BALANCE.audio;
    const cache = this.scene.cache.audio;

    const rendered: Phaser.Types.Sound.DecodeAudioConfig[] = [
      { key: SoundKey.SHOOT, data: renderSfx(sfx.shoot, sampleRate, peak, 1) },
      { key: SoundKey.ENEMY_HIT, data: renderSfx(sfx.enemyHit, sampleRate, peak, 2) },
      { key: SoundKey.ENEMY_DEATH, data: renderSfx(sfx.enemyDeath, sampleRate, peak, 3) },
      { key: SoundKey.PLAYER_DAMAGE, data: renderSfx(sfx.playerDamage, sampleRate, peak, 4) },
      { key: SoundKey.PICKUP, data: renderSfx(sfx.pickup, sampleRate, peak, 5) },
      { key: SoundKey.HEAL, data: renderSfx(sfx.heal, sampleRate, peak, 9) },
      { key: SoundKey.LEVEL_UP, data: renderSfx(sfx.levelUp, sampleRate, peak, 8) },
      {
        key: SoundKey.MUSIC,
        data: toWav(
          normalise(
            mixLayers([
              renderSequence(music.bass, sampleRate, 6),
              renderSequence(music.lead, sampleRate, 7),
            ]),
            peak,
          ),
          sampleRate,
        ),
      },
    ];

    const pending = rendered.filter((entry) => !cache.exists(entry.key));
    if (pending.length === 0) {
      this.handleDecoded();
      return;
    }

    this.webAudio.once(Phaser.Sound.Events.DECODED_ALL, this.handleDecoded);
    this.webAudio.decodeAudio(pending);
  }

  /**
   * Pushes the current volumes onto every Sound this system owns.
   *
   * `setVolume` is declared on the concrete sound classes, not on `BaseSound`, which is what
   * `sound.add` returns — hence the `instanceof` rather than a cast. Every sound here is a
   * WebAudio one by construction: `decode` returns early on any other backend, so nothing is
   * ever created to adjust.
   */
  private applyVolumes(): void {
    const { masterVolume, sfxVolume, musicVolume } = settings.get();

    this.scene.sound.volume = masterVolume;

    for (const voice of this.voices.values()) {
      if (voice.sound instanceof Phaser.Sound.WebAudioSound) {
        voice.sound.setVolume(sfxVolume);
      }
    }

    if (this.music instanceof Phaser.Sound.WebAudioSound) {
      this.music.setVolume(musicVolume);
    }
  }

  private startMusic(): void {
    if (this.scene.sound.locked) {
      // Phaser resumes the context itself on the first input; this only waits for it.
      this.scene.sound.once(Phaser.Sound.Events.UNLOCKED, this.handleUnlocked);
      return;
    }

    this.music?.play();
  }

  /** No-op before the buffers decode, and while the same sound is inside its throttle. */
  private play(key: SoundKey): void {
    const voice = this.voices.get(key);
    if (voice?.sound === undefined || voice.cooldown > 0) {
      return;
    }

    voice.cooldown = BALANCE.audio.throttleSeconds;
    voice.sound.play();
  }
}

/** One tone, normalised so nothing clips, packed as a WAV the decoder accepts. */
function renderSfx(
  spec: ToneSpec,
  sampleRate: number,
  peak: number,
  seed: number,
): ArrayBuffer {
  return toWav(normalise(renderTone(spec, sampleRate, seed), peak), sampleRate);
}
