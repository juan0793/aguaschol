let audioContext = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
};

export const primeNotificationSound = async () => {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    await context.resume().catch(() => null);
  }
};

export const playNotificationSound = async ({ muted = false } = {}) => {
  if (muted) return;

  const context = getAudioContext();
  if (!context) return;

  await primeNotificationSound();
  if (context.state !== "running") return;

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gain.connect(context.destination);

  [880, 1174].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const startAt = now + index * 0.16;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.connect(gain);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.2);
  });

  window.setTimeout(() => gain.disconnect(), 520);
};
