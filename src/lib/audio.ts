/**
 * Orbita Centralized Audio Feedback System
 *
 * Provides immediate (0ms latency), restrained, and elegant sound feedback
 * tailored for Orbita's dark-space aesthetic.
 *
 * - Correct: Crystalline harmonic two-tone chime (E5 -> B5 sine blend)
 * - Incorrect: Two soft descending notes (A3 -> E3 triangle, low-passed)
 * - Zero external asset dependency, zero network delay, zero re-render duplicates.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock audio on first user gesture
if (typeof window !== "undefined") {
  const unlock = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}

/**
 * Play a polished, elegant correct answer chime.
 */
export function playCorrectSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master gain for correct chime
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.28, now);
    masterGain.connect(ctx.destination);

    // Primary tone (E5: ~659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    // Harmonic fifth tone (B5: ~987.77Hz, slight offset for chime sparkle)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.04);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.001, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.28, now + 0.055);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.warn("[Orbita Audio] Failed to play correct sound", err);
  }
}

/**
 * Incorrect answer: two soft descending notes (A3 then E3), warm and short.
 * A low-pass keeps it rounded rather than buzzy; a little louder than the old single tone.
 */
export function playIncorrectSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.32, now);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1400, now);
    lowpass.Q.setValueAtTime(0.7, now);
    lowpass.connect(masterGain);
    masterGain.connect(ctx.destination);

    const note = (freq: number, start: number, length: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, start + length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain);
      gain.connect(lowpass);
      osc.start(start);
      osc.stop(start + length + 0.02);
    };

    note(220, now, 0.14, 0.42);
    note(164.81, now + 0.09, 0.22, 0.38);
  } catch (err) {
    console.warn("[Orbita Audio] Failed to play incorrect sound", err);
  }
}

/**
 * Unified answer audio dispatcher.
 */
export function playAnswerSound(isCorrect: boolean): void {
  if (isCorrect) {
    playCorrectSound();
  } else {
    playIncorrectSound();
  }
}
