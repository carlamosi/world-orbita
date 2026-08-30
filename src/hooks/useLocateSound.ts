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

/** Descending buzz — wrong answer */
export function playWrong() {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(105, now + 0.38);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.start(now);
  osc.stop(now + 0.5);
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
