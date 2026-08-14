import { describe, expect, it } from 'vitest';
import {
  mixLayers,
  normalise,
  renderSequence,
  renderTone,
  toWav,
  Waveform,
  type SequenceSpec,
  type ToneSpec,
} from '../core/audioSynth';

// The whole audio path is arithmetic over buffers, which is why it lives in core/ and is
// tested here with no DOM and no Phaser. `vitest.config.ts` is `environment: 'node'`.

const SAMPLE_RATE = 8000;

function tone(overrides: Partial<ToneSpec> = {}): ToneSpec {
  return {
    durationSeconds: 0.1,
    startFrequency: 440,
    endFrequency: 440,
    waveform: Waveform.SINE,
    attackSeconds: 0.001,
    decay: 0,
    gain: 1,
    noiseMix: 0,
    ...overrides,
  };
}

function peakOf(samples: Float32Array): number {
  let loudest = 0;
  for (const sample of samples) {
    loudest = Math.max(loudest, Math.abs(sample));
  }
  return loudest;
}

/** Two per cycle, so this is a frequency measurement that needs no FFT. */
function zeroCrossings(samples: Float32Array): number {
  let count = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const previous = samples[i - 1] ?? 0;
    const current = samples[i] ?? 0;
    if (previous < 0 !== current < 0) {
      count += 1;
    }
  }
  return count;
}

describe('renderTone', () => {
  it('renders one sample per sample-rate tick of its duration', () => {
    expect(renderTone(tone({ durationSeconds: 0.25 }), SAMPLE_RATE)).toHaveLength(2000);
  });

  it('never renders an empty buffer, however short the tone', () => {
    expect(renderTone(tone({ durationSeconds: 0 }), SAMPLE_RATE).length).toBeGreaterThan(0);
  });

  it('stays inside the gain it was given', () => {
    expect(peakOf(renderTone(tone({ gain: 0.5 }), SAMPLE_RATE))).toBeLessThanOrEqual(0.5);
  });

  it('opens with an attack rather than a click', () => {
    const samples = renderTone(tone({ attackSeconds: 0.02 }), SAMPLE_RATE);

    expect(Math.abs(samples[0] ?? 1)).toBeLessThan(0.05);
  });

  it('decays, so the end is quieter than the start', () => {
    const samples = renderTone(tone({ decay: 20 }), SAMPLE_RATE);
    const head = peakOf(samples.slice(0, 100));
    const tail = peakOf(samples.slice(-100));

    expect(tail).toBeLessThan(head);
  });

  it('is deterministic: the same seed renders the same buffer', () => {
    const spec = tone({ noiseMix: 1 });

    expect(Array.from(renderTone(spec, SAMPLE_RATE, 7))).toEqual(
      Array.from(renderTone(spec, SAMPLE_RATE, 7)),
    );
  });

  it('differs by seed, so noise is not a fixed pattern', () => {
    const spec = tone({ noiseMix: 1 });

    expect(Array.from(renderTone(spec, SAMPLE_RATE, 1))).not.toEqual(
      Array.from(renderTone(spec, SAMPLE_RATE, 2)),
    );
  });

  it('holds the pitch it was given when the sweep is flat', () => {
    const samples = renderTone(
      tone({ durationSeconds: 0.5, startFrequency: 400, endFrequency: 400, decay: 0 }),
      SAMPLE_RATE,
    );

    // Two zero crossings per cycle: 400Hz for half a second is ~400 of them.
    expect(zeroCrossings(samples)).toBeGreaterThan(395);
    expect(zeroCrossings(samples)).toBeLessThan(405);
  });

  it('ends a sweep on the frequency it was asked to end on', () => {
    const samples = renderTone(
      tone({ durationSeconds: 0.5, startFrequency: 200, endFrequency: 800, decay: 0 }),
      SAMPLE_RATE,
    );

    // The last tenth of a second covers 680Hz→800Hz, averaging 740, so ~148 crossings.
    //
    // Phase is accumulated rather than recomputed from `frequency * time`. The naive
    // spelling is still continuous, so a smoothness check would not catch it — but it
    // sweeps at twice the rate asked for and would land near 280 here, which this does.
    const tail = zeroCrossings(samples.slice(-SAMPLE_RATE / 10));

    expect(tail).toBeGreaterThan(140);
    expect(tail).toBeLessThan(156);
  });

  it('renders every waveform inside unit range', () => {
    for (const waveform of Object.values(Waveform)) {
      expect(peakOf(renderTone(tone({ waveform }), SAMPLE_RATE))).toBeLessThanOrEqual(1);
    }
  });
});

describe('renderSequence', () => {
  function sequence(overrides: Partial<SequenceSpec> = {}): SequenceSpec {
    return {
      rootFrequency: 110,
      stepSeconds: 0.1,
      steps: [0, 12, null, 7],
      waveform: Waveform.TRIANGLE,
      decay: 4,
      gain: 0.5,
      ...overrides,
    };
  }

  it('is exactly as long as its steps, so it loops seamlessly', () => {
    expect(renderSequence(sequence(), SAMPLE_RATE)).toHaveLength(4 * 800);
  });

  it('leaves rests silent', () => {
    const samples = renderSequence(sequence(), SAMPLE_RATE);

    expect(peakOf(samples.slice(2 * 800, 3 * 800))).toBe(0);
  });

  it('sounds notes where a step names one', () => {
    const samples = renderSequence(sequence(), SAMPLE_RATE);

    expect(peakOf(samples.slice(0, 800))).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(Array.from(renderSequence(sequence(), SAMPLE_RATE, 3))).toEqual(
      Array.from(renderSequence(sequence(), SAMPLE_RATE, 3)),
    );
  });
});

describe('mixLayers', () => {
  it('is as long as its longest input', () => {
    expect(mixLayers([new Float32Array(10), new Float32Array(25)])).toHaveLength(25);
  });

  it('sums overlapping samples', () => {
    const a = Float32Array.from([0.1, 0.2]);
    const b = Float32Array.from([0.3, 0.4, 0.5]);

    expect(Array.from(mixLayers([a, b]))).toEqual([
      expect.closeTo(0.4, 5),
      expect.closeTo(0.6, 5),
      expect.closeTo(0.5, 5),
    ]);
  });

  it('mixes nothing into an empty buffer', () => {
    expect(mixLayers([])).toHaveLength(0);
  });
});

describe('normalise', () => {
  it('scales the loudest sample to the peak', () => {
    const samples = normalise(Float32Array.from([0.1, -0.2, 0.05]), 0.9);

    expect(peakOf(samples)).toBeCloseTo(0.9, 5);
  });

  it('scales quiet buffers up as well as loud ones down', () => {
    expect(peakOf(normalise(Float32Array.from([0.01]), 0.5))).toBeCloseTo(0.5, 5);
  });

  it('preserves relative levels', () => {
    const samples = normalise(Float32Array.from([0.2, 0.1]), 1);

    expect((samples[1] ?? 0) / (samples[0] ?? 1)).toBeCloseTo(0.5, 5);
  });

  it('leaves silence alone rather than dividing by zero', () => {
    expect(Array.from(normalise(new Float32Array(4), 0.9))).toEqual([0, 0, 0, 0]);
  });
});

describe('toWav', () => {
  const HEADER_BYTES = 44;

  it('writes a 44-byte header in front of 16-bit samples', () => {
    expect(toWav(new Float32Array(100), SAMPLE_RATE).byteLength).toBe(HEADER_BYTES + 200);
  });

  it('is a RIFF/WAVE container with a fmt and a data chunk', () => {
    const view = new DataView(toWav(new Float32Array(8), SAMPLE_RATE));
    const ascii = (offset: number): string =>
      String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );

    expect(ascii(0)).toBe('RIFF');
    expect(ascii(8)).toBe('WAVE');
    expect(ascii(12)).toBe('fmt ');
    expect(ascii(36)).toBe('data');
  });

  it('declares mono 16-bit PCM at the sample rate it was given', () => {
    const view = new DataView(toWav(new Float32Array(8), 22050));

    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('declares chunk sizes that match the payload', () => {
    const view = new DataView(toWav(new Float32Array(50), SAMPLE_RATE));

    expect(view.getUint32(4, true)).toBe(HEADER_BYTES - 8 + 100);
    expect(view.getUint32(40, true)).toBe(100);
  });

  it('clamps rather than wrapping, so a hot sample is not a loud click', () => {
    const view = new DataView(toWav(Float32Array.from([2, -2]), SAMPLE_RATE));

    expect(view.getInt16(HEADER_BYTES, true)).toBe(0x7fff);
    expect(view.getInt16(HEADER_BYTES + 2, true)).toBe(-0x8000);
  });

  it('round-trips a sample through the 16-bit quantisation', () => {
    const view = new DataView(toWav(Float32Array.from([0.5]), SAMPLE_RATE));

    expect(view.getInt16(HEADER_BYTES, true) / 0x7fff).toBeCloseTo(0.5, 3);
  });
});
