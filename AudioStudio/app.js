const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmtTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0s";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, "0")}` : `${s.toFixed(1)}s`;
};
const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (gain) => 20 * Math.log10(Math.max(gain, 1e-9));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function duplicateMono(bufferData) {
  return bufferData.length > 1
    ? bufferData
    : [bufferData[0], new Float32Array(bufferData[0])];
}

function audioBufferToArrays(buffer) {
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    channels.push(new Float32Array(buffer.getChannelData(ch)));
  }
  return duplicateMono(channels);
}

function arraysToAudioBuffer(audioCtx, channels, sampleRate) {
  const safeChannels = duplicateMono(channels);
  const length = safeChannels[0]?.length || 0;
  const buffer = audioCtx.createBuffer(safeChannels.length, length, sampleRate);
  safeChannels.forEach((data, index) => {
    buffer.copyToChannel(data, index);
  });
  return buffer;
}

function cloneAudioBuffer(audioCtx, buffer) {
  return arraysToAudioBuffer(audioCtx, audioBufferToArrays(buffer), buffer.sampleRate);
}

function cloneEffectChain(chain) {
  return JSON.parse(JSON.stringify(chain));
}

function formatParamValue(value) {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "number") {
    if (Math.abs(value) >= 100) return `${Math.round(value)}`;
    if (Math.abs(value) >= 10) return `${value.toFixed(1)}`;
    return `${value.toFixed(2)}`;
  }
  return String(value);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-J0dAS2C7_KCpupKpvB_lLhi55TkbWTQ",
  authDomain: "guitarpractice-dfa4b.firebaseapp.com",
  projectId: "guitarpractice-dfa4b",
  storageBucket: "guitarpractice-dfa4b.firebasestorage.app",
  messagingSenderId: "282086325190",
  appId: "1:282086325190:web:b3ec1bca510460e87a50c7",
};

const STUDIO_PRESETS_FIELD = "audiostudio_effects_presets";
const STUDIO_PROFILES_FIELD = "audiostudio_effects_profiles";
const STUDIO_SETTINGS_FIELD = "audiostudio_settings";
const STUDIO_SETTINGS_STORAGE_KEY = "audiostudio.settings";
const APP_VERSIONS_URL = "/AudioStudio/versions.json";
const APP_BUILD = {
  version: "v2026.05.14.17",
};
const DEFAULT_SETTINGS = Object.freeze({
  appFontSize: 15,
});

function normalizeStudioSettings(raw = {}) {
  return {
    appFontSize: clamp(Number(raw?.appFontSize || DEFAULT_SETTINGS.appFontSize), 12, 24),
  };
}

function parseVersionParts(version = "") {
  return String(version || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => parseInt(part, 10))
    .filter(Number.isFinite);
}

function compareVersions(a = "", b = "") {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const maxLen = Math.max(pa.length, pb.length);
  for (let i = 0; i < maxLen; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

function normalizeVersionUpdateEntry(entry = {}) {
  return {
    version: String(entry.version || "").trim(),
    releasedAt: String(entry.releasedAt || entry.date || "").trim(),
    summary: String(entry.summary || "").trim(),
    description: String(entry.description || "").trim(),
    changes: Array.isArray(entry.changes) ? entry.changes.map((item) => String(item || "").trim()).filter(Boolean) : [],
  };
}

class StudioCloudStore {
  constructor() {
    if (!window.firebase?.apps?.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    this.auth = firebase.auth();
    this.db = firebase.firestore();
  }

  async enablePersistence() {
    await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  }

  observeAuth(handler) {
    return this.auth.onAuthStateChanged(handler);
  }

  async ensureAnonymous() {
    if (!this.auth.currentUser) {
      await this.auth.signInAnonymously();
    }
  }

  async signInWithEmail(email, password) {
    await this.auth.signInWithEmailAndPassword(email, password);
  }

  async signUpWithEmail(email, password) {
    await this.auth.createUserWithEmailAndPassword(email, password);
  }

  async signOutToGuest() {
    await this.auth.signOut();
    await this.auth.signInAnonymously();
  }

  async loadUserData(uid) {
    const snap = await this.db.collection("users").doc(uid).get();
    const data = snap.exists ? snap.data() : {};
    return {
      presets: data?.[STUDIO_PRESETS_FIELD] || {},
      profiles: data?.[STUDIO_PROFILES_FIELD] || [],
      settings: normalizeStudioSettings(data?.[STUDIO_SETTINGS_FIELD] || {}),
    };
  }

  async saveUserData(uid, { presets, profiles, settings }) {
    await this.db.collection("users").doc(uid).set({
      [STUDIO_PRESETS_FIELD]: presets,
      [STUDIO_PROFILES_FIELD]: profiles,
      [STUDIO_SETTINGS_FIELD]: normalizeStudioSettings(settings || {}),
    }, { merge: true });
  }
}

function linearResample(data, newLength) {
  const out = new Float32Array(Math.max(1, newLength));
  const last = data.length - 1;
  const scale = last / Math.max(1, out.length - 1);
  for (let i = 0; i < out.length; i += 1) {
    const pos = i * scale;
    const left = Math.floor(pos);
    const right = Math.min(last, left + 1);
    const frac = pos - left;
    out[i] = data[left] * (1 - frac) + data[right] * frac;
  }
  return out;
}

function hann(size) {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

function timeStretchChannel(data, rate) {
  if (Math.abs(rate - 1) < 0.0001) return new Float32Array(data);
  const windowSize = 2048;
  const hopIn = 512;
  const hopOut = Math.max(64, Math.round(hopIn / rate));
  const win = hann(windowSize);
  const frames = Math.max(1, Math.ceil((data.length - windowSize) / hopIn) + 1);
  const outLength = Math.max(windowSize, hopOut * (frames - 1) + windowSize);
  const out = new Float32Array(outLength);
  const norm = new Float32Array(outLength);
  let inPos = 0;
  let outPos = 0;
  while (inPos < data.length) {
    for (let i = 0; i < windowSize; i += 1) {
      const srcIndex = inPos + i;
      if (srcIndex >= data.length) break;
      const weighted = data[srcIndex] * win[i];
      out[outPos + i] += weighted;
      norm[outPos + i] += win[i];
    }
    inPos += hopIn;
    outPos += hopOut;
    if (outPos + windowSize >= out.length) break;
  }
  for (let i = 0; i < out.length; i += 1) {
    if (norm[i] > 1e-6) out[i] /= norm[i];
  }
  return out;
}

function applyFilter(samples, coeffs) {
  const { b0, b1, b2, a1, a2 } = coeffs;
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function rbjPeak(sampleRate, freq, q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = 1 + alpha * A;
  const b1 = -2 * Math.cos(w0);
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha / A;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function rbjShelf(sampleRate, freq, gainDb, type) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / 2 * Math.sqrt((A + 1 / A) * (1 - 1) + 2);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  if (type === "low") {
    b0 = A * ((A + 1) - (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * cos);
    b2 = A * ((A + 1) - (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
    a0 = (A + 1) + (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
    a1 = -2 * ((A - 1) + (A + 1) * cos);
    a2 = (A + 1) + (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
  } else {
    b0 = A * ((A + 1) + (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
    b1 = -2 * A * ((A - 1) + (A + 1) * cos);
    b2 = A * ((A + 1) + (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
    a0 = (A + 1) - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
    a1 = 2 * ((A - 1) - (A + 1) * cos);
    a2 = (A + 1) - (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function rbjLowpass(sampleRate, freq, q = 0.707) {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = (1 - cos) / 2;
  const b1 = 1 - cos;
  const b2 = (1 - cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function rbjHighpass(sampleRate, freq, q = 0.707) {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function peakNormalize(channels, targetDb = -3) {
  let peak = 0;
  channels.forEach((ch) => {
    for (let i = 0; i < ch.length; i += 1) peak = Math.max(peak, Math.abs(ch[i]));
  });
  if (peak < 1e-9) return channels;
  const gain = dbToGain(targetDb) / peak;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i += 1) out[i] = clamp(ch[i] * gain, -1, 1);
    return out;
  });
}

function smoothGainTransitions(gainState, targetGain, attackCoeff, releaseCoeff) {
  return targetGain < gainState
    ? targetGain + attackCoeff * (gainState - targetGain)
    : targetGain + releaseCoeff * (gainState - targetGain);
}

function linkedCompression(channels, { threshold = -18, ratio = 4, makeup = 0, attackMs = 10, releaseMs = 80 } = {}) {
  const [left, right] = duplicateMono(channels);
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  const thresholdLin = dbToGain(threshold);
  const makeupLin = dbToGain(makeup);
  const attackCoeff = Math.exp(-1 / Math.max(1, 44100 * attackMs / 1000));
  const releaseCoeff = Math.exp(-1 / Math.max(1, 44100 * releaseMs / 1000));
  let detector = 0;
  let gainState = 1;
  for (let i = 0; i < left.length; i += 1) {
    const mono = (Math.abs(left[i]) + Math.abs(right[i])) * 0.5;
    detector = mono > detector
      ? mono + attackCoeff * (detector - mono)
      : mono + releaseCoeff * (detector - mono);
    let targetGain = 1;
    if (detector > thresholdLin) {
      const compressed = thresholdLin + (detector - thresholdLin) / Math.max(1, ratio);
      targetGain = compressed / Math.max(detector, 1e-9);
    }
    gainState = smoothGainTransitions(gainState, targetGain, attackCoeff, releaseCoeff);
    const gain = gainState * makeupLin;
    outL[i] = clamp(left[i] * gain, -1, 1);
    outR[i] = clamp(right[i] * gain, -1, 1);
  }
  return [outL, outR];
}

function gateExpanderEffect(channels, { threshold = -42, ratio = 3, floor = -24, attackMs = 4, releaseMs = 100 } = {}) {
  const [left, right] = duplicateMono(channels);
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  const thresholdLin = dbToGain(threshold);
  const floorGain = dbToGain(floor);
  const attackCoeff = Math.exp(-1 / Math.max(1, 44100 * attackMs / 1000));
  const releaseCoeff = Math.exp(-1 / Math.max(1, 44100 * releaseMs / 1000));
  let detector = 0;
  let gainState = 1;
  for (let i = 0; i < left.length; i += 1) {
    const mono = (Math.abs(left[i]) + Math.abs(right[i])) * 0.5;
    detector = mono > detector
      ? mono + attackCoeff * (detector - mono)
      : mono + releaseCoeff * (detector - mono);
    let targetGain = 1;
    if (detector < thresholdLin) {
      const deficit = 1 - detector / Math.max(thresholdLin, 1e-9);
      targetGain = Math.max(floorGain, 1 - deficit * (1 - 1 / Math.max(1, ratio)));
    }
    gainState = smoothGainTransitions(gainState, targetGain, attackCoeff, releaseCoeff);
    outL[i] = clamp(left[i] * gainState, -1, 1);
    outR[i] = clamp(right[i] * gainState, -1, 1);
  }
  return [outL, outR];
}

function limiterEffect(channels, { ceiling = -0.3, drive = 6, releaseMs = 60 } = {}) {
  const [left, right] = duplicateMono(channels);
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  const ceilingLin = dbToGain(ceiling);
  const preGain = dbToGain(drive);
  const releaseCoeff = Math.exp(-1 / Math.max(1, 44100 * releaseMs / 1000));
  let gainState = 1;
  for (let i = 0; i < left.length; i += 1) {
    const inL = left[i] * preGain;
    const inR = right[i] * preGain;
    const peak = Math.max(Math.abs(inL), Math.abs(inR), 1e-9);
    const targetGain = peak > ceilingLin ? ceilingLin / peak : 1;
    gainState = targetGain < gainState ? targetGain : targetGain + releaseCoeff * (gainState - targetGain);
    outL[i] = clamp(inL * gainState, -ceilingLin, ceilingLin);
    outR[i] = clamp(inR * gainState, -ceilingLin, ceilingLin);
  }
  return [outL, outR];
}

function exciterEffect(channels, sampleRate, { amount = 0.45, tune = 6500, mix = 0.5 } = {}) {
  const highpass = rbjHighpass(sampleRate, clamp(tune, 2500, Math.min(12000, sampleRate * 0.45)), 0.8);
  return channels.map((input) => {
    const band = applyFilter(input, highpass);
    const out = new Float32Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const harmonics = Math.tanh(band[i] * (1 + amount * 6)) * amount;
      out[i] = clamp(input[i] * (1 - mix) + (input[i] + harmonics) * mix, -1, 1);
    }
    return out;
  });
}

function simpleNoiseReduce(channels, { strength = 0.75 }) {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let avg = 0;
    const noiseFloor = 0.008 + (1 - strength) * 0.01;
    for (let i = 0; i < ch.length; i += 1) {
      const abs = Math.abs(ch[i]);
      avg = avg * 0.995 + abs * 0.005;
      const gate = avg < noiseFloor ? 1 - strength * 0.7 : 1;
      out[i] = ch[i] * gate;
    }
    return out;
  });
}

function simpleReverb(channels, sampleRate, params) {
  const { room = 0.4, damping = 0.5, wet = 0.3, width = 1, dry = 0.8 } = params;
  const lengths = [0.013, 0.017, 0.019, 0.023].map((t, index) =>
    Math.max(16, Math.floor(sampleRate * t * (0.6 + room + index * 0.08))));
  return channels.map((ch, chIndex) => {
    const out = new Float32Array(ch.length);
    const buffers = lengths.map((len) => new Float32Array(len));
    const idx = new Array(lengths.length).fill(0);
    for (let i = 0; i < ch.length; i += 1) {
      let reverb = 0;
      for (let b = 0; b < buffers.length; b += 1) {
        const delayed = buffers[b][idx[b]];
        reverb += delayed;
        buffers[b][idx[b]] = ch[i] + delayed * (0.25 + room * 0.35) * (1 - damping * 0.4);
        idx[b] = (idx[b] + 1) % buffers[b].length;
      }
      const stereoSpread = chIndex === 0 ? width : 2 - width;
      out[i] = clamp(ch[i] * dry + reverb * wet * 0.25 * stereoSpread, -1, 1);
    }
    return out;
  });
}

function feedbackDelay(channels, sampleRate, params) {
  const { timeMs = 300, feedback = 0.4, mix = 0.35 } = params;
  const delaySamples = Math.max(1, Math.floor(sampleRate * timeMs / 1000));
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    const line = new Float32Array(delaySamples);
    let index = 0;
    for (let i = 0; i < ch.length; i += 1) {
      const delayed = line[index];
      const wet = ch[i] + delayed * feedback;
      line[index] = wet;
      out[i] = clamp(ch[i] * (1 - mix) + delayed * mix, -1, 1);
      index = (index + 1) % delaySamples;
    }
    return out;
  });
}

function chorusEffect(channels, sampleRate, params) {
  const { rate = 1.2, depth = 0.015, mix = 0.4 } = params;
  const maxDelay = Math.max(4, Math.floor(depth * sampleRate * 1.5));
  return channels.map((ch, chIndex) => {
    const out = new Float32Array(ch.length);
    const line = new Float32Array(maxDelay + 4);
    let index = 0;
    for (let i = 0; i < ch.length; i += 1) {
      line[index] = ch[i];
      const lfo = (Math.sin(2 * Math.PI * rate * i / sampleRate + chIndex * Math.PI * 0.5) + 1) * 0.5;
      const delay = lfo * maxDelay;
      const read = (index - delay + line.length) % line.length;
      const a = Math.floor(read);
      const b = (a + 1) % line.length;
      const frac = read - a;
      const delayed = line[a] * (1 - frac) + line[b] * frac;
      out[i] = clamp(ch[i] * (1 - mix) + delayed * mix, -1, 1);
      index = (index + 1) % line.length;
    }
    return out;
  });
}

function saturationEffect(channels, sampleRate, params) {
  const { drive = 2.5, tone = 0.5, mix = 0.6 } = params;
  let processed = channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i += 1) {
      const driven = Math.tanh(ch[i] * drive);
      out[i] = ch[i] * (1 - mix) + driven * mix;
    }
    return out;
  });
  if (tone > 0.5) {
    const coeffs = rbjShelf(sampleRate, 2800 + (tone - 0.5) * 9000, (tone - 0.5) * 9, "high");
    processed = processed.map((ch) => applyFilter(ch, coeffs));
  }
  return processed.map((ch) => {
    for (let i = 0; i < ch.length; i += 1) ch[i] = clamp(ch[i], -1, 1);
    return ch;
  });
}

function masteringEffect(channels, sampleRate, params) {
  let [left, right] = duplicateMono(channels);
  if (Math.abs(params.low_boost) > 0.1) {
    const coeffs = rbjShelf(sampleRate, 120, params.low_boost, "low");
    left = applyFilter(left, coeffs);
    right = applyFilter(right, coeffs);
  }
  if (Math.abs(params.high_boost) > 0.1) {
    const coeffs = rbjShelf(sampleRate, 10000, params.high_boost, "high");
    left = applyFilter(left, coeffs);
    right = applyFilter(right, coeffs);
  }
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  const midCutGain = dbToGain(params.mid_cut || -1);
  for (let i = 0; i < left.length; i += 1) {
    let mid = (left[i] + right[i]) * 0.5;
    const side = (left[i] - right[i]) * 0.5 * 1.2;
    mid *= midCutGain;
    outL[i] = mid + side;
    outR[i] = mid - side;
  }
  let compressed = linkedCompression([outL, outR], {
    threshold: -16,
    ratio: params.multiband_comp ? 3.2 : 2.2,
    makeup: 1.5,
    attackMs: 12,
    releaseMs: 110,
  });
  compressed = saturationEffect(compressed, sampleRate, { drive: 1.4, tone: 0.58, mix: 0.25 });
  compressed = limiterEffect(compressed, {
    ceiling: params.ceiling ?? -0.3,
    drive: Math.max(1, ((params.target_lufs ?? -14) + 20) * 0.7),
    releaseMs: 90,
  });
  return compressed;
}

function pitchTimeEffect(channels, params) {
  const semitones = params.semitones || 0;
  const rate = params.rate || 1;
  return channels.map((original) => {
    let out = new Float32Array(original);
    if (Math.abs(semitones) > 0.05) {
      const factor = Math.pow(2, semitones / 12);
      const stretched = timeStretchChannel(out, 1 / factor);
      out = linearResample(stretched, original.length);
    }
    if (Math.abs(rate - 1) > 0.02) {
      out = timeStretchChannel(out, rate);
    }
    return out;
  });
}

function eqEffect(channels, sampleRate, params) {
  const bands = [
    ["sub_gain", 80, 1.0, "low"],
    ["lm_gain", 250, 1.4, "peak"],
    ["mid_gain", 1000, 1.0, "peak"],
    ["hm_gain", 3500, 1.2, "peak"],
    ["pres_gain", 8000, 1.0, "peak"],
    ["air_gain", 16000, 0.8, "high"],
  ];
  return channels.map((input) => {
    let out = new Float32Array(input);
    bands.forEach(([key, freq, q, type]) => {
      const gain = params[key] || 0;
      if (Math.abs(gain) < 0.05) return;
      const coeffs = type === "peak"
        ? rbjPeak(sampleRate, freq, q, gain)
        : rbjShelf(sampleRate, freq, gain, type);
      out = applyFilter(out, coeffs);
    });
    return out;
  });
}

function deEsserEffect(channels, sampleRate, params) {
  const frequency = clamp(params.frequency ?? 6500, 3000, Math.min(10000, sampleRate * 0.45));
  const bandwidth = clamp(params.bandwidth ?? 3200, 1200, 9000);
  const thresholdLin = dbToGain(params.threshold ?? -24);
  const amount = clamp(params.amount ?? 0.55, 0, 1);
  const mix = clamp(params.mix ?? 1, 0, 1);
  const lowCut = clamp(frequency - bandwidth * 0.5, 2200, Math.max(2200, sampleRate * 0.4));
  const highCut = clamp(frequency + bandwidth * 0.5, lowCut + 600, Math.min(sampleRate * 0.48, 12000));
  const hp = rbjHighpass(sampleRate, lowCut, 0.85);
  const lp = rbjLowpass(sampleRate, highCut, 0.85);
  return channels.map((input) => {
    const bandPassed = applyFilter(applyFilter(input, hp), lp);
    const out = new Float32Array(input.length);
    const attack = Math.exp(-1 / Math.max(1, sampleRate * 0.0025));
    const release = Math.exp(-1 / Math.max(1, sampleRate * 0.05));
    let env = 0;
    for (let i = 0; i < input.length; i += 1) {
      const detector = Math.abs(bandPassed[i]);
      env = detector > env
        ? detector + attack * (env - detector)
        : detector + release * (env - detector);
      const over = Math.max(0, env - thresholdLin);
      const depth = clamp(over / Math.max(1e-6, 1 - thresholdLin), 0, 1);
      const reduction = amount * depth;
      const processed = input[i] - bandPassed[i] * reduction;
      out[i] = clamp(input[i] * (1 - mix) + processed * mix, -1, 1);
    }
    return out;
  });
}

function encodeWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * blockAlign, true);
  const channelData = [];
  for (let ch = 0; ch < channels; ch += 1) channelData.push(audioBuffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = clamp(channelData[ch][i], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

class AudioEngine {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.originalBuffer = null;
    this.currentBuffer = null;
    this.fileName = "";
    this.undoStack = [];
    this.redoStack = [];
    this.effectChain = [];
    this.changeLog = [];
    this.previewBuffer = null;
    this.source = null;
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 0.85;
    this.gainNode.connect(this.audioCtx.destination);
    this.startClock = 0;
    this.pauseOffset = 0;
    this.playEnd = null;
    this.previewOriginal = false;
    this.loop = false;
    this.onEnded = null;
  }

  get activeBuffer() {
    return this.previewOriginal ? this.originalBuffer : (this.previewBuffer || this.currentBuffer);
  }

  get duration() {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  get isPlaying() {
    return Boolean(this.source);
  }

  setVolume(value) {
    this.gainNode.gain.value = value;
  }

  async loadFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const stereo = arraysToAudioBuffer(this.audioCtx, audioBufferToArrays(decoded), decoded.sampleRate);
    this.originalBuffer = cloneAudioBuffer(this.audioCtx, stereo);
    this.currentBuffer = cloneAudioBuffer(this.audioCtx, stereo);
    this.fileName = file.name;
    this.undoStack = [];
    this.redoStack = [];
    this.effectChain = [];
    this.changeLog = [];
    this.previewBuffer = null;
    this.stop();
  }

  newProject() {
    this.stop();
    this.originalBuffer = null;
    this.currentBuffer = null;
    this.fileName = "";
    this.undoStack = [];
    this.redoStack = [];
    this.effectChain = [];
    this.changeLog = [];
    this.previewBuffer = null;
    this.pauseOffset = 0;
    this.playEnd = null;
    this.previewOriginal = false;
    this.loop = false;
  }

  pushUndo() {
    if (!this.currentBuffer) return;
    this.undoStack.push({
      buffer: cloneAudioBuffer(this.audioCtx, this.currentBuffer),
      chain: cloneEffectChain(this.effectChain),
      changes: cloneEffectChain(this.changeLog),
    });
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length || !this.currentBuffer) return false;
    this.redoStack.push({
      buffer: cloneAudioBuffer(this.audioCtx, this.currentBuffer),
      chain: cloneEffectChain(this.effectChain),
      changes: cloneEffectChain(this.changeLog),
    });
    const state = this.undoStack.pop();
    this.currentBuffer = cloneAudioBuffer(this.audioCtx, state.buffer);
    this.effectChain = cloneEffectChain(state.chain);
    this.changeLog = cloneEffectChain(state.changes || []);
    this.previewBuffer = null;
    return true;
  }

  redo() {
    if (!this.redoStack.length || !this.currentBuffer) return false;
    this.undoStack.push({
      buffer: cloneAudioBuffer(this.audioCtx, this.currentBuffer),
      chain: cloneEffectChain(this.effectChain),
      changes: cloneEffectChain(this.changeLog),
    });
    const state = this.redoStack.pop();
    this.currentBuffer = cloneAudioBuffer(this.audioCtx, state.buffer);
    this.effectChain = cloneEffectChain(state.chain);
    this.changeLog = cloneEffectChain(state.changes || []);
    this.previewBuffer = null;
    return true;
  }

  resetToOriginal() {
    if (!this.originalBuffer) return;
    this.pushUndo();
    this.currentBuffer = cloneAudioBuffer(this.audioCtx, this.originalBuffer);
    this.effectChain = [];
    this.changeLog.push({ type: "edit", label: "Reset To Original", meta: "Restored the untouched source audio." });
    this.previewBuffer = null;
    this.stop();
  }

  trim(startSeconds, endSeconds) {
    if (!this.currentBuffer) return;
    this.pushUndo();
    const start = Math.max(0, Math.floor(startSeconds * this.currentBuffer.sampleRate));
    const end = Math.max(start + 1, Math.floor(endSeconds * this.currentBuffer.sampleRate));
    const source = audioBufferToArrays(this.currentBuffer);
    const trimmed = source.map((ch) => ch.slice(start, Math.min(ch.length, end)));
    this.currentBuffer = arraysToAudioBuffer(this.audioCtx, trimmed, this.currentBuffer.sampleRate);
    this.changeLog.push({ type: "edit", label: "Trim", meta: `${fmtTime(startSeconds)} – ${fmtTime(endSeconds)}` });
    this.previewBuffer = null;
    this.stop();
  }

  cut(startSeconds, endSeconds) {
    if (!this.currentBuffer) return;
    this.pushUndo();
    const sr = this.currentBuffer.sampleRate;
    const start = Math.max(0, Math.floor(startSeconds * sr));
    const end = Math.max(start + 1, Math.floor(endSeconds * sr));
    const arrays = audioBufferToArrays(this.currentBuffer).map((ch) => {
      const out = new Float32Array(ch.length - Math.max(0, Math.min(ch.length, end) - start));
      out.set(ch.slice(0, start), 0);
      out.set(ch.slice(end), start);
      return out;
    });
    this.currentBuffer = arraysToAudioBuffer(this.audioCtx, arrays, sr);
    this.changeLog.push({ type: "edit", label: "Cut", meta: `${fmtTime(startSeconds)} – ${fmtTime(endSeconds)}` });
    this.previewBuffer = null;
    this.stop();
  }

  clearPreviewBuffer() {
    this.previewBuffer = null;
  }

  async processEffectBuffer(inputBuffer, spec) {
    if (!inputBuffer) return null;
    await nextFrame();
    const sr = inputBuffer.sampleRate;
    let channels = audioBufferToArrays(inputBuffer);
    switch (spec.effect) {
      case "eq":
        channels = eqEffect(channels, sr, spec.params);
        break;
      case "compression":
        channels = linkedCompression(channels, spec.params);
        break;
      case "gate_expander":
        channels = gateExpanderEffect(channels, spec.params);
        break;
      case "de_esser":
        channels = deEsserEffect(channels, sr, spec.params);
        break;
      case "noise_reduction":
        channels = simpleNoiseReduce(channels, spec.params);
        break;
      case "reverb":
        channels = simpleReverb(channels, sr, spec.params);
        break;
      case "delay":
        channels = feedbackDelay(channels, sr, spec.params);
        break;
      case "chorus":
        channels = chorusEffect(channels, sr, spec.params);
        break;
      case "saturation":
        channels = saturationEffect(channels, sr, spec.params);
        break;
      case "exciter":
        channels = exciterEffect(channels, sr, spec.params);
        break;
      case "limiter":
        channels = limiterEffect(channels, spec.params);
        break;
      case "mastering":
        channels = masteringEffect(channels, sr, spec.params);
        break;
      case "pitch_time":
        channels = pitchTimeEffect(channels, spec.params);
        break;
      case "normalize":
        channels = peakNormalize(channels, spec.params.target_db);
        break;
      default:
        throw new Error(`Unknown effect ${spec.effect}`);
    }
    return arraysToAudioBuffer(this.audioCtx, channels, sr);
  }

  play(startSeconds = 0, endSeconds = null) {
    if (!this.activeBuffer) return false;
    this.stop();
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.activeBuffer;
    source.connect(this.gainNode);
    source.onended = () => {
      if (this.source === source) {
        this.source = null;
        if (this.loop && !this.previewOriginal) {
          this.play(startSeconds, endSeconds);
          return;
        }
        this.pauseOffset = 0;
        this.playEnd = null;
        this.onEnded?.();
      }
    };
    this.source = source;
    this.startClock = this.audioCtx.currentTime - startSeconds;
    this.pauseOffset = startSeconds;
    this.playEnd = endSeconds;
    const duration = endSeconds != null ? Math.max(0.01, endSeconds - startSeconds) : undefined;
    source.start(0, startSeconds, duration);
    return true;
  }

  pause() {
    if (!this.source) return false;
    this.pauseOffset = this.position;
    this.stop(false);
    return true;
  }

  resume() {
    if (!this.activeBuffer) return false;
    return this.play(this.pauseOffset, this.playEnd);
  }

  stop(resetOffset = true) {
    if (this.source) {
      const source = this.source;
      this.source = null;
      source.onended = null;
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    if (resetOffset) this.pauseOffset = 0;
    this.playEnd = null;
  }

  seek(seconds) {
    const wasPlaying = this.isPlaying;
    const end = this.playEnd;
    this.pauseOffset = seconds;
    if (wasPlaying) this.play(seconds, end);
  }

  get position() {
    if (!this.activeBuffer) return 0;
    if (!this.source) return this.pauseOffset;
    const limit = this.playEnd ?? this.activeBuffer.duration;
    return clamp(this.audioCtx.currentTime - this.startClock, 0, limit);
  }

  async applyEffect(spec, { record = true } = {}) {
    if (!this.currentBuffer) return;
    if (record) this.pushUndo();
    this.currentBuffer = await this.processEffectBuffer(this.currentBuffer, spec);
    this.previewBuffer = null;
    if (record) {
      this.effectChain.push(cloneEffectChain([spec])[0]);
      this.changeLog.push({
        type: "effect",
        label: EFFECTS.find((item) => item.key === spec.effect)?.label || spec.effect,
        effect: spec.effect,
        params: cloneEffectChain([spec.params])[0],
      });
    }
    this.stop();
  }

  async applyProfile(profileSpecs) {
    if (!this.currentBuffer || !Array.isArray(profileSpecs) || !profileSpecs.length) return;
    this.pushUndo();
    for (const spec of profileSpecs) {
      await this.applyEffect(spec, { record: false });
      await nextFrame();
    }
    this.effectChain = cloneEffectChain(profileSpecs);
    this.changeLog.push({
      type: "profile",
      label: "Apply Profile",
      meta: `${profileSpecs.length} saved effects applied.`,
    });
  }
}

class WaveformView {
  constructor(canvas, onSeek) {
    this.canvas = canvas;
    this.onSeek = onSeek;
    this.selection = null;
    this.drag = null;
    this.duration = 0;
    this.cursor = 0;
    this.buffer = null;
    this.previewOriginal = false;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    this.attachEvents();
  }

  attachEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (!this.buffer) return;
      const x = this.localX(event);
      const seconds = x / this.canvas.clientWidth * this.duration;
      this.drag = { start: seconds, current: seconds };
      this.onSeek(seconds);
      this.draw();
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const x = this.localX(event);
      const seconds = clamp(x / this.canvas.clientWidth * this.duration, 0, this.duration);
      this.drag.current = seconds;
      this.selection = [this.drag.start, seconds];
      this.draw();
    });
    this.canvas.addEventListener("pointerup", () => {
      if (!this.drag) return;
      const [a, b] = this.selection || [this.drag.start, this.drag.current];
      if (Math.abs(a - b) < 0.01) this.selection = null;
      this.drag = null;
      this.draw();
    });
  }

  localX(event) {
    const rect = this.canvas.getBoundingClientRect();
    return clamp(event.clientX - rect.left, 0, rect.width);
  }

  setBuffer(buffer, { previewOriginal = false } = {}) {
    this.buffer = buffer;
    this.previewOriginal = previewOriginal;
    this.duration = buffer ? buffer.duration : 0;
    this.draw();
  }

  setCursor(seconds) {
    this.cursor = seconds;
    this.draw();
  }

  clearSelection() {
    this.selection = null;
    this.draw();
  }

  getSelection() {
    if (!this.selection) return null;
    const [a, b] = this.selection;
    if (Math.abs(a - b) < 0.01) return null;
    return [Math.min(a, b), Math.max(a, b)];
  }

  draw() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }
    const ctx = this.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0b1620";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 12; i += 1) {
      const x = i / 11 * width;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!this.buffer) {
      ctx.fillStyle = "rgba(238,246,248,0.55)";
      ctx.font = "16px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("Open an audio file to begin", width / 2, height / 2);
      return;
    }

    const channels = audioBufferToArrays(this.buffer);
    const step = Math.max(1, Math.floor(channels[0].length / width));
    const colors = this.previewOriginal
      ? ["rgba(255, 209, 102, 0.78)", "rgba(204, 130, 54, 0.58)"]
      : ["rgba(40, 214, 181, 0.82)", "rgba(81, 177, 255, 0.54)"];

    channels.slice(0, 2).forEach((channel, ch) => {
      ctx.beginPath();
      const mid = ch === 0 ? height * 0.32 : height * 0.68;
      const amp = height * 0.22;
      for (let x = 0; x < width; x += 1) {
        const start = x * step;
        const end = Math.min(channel.length, start + step);
        let min = 1;
        let max = -1;
        for (let i = start; i < end; i += 1) {
          min = Math.min(min, channel[i]);
          max = Math.max(max, channel[i]);
        }
        ctx.moveTo(x, mid + min * amp);
        ctx.lineTo(x, mid + max * amp);
      }
      ctx.strokeStyle = colors[ch];
      ctx.stroke();
    });

    const selection = this.getSelection();
    if (selection) {
      const [start, end] = selection;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(start / this.duration * width, 0, (end - start) / this.duration * width, height);
    }

    const cursorX = this.duration > 0 ? this.cursor / this.duration * width : 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();
  }
}

const EFFECTS = [
  {
    key: "eq",
    label: "Equalizer",
    title: "Parametric Equalizer",
    subtitle: "Shape the tone with six bands.",
    note: "Use this for tone shaping before compression or mastering.",
    controls: [
      ["sub_gain", "Sub Bass 80 Hz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["lm_gain", "Low Mid 250 Hz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["mid_gain", "Midrange 1 kHz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["hm_gain", "High Mid 3.5 kHz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["pres_gain", "Presence 8 kHz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["air_gain", "Air 16 kHz", -18, 18, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
    ],
    presets: {
      Flat: { sub_gain: 0, lm_gain: 0, mid_gain: 0, hm_gain: 0, pres_gain: 0, air_gain: 0 },
      "Vocal Boost": { sub_gain: -2, lm_gain: -3, mid_gain: 4, hm_gain: 5, pres_gain: 3, air_gain: 2 },
      "Bass Heavy": { sub_gain: 8, lm_gain: 4, mid_gain: -2, hm_gain: -2, pres_gain: 0, air_gain: 0 },
      "Bright Air": { sub_gain: -2, lm_gain: 0, mid_gain: 0, hm_gain: 2, pres_gain: 5, air_gain: 7 },
      "Acoustic Sparkle": { sub_gain: -1, lm_gain: -2, mid_gain: 1.5, hm_gain: 3, pres_gain: 4.5, air_gain: 5.5 },
      "Podcast Clarity": { sub_gain: -3, lm_gain: -1.5, mid_gain: 3.5, hm_gain: 2.5, pres_gain: 1.5, air_gain: 0.5 },
      "Warm Mix Bus": { sub_gain: 1.5, lm_gain: 1, mid_gain: -1, hm_gain: -0.5, pres_gain: 1, air_gain: 1.5 },
      "Smile Curve": { sub_gain: 4, lm_gain: -1.5, mid_gain: -2, hm_gain: 2, pres_gain: 3.5, air_gain: 3 },
      "LoFi Radio": { sub_gain: -8, lm_gain: 2, mid_gain: 3, hm_gain: -4, pres_gain: -6, air_gain: -10 },
      "Drum Snap": { sub_gain: 2, lm_gain: -2, mid_gain: -1, hm_gain: 4.5, pres_gain: 3, air_gain: 1 },
      "Bass Tame": { sub_gain: -5, lm_gain: -3, mid_gain: 0.5, hm_gain: 1.5, pres_gain: 2, air_gain: 1 },
    },
  },
  {
    key: "compression",
    label: "Compressor",
    title: "Dynamic Compressor",
    subtitle: "Control loud peaks and add glue.",
    note: "This uses linked stereo compression so both channels move together.",
    controls: [
      ["threshold", "Threshold", -60, 0, -18, 1, (v) => `${Math.round(v)} dB`],
      ["ratio", "Ratio", 1, 20, 4, 0.1, (v) => `${v.toFixed(1)}:1`],
      ["makeup", "Makeup Gain", 0, 24, 0, 0.1, (v) => `${v.toFixed(1)} dB`],
    ],
    presets: {
      Gentle: { threshold: -24, ratio: 2, makeup: 2 },
      Vocal: { threshold: -18, ratio: 4, makeup: 4 },
      Drums: { threshold: -12, ratio: 6, makeup: 6 },
      Glue: { threshold: -20, ratio: 2.5, makeup: 3 },
    },
  },
  {
    key: "gate_expander",
    label: "Gate / Expander",
    title: "Noise Gate / Downward Expander",
    subtitle: "Reduce room noise and low-level bleed between phrases.",
    note: "Use gentle settings first so quiet tails still feel natural.",
    controls: [
      ["threshold", "Threshold", -70, -6, -42, 1, (v) => `${Math.round(v)} dB`],
      ["ratio", "Range / Ratio", 1, 8, 3, 0.1, (v) => `${v.toFixed(1)}:1`],
      ["floor", "Floor", -48, -6, -24, 1, (v) => `${Math.round(v)} dB`],
      ["attackMs", "Attack", 1, 40, 4, 1, (v) => `${Math.round(v)} ms`],
      ["releaseMs", "Release", 20, 400, 100, 1, (v) => `${Math.round(v)} ms`],
    ],
    presets: {
      Gentle: { threshold: -46, ratio: 2, floor: -18, attackMs: 6, releaseMs: 140 },
      Voice: { threshold: -40, ratio: 3, floor: -24, attackMs: 4, releaseMs: 110 },
      Drums: { threshold: -32, ratio: 4.5, floor: -30, attackMs: 2, releaseMs: 70 },
      Tight: { threshold: -36, ratio: 6, floor: -36, attackMs: 3, releaseMs: 60 },
    },
  },
  {
    key: "de_esser",
    label: "De-Esser",
    title: "Custom DSP De-Esser",
    subtitle: "Catch harsh S, T, and SH consonants without dulling the whole mix.",
    note: "This de-esser listens to a focused sibilance band, then dynamically subtracts that band only when it spikes.",
    controls: [
      ["frequency", "Center Frequency", 3000, 10000, 6500, 10, (v) => `${Math.round(v)} Hz`],
      ["bandwidth", "Bandwidth", 1200, 9000, 3200, 10, (v) => `${Math.round(v)} Hz`],
      ["threshold", "Threshold", -40, -6, -24, 1, (v) => `${Math.round(v)} dB`],
      ["amount", "Reduction Amount", 0, 1, 0.55, 0.01, (v) => `${Math.round(v * 100)}%`],
      ["mix", "Mix", 0, 1, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Gentle: { frequency: 6200, bandwidth: 2800, threshold: -26, amount: 0.35, mix: 1 },
      "Lead Vocal": { frequency: 6600, bandwidth: 3000, threshold: -24, amount: 0.55, mix: 1 },
      "Bright Female Vox": { frequency: 7600, bandwidth: 2600, threshold: -25, amount: 0.6, mix: 1 },
      "Dark Male Vox": { frequency: 5400, bandwidth: 3200, threshold: -22, amount: 0.5, mix: 1 },
      "Harsh Overheads": { frequency: 7000, bandwidth: 4200, threshold: -20, amount: 0.7, mix: 0.9 },
      Parallel: { frequency: 6500, bandwidth: 3400, threshold: -24, amount: 0.8, mix: 0.65 },
    },
  },
  {
    key: "noise_reduction",
    label: "Noise Reduce",
    title: "Noise Reduction",
    subtitle: "Reduce low-level steady noise.",
    note: "This browser version uses a lightweight gate-style reducer, so it is gentler than the Python spectral version.",
    controls: [
      ["strength", "Reduction Strength", 0.1, 1, 0.75, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Light: { strength: 0.35 },
      Medium: { strength: 0.65 },
      Strong: { strength: 0.9 },
    },
  },
  {
    key: "reverb",
    label: "Reverb",
    title: "Reverb / Space",
    subtitle: "Add depth and ambience.",
    note: "Use sparingly before mastering.",
    controls: [
      ["room", "Room Size", 0.01, 1, 0.4, 0.01, (v) => v.toFixed(2)],
      ["damping", "Damping", 0, 1, 0.5, 0.01, (v) => v.toFixed(2)],
      ["wet", "Wet Level", 0, 1, 0.3, 0.01, (v) => v.toFixed(2)],
      ["dry", "Dry Level", 0, 1, 0.8, 0.01, (v) => v.toFixed(2)],
      ["width", "Stereo Width", 0, 1, 1, 0.01, (v) => v.toFixed(2)],
    ],
    presets: {
      Room: { room: 0.2, damping: 0.7, wet: 0.2, dry: 0.9, width: 0.8 },
      Hall: { room: 0.7, damping: 0.4, wet: 0.4, dry: 0.7, width: 1 },
      Plate: { room: 0.3, damping: 0.8, wet: 0.35, dry: 0.8, width: 1 },
    },
  },
  {
    key: "delay",
    label: "Delay",
    title: "Delay / Echo",
    subtitle: "Create echoes and rhythmic repeats.",
    note: "Short settings work well for slapback vocals and lead lines.",
    controls: [
      ["time_ms", "Delay Time", 50, 1000, 300, 1, (v) => `${Math.round(v)} ms`],
      ["feedback", "Feedback", 0, 0.95, 0.4, 0.01, (v) => `${Math.round(v * 100)}%`],
      ["mix", "Wet Mix", 0, 1, 0.35, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Slap: { time_ms: 70, feedback: 0.15, mix: 0.2 },
      Quarter: { time_ms: 250, feedback: 0.4, mix: 0.35 },
      Long: { time_ms: 800, feedback: 0.6, mix: 0.45 },
    },
  },
  {
    key: "chorus",
    label: "Chorus",
    title: "Chorus / Flanger",
    subtitle: "Add width and motion.",
    note: "A little goes a long way here.",
    controls: [
      ["rate", "LFO Rate", 0.1, 8, 1.2, 0.01, (v) => `${v.toFixed(2)} Hz`],
      ["depth", "Depth", 0.002, 0.04, 0.015, 0.001, (v) => v.toFixed(3)],
      ["mix", "Wet Mix", 0, 1, 0.4, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Subtle: { rate: 0.8, depth: 0.008, mix: 0.25 },
      Classic: { rate: 1.2, depth: 0.015, mix: 0.4 },
      Lush: { rate: 0.5, depth: 0.03, mix: 0.55 },
    },
  },
  {
    key: "saturation",
    label: "Saturation",
    title: "Tape Saturation / Harmonics",
    subtitle: "Warm up the signal with soft clipping.",
    note: "Useful for body, density, and edge.",
    controls: [
      ["drive", "Drive", 1, 6, 2.5, 0.1, (v) => v.toFixed(1)],
      ["tone", "Tone", 0, 1, 0.5, 0.01, (v) => v.toFixed(2)],
      ["mix", "Mix", 0, 1, 0.6, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Warmth: { drive: 1.8, tone: 0.55, mix: 0.35 },
      Tube: { drive: 2.8, tone: 0.62, mix: 0.55 },
      LoFi: { drive: 4.2, tone: 0.7, mix: 0.75 },
    },
  },
  {
    key: "exciter",
    label: "Exciter",
    title: "Harmonic Exciter",
    subtitle: "Add sheen and intelligibility to the top end.",
    note: "Best after EQ and before the final limiter or mastering stage.",
    controls: [
      ["amount", "Amount", 0, 1, 0.45, 0.01, (v) => `${Math.round(v * 100)}%`],
      ["tune", "Focus Frequency", 2500, 12000, 6500, 10, (v) => `${Math.round(v)} Hz`],
      ["mix", "Mix", 0, 1, 0.5, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
    presets: {
      Air: { amount: 0.3, tune: 8000, mix: 0.35 },
      "Vocal Shine": { amount: 0.45, tune: 6200, mix: 0.5 },
      Presence: { amount: 0.55, tune: 4800, mix: 0.42 },
      Sparkle: { amount: 0.65, tune: 9000, mix: 0.55 },
    },
  },
  {
    key: "limiter",
    label: "Limiter",
    title: "Brickwall Limiter",
    subtitle: "Catch peaks and raise loudness without overs.",
    note: "Use as the final stage when you want stricter peak control than normalize.",
    controls: [
      ["ceiling", "Ceiling", -3, 0, -0.3, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["drive", "Input Drive", 0, 18, 6, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["releaseMs", "Release", 10, 300, 60, 1, (v) => `${Math.round(v)} ms`],
    ],
    presets: {
      Safe: { ceiling: -1, drive: 2, releaseMs: 90 },
      Loud: { ceiling: -0.5, drive: 6, releaseMs: 60 },
      Modern: { ceiling: -0.3, drive: 8, releaseMs: 45 },
      "Pump Guard": { ceiling: -1.2, drive: 4, releaseMs: 120 },
    },
  },
  {
    key: "mastering",
    label: "Mastering",
    title: "Mastering Chain",
    subtitle: "Final polish with tone, glue, and limiting.",
    note: "This browser mastering chain is tuned to feel musical, even though it is lighter than the Python desktop DSP stack.",
    controls: [
      ["target_lufs", "Target LUFS", -20, -6, -14, 0.1, (v) => `${v.toFixed(1)} LUFS`],
      ["ceiling", "True Peak Ceiling", -3, 0, -0.3, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["low_boost", "Low Shelf", -6, 6, 1.5, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["high_boost", "High Shelf", -6, 6, 1, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["mid_cut", "Mid Cut", -4, 2, -1, 0.1, (v) => `${v.toFixed(1)} dB`],
      ["multiband_comp", "Multiband Compression", 0, 1, 1, 1, (v) => v >= 0.5 ? "On" : "Off", "toggle"],
    ],
    presets: {
      Streaming: { target_lufs: -14, ceiling: -1, low_boost: 1.5, high_boost: 1, mid_cut: -1, multiband_comp: 1 },
      Podcast: { target_lufs: -16, ceiling: -1, low_boost: 0.5, high_boost: 0.5, mid_cut: -0.5, multiband_comp: 1 },
      Club: { target_lufs: -8, ceiling: -0.1, low_boost: 2.5, high_boost: 2, mid_cut: -2, multiband_comp: 1 },
      "Acoustic Polish": { target_lufs: -15, ceiling: -1, low_boost: 0.8, high_boost: 1.8, mid_cut: -0.6, multiband_comp: 1 },
      "Warm Glue": { target_lufs: -13, ceiling: -0.8, low_boost: 1.8, high_boost: 0.3, mid_cut: -1.2, multiband_comp: 1 },
      "Vocal Forward": { target_lufs: -12, ceiling: -0.6, low_boost: 0.4, high_boost: 1.6, mid_cut: -0.2, multiband_comp: 1 },
      "EDM Loud": { target_lufs: -7, ceiling: -0.1, low_boost: 2.8, high_boost: 2.4, mid_cut: -1.8, multiband_comp: 1 },
      "LoFi Soft": { target_lufs: -15, ceiling: -1.5, low_boost: 1.2, high_boost: -1.2, mid_cut: -0.8, multiband_comp: 0 },
      "Broadcast Tight": { target_lufs: -11, ceiling: -0.5, low_boost: 0.9, high_boost: 1.2, mid_cut: -0.9, multiband_comp: 1 },
    },
  },
  {
    key: "pitch_time",
    label: "Pitch / Time",
    title: "Pitch Shift & Time Stretch",
    subtitle: "Shift pitch and stretch timing.",
    note: "This browser version uses a lightweight overlap-add method, so strong settings will sound rougher than studio-grade processing.",
    controls: [
      ["semitones", "Pitch Shift", -12, 12, 0, 0.1, (v) => `${v.toFixed(1)} st`],
      ["rate", "Time Stretch", 0.5, 2, 1, 0.01, (v) => `${v.toFixed(2)}x`],
    ],
    presets: {
      "Up 3": { semitones: 3, rate: 1 },
      "Down 3": { semitones: -3, rate: 1 },
      "Half Speed": { semitones: 0, rate: 0.5 },
      "Fast": { semitones: 0, rate: 1.3 },
    },
  },
  {
    key: "normalize",
    label: "Normalize",
    title: "Normalize Volume",
    subtitle: "Set the peak level quickly.",
    note: "Great as a final pass after edits.",
    controls: [
      ["target_db", "Peak Target", -12, 0, -3, 0.1, (v) => `${v.toFixed(1)} dB`],
    ],
    presets: {
      Safe: { target_db: -3 },
      Loud: { target_db: -1 },
      Headroom: { target_db: -6 },
    },
  },
];

const BUILTIN_PROFILES = Object.freeze([
  {
    source: "builtin",
    name: "Voice Cleaner",
    effects: [
      { effect: "gate_expander", params: { threshold: -44, ratio: 2.6, floor: -18, attackMs: 5, releaseMs: 120 } },
      { effect: "de_esser", params: { frequency: 6500, bandwidth: 2800, threshold: -25, amount: 0.48, mix: 1 } },
      { effect: "eq", params: { sub_gain: -4, lm_gain: -2, mid_gain: 2.5, hm_gain: 2, pres_gain: 2.5, air_gain: 1 } },
      { effect: "compression", params: { threshold: -20, ratio: 3.2, makeup: 3 } },
      { effect: "normalize", params: { target_db: -1 } },
    ],
    updatedAt: 0,
  },
  {
    source: "builtin",
    name: "Voice Deep",
    effects: [
      { effect: "eq", params: { sub_gain: 1.5, lm_gain: 3.5, mid_gain: -1.5, hm_gain: -1, pres_gain: -1.5, air_gain: -1 } },
      { effect: "compression", params: { threshold: -22, ratio: 2.8, makeup: 2.5 } },
      { effect: "saturation", params: { drive: 1.9, tone: 0.42, mix: 0.35 } },
      { effect: "exciter", params: { amount: 0.16, tune: 4200, mix: 0.18 } },
      { effect: "normalize", params: { target_db: -1.5 } },
    ],
    updatedAt: 0,
  },
  {
    source: "builtin",
    name: "Song Enhancer",
    effects: [
      { effect: "eq", params: { sub_gain: 1, lm_gain: -1, mid_gain: 0.5, hm_gain: 1.5, pres_gain: 2, air_gain: 2.5 } },
      { effect: "compression", params: { threshold: -21, ratio: 2.3, makeup: 2.5 } },
      { effect: "reverb", params: { room: 0.28, damping: 0.72, wet: 0.16, dry: 0.92, width: 1 } },
      { effect: "delay", params: { time_ms: 180, feedback: 0.18, mix: 0.12 } },
      { effect: "exciter", params: { amount: 0.22, tune: 7800, mix: 0.25 } },
      { effect: "limiter", params: { ceiling: -0.8, drive: 2.5, releaseMs: 90 } },
    ],
    updatedAt: 0,
  },
  {
    source: "builtin",
    name: "Song Enhancer 2",
    effects: [
      { effect: "eq", params: { sub_gain: 2, lm_gain: 0.5, mid_gain: -1, hm_gain: 1.8, pres_gain: 2.8, air_gain: 1.6 } },
      { effect: "chorus", params: { rate: 0.35, depth: 0.006, mix: 0.12 } },
      { effect: "reverb", params: { room: 0.42, damping: 0.62, wet: 0.2, dry: 0.88, width: 1 } },
      { effect: "delay", params: { time_ms: 260, feedback: 0.24, mix: 0.14 } },
      { effect: "mastering", params: { target_lufs: -13, ceiling: -0.7, low_boost: 1.2, high_boost: 1.4, mid_cut: -0.8, multiband_comp: 1 } },
    ],
    updatedAt: 0,
  },
  {
    source: "builtin",
    name: "Guitar Enhancer",
    effects: [
      { effect: "gate_expander", params: { threshold: -48, ratio: 1.8, floor: -14, attackMs: 6, releaseMs: 160 } },
      { effect: "eq", params: { sub_gain: -3, lm_gain: -1, mid_gain: 1.2, hm_gain: 2.8, pres_gain: 2.2, air_gain: 1.2 } },
      { effect: "compression", params: { threshold: -24, ratio: 2, makeup: 2 } },
      { effect: "reverb", params: { room: 0.24, damping: 0.78, wet: 0.14, dry: 0.94, width: 0.95 } },
      { effect: "exciter", params: { amount: 0.18, tune: 6200, mix: 0.2 } },
      { effect: "normalize", params: { target_db: -1.2 } },
    ],
    updatedAt: 0,
  },
]);

class ProAudioStudioWeb {
  constructor() {
    this.cloud = new StudioCloudStore();
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.engine = new AudioEngine(this.audioCtx);
    this.activeEffectKey = EFFECTS[0].key;
    this.effectValues = {};
    this.processing = false;
    this.previewOriginal = false;
    this.previewEffectEnabled = false;
    this.previewDebounce = 0;
    this.cursorRAF = 0;
    this.userPresets = {};
    this.userProfiles = [];
    this.userSettings = normalizeStudioSettings(DEFAULT_SETTINGS);
    this.currentUser = null;
    this.authInitialized = false;
    this.dragDepth = 0;
    this.swRegistration = null;
    this.swUpdateReady = false;
    this.swUpdateFlowStarted = false;
    this.swControllerReloadTriggered = false;
    this.swPeriodicUpdateTimer = null;
    this.updateHistory = [];
    this.latestCatalogVersion = APP_BUILD.version;
    this.latestCatalogEntry = null;
    this.catalogUpdateAvailable = false;
    this.cacheElements();
    this.initDefaults();
    this.wave = new WaveformView(this.waveCanvas, (seconds) => this.seek(seconds));
    this.engine.onEnded = () => {
      this.updatePlayButton(false);
      this.updateCursor(0);
      this.setStatus("Playback finished");
    };
    this.buildEffectList();
    this.renderActivePanel();
    this.bindUI();
    this.renderAll();
    this.initAuth();
    this.refreshVersionCatalog(false);
    this.registerServiceWorker();
  }

  cacheElements() {
    this.fileMeta = document.getElementById("fileMeta");
    this.statusBar = document.getElementById("statusBar");
    this.waveCanvas = document.getElementById("waveCanvas");
    this.waveTitle = document.getElementById("waveTitle");
    this.selectionLabel = document.getElementById("selectionLabel");
    this.effectList = document.getElementById("effectList");
    this.changeList = document.getElementById("changeList");
    this.panelHost = document.getElementById("panelHost");
    this.timeLabel = document.getElementById("timeLabel");
    this.volumeSlider = document.getElementById("volumeSlider");
    this.audioInput = document.getElementById("audioInput");
    this.previewButton = document.getElementById("previewButton");
    this.loopButton = document.getElementById("loopButton");
    this.playButton = document.querySelector('[data-action="play-toggle"]');
    this.authStatus = document.getElementById("authStatus");
    this.appShell = document.getElementById("app");
    this.signInButton = document.querySelector('[data-action="sign-in"]');
    this.signOutButton = document.querySelector('[data-action="sign-out"]');
    this.profileModal = document.getElementById("profileModal");
    this.profileList = document.getElementById("profileList");
    this.authModal = document.getElementById("authModal");
    this.settingsModal = document.getElementById("settingsModal");
    this.settingsModalContent = document.getElementById("settingsModalContent");
    this.authEmail = document.getElementById("authEmail");
    this.authPassword = document.getElementById("authPassword");
    this.authMessage = document.getElementById("authMessage");
    this.profileModal.addEventListener("click", (event) => {
      if (event.target === this.profileModal) this.closeProfileModal();
    });
    this.authModal.addEventListener("click", (event) => {
      if (event.target === this.authModal) this.closeAuthModal();
    });
    this.settingsModal?.addEventListener("click", (event) => {
      if (event.target === this.settingsModal) this.closeSettingsModal();
    });
  }

  initDefaults() {
    EFFECTS.forEach((effect) => {
      const initial = {};
      effect.controls.forEach(([key,, , , initialValue]) => {
        initial[key] = initialValue;
      });
      this.effectValues[effect.key] = initial;
    });
    this.applyUserSettings(this.loadLocalSettings());
  }

  loadLocalSettings() {
    try {
      const raw = window.localStorage.getItem(STUDIO_SETTINGS_STORAGE_KEY);
      if (!raw) return normalizeStudioSettings(DEFAULT_SETTINGS);
      return normalizeStudioSettings(JSON.parse(raw));
    } catch {
      return normalizeStudioSettings(DEFAULT_SETTINGS);
    }
  }

  persistLocalSettings() {
    try {
      window.localStorage.setItem(STUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(this.userSettings));
    } catch {}
  }

  applyUserSettings(settings = {}) {
    this.userSettings = normalizeStudioSettings(settings);
    document.documentElement.style.setProperty("--app-font-size", `${this.userSettings.appFontSize}px`);
  }

  async initAuth() {
    if (location.protocol === "file:") {
      this.setStatus("Open this app through http://localhost for Firebase sign-in.");
    }
    try {
      await this.cloud.enablePersistence();
    } catch (error) {
      this.setStatus(`Auth persistence warning: ${error.message}`);
    }
    this.cloud.observeAuth(async (user) => {
      this.currentUser = user;
      if (!user) {
        this.userPresets = {};
        this.userProfiles = [];
        this.updateAuthUI();
        if (!this.authInitialized) {
          this.authInitialized = true;
          await this.cloud.ensureAnonymous();
        }
        return;
      }
      this.authInitialized = true;
      if (user.isAnonymous) {
        this.userPresets = {};
        this.userProfiles = [];
        this.applyUserSettings(this.loadLocalSettings());
      } else {
        try {
          const data = await this.cloud.loadUserData(user.uid);
          this.userPresets = data.presets || {};
          this.userProfiles = data.profiles || [];
          this.applyUserSettings(data.settings || DEFAULT_SETTINGS);
          this.persistLocalSettings();
        } catch (error) {
          this.setStatus(`Cloud load failed: ${error.message}`);
        }
      }
      this.updateAuthUI();
      this.renderActivePanel();
      this.renderAll();
    });
    await this.cloud.ensureAnonymous();
  }

  get canUseCloudStorage() {
    return Boolean(this.currentUser && !this.currentUser.isAnonymous);
  }

  updateAuthUI() {
    if (!this.currentUser) {
      this.authStatus.textContent = "Connecting…";
      this.signInButton.textContent = "Sign In / Sign Up";
      this.signInButton.disabled = true;
      this.signOutButton.disabled = true;
      return;
    }
    if (this.currentUser.isAnonymous) {
      this.authStatus.textContent = "Guest";
      this.signInButton.textContent = "Sign In / Sign Up";
      this.signInButton.disabled = false;
      this.signOutButton.disabled = true;
    } else {
      this.authStatus.textContent = this.currentUser.displayName || this.currentUser.email || "Signed In";
      this.signInButton.textContent = "Account Connected";
      this.signInButton.disabled = true;
      this.signOutButton.disabled = false;
    }
  }

  openAuthModal() {
    this.authMessage.textContent = "";
    this.authModal.hidden = false;
    this.authEmail.focus();
  }

  closeAuthModal() {
    this.authModal.hidden = true;
  }

  bindUI() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action));
    });

    document.querySelectorAll(".menu-button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const key = button.dataset.menu;
        const dropdown = document.querySelector(`[data-dropdown="${key}"]`);
        const open = dropdown.classList.contains("open");
        document.querySelectorAll(".menu-dropdown").forEach((el) => el.classList.remove("open"));
        document.querySelectorAll(".menu-button").forEach((el) => el.classList.remove("active"));
        if (!open) {
          dropdown.classList.add("open");
          button.classList.add("active");
        }
      });
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".menu-dropdown").forEach((el) => el.classList.remove("open"));
      document.querySelectorAll(".menu-button").forEach((el) => el.classList.remove("active"));
    });

    this.volumeSlider.addEventListener("input", () => {
      this.engine.setVolume(Number(this.volumeSlider.value));
    });

    this.audioInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await this.loadAudio(file);
      event.target.value = "";
    });

    [window, document, this.appShell].filter(Boolean).forEach((target) => {
      target.addEventListener("dragenter", (event) => this.handleAppDragEnter(event));
      target.addEventListener("dragover", (event) => this.handleAppDragOver(event));
      target.addEventListener("dragleave", (event) => this.handleAppDragLeave(event));
      target.addEventListener("drop", (event) => this.handleAppDrop(event));
    });

    window.addEventListener("keydown", (event) => this.handleShortcut(event));
  }

  isAudioFileDrag(event) {
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) return true;
    const items = Array.from(event.dataTransfer?.items || []);
    if (items.some((item) => item.kind === "file")) return true;
    const types = Array.from(event.dataTransfer?.types || []);
    return types.includes("Files");
  }

  setDragUi(active) {
    this.appShell?.classList.toggle("drag-active", !!active);
  }

  handleAppDragEnter(event) {
    if (!this.isAudioFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    this.setDragUi(true);
  }

  handleAppDragOver(event) {
    if (!this.isAudioFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    this.setDragUi(true);
  }

  handleAppDragLeave(event) {
    if (!this.isAudioFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.setDragUi(false);
  }

  async handleAppDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.setDragUi(false);
    const files = Array.from(event.dataTransfer?.files || []);
    const audioFile = files.find((file) => String(file.type || "").startsWith("audio/"))
      || files.find((file) => /\.(mp3|wav|ogg|m4a|aac|flac|aif|aiff|wma)$/i.test(file.name || ""));
    if (!audioFile) {
      this.setStatus("Drop an audio file to open it.");
      return;
    }
    await this.loadAudio(audioFile);
  }

  buildEffectList() {
    this.effectList.innerHTML = "";
    EFFECTS.forEach((effect) => {
      const button = document.createElement("button");
      button.className = "effect-item";
      button.textContent = effect.label;
      button.addEventListener("click", () => {
        this.activeEffectKey = effect.key;
        this.renderActivePanel();
        this.updateEffectButtons();
      });
      button.dataset.effect = effect.key;
      this.effectList.appendChild(button);
    });
    this.updateEffectButtons();
  }

  getUserPresetEntries(effectKey) {
    return Array.isArray(this.userPresets?.[effectKey]) ? this.userPresets[effectKey] : [];
  }

  async persistCloudData() {
    if (!this.canUseCloudStorage) {
      throw new Error("Sign in to save and load presets or profiles.");
    }
    await this.cloud.saveUserData(this.currentUser.uid, {
      presets: this.userPresets,
      profiles: this.userProfiles,
      settings: this.userSettings,
    });
  }

  updateEffectButtons() {
    this.effectList.querySelectorAll(".effect-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.effect === this.activeEffectKey);
    });
  }

  openSettingsPanel() {
    this.renderSettingsPanel();
    if (this.settingsModal) this.settingsModal.hidden = false;
  }

  closeSettingsModal() {
    if (this.settingsModal) this.settingsModal.hidden = true;
  }

  getPresetManagerEntries() {
    return Object.entries(this.userPresets || {})
      .flatMap(([effectKey, entries]) => (Array.isArray(entries) ? entries.map((entry) => ({ effectKey, ...entry })) : []))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  formatProfileEffectSummary(spec = {}) {
    const effect = EFFECTS.find((item) => item.key === spec.effect);
    const defaults = Object.fromEntries((effect?.controls || []).map(([key,,, , initialValue]) => [key, initialValue]));
    const changed = Object.entries(spec.params || {}).filter(([key, value]) => defaults[key] !== value);
    if (!changed.length) return "Uses saved default settings.";
    return changed
      .slice(0, 5)
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${formatParamValue(value)}`)
      .join(" • ");
  }

  renderSettingsPanel() {
    const panel = document.createElement("div");
    panel.className = "panel settings-panel";
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-title">Settings</div>
          <div class="panel-subtitle">Font size, updates, and preset management for Audio Studio.</div>
        </div>
        <button class="modal-close" data-role="close-settings">×</button>
      </div>
      <div class="settings-grid">
        <section class="settings-card">
          <h3>Text Size</h3>
          <p>Match the reading comfort of the main Guitar Trainer settings page.</p>
          <div class="settings-row">
            <input id="settings-font-size" type="range" min="12" max="24" step="1" value="${this.userSettings.appFontSize}">
            <span id="settings-font-size-label" class="settings-value">${this.userSettings.appFontSize} px</span>
            <button id="settings-save-btn" class="settings-button primary">Save Settings</button>
          </div>
        </section>
        <section class="settings-card">
          <h3>App Updates</h3>
          <p id="settings-update-status">Checking update status...</p>
          <div class="settings-row">
            <button id="settings-update-btn" class="settings-button primary">Update App</button>
            <button id="settings-check-update-btn" class="settings-button">Check For Updates</button>
            <span id="settings-update-ready" class="settings-update-ready hidden">New version ready</span>
          </div>
          <div id="settings-update-description" class="settings-update-description hidden"></div>
          <div id="settings-update-history" class="settings-history"></div>
          <p id="settings-build-info"></p>
        </section>
        <section class="settings-card">
          <h3>User Presets</h3>
          <p>${this.canUseCloudStorage ? "Rename or delete the presets saved to your account." : "Sign in to rename or delete your cloud presets."}</p>
          <div id="settings-preset-manager" class="preset-manager-list"></div>
        </section>
      </div>
    `;
    this.settingsModalContent.replaceChildren(panel);

    const slider = panel.querySelector("#settings-font-size");
    const label = panel.querySelector("#settings-font-size-label");
    slider?.addEventListener("input", () => {
      const size = clamp(Number(slider.value), 12, 24);
      label.textContent = `${size} px`;
      this.applyUserSettings({ ...this.userSettings, appFontSize: size });
    });
    panel.querySelector('[data-role="close-settings"]')?.addEventListener("click", () => this.closeSettingsModal());
    panel.querySelector("#settings-save-btn")?.addEventListener("click", () => this.saveSettings());
    panel.querySelector("#settings-check-update-btn")?.addEventListener("click", () => this.checkForAppUpdate(true));
    panel.querySelector("#settings-update-btn")?.addEventListener("click", () => this.forceAppUpdate());

    this.renderPresetManagerUi();
    this.renderBuildInfo();
    this.updateSettingsUpdateUi();
    this.renderUpdateHistoryUi();
  }

  renderActivePanel() {
    const effect = EFFECTS.find((item) => item.key === this.activeEffectKey);
    const values = this.effectValues[effect.key];
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-title">${effect.title}</div>
          <div class="panel-subtitle">${effect.subtitle}</div>
        </div>
      </div>
      <div class="${effect.key === "eq" ? "eq-grid" : "control-grid"}"></div>
      <div class="preset-row">
        <select class="preset-select">
          <option value="">Choose preset…</option>
        </select>
        <button class="save-preset-button" ${this.canUseCloudStorage ? "" : "disabled"}>${this.canUseCloudStorage ? "Save As Preset" : "Sign In To Save Preset"}</button>
        <label class="preview-toggle">
          <input type="checkbox" ${this.previewEffectEnabled ? "checked" : ""}>
          <span>Preview Before Apply</span>
        </label>
      </div>
      <div class="apply-row">
        <button class="apply-button">Apply Effect</button>
        <div class="panel-note">${effect.note}</div>
      </div>
    `;
    const grid = panel.querySelector(".eq-grid, .control-grid");
    effect.controls.forEach(([key, label, min, max, initial, step, fmt, type]) => {
      const current = values[key] ?? initial;
      const isEq = effect.key === "eq";
      const card = document.createElement("div");
      card.className = isEq ? "eq-strip" : "control-card";
      if (type === "toggle") {
        card.innerHTML = `
          <label><span>${label}</span><span class="value">${fmt(current)}</span></label>
          <input type="checkbox" ${current >= 0.5 ? "checked" : ""}>
        `;
        const checkbox = card.querySelector("input");
        const valueLabel = card.querySelector(".value");
        checkbox.addEventListener("change", () => {
          values[key] = checkbox.checked ? 1 : 0;
          valueLabel.textContent = fmt(values[key]);
          this.queuePreviewRender();
        });
      } else if (isEq) {
        card.innerHTML = `
          <div class="eq-value">${fmt(Number(current))}</div>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${current}">
          <div class="eq-label">${label}</div>
        `;
        const range = card.querySelector("input");
        const valueLabel = card.querySelector(".eq-value");
        range.addEventListener("input", () => {
          values[key] = Number(range.value);
          valueLabel.textContent = fmt(values[key]);
          this.queuePreviewRender();
        });
      } else {
        card.innerHTML = `
          <label><span>${label}</span><span class="value">${fmt(Number(current))}</span></label>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${current}">
        `;
        const range = card.querySelector("input");
        const valueLabel = card.querySelector(".value");
        range.addEventListener("input", () => {
          values[key] = Number(range.value);
          valueLabel.textContent = fmt(values[key]);
          this.queuePreviewRender();
        });
      }
      grid.appendChild(card);
    });

    const presetSelect = panel.querySelector(".preset-select");
    const builtInGroup = document.createElement("optgroup");
    builtInGroup.label = "Built-in Presets";
    Object.entries(effect.presets).forEach(([name]) => {
      const option = document.createElement("option");
      option.value = `builtin:${name}`;
      option.textContent = `[Built-in] ${name}`;
      builtInGroup.appendChild(option);
    });
    presetSelect.appendChild(builtInGroup);

    const userEntries = this.getUserPresetEntries(effect.key);
    if (userEntries.length) {
      const userGroup = document.createElement("optgroup");
      userGroup.label = "Your Presets";
      userEntries.forEach((entry) => {
        const option = document.createElement("option");
        option.value = `user:${entry.name}`;
        option.textContent = `[User] ${entry.name}`;
        userGroup.appendChild(option);
      });
      presetSelect.appendChild(userGroup);
    }

    presetSelect.addEventListener("change", () => {
      let preset = null;
      if (presetSelect.value.startsWith("builtin:")) {
        preset = effect.presets[presetSelect.value.replace("builtin:", "")];
      } else if (presetSelect.value.startsWith("user:")) {
        const found = userEntries.find((entry) => entry.name === presetSelect.value.replace("user:", ""));
        preset = found?.params;
      }
      if (!preset) return;
      this.effectValues[effect.key] = { ...this.effectValues[effect.key], ...preset };
      this.renderActivePanel();
      this.queuePreviewRender(true);
    });

    panel.querySelector(".save-preset-button").addEventListener("click", () => this.saveCurrentPreset());

    const previewToggle = panel.querySelector('.preview-toggle input');
    previewToggle.addEventListener("change", () => {
      this.previewEffectEnabled = previewToggle.checked;
      this.queuePreviewRender(true);
    });

    panel.querySelector(".apply-button").addEventListener("click", () => this.applyActiveEffect());
    this.panelHost.replaceChildren(panel);
  }

  getActiveEffectSpec() {
    const effect = EFFECTS.find((item) => item.key === this.activeEffectKey);
    return {
      effect: effect.key,
      params: cloneEffectChain([this.effectValues[effect.key]])[0],
    };
  }

  async loadAudio(file) {
    try {
      this.setBusy(true, "Loading audio…");
      await this.audioCtx.resume();
      await this.engine.loadFile(file);
      this.previewOriginal = false;
      this.engine.previewOriginal = false;
      this.previewEffectEnabled = false;
      this.wave.clearSelection();
      this.renderAll();
      this.setStatus(`Loaded ${file.name}`);
    } catch (error) {
      this.setStatus(`Load failed: ${error.message}`);
      alert(`Could not load this audio file.\n\n${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  async exportAudio() {
    if (!this.engine.currentBuffer) return alert("Open a file first.");
    const name = this.engine.fileName.replace(/\.[^.]+$/, "") || "export";
    const blob = encodeWav(this.engine.currentBuffer);
    downloadBlob(blob, `${name}-edited.wav`);
    this.setStatus("Exported WAV download");
  }

  async saveCurrentPreset() {
    if (!this.canUseCloudStorage) {
      alert("Guest mode can edit audio, but saving presets requires sign-in.");
      return;
    }
    const effect = EFFECTS.find((item) => item.key === this.activeEffectKey);
    const name = prompt(`Save ${effect.label} preset as`, `${effect.label} Preset`);
    if (!name) return;
    const effectKey = effect.key;
    const list = this.getUserPresetEntries(effectKey).filter((entry) => entry.name !== name);
    list.push({
      name,
      params: cloneEffectChain([this.effectValues[effectKey]])[0],
      updatedAt: Date.now(),
    });
    this.userPresets[effectKey] = list;
    try {
      await this.persistCloudData();
      this.renderSettingsPanel();
      this.setStatus(`Saved preset ${name}`);
    } catch (error) {
      this.setStatus(`Preset save failed: ${error.message}`);
      alert(`Could not save preset.\n\n${error.message}`);
    }
  }

  async renameUserPreset(effectKey, oldName) {
    if (!this.canUseCloudStorage) {
      alert("Sign in to rename presets.");
      return;
    }
    const nextName = prompt("Rename preset", oldName);
    if (!nextName || nextName === oldName) return;
    const list = this.getUserPresetEntries(effectKey);
    const target = list.find((entry) => entry.name === oldName);
    if (!target) return;
    this.userPresets[effectKey] = list
      .filter((entry) => entry.name !== oldName && entry.name !== nextName)
      .concat([{ ...target, name: nextName, updatedAt: Date.now() }]);
    try {
      await this.persistCloudData();
      this.renderSettingsPanel();
      this.setStatus(`Renamed preset to ${nextName}`);
    } catch (error) {
      this.setStatus(`Rename failed: ${error.message}`);
      alert(`Could not rename preset.\n\n${error.message}`);
    }
  }

  async deleteUserPreset(effectKey, name) {
    if (!this.canUseCloudStorage) {
      alert("Sign in to delete presets.");
      return;
    }
    if (!confirm(`Delete preset "${name}"?`)) return;
    this.userPresets[effectKey] = this.getUserPresetEntries(effectKey).filter((entry) => entry.name !== name);
    if (!this.userPresets[effectKey].length) delete this.userPresets[effectKey];
    try {
      await this.persistCloudData();
      this.renderSettingsPanel();
      this.setStatus(`Deleted preset ${name}`);
    } catch (error) {
      this.setStatus(`Delete failed: ${error.message}`);
      alert(`Could not delete preset.\n\n${error.message}`);
    }
  }

  renderPresetManagerUi() {
    const host = document.getElementById("settings-preset-manager");
    if (!host) return;
    host.innerHTML = "";
    const entries = this.getPresetManagerEntries();
    if (!entries.length) {
      host.innerHTML = `<div class="preset-empty">No user presets saved yet.</div>`;
      return;
    }
    entries.forEach((entry) => {
      const effectLabel = EFFECTS.find((item) => item.key === entry.effectKey)?.label || entry.effectKey;
      const when = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "Unknown date";
      const item = document.createElement("div");
      item.className = "preset-manager-item";
      item.innerHTML = `
        <div>
          <div class="preset-manager-name">${escapeHtml(entry.name || "Untitled preset")}</div>
          <div class="preset-manager-meta">${escapeHtml(effectLabel)} • Updated ${escapeHtml(when)}</div>
        </div>
        <div class="preset-manager-actions">
          <button class="settings-button" data-role="rename">Rename</button>
          <button class="settings-button" data-role="delete">Delete</button>
        </div>
      `;
      item.querySelector('[data-role="rename"]')?.addEventListener("click", () => this.renameUserPreset(entry.effectKey, entry.name));
      item.querySelector('[data-role="delete"]')?.addEventListener("click", () => this.deleteUserPreset(entry.effectKey, entry.name));
      host.appendChild(item);
    });
  }

  async saveSettings() {
    this.persistLocalSettings();
    if (!this.canUseCloudStorage) {
      this.renderSettingsPanel();
      this.setStatus("Settings saved on this device.");
      return;
    }
    try {
      await this.persistCloudData();
      this.renderSettingsPanel();
      this.setStatus("Settings saved.");
    } catch (error) {
      this.setStatus(`Settings save failed: ${error.message}`);
      alert(`Could not save settings.\n\n${error.message}`);
    }
  }

  renderBuildInfo() {
    const el = document.getElementById("settings-build-info");
    if (!el) return;
    el.textContent = `Version ${APP_BUILD.version} • Updated ${new Date().toLocaleString()}`;
  }

  renderUpdateHistoryUi() {
    const historyEl = document.getElementById("settings-update-history");
    const descriptionEl = document.getElementById("settings-update-description");
    if (historyEl) {
      if (!this.updateHistory.length) {
        historyEl.innerHTML = `<p class="preset-empty">No update log available yet.</p>`;
      } else {
        historyEl.innerHTML = this.updateHistory.slice(0, 10).map((item) => {
          const when = item.releasedAt ? new Date(item.releasedAt) : null;
          const dateLabel = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : "Unknown date";
          return `
            <div class="settings-history-item">
              <div class="settings-history-item-title">${escapeHtml(item.version || "Unversioned update")}</div>
              <div class="settings-history-item-meta">${escapeHtml(dateLabel)}${item.summary ? ` • ${escapeHtml(item.summary)}` : ""}</div>
            </div>
          `;
        }).join("");
      }
    }

    if (!descriptionEl) return;
    if (!this.catalogUpdateAvailable || !this.latestCatalogEntry) {
      descriptionEl.classList.add("hidden");
      descriptionEl.innerHTML = "";
      return;
    }
    const changeLines = this.latestCatalogEntry.changes.length
      ? `<ul>${this.latestCatalogEntry.changes.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    descriptionEl.innerHTML = `
      <div class="settings-history-item-title">${escapeHtml(this.latestCatalogEntry.version || this.latestCatalogVersion)}</div>
      ${this.latestCatalogEntry.summary ? `<div class="settings-history-item-meta">${escapeHtml(this.latestCatalogEntry.summary)}</div>` : ""}
      ${this.latestCatalogEntry.description ? `<p>${escapeHtml(this.latestCatalogEntry.description)}</p>` : ""}
      ${changeLines}
    `;
    descriptionEl.classList.remove("hidden");
  }

  updateSettingsUpdateUi() {
    const status = document.getElementById("settings-update-status");
    const notice = document.getElementById("settings-update-ready");
    const hasAnyUpdate = this.swUpdateReady || this.catalogUpdateAvailable;
    if (status) {
      status.textContent = hasAnyUpdate
        ? `New version ${this.latestCatalogVersion || APP_BUILD.version} available. Tap Update to apply it.`
        : `App is up to date (build ${APP_BUILD.version}).`;
    }
    if (notice) notice.classList.toggle("hidden", !hasAnyUpdate);
  }

  markUpdateReady(showStatusMessage = true) {
    if (this.swUpdateReady) return;
    this.swUpdateReady = true;
    this.updateSettingsUpdateUi();
    if (showStatusMessage) this.setStatus("New app version available. Open Settings and tap Update.");
  }

  async refreshVersionCatalog(showFeedback = false) {
    try {
      const response = await fetch(`${APP_VERSIONS_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const updates = Array.isArray(payload?.updates)
        ? payload.updates.map(normalizeVersionUpdateEntry).filter((item) => item.version)
        : [];
      updates.sort((a, b) => compareVersions(b.version, a.version));
      this.updateHistory = updates;
      this.latestCatalogVersion = String(payload?.latestVersion || updates[0]?.version || APP_BUILD.version);
      this.latestCatalogEntry = updates.find((item) => item.version === this.latestCatalogVersion) || updates[0] || null;
      this.catalogUpdateAvailable = compareVersions(this.latestCatalogVersion, APP_BUILD.version) > 0;
      this.updateSettingsUpdateUi();
      this.renderUpdateHistoryUi();
      if (showFeedback) {
        this.setStatus(this.catalogUpdateAvailable ? `New version ${this.latestCatalogVersion} is available.` : "No new version in update log right now.");
      }
      return this.catalogUpdateAvailable;
    } catch (error) {
      this.renderUpdateHistoryUi();
      if (showFeedback) this.setStatus("Could not load update log.");
      return false;
    }
  }

  async waitForWaitingWorker(registration, timeoutMs = 12000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (registration.waiting) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        await registration.update();
      } catch {}
    }
    return !!registration.waiting;
  }

  startPeriodicUpdateChecks() {
    if (!("serviceWorker" in navigator) || this.swPeriodicUpdateTimer) return;
    this.swPeriodicUpdateTimer = window.setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const reg = this.swRegistration || await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        this.swRegistration = reg;
        await reg.update();
        await this.refreshVersionCatalog(false);
      } catch {}
    }, 10 * 60 * 1000);
  }

  async checkForAppUpdate(showFeedback = false) {
    if (!("serviceWorker" in navigator)) {
      if (showFeedback) this.setStatus("This browser does not support service worker updates.");
      return false;
    }
    if (!navigator.onLine) {
      if (showFeedback) this.setStatus("You are offline. Connect to check for updates.");
      return false;
    }
    const btn = document.getElementById("settings-check-update-btn");
    const originalLabel = btn?.textContent || "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking...";
    }
    const status = document.getElementById("settings-update-status");
    if (status) status.textContent = "Checking for updates...";
    try {
      const hasCatalogUpdate = await this.refreshVersionCatalog(false);
      const reg = this.swRegistration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        this.updateSettingsUpdateUi();
        return hasCatalogUpdate;
      }
      this.swRegistration = reg;
      await reg.update();
      const hasWaiting = await this.waitForWaitingWorker(reg);
      if (hasWaiting) this.markUpdateReady(false);
      if (hasWaiting || hasCatalogUpdate) {
        this.updateSettingsUpdateUi();
        if (showFeedback) {
          this.setStatus(hasCatalogUpdate
            ? `New version ${this.latestCatalogVersion} found. Tap Update to apply it.`
            : "New app files are ready. Tap Update to apply it.");
        }
        return true;
      }
      this.updateSettingsUpdateUi();
      if (showFeedback) this.setStatus("No new update right now.");
      return false;
    } catch (error) {
      this.updateSettingsUpdateUi();
      if (showFeedback) this.setStatus("Could not check for updates.");
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel || "Check For Updates";
      }
    }
  }

  hardReloadWithBypass() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("__app_update", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }

  async forceAppUpdate() {
    if (!("serviceWorker" in navigator)) {
      this.setStatus("This browser does not support service worker updates.");
      return;
    }
    const btn = document.getElementById("settings-update-btn");
    const originalLabel = btn?.textContent || "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Updating...";
    }
    this.swUpdateFlowStarted = true;
    this.setStatus("Applying update...");
    try {
      let reg = this.swRegistration || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      }
      if (!reg) {
        this.hardReloadWithBypass();
        return;
      }
      this.swRegistration = reg;
      const status = document.getElementById("settings-update-status");
      if (status) status.textContent = "Checking for updates...";
      await reg.update();
      if (reg.waiting) {
        this.swUpdateReady = true;
        this.updateSettingsUpdateUi();
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("guitartrainer-")).map((key) => caches.delete(key)));
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "FORCE_UPDATE" });
      }
      if (status) status.textContent = "Refreshing cached app files...";
      setTimeout(() => this.hardReloadWithBypass(), 1500);
    } catch (error) {
      this.swUpdateFlowStarted = false;
      this.setStatus("Could not update right now.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel || "Update App";
      }
    }
  }

  async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    try {
      if (isLocalhost) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        return;
      }
      this.swRegistration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      this.startPeriodicUpdateChecks();
      if (this.swRegistration.waiting) this.markUpdateReady();
      this.swRegistration.addEventListener("updatefound", () => {
        const installing = this.swRegistration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            this.markUpdateReady();
          }
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (this.swControllerReloadTriggered) return;
        this.swControllerReloadTriggered = true;
        if (this.swUpdateFlowStarted) window.location.reload();
      });
      navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event?.data || {};
        if (data.type === "APP_FILES_REFRESHED") {
          this.updateSettingsUpdateUi();
          this.setStatus("App files refreshed. Reloading...");
          if (this.swUpdateFlowStarted) setTimeout(() => this.hardReloadWithBypass(), 500);
          return;
        }
        if (data.type === "APP_FILES_REFRESH_FAILED") {
          this.swUpdateFlowStarted = false;
          this.setStatus("Could not refresh all app files.");
          return;
        }
        if (data.type === "SW_ACTIVE") {
          this.swUpdateFlowStarted = false;
          this.swUpdateReady = false;
          this.updateSettingsUpdateUi();
        }
      });
    } catch (error) {
      this.setStatus(`Service worker warning: ${error.message}`);
    }
  }

  async saveProfile() {
    if (!this.canUseCloudStorage) {
      alert("Guest mode cannot save or load cloud profiles. Please sign in first.");
      return;
    }
    const savableEffects = this.getSavableProfileEffects();
    if (!savableEffects.length) {
      return alert("No savable effects found. Profiles skip trim, cut, and any effect that changes audio length.");
    }
    const name = prompt("Profile name", "effect-profile") || "effect-profile";
    this.userProfiles = this.userProfiles.filter((profile) => profile.name !== name);
    this.userProfiles.push({
      name,
      effects: savableEffects,
      updatedAt: Date.now(),
    });
    try {
      await this.persistCloudData();
      this.setStatus(`Saved profile ${name}`);
    } catch (error) {
      this.setStatus(`Profile save failed: ${error.message}`);
      alert(`Could not save profile.\n\n${error.message}`);
    }
  }

  openProfileModal() {
    if (!this.canUseCloudStorage && !BUILTIN_PROFILES.length) {
      alert("Guest mode cannot save or load cloud profiles. Please sign in first.");
      return;
    }
    this.renderProfileList();
    this.profileModal.hidden = false;
  }

  closeProfileModal() {
    this.profileModal.hidden = true;
  }

  renderProfileList() {
    this.profileList.innerHTML = "";
    const profiles = [
      ...BUILTIN_PROFILES,
      ...[...this.userProfiles].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((profile) => ({ ...profile, source: "user" })),
    ];
    if (!profiles.length) {
      const empty = document.createElement("div");
      empty.className = "profile-item";
      empty.innerHTML = `<div><div class="profile-name">No saved profiles yet</div><div class="profile-meta">Save your current effect chain from the File menu.</div></div>`;
      this.profileList.appendChild(empty);
      return;
    }
    profiles.forEach((profile) => {
        const item = document.createElement("div");
        item.className = "profile-item";
        const detailsHtml = Array.isArray(profile.effects) && profile.effects.length
          ? profile.effects.map((spec, index) => {
              const effectLabel = EFFECTS.find((entry) => entry.key === spec.effect)?.label || spec.effect || `Effect ${index + 1}`;
              return `
                <div class="profile-effect">
                  <div class="profile-effect-name">${escapeHtml(`${index + 1}. ${effectLabel}`)}</div>
                  <div class="profile-effect-meta">${escapeHtml(this.formatProfileEffectSummary(spec))}</div>
                </div>
              `;
            }).join("")
          : `<div class="profile-effect"><div class="profile-effect-name">No effects stored</div><div class="profile-effect-meta">This profile does not currently contain any savable effects.</div></div>`;
        item.innerHTML = `
          <div class="profile-top">
            <div>
              <div class="profile-name">${escapeHtml(profile.name)}</div>
              <div class="profile-meta">${profile.effects?.length || 0} effects • ${profile.source === "builtin" ? "Built-in profile" : "Saved to your account"}</div>
            </div>
            <div class="profile-actions">
              <button class="profile-apply">Apply</button>
            </div>
          </div>
          <details class="profile-details">
            <summary>Show profile details</summary>
            <div class="profile-details-body">${detailsHtml}</div>
          </details>
        `;
        item.querySelector(".profile-apply").addEventListener("click", async () => {
          this.closeProfileModal();
          await this.applyCloudProfile(profile);
        });
        this.profileList.appendChild(item);
      });
  }

  async applyCloudProfile(profile) {
    if (!this.engine.currentBuffer) return alert("Open a file first.");
    try {
      this.setBusy(true, `Applying profile ${profile.name}…`);
      await this.engine.applyProfile(profile.effects || []);
      this.renderAll();
      this.setStatus(`Applied profile ${profile.name}`);
    } catch (error) {
      this.setStatus(`Profile failed: ${error.message}`);
      alert(`Could not apply that profile.\n\n${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  async applyActiveEffect() {
    if (!this.engine.currentBuffer) return alert("Open a file first.");
    if (this.previewOriginal) return alert("Switch back to edited preview before applying effects.");
    const effect = EFFECTS.find((item) => item.key === this.activeEffectKey);
    const spec = this.getActiveEffectSpec();
    try {
      this.setBusy(true, `Applying ${effect.label}…`);
      await this.engine.applyEffect(spec);
      this.previewEffectEnabled = false;
      this.renderAll();
      this.setStatus(`${effect.label} applied`);
    } catch (error) {
      this.setStatus(`Effect failed: ${error.message}`);
      alert(`Could not apply the effect.\n\n${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  handleAction(action) {
    switch (action) {
      case "open-audio":
        this.audioInput.click();
        break;
      case "new-project":
        this.engine.newProject();
        this.previewOriginal = false;
        this.engine.previewOriginal = false;
        this.previewEffectEnabled = false;
        this.wave.clearSelection();
        this.stopCursorUpdates();
        this.updatePlayButton(false);
        this.renderAll();
        this.setStatus("Started a new empty project");
        break;
      case "export-audio":
        this.exportAudio();
        break;
      case "save-profile":
        this.saveProfile();
        break;
      case "apply-profile":
        this.openProfileModal();
        break;
      case "sign-in":
        this.openAuthModal();
        break;
      case "sign-out":
        this.signOut();
        break;
      case "close-profile-modal":
        this.closeProfileModal();
        break;
      case "close-auth-modal":
        this.closeAuthModal();
        break;
      case "email-sign-in":
        this.emailSignIn();
        break;
      case "email-sign-up":
        this.emailSignUp();
        break;
      case "undo":
        if (this.engine.undo()) {
          this.renderAll();
          this.setStatus("Undo");
        }
        break;
      case "redo":
        if (this.engine.redo()) {
          this.renderAll();
          this.setStatus("Redo");
        }
        break;
      case "cut":
        this.cutSelection();
        break;
      case "trim":
        this.trimSelection();
        break;
      case "reset":
        this.engine.resetToOriginal();
        this.wave.clearSelection();
        this.renderAll();
        this.setStatus("Reset to original");
        break;
      case "to-start":
        this.seek(0);
        this.updateCursor(0);
        break;
      case "play-toggle":
        this.togglePlayback();
        break;
      case "stop":
        this.engine.stop();
        this.stopCursorUpdates();
        this.updatePlayButton(false);
        this.updateCursor(0);
        this.setStatus("Stopped");
        break;
      case "play-selection":
        this.playSelection();
        break;
      case "toggle-loop":
        this.engine.loop = !this.engine.loop;
        this.loopButton.classList.toggle("active", this.engine.loop);
        this.setStatus(this.engine.loop ? "Loop enabled" : "Loop disabled");
        break;
      case "toggle-original":
        this.previewOriginal = !this.previewOriginal;
        this.engine.previewOriginal = this.previewOriginal;
        if (this.previewOriginal) this.engine.clearPreviewBuffer();
        this.engine.stop();
        this.stopCursorUpdates();
        this.updatePlayButton(false);
        this.updateCursor(0);
        this.renderAll();
        this.setStatus(this.previewOriginal ? "Previewing original" : "Previewing edited");
        break;
      case "open-settings":
        this.openSettingsPanel();
        break;
      case "show-shortcuts":
        alert(
          "Ctrl+N New project\n" +
          "Ctrl+O Open audio\n" +
          "Ctrl+E Export audio\n" +
          "Ctrl+Shift+S Save profile\n" +
          "Ctrl+Shift+O Apply profile\n" +
          "Ctrl+Z Undo\n" +
          "Ctrl+Y Redo\n" +
          "Ctrl+X Cut selection\n" +
          "Ctrl+T Trim to selection\n" +
          "Ctrl+B Toggle original preview\n" +
          "Ctrl+, Open settings"
        );
        break;
      case "show-about":
        alert("ProAudio Studio Web\n\nBrowser-based audio editor inspired by the Python desktop app.");
        break;
      default:
        break;
    }
  }

  handleShortcut(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey && event.shiftKey && key === "s") {
      event.preventDefault();
      this.saveProfile();
    } else if (event.ctrlKey && event.shiftKey && key === "o") {
      event.preventDefault();
      this.openProfileModal();
    } else if (event.ctrlKey && key === "n") {
      event.preventDefault();
      this.handleAction("new-project");
    } else if (event.ctrlKey && key === "o") {
      event.preventDefault();
      this.audioInput.click();
    } else if (event.ctrlKey && key === "e") {
      event.preventDefault();
      this.exportAudio();
    } else if (event.ctrlKey && key === "z") {
      event.preventDefault();
      this.handleAction("undo");
    } else if (event.ctrlKey && key === "y") {
      event.preventDefault();
      this.handleAction("redo");
    } else if (event.ctrlKey && key === "x") {
      event.preventDefault();
      this.cutSelection();
    } else if (event.ctrlKey && key === "t") {
      event.preventDefault();
      this.trimSelection();
    } else if (event.ctrlKey && key === "b") {
      event.preventDefault();
      this.handleAction("toggle-original");
    } else if (event.ctrlKey && key === ",") {
      event.preventDefault();
      this.openSettingsPanel();
    } else if (key === " ") {
      event.preventDefault();
      this.togglePlayback();
    }
  }

  getAuthFormValues() {
    const email = this.authEmail.value.trim();
    const password = this.authPassword.value;
    if (!email || !password) {
      throw new Error("Enter both email and password.");
    }
    return { email, password };
  }

  async emailSignIn() {
    try {
      const { email, password } = this.getAuthFormValues();
      this.authMessage.textContent = "Signing in…";
      await this.cloud.signInWithEmail(email, password);
      this.closeAuthModal();
      this.setStatus("Signed in");
    } catch (error) {
      this.authMessage.textContent = error.message;
      this.setStatus(`Sign-in failed: ${error.message}`);
    }
  }

  async emailSignUp() {
    try {
      const { email, password } = this.getAuthFormValues();
      this.authMessage.textContent = "Creating account…";
      await this.cloud.signUpWithEmail(email, password);
      this.closeAuthModal();
      this.setStatus("Account created");
    } catch (error) {
      this.authMessage.textContent = error.message;
      this.setStatus(`Sign-up failed: ${error.message}`);
    }
  }

  async signOut() {
    try {
      await this.cloud.signOutToGuest();
      this.setStatus("Signed out to guest mode");
    } catch (error) {
      this.setStatus(`Sign-out failed: ${error.message}`);
      alert(`Could not sign out.\n\n${error.message}`);
    }
  }

  togglePlayback() {
    if (!this.engine.activeBuffer) return;
    this.audioCtx.resume();
    if (this.engine.isPlaying) {
      this.engine.pause();
      this.stopCursorUpdates();
      this.updatePlayButton(false);
      this.setStatus("Paused");
    } else {
      this.engine.resume();
      this.startCursorUpdates();
      this.updatePlayButton(true);
      this.setStatus("Playing");
    }
  }

  playSelection() {
    if (!this.engine.currentBuffer || this.previewOriginal) return;
    const selection = this.wave.getSelection();
    if (!selection) return alert("Drag on the waveform to select a region first.");
    this.audioCtx.resume();
    this.engine.play(selection[0], selection[1]);
    this.startCursorUpdates();
    this.updatePlayButton(true);
    this.setStatus(`Playing selection ${fmtTime(selection[0])} – ${fmtTime(selection[1])}`);
  }

  seek(seconds) {
    if (!this.engine.activeBuffer) return;
    const clamped = clamp(seconds, 0, this.engine.activeBuffer.duration);
    if (this.engine.isPlaying) {
      this.audioCtx.resume();
      this.engine.seek(clamped);
    } else {
      this.engine.pauseOffset = clamped;
    }
    this.updateCursor(clamped);
  }

  updateCursor(seconds) {
    this.wave.setCursor(seconds);
    this.timeLabel.textContent = `${fmtTime(seconds)} / ${fmtTime(this.engine.duration)}`;
  }

  startCursorUpdates() {
    this.stopCursorUpdates();
    const tick = () => {
      if (!this.engine.isPlaying) return;
      this.updateCursor(this.engine.position);
      this.cursorRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  stopCursorUpdates() {
    if (this.cursorRAF) cancelAnimationFrame(this.cursorRAF);
    this.cursorRAF = 0;
  }

  updatePlayButton(playing) {
    this.playButton.textContent = playing ? "⏸" : "▶";
  }

  trimSelection() {
    const selection = this.wave.getSelection();
    if (!selection) return alert("Drag on the waveform to select a region first.");
    this.engine.trim(selection[0], selection[1]);
    this.wave.clearSelection();
    this.renderAll();
    this.setStatus(`Trimmed to ${fmtTime(selection[0])} – ${fmtTime(selection[1])}`);
  }

  cutSelection() {
    const selection = this.wave.getSelection();
    if (!selection) return alert("Drag on the waveform to select a region first.");
    this.engine.cut(selection[0], selection[1]);
    this.wave.clearSelection();
    this.renderAll();
    this.setStatus(`Cut ${fmtTime(selection[0])} – ${fmtTime(selection[1])}`);
  }

  setBusy(busy, status = "") {
    this.processing = busy;
    document.querySelectorAll("button, input").forEach((el) => {
      if (el.id === "audioInput") return;
      el.disabled = busy;
    });
    if (busy) this.setStatus(status);
    else this.renderAll();
  }

  setStatus(text) {
    this.statusBar.textContent = text;
  }

  queuePreviewRender(force = false) {
    clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => {
      this.updateEffectPreview(force);
    }, 120);
  }

  async updateEffectPreview(force = false) {
    if (!this.engine.currentBuffer || this.previewOriginal) return;
    if (!this.previewEffectEnabled) {
      if (this.engine.previewBuffer) {
        const wasPlaying = this.engine.isPlaying;
        const pos = this.engine.position;
        const end = this.engine.playEnd;
        this.engine.clearPreviewBuffer();
        if (wasPlaying) {
          this.engine.play(pos, end);
          this.startCursorUpdates();
        }
        this.renderAll();
      }
      return;
    }
    if (this.processing && !force) return;
    const wasPlaying = this.engine.isPlaying;
    const pos = this.engine.position;
    const end = this.engine.playEnd;
    const spec = this.getActiveEffectSpec();
    try {
      this.engine.previewBuffer = await this.engine.processEffectBuffer(this.engine.currentBuffer, spec);
      if (wasPlaying) {
        this.engine.play(pos, end);
        this.startCursorUpdates();
      }
      this.renderAll();
      this.setStatus(`Previewing ${EFFECTS.find((item) => item.key === spec.effect)?.label}`);
    } catch (error) {
      this.setStatus(`Preview failed: ${error.message}`);
    }
  }

  getSavableProfileEffects() {
    return cloneEffectChain(this.engine.effectChain).filter((spec) => {
      if (spec.effect === "pitch_time") {
        const rate = spec.params?.rate ?? 1;
        return Math.abs(rate - 1) <= 0.02;
      }
      return true;
    });
  }

  renderChangeList() {
    this.changeList.innerHTML = "";
    if (!this.engine.changeLog.length) {
      const empty = document.createElement("div");
      empty.className = "change-item";
      empty.innerHTML = `<div class="change-name">No applied effects yet</div>
        <div class="change-meta">Effects and edits like trim or cut appear here as you work.</div>`;
      this.changeList.appendChild(empty);
      return;
    }

    this.engine.changeLog.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "change-item";
      let summary = entry.meta || "";
      if (!summary && entry.params) {
        const entries = Object.entries(entry.params).filter(([, value]) => {
          if (entry.effect === "pitch_time" && value === 1) return false;
          return value !== 0 && value !== false;
        });
        summary = entries.slice(0, 3).map(([key, value]) => {
          const label = key.replaceAll("_", " ");
          return `${label}: ${formatParamValue(value)}`;
        }).join(" · ");
      }
      item.innerHTML = `
        <div class="change-name">${index + 1}. ${entry.label}</div>
        <div class="change-meta">${summary || "Applied with default settings."}</div>
      `;
      this.changeList.appendChild(item);
    });
  }

  renderAll() {
    const active = this.engine.activeBuffer;
    this.fileMeta.textContent = this.engine.fileName
      ? `${this.engine.fileName} | ${fmtTime(this.engine.duration)} | ${this.engine.currentBuffer?.sampleRate || 0} Hz`
      : "No file loaded";
    this.waveTitle.textContent = this.engine.fileName
      ? `${this.engine.fileName} ${this.previewOriginal ? "[ORIGINAL]" : "[EDITED]"}`
      : "Open an audio file to begin";
    this.selectionLabel.textContent = this.previewOriginal
      ? "Original preview is read-only"
      : (this.previewEffectEnabled
          ? "Preview mode on: adjust controls to hear this effect before applying"
          : "Click waveform to seek, drag to select");
    this.previewButton.textContent = this.previewOriginal ? "Preview Original" : "Preview Edited";
    this.previewButton.classList.toggle("active", this.previewOriginal);
    this.loopButton.classList.toggle("active", this.engine.loop);
    this.wave.setBuffer(active, { previewOriginal: this.previewOriginal });
    this.updateCursor(this.engine.position || 0);
    this.updateEffectButtons();
    this.renderChangeList();
    if (this.settingsModal && !this.settingsModal.hidden) {
      this.renderBuildInfo();
      this.updateSettingsUpdateUi();
      this.renderUpdateHistoryUi();
      this.renderPresetManagerUi();
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new ProAudioStudioWeb();
});
