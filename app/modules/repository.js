import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export class FirestoreRepository {
  constructor(db) {
    this.db = db;
    this.cachePrefix = 'guitartrainer.repo.cache.v1';
    this.readTimeoutMs = 6500;
    this.idbName = 'guitartrainer.repo.idb.v1';
    this.idbStore = 'kv';
    this.idbPromise = null;
    this.connectivityReporter = null;
  }

  setConnectivityReporter(fn) {
    this.connectivityReporter = typeof fn === 'function' ? fn : null;
  }

  reportConnectivity(isOnline, reason = '') {
    if (!this.connectivityReporter) return;
    try {
      this.connectivityReporter(!!isOnline, String(reason || ''));
    } catch {}
  }

  makeCacheKey(scope, key = '') {
    return `${this.cachePrefix}:${scope}:${key}`;
  }

  withTimeout(promise, timeoutMs = this.readTimeoutMs) {
    const ms = Math.max(1200, Number(timeoutMs) || this.readTimeoutMs);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
      promise
        .then(value => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  getCacheJson(cacheKey) {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setCacheJson(cacheKey, value) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(value));
    } catch {}
  }

  async readWithCache(cacheKey, fetcher, { timeoutMs = this.readTimeoutMs } = {}) {
    try {
      const value = await this.withTimeout(Promise.resolve().then(fetcher), timeoutMs);
      this.setCacheJson(cacheKey, value);
      this.reportConnectivity(true, 'network_read_ok');
      return value;
    } catch (err) {
      const fallback = this.getCacheJson(cacheKey);
      if (fallback !== null) {
        this.reportConnectivity(false, 'network_read_fallback_cache');
        return fallback;
      }
      this.reportConnectivity(false, 'network_read_failed');
      throw err;
    }
  }

  async getIdb() {
    if (this.idbPromise) return this.idbPromise;
    this.idbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(this.idbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.idbStore)) db.createObjectStore(this.idbStore);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb_open_failed'));
    }).catch(() => null);
    return this.idbPromise;
  }

  async idbGet(cacheKey) {
    const db = await this.getIdb();
    if (!db) return null;
    return await new Promise(resolve => {
      try {
        const tx = db.transaction(this.idbStore, 'readonly');
        const store = tx.objectStore(this.idbStore);
        const req = store.get(cacheKey);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async idbSet(cacheKey, value) {
    const db = await this.getIdb();
    if (!db) return;
    await new Promise(resolve => {
      try {
        const tx = db.transaction(this.idbStore, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.objectStore(this.idbStore).put(value, cacheKey);
      } catch {
        resolve();
      }
    });
  }

  async readWithIdbCache(cacheKey, fetcher, { timeoutMs = this.readTimeoutMs } = {}) {
    try {
      const value = await this.withTimeout(Promise.resolve().then(fetcher), timeoutMs);
      await this.idbSet(cacheKey, value);
      this.reportConnectivity(true, 'network_read_ok');
      return value;
    } catch (err) {
      const fallback = await this.idbGet(cacheKey);
      if (fallback !== null) {
        this.reportConnectivity(false, 'network_read_fallback_idb');
        return fallback;
      }
      this.reportConnectivity(false, 'network_read_failed');
      throw err;
    }
  }

  async loadSongs({ defaultSong, ensureSongFormat }) {
    const songs = await this.readWithCache(this.makeCacheKey('songs', 'all'), async () => {
      const songsRef = collection(this.db, 'songs');
      const snap = await getDocs(songsRef);
      if (snap.empty) {
        await setDoc(doc(songsRef, 'default_song'), defaultSong);
        return [{ id: 'default_song', ...defaultSong }];
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
    return songs.map(d => ensureSongFormat(d));
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

  async deleteSong(songId) {
    const commentsRef = collection(this.db, 'songs', songId, 'comments');
    const commentsSnap = await getDocs(commentsRef);
    for (const entry of commentsSnap.docs) {
      await deleteDoc(entry.ref);
    }

    const ratingsRef = collection(this.db, 'songs', songId, 'ratings');
    const ratingsSnap = await getDocs(ratingsRef);
    for (const entry of ratingsSnap.docs) {
      await deleteDoc(entry.ref);
    }

    await deleteDoc(doc(this.db, 'songs', songId));
  }

  async searchSongs(queryText, { ensureSongFormat, max = 30 } = {}) {
    const term = String(queryText || '').trim().toLowerCase();
    if (!term) return [];
    const cacheKey = this.makeCacheKey('song_search', `${term}:${max}`);
    const result = await this.readWithCache(cacheKey, async () => {
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
      return filtered.slice(0, max);
    });
    return ensureSongFormat ? result.map(ensureSongFormat) : result;
  }

  async loadUserSettings(userId, defaults) {
    const cached = await this.readWithCache(this.makeCacheKey('user_settings', userId), async () => {
      const settingsRef = doc(this.db, 'users', userId, 'settings', 'app');
      const snap = await getDoc(settingsRef);
      return snap.exists() ? snap.data() : {};
    });
    return { ...defaults, ...(cached || {}) };
  }

  async saveUserSettings(userId, settings) {
    const settingsRef = doc(this.db, 'users', userId, 'settings', 'app');
    await setDoc(settingsRef, settings, { merge: true });
    this.setCacheJson(this.makeCacheKey('user_settings', userId), settings);
  }

  async loadProgress(userId, songId) {
    return await this.readWithCache(this.makeCacheKey('progress', `${userId}:${songId}`), async () => {
      const progRef = doc(this.db, 'users', userId, 'progress', songId);
      const snap = await getDoc(progRef);
      return snap.exists() ? snap.data() : { step1: { p: 0 }, step2: { p: 0 }, step3: { p: 0 } };
    });
  }

  async saveProgress(userId, songId, progress) {
    const progRef = doc(this.db, 'users', userId, 'progress', songId);
    await setDoc(progRef, progress, { merge: true });
    this.setCacheJson(this.makeCacheKey('progress', `${userId}:${songId}`), progress);
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
    const history = await this.readWithCache(this.makeCacheKey('looper_history', userId), async () => {
      const ref = collection(this.db, 'users', userId, 'looper_history');
      const snap = await getDocs(ref);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    });
    this.setCacheJson(this.makeCacheKey('looper_history_device', 'all'), history);
    return history;
  }

  loadLooperHistoryFromDeviceCache() {
    return this.getCacheJson(this.makeCacheKey('looper_history_device', 'all')) || [];
  }

  async addLooperHistory(userId, item) {
    const ref = collection(this.db, 'users', userId, 'looper_history');
    const created = await addDoc(ref, item);
    const cacheKey = this.makeCacheKey('looper_history', userId);
    const current = this.getCacheJson(cacheKey);
    const base = Array.isArray(current) ? current : [];
    const next = [{ id: created.id, ...item }, ...base]
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    this.setCacheJson(cacheKey, next);
    this.setCacheJson(this.makeCacheKey('looper_history_device', 'all'), next);
    return created.id;
  }

  async updateLooperHistory(userId, itemId, patch) {
    await setDoc(doc(this.db, 'users', userId, 'looper_history', itemId), patch, { merge: true });
    const cacheKey = this.makeCacheKey('looper_history', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const next = current.map(item => (item?.id === itemId ? { ...item, ...patch } : item))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
      this.setCacheJson(this.makeCacheKey('looper_history_device', 'all'), next);
    }
  }

  async deleteLooperHistory(userId, itemId) {
    await deleteDoc(doc(this.db, 'users', userId, 'looper_history', itemId));
    const cacheKey = this.makeCacheKey('looper_history', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const next = current.filter(item => item?.id !== itemId);
      this.setCacheJson(cacheKey, next);
      this.setCacheJson(this.makeCacheKey('looper_history_device', 'all'), next);
    }
  }

  async saveLooperMediaData(userId, itemId, dataUrl) {
    const chunksRef = collection(this.db, 'users', userId, 'looper_history', itemId, 'media_chunks');
    const existing = await getDocs(chunksRef);
    for (const entry of existing.docs) {
      await deleteDoc(entry.ref);
    }
    const CHUNK_SIZE = 350000;
    const source = String(dataUrl || '');
    const chunkCount = Math.max(1, Math.ceil(source.length / CHUNK_SIZE));
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const part = source.slice(start, start + CHUNK_SIZE);
      const chunkId = String(i).padStart(5, '0');
      await setDoc(doc(chunksRef, chunkId), { index: i, data: part });
    }
    await this.idbSet(this.makeCacheKey('looper_media', `${userId}:${itemId}`), source);
    await this.idbSet(this.makeCacheKey('looper_media_device', itemId), source);
    return chunkCount;
  }

  async loadLooperMediaData(userId, itemId, onProgress = null) {
    const cacheKey = this.makeCacheKey('looper_media', `${userId}:${itemId}`);
    try {
      const value = await this.readWithIdbCache(cacheKey, async () => {
        const chunksRef = collection(this.db, 'users', userId, 'looper_history', itemId, 'media_chunks');
        const snap = await getDocs(chunksRef);
        if (snap.empty) return '';
        if (typeof onProgress === 'function') onProgress(18);
        const ordered = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.index ?? Number(a.id)) - (b.index ?? Number(b.id)));
        const total = Math.max(1, ordered.length);
        const parts = [];
        for (let i = 0; i < ordered.length; i += 1) {
          parts.push(String(ordered[i].data || ''));
          if (typeof onProgress === 'function') {
            const progress = 18 + Math.round(((i + 1) / total) * 72);
            onProgress(Math.min(90, progress));
          }
          if (i % 25 === 0) await Promise.resolve();
        }
        if (typeof onProgress === 'function') onProgress(95);
        return parts.join('');
      }, { timeoutMs: 10000 });
      if (value) {
        await this.idbSet(this.makeCacheKey('looper_media_device', itemId), value);
        return value;
      }
      const globalFallback = await this.idbGet(this.makeCacheKey('looper_media_device', itemId));
      return globalFallback || '';
    } catch {
      const globalFallback = await this.idbGet(this.makeCacheKey('looper_media_device', itemId));
      return globalFallback || '';
    }
  }

  async deleteLooperMediaData(userId, itemId) {
    const chunksRef = collection(this.db, 'users', userId, 'looper_history', itemId, 'media_chunks');
    const snap = await getDocs(chunksRef);
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
  }

  async addPublicLooperShare(item) {
    const ref = collection(this.db, 'public_loops');
    const created = await addDoc(ref, item);
    return created.id;
  }

  async updatePublicLooperShare(shareId, patch) {
    await setDoc(doc(this.db, 'public_loops', shareId), patch, { merge: true });
  }

  async loadPublicLooperShare(shareId) {
    const snap = await getDoc(doc(this.db, 'public_loops', shareId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }

  async savePublicLooperMediaData(shareId, dataUrl) {
    const chunksRef = collection(this.db, 'public_loops', shareId, 'media_chunks');
    const existing = await getDocs(chunksRef);
    for (const entry of existing.docs) {
      await deleteDoc(entry.ref);
    }
    const CHUNK_SIZE = 350000;
    const source = String(dataUrl || '');
    const chunkCount = Math.max(1, Math.ceil(source.length / CHUNK_SIZE));
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const part = source.slice(start, start + CHUNK_SIZE);
      const chunkId = String(i).padStart(5, '0');
      await setDoc(doc(chunksRef, chunkId), { index: i, data: part });
    }
    await this.idbSet(this.makeCacheKey('public_looper_media', shareId), source);
    return chunkCount;
  }

  async loadPublicLooperMediaData(shareId, onProgress = null) {
    const cacheKey = this.makeCacheKey('public_looper_media', shareId);
    return await this.readWithIdbCache(cacheKey, async () => {
      const chunksRef = collection(this.db, 'public_loops', shareId, 'media_chunks');
      const snap = await getDocs(chunksRef);
      if (snap.empty) return '';
      if (typeof onProgress === 'function') onProgress(18);
      const ordered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.index ?? Number(a.id)) - (b.index ?? Number(b.id)));
      const total = Math.max(1, ordered.length);
      const parts = [];
      for (let i = 0; i < ordered.length; i += 1) {
        parts.push(String(ordered[i].data || ''));
        if (typeof onProgress === 'function') {
          const progress = 18 + Math.round(((i + 1) / total) * 72);
          onProgress(Math.min(90, progress));
        }
        if (i % 25 === 0) await Promise.resolve();
      }
      if (typeof onProgress === 'function') onProgress(95);
      return parts.join('');
    }, { timeoutMs: 10000 });
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
    const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!defaultChords.length) return existing;

    const makeShapeKey = (strings = []) => (Array.isArray(strings) ? strings.map(v => String(v).trim().toLowerCase()).join('|') : '');
    const existingKeys = new Set(
      existing.map(item => {
        const nameKey = String(item?.name || '').trim().toLowerCase();
        const shapeKey = makeShapeKey(item?.strings || []);
        return `${nameKey}::${shapeKey}`;
      }).filter(key => key !== '::')
    );
    const missing = defaultChords.filter(item => {
      const nameKey = String(item?.name || '').trim().toLowerCase();
      const shapeKey = makeShapeKey(item?.strings || []);
      const key = `${nameKey}::${shapeKey}`;
      return !!nameKey && !!shapeKey && !existingKeys.has(key);
    });
    if (!missing.length) return existing;

    for (const chord of missing) {
      await addDoc(chordsRef, chord);
    }
    const refreshed = await getDocs(chordsRef);
    return refreshed.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async saveChord(chordData, editingChordId = null) {
    if (editingChordId) {
      await setDoc(doc(this.db, 'chords', editingChordId), chordData, { merge: true });
      return editingChordId;
    }
    const created = await addDoc(collection(this.db, 'chords'), chordData);
    return created.id;
  }

  async loadGuitarTones() {
    const tonesRef = collection(this.db, 'guitar_tones');
    const snap = await getDocs(tonesRef);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const nameA = String(a.name || '').toLowerCase();
        const nameB = String(b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }

  async saveGuitarTone(toneData, editingToneId = null) {
    if (editingToneId) {
      await setDoc(doc(this.db, 'guitar_tones', editingToneId), toneData, { merge: true });
      return editingToneId;
    }
    const created = await addDoc(collection(this.db, 'guitar_tones'), toneData);
    return created.id;
  }

  async deleteGuitarTone(toneId) {
    const chunksRef = collection(this.db, 'guitar_tones', toneId, 'string_chunks');
    const snap = await getDocs(chunksRef);
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
    await deleteDoc(doc(this.db, 'guitar_tones', toneId));
  }

  async saveGuitarToneStringData(toneId, stringKey, dataUrl) {
    const chunksRef = collection(this.db, 'guitar_tones', toneId, 'string_chunks');
    const existing = await getDocs(query(chunksRef, where('stringKey', '==', stringKey)));
    for (const entry of existing.docs) {
      await deleteDoc(entry.ref);
    }
    const CHUNK_SIZE = 350000;
    const source = String(dataUrl || '');
    const chunkCount = Math.max(1, Math.ceil(source.length / CHUNK_SIZE));
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const part = source.slice(start, start + CHUNK_SIZE);
      const chunkId = `${stringKey}-${String(i).padStart(5, '0')}`;
      await setDoc(doc(chunksRef, chunkId), { stringKey, index: i, data: part });
    }
    return chunkCount;
  }

  async loadGuitarToneStringData(toneId, stringKey) {
    const chunksRef = collection(this.db, 'guitar_tones', toneId, 'string_chunks');
    const snap = await getDocs(query(chunksRef, where('stringKey', '==', stringKey), limit(500)));
    if (snap.empty) return '';
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.index ?? Number(String(a.id).split('-').pop())) - (b.index ?? Number(String(b.id).split('-').pop())))
      .map(entry => String(entry.data || ''))
      .join('');
  }

  async deleteGuitarToneStringData(toneId, stringKey) {
    const chunksRef = collection(this.db, 'guitar_tones', toneId, 'string_chunks');
    const snap = await getDocs(query(chunksRef, where('stringKey', '==', stringKey)));
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
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
