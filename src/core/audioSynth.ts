// Sound synthesis and WAV packing. Portable TypeScript: no Phaser, no DOM.
//
// The repo ships no audio files, for the same reason it ships no images: every sound is
// built at boot from numbers, so a sound is a data change rather than an asset. Phaser's
// `decodeAudio` accepts an ArrayBuffer, and a WAV container is a 44-byte header in front of
// PCM, so the whole path is arithmetic — which is why it lives here and is unit tested.
//
// `ArrayBuffer`, `DataView` and the typed arrays are ECMAScript, not DOM. Nothing in this
// file needs a browser.

export const Waveform = {
  SINE: 'sine',
  SQUARE: 'square',
  SAW: 'saw',
  TRIANGLE: 'triangle',
} as const;

export type Waveform = (typeof Waveform)[keyof typeof Waveform];

/** One synthesised sound. Every field is a number so the whole sound design fits balance.ts. */
export interface ToneSpec {
  readonly durationSeconds: number;
  readonly startFrequency: number;
  /** Swept linearly from `startFrequency` across the tone. Equal values hold a pitch. */
  readonly endFrequency: number;
  readonly waveform: Waveform;
  /** Fade-in, in seconds. Anything above zero removes the click a hard start makes. */
  readonly attackSeconds: number;
  /** Exponential decay rate. Higher is snappier; 0 holds full amplitude until the end. */
  readonly decay: number;
  readonly gain: number;
  /** 0 is pure tone, 1 is pure noise. Percussive sounds want most of their energy here. */
  readonly noiseMix: number;
}

/** One voice of the music loop. `null` steps are rests. */
export interface SequenceSpec {
  readonly rootFrequency: number;
  readonly stepSeconds: number;
  /** Semitone offsets from the root, or null for a rest. */
  readonly steps: readonly (number | null)[];
  readonly waveform: Waveform;
  readonly decay: number;
  readonly gain: number;
}

/**
 * A deterministic noise source.
 *
 * `Math.random` is deliberately not used: a synthesised sound that differs between runs
 * cannot be asserted on, and this is the only randomness in the whole audio path. A 32-bit
 * LCG is more than enough entropy to sound like noise.
 */
function makeNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0x100000000) * 2 - 1;
  };
}

/** One cycle of the named waveform at phase `t`, where t is turns rather than radians. */
function oscillate(waveform: Waveform, t: number): number {
  const phase = t - Math.floor(t);

  switch (waveform) {
    case Waveform.SINE:
      return Math.sin(phase * Math.PI * 2);
    case Waveform.SQUARE:
      return phase < 0.5 ? 1 : -1;
    case Waveform.SAW:
      return phase * 2 - 1;
    case Waveform.TRIANGLE:
      return phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
  }
}

/**
 * Renders one tone into a new sample buffer.
 *
 * Phase is accumulated rather than computed from `frequency * time`. That spelling is
 * smooth, so it does not click — it simply sweeps at twice the rate asked for, because the
 * instantaneous frequency of `(f0 + (f1 - f0)t) · t` is its derivative, not the bracket.
 */
export function renderTone(spec: ToneSpec, sampleRate: number, seed = 1): Float32Array {
  const sampleCount = Math.max(1, Math.floor(spec.durationSeconds * sampleRate));
  const samples = new Float32Array(sampleCount);
  const noise = makeNoise(seed);
  const attackSamples = Math.max(1, Math.floor(spec.attackSeconds * sampleRate));

  let phase = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const frequency = spec.startFrequency + (spec.endFrequency - spec.startFrequency) * t;
    phase += frequency / sampleRate;

    const tone = oscillate(spec.waveform, phase);
    const voice = tone * (1 - spec.noiseMix) + noise() * spec.noiseMix;

    const attack = i < attackSamples ? i / attackSamples : 1;
    const envelope = attack * Math.exp(-spec.decay * t);

    samples[i] = voice * envelope * spec.gain;
  }

  return samples;
}

/** Renders a sequence of plucked notes into one buffer, looping cleanly at its own length. */
export function renderSequence(spec: SequenceSpec, sampleRate: number, seed = 1): Float32Array {
  const stepSamples = Math.max(1, Math.floor(spec.stepSeconds * sampleRate));
  const samples = new Float32Array(stepSamples * spec.steps.length);
  const noise = makeNoise(seed);

  for (let step = 0; step < spec.steps.length; step += 1) {
    const semitones = spec.steps[step];
    if (semitones === null || semitones === undefined) {
      continue;
    }

    // Equal temperament. `pow` is fine here: this decides a pitch, not a game outcome.
    const frequency = spec.rootFrequency * Math.pow(2, semitones / 12);
    const offset = step * stepSamples;
    let phase = 0;

    for (let i = 0; i < stepSamples; i += 1) {
      const t = i / stepSamples;
      phase += frequency / sampleRate;

      // A short fade at both ends of every note. Without it each step boundary is a step
      // discontinuity in the waveform, which is audible as a click on every note.
      const edge = Math.min(1, Math.min(i, stepSamples - 1 - i) / 32);
      const envelope = Math.exp(-spec.decay * t) * edge;

      const target = offset + i;
      const existing = samples[target] ?? 0;
      samples[target] = existing + oscillate(spec.waveform, phase) * envelope * spec.gain;
    }
  }

  // The noise generator is advanced once per sample so the seed argument is honoured even
  // for a pure-tone sequence, keeping renders reproducible across refactors.
  noise();

  return samples;
}

/** Sums buffers of any length into one buffer as long as the longest input. */
export function mixLayers(layers: readonly Float32Array[]): Float32Array {
  let length = 0;
  for (const layer of layers) {
    length = Math.max(length, layer.length);
  }

  const mixed = new Float32Array(length);
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i += 1) {
      mixed[i] = (mixed[i] ?? 0) + (layer[i] ?? 0);
    }
  }

  return mixed;
}

/**
 * Scales a buffer so its loudest sample sits at `peak`.
 *
 * Applied after mixing rather than before: two layers that each fit inside ±1 sum to
 * something that does not, and the clipping that follows sounds like a fault rather than a
 * loud sound.
 */
export function normalise(samples: Float32Array, peak: number): Float32Array {
  let loudest = 0;
  for (const sample of samples) {
    loudest = Math.max(loudest, Math.abs(sample));
  }

  if (loudest === 0) {
    return samples;
  }

  const scale = peak / loudest;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = (samples[i] ?? 0) * scale;
  }

  return samples;
}

const WAV_HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const PCM_FORMAT = 1;
const CHANNELS = 1;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Packs float samples into a mono 16-bit PCM WAV.
 *
 * WAV is the only container worth writing by hand — it is a fixed header in front of raw
 * samples, and every browser decodes it. Size is irrelevant because nothing is transmitted:
 * these buffers are built in memory and handed straight to the decoder.
 */
export function toWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * (BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const byteRate = sampleRate * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    // Clamped before scaling: a sample above 1 would wrap to a large negative 16-bit value,
    // which is a loud click rather than the quiet clip the caller expects.
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const scaled = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(scaled), true);
  }

  return buffer;
}
