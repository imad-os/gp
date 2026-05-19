import { collection, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc, query, where, limit, orderBy, startAfter, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

  async idbDelete(cacheKey) {
    const db = await this.getIdb();
    if (!db) return;
    await new Promise(resolve => {
      try {
        const tx = db.transaction(this.idbStore, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.objectStore(this.idbStore).delete(cacheKey);
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

  estimatePayloadBytes(value) {
    try {
      return new Blob([JSON.stringify(value ?? null)]).size;
    } catch {
      try {
        return String(value ?? '').length;
      } catch {
        return 0;
      }
    }
  }

  async measureCollectionUsage(path = []) {
    try {
      const ref = collection(this.db, ...path);
      const snap = await getDocs(ref);
      let bytes = 0;
      snap.docs.forEach(d => {
        bytes += this.estimatePayloadBytes(d.data()) + String(d.id || '').length;
      });
      return { docs: snap.docs.length, bytes };
    } catch {
      return { docs: 0, bytes: 0 };
    }
  }

  async measureNestedUsage(parentPath = [], childName = '') {
    try {
      const parentRef = collection(this.db, ...parentPath);
      const parentSnap = await getDocs(parentRef);
      let docs = 0;
      let bytes = 0;
      for (const parent of parentSnap.docs) {
        const childRef = collection(this.db, ...parentPath, parent.id, childName);
        const childSnap = await getDocs(childRef);
        docs += childSnap.docs.length;
        childSnap.docs.forEach(d => {
          bytes += this.estimatePayloadBytes(d.data()) + String(d.id || '').length;
        });
      }
      return { docs, bytes };
    } catch {
      return { docs: 0, bytes: 0 };
    }
  }

  async getUsageStats(userId = '') {
    const rows = [];
    const push = (key, label, result) => rows.push({ key, label, docs: Number(result?.docs || 0), bytes: Number(result?.bytes || 0) });

    push('songs', 'songs', await this.measureCollectionUsage(['songs']));
    push('song_comments', 'songs/*/comments', await this.measureNestedUsage(['songs'], 'comments'));
    push('song_ratings', 'songs/*/ratings', await this.measureNestedUsage(['songs'], 'ratings'));
    push('chords', 'chords', await this.measureCollectionUsage(['chords']));
    push('guitar_tones', 'guitar_tones', await this.measureCollectionUsage(['guitar_tones']));
    push('guitar_tone_chunks', 'guitar_tones/*/string_chunks', await this.measureNestedUsage(['guitar_tones'], 'string_chunks'));
    push('training_articles', 'training_articles', await this.measureCollectionUsage(['training_articles']));
    push('training_comments', 'training_articles/*/comments', await this.measureNestedUsage(['training_articles'], 'comments'));
    push('training_ratings', 'training_articles/*/ratings', await this.measureNestedUsage(['training_articles'], 'ratings'));
    push('public_loops', 'public_loops', await this.measureCollectionUsage(['public_loops']));
    push('public_loop_chunks', 'public_loops/*/media_chunks', await this.measureNestedUsage(['public_loops'], 'media_chunks'));

    if (userId) {
      push('user_settings', `users/${userId}/settings`, await this.measureCollectionUsage(['users', userId, 'settings']));
      push('user_progress', `users/${userId}/progress`, await this.measureCollectionUsage(['users', userId, 'progress']));
      push('user_recordings', `users/${userId}/tool_recordings`, await this.measureCollectionUsage(['users', userId, 'tool_recordings']));
      push('user_looper_history', `users/${userId}/looper_history`, await this.measureCollectionUsage(['users', userId, 'looper_history']));
      push('user_looper_chunks', `users/${userId}/looper_history/*/media_chunks`, await this.measureNestedUsage(['users', userId, 'looper_history'], 'media_chunks'));
      push('user_music', `users/${userId}/music`, await this.measureCollectionUsage(['users', userId, 'music']));
      push('user_music_chunks', `users/${userId}/music/*/media_chunks`, await this.measureNestedUsage(['users', userId, 'music'], 'media_chunks'));
      push('user_music_playlists', `users/${userId}/music_playlists`, await this.measureCollectionUsage(['users', userId, 'music_playlists']));
      push('user_gp_files', `users/${userId}/guitarpro_files`, await this.measureCollectionUsage(['users', userId, 'guitarpro_files']));
      push('user_gp_chunks', `users/${userId}/guitarpro_files/*/file_chunks`, await this.measureNestedUsage(['users', userId, 'guitarpro_files'], 'file_chunks'));
    }

    const totals = rows.reduce((acc, row) => {
      acc.docs += row.docs;
      acc.bytes += row.bytes;
      return acc;
    }, { docs: 0, bytes: 0 });

    return {
      checkedAt: Date.now(),
      rows,
      totals
    };
  }

  async loadSoundEffectProfiles(userId) {
    if (!userId) return [];
    const cacheKey = this.makeCacheKey('sound_effect_profiles', userId);
    const list = await this.readWithCache(cacheKey, async () => {
      const ref = collection(this.db, 'users', userId, 'sound_effect_profiles');
      const snap = await getDocs(ref);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    });
    return Array.isArray(list) ? list : [];
  }

  async saveSoundEffectProfile(userId, profileId, payload) {
    if (!userId) throw new Error('Missing user id');
    const id = String(profileId || '').trim() || `sfx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await setDoc(doc(this.db, 'users', userId, 'sound_effect_profiles', id), payload, { merge: true });
    const cacheKey = this.makeCacheKey('sound_effect_profiles', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const idx = current.findIndex(item => item?.id === id);
      const nextItem = { id, ...(idx >= 0 ? current[idx] : {}), ...payload };
      const next = idx >= 0 ? current.map(item => (item?.id === id ? nextItem : item)) : [nextItem, ...current];
      next.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
    }
    return id;
  }

  async deleteSoundEffectProfile(userId, profileId) {
    if (!userId || !profileId) return;
    await deleteDoc(doc(this.db, 'users', userId, 'sound_effect_profiles', profileId));
    const cacheKey = this.makeCacheKey('sound_effect_profiles', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      this.setCacheJson(cacheKey, current.filter(item => item?.id !== profileId));
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

  async browseSongsPage({ ensureSongFormat, pageSize = 20, cursor = null } = {}) {
    const size = Math.max(1, Math.min(50, Number(pageSize) || 20));
    const songsRef = collection(this.db, 'songs');
    const buildCursorQuery = (baseCursor) => {
      const clauses = [
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        limit(size + 1)
      ];
      if (baseCursor && typeof baseCursor.createdAt === 'number' && baseCursor.id) {
        clauses.splice(2, 0, startAfter(baseCursor.createdAt, String(baseCursor.id)));
      }
      return query(songsRef, ...clauses);
    };
    const fallbackDocIdQuery = (baseCursor) => {
      const clauses = [orderBy(documentId(), 'desc'), limit(size + 1)];
      if (baseCursor && baseCursor.id) {
        clauses.splice(1, 0, startAfter(String(baseCursor.id)));
      }
      return query(songsRef, ...clauses);
    };

    let snap = await getDocs(buildCursorQuery(cursor));
    if (snap.empty && !cursor) {
      snap = await getDocs(fallbackDocIdQuery(cursor));
    }

    const docs = snap.docs || [];
    const hasMore = docs.length > size;
    const pageDocs = hasMore ? docs.slice(0, size) : docs;
    const items = pageDocs.map(d => ({ id: d.id, ...d.data() }));
    const last = pageDocs[pageDocs.length - 1] || null;
    const nextCursor = hasMore && last
      ? { id: last.id, createdAt: Number(last.data()?.createdAt || 0) }
      : null;

    return {
      items: ensureSongFormat ? items.map(ensureSongFormat) : items,
      hasMore,
      nextCursor
    };
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
    await this.deleteToolRecordingData(userId, recordingId);
    await deleteDoc(doc(this.db, 'users', userId, 'tool_recordings', recordingId));
  }

  async updateToolRecording(userId, recordingId, patch) {
    await setDoc(doc(this.db, 'users', userId, 'tool_recordings', recordingId), patch, { merge: true });
  }

  async saveToolRecordingData(userId, recordingId, dataUrl) {
    const chunksRef = collection(this.db, 'users', userId, 'tool_recordings', recordingId, 'audio_chunks');
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
    await this.idbSet(this.makeCacheKey('tool_recording_audio', `${userId}:${recordingId}`), source);
    return chunkCount;
  }

  async loadToolRecordingData(userId, recordingId) {
    const cacheKey = this.makeCacheKey('tool_recording_audio', `${userId}:${recordingId}`);
    return await this.readWithIdbCache(cacheKey, async () => {
      const chunksRef = collection(this.db, 'users', userId, 'tool_recordings', recordingId, 'audio_chunks');
      const snap = await getDocs(chunksRef);
      if (snap.empty) return '';
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.index ?? Number(a.id)) - (b.index ?? Number(b.id)))
        .map(item => String(item.data || ''))
        .join('');
    }, { timeoutMs: 10000 });
  }

  async deleteToolRecordingData(userId, recordingId) {
    const chunksRef = collection(this.db, 'users', userId, 'tool_recordings', recordingId, 'audio_chunks');
    const snap = await getDocs(chunksRef);
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
    await this.idbDelete(this.makeCacheKey('tool_recording_audio', `${userId}:${recordingId}`));
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

  async loadMusicLibrary(userId) {
    const items = await this.readWithCache(this.makeCacheKey('music_library', userId), async () => {
      const ref = collection(this.db, 'users', userId, 'music');
      const snap = await getDocs(ref);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    });
    this.setCacheJson(this.makeCacheKey('music_library_device', 'all'), items);
    return Array.isArray(items) ? items : [];
  }

  loadMusicLibraryFromDeviceCache() {
    return this.getCacheJson(this.makeCacheKey('music_library_device', 'all')) || [];
  }

  async saveMusicItem(userId, itemId, payload) {
    if (!userId) throw new Error('Missing user id');
    const id = String(itemId || '').trim();
    if (id) {
      await setDoc(doc(this.db, 'users', userId, 'music', id), payload, { merge: true });
    } else {
      const created = await addDoc(collection(this.db, 'users', userId, 'music'), payload);
      itemId = created.id;
    }
    const safeId = String(itemId || id || '').trim();
    const cacheKey = this.makeCacheKey('music_library', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const idx = current.findIndex(item => item?.id === safeId);
      const nextItem = { id: safeId, ...(idx >= 0 ? current[idx] : {}), ...payload };
      const next = idx >= 0 ? current.map(item => (item?.id === safeId ? nextItem : item)) : [nextItem, ...current];
      next.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
      this.setCacheJson(this.makeCacheKey('music_library_device', 'all'), next);
    }
    return safeId;
  }

  async updateMusicItem(userId, itemId, patch) {
    if (!userId || !itemId) return;
    await setDoc(doc(this.db, 'users', userId, 'music', itemId), patch, { merge: true });
    const cacheKey = this.makeCacheKey('music_library', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const next = current.map(item => (item?.id === itemId ? { ...item, ...patch } : item))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
      this.setCacheJson(this.makeCacheKey('music_library_device', 'all'), next);
    }
  }

  async deleteMusicItem(userId, itemId) {
    if (!userId || !itemId) return;
    await deleteDoc(doc(this.db, 'users', userId, 'music', itemId));
    const cacheKey = this.makeCacheKey('music_library', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const next = current.filter(item => item?.id !== itemId);
      this.setCacheJson(cacheKey, next);
      this.setCacheJson(this.makeCacheKey('music_library_device', 'all'), next);
    }
    await this.idbDelete(this.makeCacheKey('music_media', `${userId}:${itemId}`));
    await this.idbDelete(this.makeCacheKey('music_media_device', itemId));
  }

  async saveMusicMediaData(userId, itemId, dataUrl, onProgress = null) {
    const chunksRef = collection(this.db, 'users', userId, 'music', itemId, 'media_chunks');
    const existing = await getDocs(chunksRef);
    for (const entry of existing.docs) {
      await deleteDoc(entry.ref);
    }
    const CHUNK_SIZE = 350000;
    const source = String(dataUrl || '');
    const chunkCount = Math.max(1, Math.ceil(source.length / CHUNK_SIZE));
    if (typeof onProgress === 'function') onProgress(12);
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const part = source.slice(start, start + CHUNK_SIZE);
      const chunkId = String(i).padStart(5, '0');
      await setDoc(doc(chunksRef, chunkId), { index: i, data: part });
      if (typeof onProgress === 'function') {
        const progress = 12 + Math.round(((i + 1) / chunkCount) * 80);
        onProgress(Math.min(92, progress));
      }
    }
    await this.idbSet(this.makeCacheKey('music_media', `${userId}:${itemId}`), source);
    await this.idbSet(this.makeCacheKey('music_media_device', itemId), source);
    if (typeof onProgress === 'function') onProgress(100);
    return chunkCount;
  }

  async loadMusicMediaData(userId, itemId, onProgress = null) {
    const cacheKey = this.makeCacheKey('music_media', `${userId}:${itemId}`);
    try {
      const value = await this.readWithIdbCache(cacheKey, async () => {
        const chunksRef = collection(this.db, 'users', userId, 'music', itemId, 'media_chunks');
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
        await this.idbSet(this.makeCacheKey('music_media_device', itemId), value);
        return value;
      }
      const globalFallback = await this.idbGet(this.makeCacheKey('music_media_device', itemId));
      return globalFallback || '';
    } catch {
      const globalFallback = await this.idbGet(this.makeCacheKey('music_media_device', itemId));
      return globalFallback || '';
    }
  }

  async deleteMusicMediaData(userId, itemId) {
    if (!userId || !itemId) return;
    const chunksRef = collection(this.db, 'users', userId, 'music', itemId, 'media_chunks');
    const snap = await getDocs(chunksRef);
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
    await this.idbDelete(this.makeCacheKey('music_media', `${userId}:${itemId}`));
    await this.idbDelete(this.makeCacheKey('music_media_device', itemId));
  }

  async loadMusicPlaylists(userId) {
    const items = await this.readWithCache(this.makeCacheKey('music_playlists', userId), async () => {
      const ref = collection(this.db, 'users', userId, 'music_playlists');
      const snap = await getDocs(ref);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    });
    return Array.isArray(items) ? items : [];
  }

  async saveMusicPlaylist(userId, playlistId, payload) {
    if (!userId) throw new Error('Missing user id');
    const id = String(playlistId || '').trim() || `playlist-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await setDoc(doc(this.db, 'users', userId, 'music_playlists', id), payload, { merge: true });
    const cacheKey = this.makeCacheKey('music_playlists', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const idx = current.findIndex(item => item?.id === id);
      const nextItem = { id, ...(idx >= 0 ? current[idx] : {}), ...payload };
      const next = idx >= 0 ? current.map(item => (item?.id === id ? nextItem : item)) : [nextItem, ...current];
      next.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
    }
    return id;
  }

  async deleteMusicPlaylist(userId, playlistId) {
    if (!userId || !playlistId) return;
    await deleteDoc(doc(this.db, 'users', userId, 'music_playlists', playlistId));
    const cacheKey = this.makeCacheKey('music_playlists', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      this.setCacheJson(cacheKey, current.filter(item => item?.id !== playlistId));
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

  async loadGuitarProFiles(userId) {
    const list = await this.readWithCache(this.makeCacheKey('guitarpro_files', userId), async () => {
      const ref = collection(this.db, 'users', userId, 'guitarpro_files');
      const snap = await getDocs(ref);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    });
    return Array.isArray(list) ? list : [];
  }

  async saveGuitarProFile(userId, itemId, payload) {
    const ref = doc(this.db, 'users', userId, 'guitarpro_files', itemId);
    await setDoc(ref, payload, { merge: true });
    const cacheKey = this.makeCacheKey('guitarpro_files', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      const idx = current.findIndex(item => item?.id === itemId);
      const nextItem = { id: itemId, ...(idx >= 0 ? current[idx] : {}), ...payload };
      const next = idx >= 0
        ? current.map(item => (item?.id === itemId ? nextItem : item))
        : [nextItem, ...current];
      next.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      this.setCacheJson(cacheKey, next);
    }
  }

  async saveGuitarProFileData(userId, itemId, dataUrl) {
    const chunksRef = collection(this.db, 'users', userId, 'guitarpro_files', itemId, 'file_chunks');
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
    await this.idbSet(this.makeCacheKey('guitarpro_file_data', `${userId}:${itemId}`), source);
    return chunkCount;
  }

  async loadGuitarProFileData(userId, itemId, onProgress = null) {
    const cacheKey = this.makeCacheKey('guitarpro_file_data', `${userId}:${itemId}`);
    return await this.readWithIdbCache(cacheKey, async () => {
      const chunksRef = collection(this.db, 'users', userId, 'guitarpro_files', itemId, 'file_chunks');
      const snap = await getDocs(chunksRef);
      if (snap.empty) return '';
      if (typeof onProgress === 'function') onProgress(15);
      const ordered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.index ?? Number(a.id)) - (b.index ?? Number(b.id)));
      const total = Math.max(1, ordered.length);
      const parts = [];
      for (let i = 0; i < ordered.length; i += 1) {
        parts.push(String(ordered[i].data || ''));
        if (typeof onProgress === 'function') onProgress(Math.min(95, 15 + Math.round(((i + 1) / total) * 80)));
        if (i % 25 === 0) await Promise.resolve();
      }
      return parts.join('');
    }, { timeoutMs: 10000 });
  }

  async deleteGuitarProFile(userId, itemId) {
    const chunksRef = collection(this.db, 'users', userId, 'guitarpro_files', itemId, 'file_chunks');
    const snap = await getDocs(chunksRef);
    for (const entry of snap.docs) {
      await deleteDoc(entry.ref);
    }
    await deleteDoc(doc(this.db, 'users', userId, 'guitarpro_files', itemId));
    const cacheKey = this.makeCacheKey('guitarpro_files', userId);
    const current = this.getCacheJson(cacheKey);
    if (Array.isArray(current)) {
      this.setCacheJson(cacheKey, current.filter(item => item?.id !== itemId));
    }
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
