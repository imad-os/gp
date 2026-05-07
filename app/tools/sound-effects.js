let bridge = null;
let audioCtx = null;
let sourceNode = null;
let sourceEl = null;
let loadedDataUrl = '';
let currentProfileId = '';
let profiles = [];
let looperUploads = [];
const BUILTIN_PROFILES = [
  { id: 'builtin:clean-pop', name: 'Clean Pop Vocal', effectState: { compression: { enabled: true, threshold: -22, ratio: 3.5, attack: 0.01, release: 0.2 }, reverb: { enabled: true, decay: 1.8, mix: 0.16 }, eq: { enabled: true, low: -1, mid: 1.5, high: 2 }, delay: { enabled: false, time: 0.22, feedback: 0.2, mix: 0.12 } } },
  { id: 'builtin:warm-acoustic', name: 'Warm Acoustic', effectState: { compression: { enabled: true, threshold: -24, ratio: 2.8, attack: 0.02, release: 0.28 }, reverb: { enabled: true, decay: 2.4, mix: 0.22 }, eq: { enabled: true, low: 1.5, mid: -0.5, high: 1 }, delay: { enabled: false, time: 0.25, feedback: 0.25, mix: 0.1 } } },
  { id: 'builtin:room-natural', name: 'Natural Room', effectState: { compression: { enabled: true, threshold: -26, ratio: 2.2, attack: 0.03, release: 0.35 }, reverb: { enabled: true, decay: 1.2, mix: 0.12 }, eq: { enabled: false, low: 0, mid: 0, high: 0 }, delay: { enabled: false, time: 0.2, feedback: 0.2, mix: 0.08 } } },
  { id: 'builtin:bright-lead', name: 'Bright Lead', effectState: { compression: { enabled: true, threshold: -20, ratio: 4.5, attack: 0.005, release: 0.18 }, reverb: { enabled: true, decay: 2.1, mix: 0.2 }, eq: { enabled: true, low: -2, mid: 1, high: 4 }, delay: { enabled: true, time: 0.28, feedback: 0.32, mix: 0.18 } } },
  { id: 'builtin:ambient-wash', name: 'Ambient Wash', effectState: { compression: { enabled: true, threshold: -28, ratio: 2.5, attack: 0.04, release: 0.4 }, reverb: { enabled: true, decay: 5.5, mix: 0.45 }, eq: { enabled: true, low: -1, mid: -1, high: 2.5 }, delay: { enabled: true, time: 0.42, feedback: 0.45, mix: 0.32 } } },
  { id: 'builtin:slapback', name: 'Slapback Echo', effectState: { compression: { enabled: true, threshold: -23, ratio: 3, attack: 0.015, release: 0.22 }, reverb: { enabled: false, decay: 1.4, mix: 0.1 }, eq: { enabled: true, low: -1, mid: 1, high: 1.5 }, delay: { enabled: true, time: 0.11, feedback: 0.2, mix: 0.22 } } },
  { id: 'builtin:radio', name: 'Radio / Mid Focus', effectState: { compression: { enabled: true, threshold: -18, ratio: 6, attack: 0.003, release: 0.14 }, reverb: { enabled: false, decay: 1, mix: 0.08 }, eq: { enabled: true, low: -6, mid: 4, high: -2 }, delay: { enabled: false, time: 0.2, feedback: 0.2, mix: 0.08 } } },
  { id: 'builtin:lofi', name: 'Lo-Fi Tape', effectState: { compression: { enabled: true, threshold: -30, ratio: 5, attack: 0.02, release: 0.4 }, reverb: { enabled: true, decay: 1.6, mix: 0.14 }, eq: { enabled: true, low: -3, mid: 1, high: -5 }, delay: { enabled: false, time: 0.25, feedback: 0.25, mix: 0.1 } } },
  { id: 'builtin:large-hall', name: 'Large Hall', effectState: { compression: { enabled: false, threshold: -24, ratio: 3, attack: 0.01, release: 0.25 }, reverb: { enabled: true, decay: 6.5, mix: 0.5 }, eq: { enabled: true, low: 0, mid: -1, high: 2 }, delay: { enabled: true, time: 0.35, feedback: 0.38, mix: 0.2 } } },
  { id: 'builtin:parallel-punch', name: 'Parallel Punch', effectState: { compression: { enabled: true, threshold: -16, ratio: 8, attack: 0.002, release: 0.12 }, reverb: { enabled: false, decay: 1.4, mix: 0.1 }, eq: { enabled: true, low: 2, mid: 0.5, high: 1 }, delay: { enabled: false, time: 0.2, feedback: 0.2, mix: 0.08 } } }
];

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
    nodes.delayFeedback.gain.value = 0;
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

  // Safety: always kill any previous delay feedback before rebuilding.
  try { nodes.delayFeedback.gain.value = 0; } catch {}
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

    // Reverb stage: split to dry/wet and merge into a single downstream point.
    cursor.connect(nodes.reverbDry);
    cursor.connect(nodes.reverbConvolver);
    nodes.reverbConvolver.connect(nodes.reverbWet);

    const reverbMerge = audioCtx.createGain();
    nodes.reverbDry.connect(reverbMerge);
    nodes.reverbWet.connect(reverbMerge);
    cursor = reverbMerge;
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
    // Keep delay loop muted when delay is disabled.
    nodes.delayFeedback.gain.value = 0;
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

function renderLooperSearchResults(query = '') {
  const results = el('tool-sfx-looper-results');
  if (!results) return;
  const normalized = String(query || '').trim().toLowerCase();
  const filtered = looperUploads
    .filter(item => {
      if (!normalized) return true;
      const title = String(item?.title || '').toLowerCase();
      return title.includes(normalized);
    })
    .slice(0, 25);
  if (!filtered.length) {
    results.innerHTML = `<div class="text-xs text-gray-500 px-2 py-1">No matches.</div>`;
    return;
  }
  results.innerHTML = filtered.map(item => `
    <button type="button" data-looper-id="${bridge.escapeHtml(item.id)}" class="w-full text-left bg-black/20 border border-gray-800 hover:border-primary/50 rounded-lg px-2 py-1.5 btn-press">
      <div class="text-sm text-white truncate">${bridge.escapeHtml(item.title || 'Untitled')}</div>
      <div class="text-[10px] text-gray-500">${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</div>
    </button>
  `).join('');
}

async function loadLooperCandidates() {
  if (!bridge) return;
  const items = await bridge.getLooperItems();
  looperUploads = items
    .filter(item => String(item?.sourceType || '') === 'upload')
    .sort((a, b) => Number(b?.updatedAt || b?.createdAt || 0) - Number(a?.updatedAt || a?.createdAt || 0));
  renderLooperSearchResults('');
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
    const isBuiltin = String(profile.id || '').startsWith('builtin:');
    return `<div class="flex items-center justify-between gap-2 bg-black/20 border ${active ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-2"><button class="text-left min-w-0 flex-1 btn-press" onclick="window.applySoundEffectProfile('${bridge.escapeHtml(profile.id)}')"><div class="text-sm text-white truncate">${bridge.escapeHtml(profile.name || 'Untitled')}</div><div class="text-[10px] text-gray-500">${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : ''}</div></button><button class="w-8 h-8 rounded-full btn-soft btn-press" onclick="window.deleteSoundEffectProfile('${bridge.escapeHtml(profile.id)}')" title="Delete"><i class="fas fa-trash text-xs"></i></button></div>`;
    return `<div class="flex items-center justify-between gap-2 bg-black/20 border ${active ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-2"><button class="text-left min-w-0 flex-1 btn-press" onclick="window.applySoundEffectProfile('${bridge.escapeHtml(profile.id)}')"><div class="text-sm text-white truncate">${bridge.escapeHtml(profile.name || 'Untitled')}</div><div class="text-[10px] text-gray-500">${isBuiltin ? 'Built-in preset' : (profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : '')}</div></button>${isBuiltin ? '<span class="text-[10px] text-gray-500 px-2">preset</span>' : `<button class="w-8 h-8 rounded-full btn-soft btn-press" onclick="window.deleteSoundEffectProfile('${bridge.escapeHtml(profile.id)}')" title="Delete"><i class="fas fa-trash text-xs"></i></button>`}</div>`;
  }).join('');
}

async function refreshProfiles() {
  const userProfiles = (bridge?.repository && bridge?.userId)
    ? await bridge.repository.loadSoundEffectProfiles(bridge.userId)
    : [];
  profiles = [...BUILTIN_PROFILES, ...userProfiles];
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
  if (String(profileId || '').startsWith('builtin:')) return;
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
  const looperSearch = el('tool-sfx-looper-search');
  if (looperSearch && looperSearch.dataset.boundSfx !== '1') {
    looperSearch.dataset.boundSfx = '1';
    looperSearch.addEventListener('input', () => {
      renderLooperSearchResults(looperSearch.value || '');
    });
  }
  const looperResults = el('tool-sfx-looper-results');
  if (looperResults && looperResults.dataset.boundSfx !== '1') {
    looperResults.dataset.boundSfx = '1';
    looperResults.addEventListener('click', async (event) => {
      const btn = event.target?.closest?.('button[data-looper-id]');
      if (!btn) return;
      const id = String(btn.getAttribute('data-looper-id') || '').trim();
      if (!id) return;
      if (looperSearch) looperSearch.value = String(btn.querySelector('.text-sm')?.textContent || '');
      await loadMediaFromLooper(id);
    });
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
  await loadLooperCandidates();
  await refreshProfiles();
  setStatus('Choose an uploaded looper track or upload a file.');
}
