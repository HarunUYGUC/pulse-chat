// Zero-dependency sound effects generator using Web Audio API

let audioCtx: AudioContext | null = null;

export const ensureAudioContext = async (): Promise<AudioContext | null> => {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('AudioContext resume failed:', err);
    return null;
  }
};

// Global Autoplay policy unlocker: unlocks AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    ensureAudioContext().catch(() => {});
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

export const playJoinSound = async (): Promise<void> => {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  // Tone 1: 440 Hz (A4)
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(440, now);
  osc1.start(now);
  osc1.stop(now + 0.09);

  // Tone 2: 880 Hz (A5)
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, now + 0.08);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.26);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
};

export const playLeaveSound = async (): Promise<void> => {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  // Tone 1: 700 Hz
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(700, now);
  osc1.start(now);
  osc1.stop(now + 0.09);

  // Tone 2: 440 Hz
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(440, now + 0.08);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.28);

  gain.gain.setValueAtTime(0.13, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
};

export const playMuteSound = async (): Promise<void> => {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.10);

  gain.gain.setValueAtTime(0.10, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
};

export const playUnmuteSound = async (): Promise<void> => {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(550, now + 0.10);

  gain.gain.setValueAtTime(0.10, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
};
