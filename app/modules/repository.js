import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export class FirestoreRepository {
  constructor(db) {
    this.db = db;
  }

  async loadSongs({ defaultSong, ensureSongFormat }) {
    const songsRef = collection(this.db, 'songs');
    const snap = await getDocs(songsRef);
    if (snap.empty) {
      await setDoc(doc(songsRef, 'default_song'), defaultSong);
      return [ensureSongFormat({ id: 'default_song', ...defaultSong })];
    }
    return snap.docs.map(d => ensureSongFormat({ id: d.id, ...d.data() }));
  }

  async saveSong(songData, editingSongId = null) {
    const titleLc = String(songData?.title || '').trim().toLowerCase();
    const artistLc = String(songData?.artist || '').trim().toLowerCase();
    const searchTokens = Array.from(new Set(
      `${titleLc} ${artistLc}`
        .split(/[^a-z0-9]+/i)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    ));
    const payload = {
      ...songData,
      titleLc,
      artistLc,
      searchTokens
    };
    if (editingSongId) {
      const songRef = doc(this.db, 'songs', editingSongId);
      await setDoc(songRef, payload, { merge: true });
      return editingSongId;
    }
    const created = await addDoc(collection(this.db, 'songs'), {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
      stats: payload.stats || { views: 0, started: 0, completed: 0 }
    });
    return created.id;
  }

  async searchSongs(queryText, { ensureSongFormat, max = 30 } = {}) {
    const term = String(queryText || '').trim().toLowerCase();
    if (!term) return [];
    const songsRef = collection(this.db, 'songs');
    const token = term.split(/\s+/)[0];
    const snapshots = [];
    snapshots.push(await getDocs(query(songsRef, where('searchTokens', 'array-contains', token), limit(max))));
    if (term !== token) {
      snapshots.push(await getDocs(query(songsRef, where('searchTokens', 'array-contains', term), limit(max))));
    }
    const merged = [];
    const seen = new Set();
    for (const snap of snapshots) {
      snap.docs.forEach(d => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        merged.push({ id: d.id, ...d.data() });
      });
    }
    const filtered = merged.filter(song => {
      const title = String(song.title || '').toLowerCase();
      const artist = String(song.artist || '').toLowerCase();
      return title.includes(term) || artist.includes(term);
    });
    return (ensureSongFormat ? filtered.map(ensureSongFormat) : filtered).slice(0, max);
  }

  async loadUserSettings(userId, defaults) {
    const settingsRef = doc(this.db, 'users', userId, 'settings', 'app');
    const snap = await getDoc(settingsRef);
    return snap.exists() ? { ...defaults, ...snap.data() } : { ...defaults };
  }

  async saveUserSettings(userId, settings) {
    const settingsRef = doc(this.db, 'users', userId, 'settings', 'app');
    await setDoc(settingsRef, settings, { merge: true });
  }

  async loadProgress(userId, songId) {
    const progRef = doc(this.db, 'users', userId, 'progress', songId);
    const snap = await getDoc(progRef);
    return snap.exists() ? snap.data() : { step1: { p: 0 }, step2: { p: 0 }, step3: { p: 0 } };
  }

  async saveProgress(userId, songId, progress) {
    const progRef = doc(this.db, 'users', userId, 'progress', songId);
    await setDoc(progRef, progress, { merge: true });
  }

  async loadToolRecordings(userId) {
    const recordingsRef = collection(this.db, 'users', userId, 'tool_recordings');
    const snap = await getDocs(recordingsRef);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async saveToolRecording(userId, recording) {
    const recordingsRef = collection(this.db, 'users', userId, 'tool_recordings');
    const created = await addDoc(recordingsRef, recording);
    return created.id;
  }

  async deleteToolRecording(userId, recordingId) {
    await deleteDoc(doc(this.db, 'users', userId, 'tool_recordings', recordingId));
  }

  async loadSongComments(songId) {
    const commentsRef = collection(this.db, 'songs', songId, 'comments');
    const snap = await getDocs(commentsRef);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async addSongComment(songId, comment) {
    const commentsRef = collection(this.db, 'songs', songId, 'comments');
    const created = await addDoc(commentsRef, comment);
    return created.id;
  }

  async loadSongRatings(songId) {
    const ratingsRef = collection(this.db, 'songs', songId, 'ratings');
    const snap = await getDocs(ratingsRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async upsertSongRating(songId, userId, rating) {
    await setDoc(doc(this.db, 'songs', songId, 'ratings', userId), rating, { merge: true });
  }

  async updateSongMeta(songId, patch) {
    await setDoc(doc(this.db, 'songs', songId), patch, { merge: true });
  }

  async loadChords(defaultChords = []) {
    const chordsRef = collection(this.db, 'chords');
    const snap = await getDocs(chordsRef);
    if (snap.empty && defaultChords.length) {
      for (const chord of defaultChords) {
        await addDoc(chordsRef, chord);
      }
      return defaultChords.map((chord, idx) => ({ id: `seed-${idx}`, ...chord }));
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async saveChord(chordData) {
    const created = await addDoc(collection(this.db, 'chords'), chordData);
    return created.id;
  }
}
