let bridge = null;
let audioCtx = null;
let sourceNode = null;
let sourceEl = null;
let loadedDataUrl = '';
let currentProfileId = '';
let profiles = [];

const state = {
  compression: { enabled: false, threshold: -24, ratio: 4, attack: 0.01, release: 0.25 },
  reverb: { enabled: false, decay: 2.2, mix: 0.25 },
  eq: { enabled: false, low: 0, mid: 0, high: 0 },
  delay: { enabled: false, time: 0.22, feedback: 0.32, mix: 0.2 }
};

const nodes = {
  inputGain: null,
  outputGain: null,
  comp: null,
  reverbConvolver: null,
  reverbDry: null,
  reverbWet: null,
  eqLow: null,
  eqMid: null,
  eqHigh: null,
  delayNode: null,
  delayFeedback: null,
  delayWet: null,
  delayDry: null
};

function el(id) { return document.getElementById(id); }
function bool(v) { return !!v; }

function setStatus(text = '', isError = false) {
  const status = el('tool-sfx-status');
  if (!status) return;
  status.textContent = text || 'Choose an uploaded looper track or upload a file.';
  status.classList.toggle('text-danger', !!isError);
  status.classList.toggle('text-gray-500', !isError);
}

function cloneState() { return JSON.parse(JSON.stringify(state)); }

function updateUiFromState() {
  const map = [['comp', 'compression'], ['reverb', 'reverb'], ['eq', 'eq'], ['delay', 'delay']];
  map.forEach(([prefix, key]) => {
    const section = state[key];
    const toggle = el(`tool-sfx-${prefix}-enabled`);
    if (toggle) toggle.checked = !!section.enabled;
  });
  const apply = (id, value, suffix = '') => {
    const input = el(id);
    const label = el(`${id}-label`);
    if (input) input.value = String(value);
    if (label) label.textContent = `${Number(value)}${suffix}`;
  };
  apply('tool-sfx-comp-threshold', state.compression.threshold, ' dB');
  apply('tool-sfx-comp-ratio', state.compression.ratio, ':1');
  apply('tool-sfx-comp-attack', state.compression.attack, ' s');
  apply('tool-sfx-comp-release', state.compression.release, ' s');
  apply('tool-sfx-reverb-decay', state.reverb.decay, ' s');
  apply('tool-sfx-reverb-mix', state.reverb.mix, '');
  apply('tool-sfx-eq-low', state.eq.low, ' dB');
  apply('tool-sfx-eq-mid', state.eq.mid, ' dB');
  apply('tool-sfx-eq-high', state.eq.high, ' dB');
  apply('tool-sfx-delay-time', state.delay.time, ' s');
  apply('tool-sfx-delay-feedback', state.delay.feedback, '');
  apply('tool-sfx-delay-mix', state.delay.mix, '');
}

async function ensureAudioGraph() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('WebAudio not supported.');
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} }
  if (!nodes.inputGain) {
    nodes.inputGain = audioCtx.createGain();
    nodes.outputGain = audioCtx.createGain();
    nodes.comp = audioCtx.createDynamicsCompressor();
    nodes.reverbConvolver = audioCtx.createConvolver();
    nodes.reverbDry = audioCtx.createGain();
    nodes.reverbWet = audioCtx.createGain();
    nodes.eqLow = audioCtx.createBiquadFilter(); nodes.eqLow.type = 'lowshelf'; nodes.eqLow.frequency.value = 150;
    nodes.eqMid = audioCtx.createBiquadFilter(); nodes.eqMid.type = 'peaking'; nodes.eqMid.frequency.value = 1200; nodes.eqMid.Q.value = 1;
    nodes.eqHigh = audioCtx.createBiquadFilter(); nodes.eqHigh.type = 'highshelf'; nodes.eqHigh.frequency.value = 4200;
    nodes.delayNode = audioCtx.createDelay(2.0);
    nodes.delayFeedback = audioCtx.createGain();
    nodes.delayWet = audioCtx.createGain();
    nodes.delayDry = audioCtx.createGain();
    nodes.delayNode.connect(nodes.delayFeedback);
    nodes.delayFeedback.connect(nodes.delayNode);
    nodes.delayNode.connect(nodes.delayWet);
  }
  if (!sourceEl) sourceEl = el('tool-sfx-audio');
  if (!sourceNode && sourceEl) sourceNode = audioCtx.createMediaElementSource(sourceEl);
  rebuildChain();
}

function buildImpulseBuffer(decaySec = 2.2) {
  const rate = audioCtx.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(0.3, Math.min(8, decaySec))));
  const impulse = audioCtx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
    }
  }
  return impulse;
}

function disconnectSafe(node) { if (!node) return; try { node.disconnect(); } catch {} }

function rebuildChain() {
  if (!audioCtx || !sourceNode || !nodes.inputGain || !nodes.outputGain) return;
  [sourceNode, nodes.inputGain, nodes.comp, nodes.reverbDry, nodes.reverbWet, nodes.reverbConvolver, nodes.eqLow, nodes.eqMid, nodes.eqHigh, nodes.delayNode, nodes.delayFeedback, nodes.delayWet, nodes.delayDry, nodes.outputGain].forEach(disconnectSafe);
  sourceNode.connect(nodes.inputGain);
  let cursor = nodes.inputGain;
  if (state.compression.enabled) {
    nodes.comp.threshold.value = state.compression.threshold;
    nodes.comp.ratio.value = state.compression.ratio;
    nodes.comp.attack.value = state.compression.attack;
    nodes.comp.release.value = state.compression.release;
    cursor.connect(nodes.comp);
    cursor = nodes.comp;
  }
  if (state.reverb.enabled) {
    nodes.reverbConvolver.buffer = buildImpulseBuffer(state.reverb.decay);
    const mix = Math.max(0, Math.min(1, state.reverb.mix));
    nodes.reverbDry.gain.value = 1 - mix;
    nodes.reverbWet.gain.value = mix;
    cursor.connect(nodes.reverbDry);
    cursor.connect(nodes.reverbConvolver);
    nodes.reverbConvolver.connect(nodes.reverbWet);
    nodes.reverbDry.connect(nodes.eqLow);
    nodes.reverbWet.connect(nodes.eqLow);
    cursor = nodes.eqLow;
  }
  if (state.eq.enabled) {
    nodes.eqLow.gain.value = state.eq.low;
    nodes.eqMid.gain.value = state.eq.mid;
    nodes.eqHigh.gain.value = state.eq.high;
    cursor.connect(nodes.eqLow);
    nodes.eqLow.connect(nodes.eqMid);
    nodes.eqMid.connect(nodes.eqHigh);
    cursor = nodes.eqHigh;
  }
  if (state.delay.enabled) {
    const mix = Math.max(0, Math.min(1, state.delay.mix));
    nodes.delayNode.delayTime.value = Math.max(0.01, Math.min(1.8, state.delay.time));
    nodes.delayFeedback.gain.value = Math.max(0, Math.min(0.95, state.delay.feedback));
    nodes.delayDry.gain.value = 1 - mix;
    nodes.delayWet.gain.value = mix;
    cursor.connect(nodes.delayDry);
    cursor.connect(nodes.delayNode);
    nodes.delayDry.connect(nodes.outputGain);
    nodes.delayWet.connect(nodes.outputGain);
  } else {
    cursor.connect(nodes.outputGain);
  }
  nodes.outputGain.connect(audioCtx.destination);
}

function readInputNumber(id, fallback = 0) { const value = Number(el(id)?.value); return Number.isFinite(value) ? value : fallback; }

function syncStateFromUi() {
  state.compression.enabled = bool(el('tool-sfx-comp-enabled')?.checked);
  state.reverb.enabled = bool(el('tool-sfx-reverb-enabled')?.checked);
  state.eq.enabled = bool(el('tool-sfx-eq-enabled')?.checked);
  state.delay.enabled = bool(el('tool-sfx-delay-enabled')?.checked);
  state.compression.threshold = readInputNumber('tool-sfx-comp-threshold', -24);
  state.compression.ratio = readInputNumber('tool-sfx-comp-ratio', 4);
  state.compression.attack = readInputNumber('tool-sfx-comp-attack', 0.01);
  state.compression.release = readInputNumber('tool-sfx-comp-release', 0.25);
  state.reverb.decay = readInputNumber('tool-sfx-reverb-decay', 2.2);
  state.reverb.mix = readInputNumber('tool-sfx-reverb-mix', 0.25);
  state.eq.low = readInputNumber('tool-sfx-eq-low', 0);
  state.eq.mid = readInputNumber('tool-sfx-eq-mid', 0);
  state.eq.high = readInputNumber('tool-sfx-eq-high', 0);
  state.delay.time = readInputNumber('tool-sfx-delay-time', 0.22);
  state.delay.feedback = readInputNumber('tool-sfx-delay-feedback', 0.32);
  state.delay.mix = readInputNumber('tool-sfx-delay-mix', 0.2);
}

function bindControls() {
  const ids = ['tool-sfx-comp-enabled','tool-sfx-reverb-enabled','tool-sfx-eq-enabled','tool-sfx-delay-enabled','tool-sfx-comp-threshold','tool-sfx-comp-ratio','tool-sfx-comp-attack','tool-sfx-comp-release','tool-sfx-reverb-decay','tool-sfx-reverb-mix','tool-sfx-eq-low','tool-sfx-eq-mid','tool-sfx-eq-high','tool-sfx-delay-time','tool-sfx-delay-feedback','tool-sfx-delay-mix'];
  ids.forEach(id => {
    const node = el(id);
    if (!node || node.dataset.boundSfx === '1') return;
    node.dataset.boundSfx = '1';
    const event = node.type === 'checkbox' ? 'change' : 'input';
    node.addEventListener(event, async () => {
      syncStateFromUi();
      updateUiFromState();
      try { await ensureAudioGraph(); rebuildChain(); } catch { setStatus('Could not apply effects.', true); }
    });
  });
}

async function fillLooperSelect() {
  const select = el('tool-sfx-looper-select');
  if (!select || !bridge) return;
  const items = await bridge.getLooperItems();
  const uploads = items.filter(item => String(item?.sourceType || '') === 'upload');
  select.innerHTML = '<option value="">Choose uploaded looper item...</option>' + uploads.map(item => `<option value="${bridge.escapeHtml(item.id)}">${bridge.escapeHtml(item.title || 'Untitled')}</option>`).join('');
}

async function loadMediaFromLooper(itemId = '') {
  if (!bridge || !itemId) return;
  setStatus('Loading looper media...');
  const url = await bridge.getLooperMediaDataUrl(itemId);
  if (!url) { setStatus('Could not load this looper media.', true); return; }
  loadedDataUrl = url;
  const audio = el('tool-sfx-audio');
  if (!audio) return;
  audio.src = loadedDataUrl;
  audio.load();
  await ensureAudioGraph();
  setStatus('Looper media loaded. Use Play then tweak effects.', false);
}

async function loadMediaFromUpload(file) {
  if (!file) return;
  const url = await bridge.readFileAsDataUrl(file);
  if (!url) { setStatus('Could not read uploaded file.', true); return; }
  loadedDataUrl = url;
  const audio = el('tool-sfx-audio');
  if (!audio) return;
  audio.src = loadedDataUrl;
  audio.load();
  await ensureAudioGraph();
  setStatus(`Loaded ${file.name}.`, false);
}

function renderProfiles() {
  const list = el('tool-sfx-profiles-list');
  if (!list) return;
  if (!profiles.length) { list.innerHTML = '<div class="text-xs text-gray-500">No profiles yet.</div>'; return; }
  list.innerHTML = profiles.map(profile => {
    const active = profile.id === currentProfileId;
    return `<div class="flex items-center justify-between gap-2 bg-black/20 border ${active ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-2"><button class="text-left min-w-0 flex-1 btn-press" onclick="window.applySoundEffectProfile('${bridge.escapeHtml(profile.id)}')"><div class="text-sm text-white truncate">${bridge.escapeHtml(profile.name || 'Untitled')}</div><div class="text-[10px] text-gray-500">${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : ''}</div></button><button class="w-8 h-8 rounded-full btn-soft btn-press" onclick="window.deleteSoundEffectProfile('${bridge.escapeHtml(profile.id)}')" title="Delete"><i class="fas fa-trash text-xs"></i></button></div>`;
  }).join('');
}

async function refreshProfiles() {
  if (!bridge?.repository || !bridge?.userId) { profiles = []; renderProfiles(); return; }
  profiles = await bridge.repository.loadSoundEffectProfiles(bridge.userId);
  renderProfiles();
}

window.applySoundEffectProfile = async function(profileId = '') {
  const profile = profiles.find(item => item.id === profileId);
  if (!profile) return;
  currentProfileId = profile.id;
  const effectState = profile?.effectState || {};
  Object.assign(state.compression, effectState.compression || {});
  Object.assign(state.reverb, effectState.reverb || {});
  Object.assign(state.eq, effectState.eq || {});
  Object.assign(state.delay, effectState.delay || {});
  updateUiFromState();
  await ensureAudioGraph();
  rebuildChain();
  renderProfiles();
  setStatus(`Applied profile "${profile.name || 'Untitled'}".`, false);
};

window.deleteSoundEffectProfile = async function(profileId = '') {
  if (!bridge?.repository || !bridge?.userId || !profileId) return;
  await bridge.repository.deleteSoundEffectProfile(bridge.userId, profileId);
  if (currentProfileId === profileId) currentProfileId = '';
  await refreshProfiles();
  setStatus('Profile deleted.', false);
};

async function saveProfile() {
  if (!bridge?.repository || !bridge?.userId) { bridge?.showToast?.('Sign in to save sound profiles.'); return; }
  const name = String(el('tool-sfx-profile-name')?.value || '').trim();
  if (!name) { setStatus('Enter a profile name first.', true); return; }
  syncStateFromUi();
  const now = Date.now();
  const payload = { name, effectState: cloneState(), updatedAt: now, createdAt: currentProfileId ? (profiles.find(p => p.id === currentProfileId)?.createdAt || now) : now };
  const id = await bridge.repository.saveSoundEffectProfile(bridge.userId, currentProfileId, payload);
  currentProfileId = id;
  await refreshProfiles();
  setStatus(`Saved profile "${name}".`, false);
}

function bindActions() {
  const looperSelect = el('tool-sfx-looper-select');
  if (looperSelect && looperSelect.dataset.boundSfx !== '1') {
    looperSelect.dataset.boundSfx = '1';
    looperSelect.addEventListener('change', async () => { const id = String(looperSelect.value || ''); if (!id) return; await loadMediaFromLooper(id); });
  }
  const upload = el('tool-sfx-upload');
  if (upload && upload.dataset.boundSfx !== '1') {
    upload.dataset.boundSfx = '1';
    upload.addEventListener('change', async (event) => { const file = event?.target?.files?.[0] || null; if (!file) return; await loadMediaFromUpload(file); });
  }
  const playBtn = el('btn-sfx-play');
  if (playBtn && playBtn.dataset.boundSfx !== '1') {
    playBtn.dataset.boundSfx = '1';
    playBtn.addEventListener('click', async () => {
      const audio = el('tool-sfx-audio');
      if (!audio || !audio.src) { setStatus('Load a source first.', true); return; }
      await ensureAudioGraph();
      try {
        if (audio.paused) { await audio.play(); playBtn.innerHTML = '<i class="fas fa-pause mr-2"></i>Pause'; }
        else { audio.pause(); playBtn.innerHTML = '<i class="fas fa-play mr-2"></i>Play'; }
      } catch { setStatus('Could not start playback.', true); }
    });
  }
  const saveBtn = el('btn-sfx-save-profile');
  if (saveBtn && saveBtn.dataset.boundSfx !== '1') { saveBtn.dataset.boundSfx = '1'; saveBtn.addEventListener('click', saveProfile); }
}

export async function initSoundEffectsTool(context = {}) {
  bridge = context;
  bindControls();
  bindActions();
  updateUiFromState();
  await fillLooperSelect();
  await refreshProfiles();
  setStatus('Choose an uploaded looper track or upload a file.');
}
