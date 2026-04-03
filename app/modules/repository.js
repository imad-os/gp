import { collection, getDocs, doc, setDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
    if (editingSongId) {
      const songRef = doc(this.db, 'songs', editingSongId);
      await setDoc(songRef, songData, { merge: true });
      return editingSongId;
    }
    const created = await addDoc(collection(this.db, 'songs'), songData);
    return created.id;
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
}
