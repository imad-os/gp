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
    try {
      snapshots.push(await getDocs(query(songsRef, where('searchTokens', 'array-contains', token), limit(max))));
      if (term !== token) {
        snapshots.push(await getDocs(query(songsRef, where('searchTokens', 'array-contains', term), limit(max))));
      }
    } catch {
      // Fallback path handled below for legacy documents without search indexes.
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
    const source = merged.length ? merged : (await getDocs(songsRef)).docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = source.filter(song => {
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

  async loadLooperHistory(userId) {
    const ref = collection(this.db, 'users', userId, 'looper_history');
    const snap = await getDocs(ref);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }

  async addLooperHistory(userId, item) {
    const ref = collection(this.db, 'users', userId, 'looper_history');
    const created = await addDoc(ref, item);
    return created.id;
  }

  async updateLooperHistory(userId, itemId, patch) {
    await setDoc(doc(this.db, 'users', userId, 'looper_history', itemId), patch, { merge: true });
  }

  async deleteLooperHistory(userId, itemId) {
    await deleteDoc(doc(this.db, 'users', userId, 'looper_history', itemId));
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

  async loadTrainingArticles() {
    const ref = collection(this.db, 'training_articles');
    const snap = await getDocs(ref);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async saveTrainingArticle(articleData, editingArticleId = null) {
    const titleLc = String(articleData?.title || '').trim().toLowerCase();
    const descriptionLc = String(articleData?.description || '').trim().toLowerCase();
    const categoryLc = String(articleData?.category || '').trim().toLowerCase();
    const searchTokens = Array.from(new Set(
      `${titleLc} ${descriptionLc} ${categoryLc}`
        .split(/[^a-z0-9]+/i)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    ));
    const payload = {
      ...articleData,
      titleLc,
      categoryLc,
      searchTokens
    };
    if (editingArticleId) {
      await setDoc(doc(this.db, 'training_articles', editingArticleId), payload, { merge: true });
      return editingArticleId;
    }
    const created = await addDoc(collection(this.db, 'training_articles'), {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
      ratingSummary: payload.ratingSummary || { average: 0, count: 0 }
    });
    return created.id;
  }

  async deleteTrainingArticle(articleId) {
    await deleteDoc(doc(this.db, 'training_articles', articleId));
  }

  async loadTrainingArticleComments(articleId) {
    const commentsRef = collection(this.db, 'training_articles', articleId, 'comments');
    const snap = await getDocs(commentsRef);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async addTrainingArticleComment(articleId, comment) {
    const commentsRef = collection(this.db, 'training_articles', articleId, 'comments');
    const created = await addDoc(commentsRef, comment);
    return created.id;
  }

  async loadTrainingArticleRatings(articleId) {
    const ratingsRef = collection(this.db, 'training_articles', articleId, 'ratings');
    const snap = await getDocs(ratingsRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async upsertTrainingArticleRating(articleId, userId, rating) {
    await setDoc(doc(this.db, 'training_articles', articleId, 'ratings', userId), rating, { merge: true });
  }

  async updateTrainingArticleMeta(articleId, patch) {
    await setDoc(doc(this.db, 'training_articles', articleId), patch, { merge: true });
  }

  async seedTrainingArticles(entries = []) {
    if (!Array.isArray(entries) || !entries.length) return [];
    const existing = await this.loadTrainingArticles();
    const existingKeys = new Set(existing.map(item => `${String(item.category || '').trim().toLowerCase()}::${String(item.title || '').trim().toLowerCase()}`));
    const inserted = [];
    for (const entry of entries) {
      const key = `${String(entry?.category || '').trim().toLowerCase()}::${String(entry?.title || '').trim().toLowerCase()}`;
      if (!key || existingKeys.has(key)) continue;
      const id = await this.saveTrainingArticle(entry);
      inserted.push(id);
      existingKeys.add(key);
    }
    return inserted;
  }
}
