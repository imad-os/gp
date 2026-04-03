import { chordToFrequencies, getCapoOffset } from './music.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.activeChordVoices = [];
  }

  async ensureReady() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch {}
    }
    return this.ctx;
  }

  clickMetronome(isAccent, when = null) {
    if (!this.ctx) return;
    const now = when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = isAccent ? 1200 : 800;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  }

  stopChordPreview(release = 0.05) {
    if (!this.ctx || !this.activeChordVoices.length) return;
    const now = this.ctx.currentTime;
    this.activeChordVoices.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
        osc.stop(now + release + 0.02);
      } catch {}
    });
    this.activeChordVoices = [];
  }

  async playChordPreview(chordName, direction = 'D', capoLabel = 'No capo') {
    const ctx = await this.ensureReady();
    const freqs = chordToFrequencies(chordName, getCapoOffset(capoLabel));
    if (!freqs.length) return;
    const now = ctx.currentTime;
    const ordered = direction === 'U' ? [...freqs].reverse() : freqs;
    this.activeChordVoices = [];
    ordered.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      const offset = idx * 0.02;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(0.28 / (idx + 1), now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.08 / (idx + 1), now + offset + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.008 / (idx + 1), now + offset + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 2.25);
      this.activeChordVoices.push({ osc, gain });
    });
  }
}
