// Shadow Vault — tiny WebAudio beeps, all synthesised in code. No audio files,
// no network: a few oscillators give footsteps, pickups, the alarm and the
// win/lose stings. Everything is guarded so the game plays silently until the
// first user gesture creates the audio context.

export function createAudio() {
  let context = null;
  let enabled = true;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function beep(freq, seconds, type, volume, when = 0) {
    if (!enabled) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      const start = ctx.currentTime + when;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.05);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    /** Call from any user gesture so later beeps are allowed to sound. */
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    },
    setEnabled(value) {
      enabled = value;
    },
    footstep() {
      beep(140, 0.05, 'triangle', 0.05);
    },
    pickup() {
      beep(660, 0.09, 'sine', 0.12);
      beep(990, 0.12, 'sine', 0.12, 0.08);
    },
    idol() {
      beep(523, 0.12, 'sine', 0.14);
      beep(659, 0.12, 'sine', 0.14, 0.1);
      beep(784, 0.2, 'sine', 0.14, 0.2);
    },
    alarmTick() {
      beep(880, 0.07, 'square', 0.05);
    },
    alarmFull() {
      beep(440, 0.16, 'square', 0.09);
      beep(440, 0.16, 'square', 0.09, 0.2);
    },
    win() {
      beep(523, 0.14, 'sine', 0.14);
      beep(659, 0.14, 'sine', 0.14, 0.12);
      beep(784, 0.14, 'sine', 0.14, 0.24);
      beep(1047, 0.3, 'sine', 0.14, 0.36);
    },
    lose() {
      beep(330, 0.18, 'sawtooth', 0.08);
      beep(220, 0.3, 'sawtooth', 0.08, 0.16);
    },
  };
}
