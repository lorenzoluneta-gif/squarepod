type AudioContextFactory = typeof AudioContext;

const MASTER_GAIN = 0.9;
const WHEEL_TICK_MIN_INTERVAL_MS = 18;
const WHEEL_TICK_SPACING_SECONDS = 0.021;
const MAX_WHEEL_TICKS_PER_EVENT = 4;

let audioContext: AudioContext | undefined;
let masterGain: GainNode | undefined;
let noiseBuffer: AudioBuffer | undefined;
let lastWheelTickAt = 0;

const getAudioContext = () => {
  if (typeof window === 'undefined') return undefined;

  if (audioContext?.state === 'closed') {
    audioContext = undefined;
    masterGain = undefined;
    noiseBuffer = undefined;
  }

  if (!audioContext) {
    const audioWindow = window as Window & { webkitAudioContext?: AudioContextFactory };
    const AudioContextCtor = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return undefined;

    audioContext = new AudioContextCtor({ latencyHint: 'interactive' });
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_GAIN;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
};

const getMasterGain = (context: AudioContext) => {
  if (!masterGain) {
    masterGain = context.createGain();
    masterGain.gain.value = MASTER_GAIN;
    masterGain.connect(context.destination);
  }
  return masterGain;
};

const getNoiseBuffer = (context: AudioContext) => {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;

  const length = Math.floor(context.sampleRate * 0.08);
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
};

export const unlockUiAudio = () => {
  const context = getAudioContext();
  if (!context || context.state !== 'suspended') return;
  context.resume().catch(() => undefined);
};

const connectEnvelope = (
  context: AudioContext,
  startTime: number,
  attackSeconds: number,
  decaySeconds: number,
  volume: number,
) => {
  const gain = context.createGain();
  const safeStart = Math.max(context.currentTime, startTime);
  const attackEnd = safeStart + attackSeconds;
  const decayEnd = attackEnd + decaySeconds;

  gain.gain.cancelScheduledValues(safeStart);
  gain.gain.setValueAtTime(0.0001, safeStart);
  gain.gain.linearRampToValueAtTime(volume, attackEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, decayEnd);
  gain.connect(getMasterGain(context));

  return gain;
};

const playNoiseBurst = ({
  startTime,
  attackSeconds,
  decaySeconds,
  volume,
  frequency,
  q,
  type,
}: {
  startTime: number;
  attackSeconds: number;
  decaySeconds: number;
  volume: number;
  frequency: number;
  q: number;
  type: BiquadFilterType;
}) => {
  const context = getAudioContext();
  if (!context) return;

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = connectEnvelope(context, startTime, attackSeconds, decaySeconds, volume);
  const duration = attackSeconds + decaySeconds + 0.012;

  source.buffer = getNoiseBuffer(context);
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, startTime);
  filter.Q.setValueAtTime(q, startTime);

  source.connect(filter);
  filter.connect(gain);
  source.start(startTime);
  source.stop(startTime + duration);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
};

const playTone = ({
  startTime,
  attackSeconds,
  decaySeconds,
  volume,
  frequency,
  endFrequency,
  type,
}: {
  startTime: number;
  attackSeconds: number;
  decaySeconds: number;
  volume: number;
  frequency: number;
  endFrequency?: number;
  type: OscillatorType;
}) => {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = connectEnvelope(context, startTime, attackSeconds, decaySeconds, volume);
  const duration = attackSeconds + decaySeconds + 0.012;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
  }

  oscillator.connect(gain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
};

export const playWheelTick = (steps = 1) => {
  const context = getAudioContext();
  if (!context) return;
  unlockUiAudio();

  const count = Math.min(Math.max(1, Math.abs(steps)), MAX_WHEEL_TICKS_PER_EVENT);
  const nowMs = performance.now();
  const scheduledStartMs = Math.max(nowMs, lastWheelTickAt + WHEEL_TICK_MIN_INTERVAL_MS);

  for (let index = 0; index < count; index += 1) {
    const tickAtMs = scheduledStartMs + index * WHEEL_TICK_SPACING_SECONDS * 1000;
    if (tickAtMs - lastWheelTickAt < WHEEL_TICK_MIN_INTERVAL_MS) continue;

    lastWheelTickAt = tickAtMs;
    const startTime = context.currentTime + Math.max(0, tickAtMs - nowMs) / 1000;

    playNoiseBurst({
      startTime,
      attackSeconds: 0.001,
      decaySeconds: 0.022,
      volume: 0.072,
      frequency: 2600,
      q: 7,
      type: 'bandpass',
    });
    playTone({
      startTime,
      attackSeconds: 0.001,
      decaySeconds: 0.018,
      volume: 0.036,
      frequency: 1250,
      endFrequency: 980,
      type: 'square',
    });
  }
};

export const playSelectClick = () => {
  const context = getAudioContext();
  if (!context) return;
  unlockUiAudio();

  const startTime = context.currentTime + 0.001;
  playNoiseBurst({
    startTime,
    attackSeconds: 0.001,
    decaySeconds: 0.034,
    volume: 0.092,
    frequency: 3600,
    q: 6,
    type: 'bandpass',
  });
  playTone({
    startTime,
    attackSeconds: 0.001,
    decaySeconds: 0.048,
    volume: 0.078,
    frequency: 2300,
    endFrequency: 1700,
    type: 'triangle',
  });
};

export const playOuterButtonClick = () => {
  const context = getAudioContext();
  if (!context) return;
  unlockUiAudio();

  const startTime = context.currentTime + 0.001;
  playNoiseBurst({
    startTime,
    attackSeconds: 0.002,
    decaySeconds: 0.058,
    volume: 0.056,
    frequency: 520,
    q: 0.9,
    type: 'lowpass',
  });
  playTone({
    startTime,
    attackSeconds: 0.002,
    decaySeconds: 0.078,
    volume: 0.074,
    frequency: 260,
    endFrequency: 130,
    type: 'sine',
  });
};
