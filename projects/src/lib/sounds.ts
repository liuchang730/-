/**
 * sounds.ts — Game Sound Effects via Web Audio API
 * All sounds are synthesized programmatically, no external audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

/** Resume audio context on user interaction (call once on first tap/click) */
export function resumeAudio() {
  try { getCtx(); } catch { /* ignore */ }
}

// ---- Helper: play a tone with ADSR envelope ----
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
  attack = 0.01,
  decay = 0.1,
  sustain = 0.7,
  release = 0.15,
  detune = 0,
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  const now = ac.currentTime;
  const susLevel = volume * sustain;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.linearRampToValueAtTime(susLevel, now + attack + decay);
  gain.gain.setValueAtTime(susLevel, now + duration - release);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration);
}

// ---- Helper: noise burst ----
function playNoise(duration: number, volume = 0.1, filterFreq = 3000) {
  const ac = getCtx();
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;

  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(now);
  src.stop(now + duration);
}

// ---- Public Sound Functions ----

/** 蓄力音效 — 渐强的低频嗡嗡声 */
export function playCharge() {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(300, ac.currentTime + 1.5);

  gain.gain.setValueAtTime(0.05, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ac.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 1.5);

  // Store for stopping
  _chargeOsc = osc;
  _chargeGain = gain;
}

let _chargeOsc: OscillatorNode | null = null;
let _chargeGain: GainNode | null = null;

/** 停止蓄力音效 */
export function stopCharge() {
  try {
    if (_chargeGain) {
      const ac = getCtx();
      _chargeGain.gain.cancelScheduledValues(ac.currentTime);
      _chargeGain.gain.setValueAtTime(_chargeGain.gain.value, ac.currentTime);
      _chargeGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.05);
    }
    if (_chargeOsc) {
      _chargeOsc.stop(getCtx().currentTime + 0.06);
      _chargeOsc = null;
    }
  } catch { /* ignore */ }
}

/** 跳跃音效 — 上升的弹性音 */
export function playJump() {
  playTone(400, 0.15, 'sine', 0.2, 0.005, 0.05, 0.5, 0.1);
  setTimeout(() => {
    playTone(600, 0.12, 'sine', 0.15, 0.005, 0.04, 0.4, 0.08);
  }, 50);
  playNoise(0.08, 0.06, 5000);
}

/** 普通落地音效 — 柔和的落地震动 */
export function playLand() {
  playTone(220, 0.2, 'triangle', 0.18, 0.005, 0.08, 0.4, 0.12);
  playNoise(0.1, 0.08, 2000);
}

/** 精准落点音效 — 清脆叮叮声 + 闪亮泛音 */
export function playPerfect() {
  playTone(880, 0.25, 'sine', 0.22, 0.005, 0.08, 0.6, 0.15);
  setTimeout(() => {
    playTone(1100, 0.2, 'sine', 0.18, 0.005, 0.06, 0.5, 0.12);
  }, 60);
  setTimeout(() => {
    playTone(1320, 0.18, 'sine', 0.12, 0.005, 0.05, 0.4, 0.1);
  }, 120);
  playNoise(0.06, 0.04, 8000);
}

/** 掉落音效 — 下坠滑音 */
export function playFall() {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.5);

  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.5);
}

/** 高分里程碑音效 — 欢快的上行琶音 */
export function playMilestone() {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.3, 'sine', 0.2, 0.005, 0.08, 0.6, 0.15);
    }, i * 100);
  });
}

/** 通关音效 — 辉煌的胜利和弦 */
export function playVictory() {
  const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.6, 'sine', 0.2, 0.01, 0.1, 0.7, 0.3);
      playTone(freq * 1.005, 0.6, 'sine', 0.08, 0.01, 0.1, 0.7, 0.3); // slight chorus
    }, i * 120);
  });
}

/** 继续挑战音效 — 温柔的鼓励音 */
export function playContinue() {
  playTone(440, 0.2, 'sine', 0.15, 0.01, 0.08, 0.5, 0.1);
  setTimeout(() => {
    playTone(554, 0.25, 'sine', 0.18, 0.01, 0.08, 0.6, 0.12);
  }, 120);
  setTimeout(() => {
    playTone(659, 0.3, 'sine', 0.15, 0.01, 0.08, 0.5, 0.15);
  }, 240);
}

/** 地标切换音效 — 温暖的钟声 */
export function playLandmark() {
  playTone(660, 0.4, 'sine', 0.18, 0.005, 0.1, 0.5, 0.2);
  playTone(990, 0.35, 'sine', 0.08, 0.005, 0.08, 0.4, 0.18);
}

/** 游戏开始封面点击音效 */
export function playStart() {
  playTone(523, 0.15, 'triangle', 0.2, 0.005, 0.05, 0.5, 0.08);
  setTimeout(() => {
    playTone(784, 0.2, 'triangle', 0.18, 0.005, 0.05, 0.5, 0.1);
  }, 80);
}
