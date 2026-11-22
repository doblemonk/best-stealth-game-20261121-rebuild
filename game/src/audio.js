// Synthesised WebAudio sound effects for Shadow Vault. No audio
// files, no network: every sound is a short oscillator beep with a
// gain envelope. The AudioContext is created lazily on the first
// unlock() call (browsers block audio before a gesture); every
// method is safe to call before unlock() — it simply does nothing.
export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  // One short beep. `to` slides the pitch (siren / chirp effects),
  // `delay` staggers notes in an arpeggio. Volumes stay low (<= 0.12).
  function tone(freq, dur, vol, type = "sine", to = null, delay = 0) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function note(freq, delay, vol = 0.1) {
    tone(freq, 0.14, vol, "triangle", null, delay);
  }

  return {
    unlock() { // Call from a user gesture to enable audio.
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    footstep() { // Very short, quiet low blip.
      if (!ctx) return;
      tone(180, 0.05, 0.05, "sine");
    },
    pickup() { // Bright two-note chirp for a gem.
      if (!ctx) return;
      tone(880, 0.09, 0.1, "sine");
      tone(1320, 0.12, 0.1, "sine", null, 0.08);
    },
    idol() { // Little golden arpeggio when the idol is secured.
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((f, i) => note(f, i * 0.09, 0.11));
    },
    alarmTick() { // Short harsh tick as the alarm climbs.
      if (!ctx) return;
      tone(1200, 0.04, 0.08, "square");
    },
    alarmFull() { // Rising siren blip when the alarm goes full.
      if (!ctx) return;
      tone(400, 0.3, 0.12, "sawtooth", 900);
    },
    win() { // Happy ascending arpeggio on a clean getaway.
      if (!ctx) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => note(f, i * 0.11, 0.11));
    },
    lose() { // Descending sad pair when caught.
      if (!ctx) return;
      tone(330, 0.22, 0.1, "triangle");
      tone(220, 0.3, 0.1, "triangle", null, 0.2);
    },
  };
}
