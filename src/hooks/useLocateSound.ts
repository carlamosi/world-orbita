/**
 * useLocateSound — Web Audio API synth sounds for Locate mode feedback.
 * No external audio files needed. Generates pleasant tones procedurally.
 */
import { useCallback, useRef } from "react";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

let sharedCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = getAudioContext();
  }
  return sharedCtx;
}

/** Rising two-note chime — correct answer */
export function playCorrect() {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  // C5 → E5 major third chime
  const freqs = [523.25, 659.25];
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.13);
    gain.gain.setValueAtTime(0, now + i * 0.13);
    gain.gain.linearRampToValueAtTime(0.2, now + i * 0.13 + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.55);
    osc.start(now + i * 0.13);
    osc.stop(now + i * 0.13 + 0.6);
  });
}

/** Descending buzz / error strike — wrong answer */
export function playWrong() {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;

  // Layer 1: Low fundamental thump for physical impact
  const subOsc = ac.createOscillator();
  const subGain = ac.createGain();
  subOsc.connect(subGain);
  subGain.connect(ac.destination);
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(130, now);
  subOsc.frequency.exponentialRampToValueAtTime(55, now + 0.28);
  subGain.gain.setValueAtTime(0.35, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  subOsc.start(now);
  subOsc.stop(now + 0.35);

  // Layer 2: Dissonant dual-saw interval (tritone / minor second clash)
  const tones = [260, 245];
  tones.forEach((freq) => {
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.32);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.32);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.38);
  });
}

export function useLocateSound() {
  const unlockedRef = useRef(false);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    const ac = ctx();
    if (ac && ac.state === "suspended") void ac.resume();
    unlockedRef.current = true;
  }, []);

  return { playCorrect, playWrong, unlock };
}
