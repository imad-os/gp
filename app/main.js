import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as Music from './modules/music.js';
import * as UI from './modules/renderers.js';
import { FirestoreRepository } from './modules/repository.js';
import { AudioEngine } from './modules/audio-engine.js';

    const appId = typeof __app_id !== 'undefined' ? __app_id : "1:282086325190:web:b3ec1bca510460e87a50c7";
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
      apiKey: "AIzaSyD-J0dAS2C7_KCpupKpvB_lLhi55TkbWTQ",
      authDomain: "guitarpractice-dfa4b.firebaseapp.com",
      projectId: "guitarpractice-dfa4b",
      storageBucket: "guitarpractice-dfa4b.firebasestorage.app",
      messagingSenderId: "282086325190",
      appId: "1:282086325190:web:b3ec1bca510460e87a50c7"
    };
    
    let app, auth, db, user, repository;
    let songs = [];
    let currentSong = null;
    let userProgress = {};
    let editingSongId = null; 
    
    let audioCtx = null;
    let isPlaying = false;
    let startTime = 0;
    let currentBpm = 70;
    let nextNoteTime = 0;
    let currentBeatInBar = 0;
    let animationId;
    let currentStepMode = 1;
    let activeStrumPattern = [];
    let lastSavedPercent = -1;
    let lastPlayedStrumIndex = -1;
    let practiceChordAudioEnabled = true;
    let activeChordVoices = [];
    let activeTab = 'home';
    let metronomeTimer = null;
    let metronomeBeatIndex = 0;
    let toolRecordings = [];
    let toolAudioPlayers = new Map();
    let activeToolAudioId = null;
    let toolRecorder = null;
    let toolRecordingStream = null;
    let toolRecordingChunks = [];
    let toolRecordingTimeout = null;
    let selectedChordReference = 'C';
    let activeToolPage = 'home';
    let currentSongComments = [];
    let currentSongRatings = [];
    let pendingSongRating = 0;
    let tunerStream = null;
    let tunerAnalyser = null;
    let tunerSource = null;
    let tunerAnimationId = null;
    let trainingTimer = null;
    let trainingBeatIndex = 0;
    const METRONOME_STORAGE_KEY = 'guitartrainer.metronome.settings';
    const DEFAULT_SETTINGS = {
      practiceTextSize: 14,
      enableStrumDetection: false,
      enableChordDetection: false,
      favoriteSongIds: [],
      recentPractice: []
    };
    let userSettings = { ...DEFAULT_SETTINGS };
    let practiceStream = null;
    let practiceAnalyser = null;
    let practiceSource = null;
    let practiceValidationStates = [];
    let lastPracticeTransientTime = 0;
    let lastPracticeRms = 0;
    let lastChordValidationState = null;
    const audioEngine = new AudioEngine();

    const CAPO_OPTIONS = ["No capo", "1st fret", "2nd fret", "3rd fret", "4th fret", "5th fret", "6th fret", "7th fret", "8th fret", "9th fret", "10th fret", "11th fret", "12th fret"];
    const TAB_VIEWS = new Set(['home', 'training', 'tuner', 'tools', 'settings']);
    const STANDARD_TUNING = [
      { note: 'E2', freq: 82.41 },
      { note: 'A2', freq: 110.0 },
      { note: 'D3', freq: 146.83 },
      { note: 'G3', freq: 196.0 },
      { note: 'B3', freq: 246.94 },
      { note: 'E4', freq: 329.63 }
    ];
    const CHORD_LIBRARY = {
      C: { baseFret: 1, strings: ['x', 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
      Cm: { baseFret: 3, strings: ['x', 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1] },
      D: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
      Dm: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
      E: { baseFret: 1, strings: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
      Em: { baseFret: 1, strings: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
      F: { baseFret: 1, strings: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
      G: { baseFret: 1, strings: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
      A: { baseFret: 1, strings: ['x', 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
      Am: { baseFret: 1, strings: ['x', 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
      B7: { baseFret: 1, strings: ['x', 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] }
    };
    const NOTE_INDEX = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const CHORD_EXPLORER_LIST = Object.keys(CHORD_LIBRARY).sort((a, b) => a.localeCompare(b));

    const MOCK_SONG = {
      title: "Ya Rayah", artist: "Cheb Khaled", postedBy: "System", bpm: 80, timeSignature: "4/4", capo: "No capo", ownerId: "system",
      rawText: "Am                                G\nYa rayah win msafar trouh taaya wa twali\nF                                 E\nChhal nadmou laabad lghafline qablak ou qabli\n\nAm                                G\nYa rayah win msafar trouh taaya wa twali",
      strumming: [
        { time: 0, type: "â†“", raw: "D" }, { time: 0.5, type: ".", raw: "." },
        { time: 1, type: "â†“", raw: "D" }, { time: 1.5, type: "â†‘", raw: "U" },
        { time: 2, type: ".", raw: "." }, { time: 2.5, type: "â†‘", raw: "U" },
        { time: 3, type: "â†“", raw: "D" }, { time: 3.5, type: "â†‘", raw: "U" }
      ]
    };

    window.showToast = function(msg, isSuccess = false) {
      const t = document.getElementById('toast-msg');
      t.innerText = msg;
      t.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl z-[100] transition-all duration-300 font-bold text-center w-11/12 max-w-sm pointer-events-none border ${isSuccess ? 'bg-[#0f6e63] text-white border-[#39d7c2] shadow-[0_14px_32px_rgba(3,218,198,0.32)]' : 'bg-[#7d3142] text-white border-[#ff9bb0] shadow-[0_14px_32px_rgba(207,102,121,0.32)]'}`;
      
      void t.offsetWidth; 
      t.classList.remove('translate-y-[-150%]', 'opacity-0');
      
      setTimeout(() => {
        t.classList.add('translate-y-[-150%]', 'opacity-0');
      }, 3000);
    };

    window.handleLogin = async function() {
      const email = document.getElementById('email-input').value.trim();
      const pass = document.getElementById('password-input').value.trim();
      if(!email || !pass) return showToast("Please enter email and password");
      
      showLoading(true, "Authenticating...");
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch(err) {
        showLoading(false);
        showToast(err.message.replace('Firebase:', '').trim() || "Login failed");
      }
    };

    window.handleSignup = async function() {
      const email = document.getElementById('email-input').value.trim();
      const pass = document.getElementById('password-input').value.trim();
      if(!email || !pass) return showToast("Please enter email and password");
      if(pass.length < 6) return showToast("Password must be at least 6 characters");
      
      showLoading(true, "Creating account...");
      try {
        await createUserWithEmailAndPassword(auth, email, pass);
        showToast("Account created successfully!", true);
      } catch(err) {
        showLoading(false);
        showToast(err.message.replace('Firebase:', '').trim() || "Signup failed");
      }
    };

    window.handleGuest = async function() {
      showLoading(true, "Entering as guest...");
      try {
        await signInAnonymously(auth);
      } catch(err) {
        showLoading(false);
        showToast("Failed to connect as guest.");
      }
    };

    window.handleLogout = async function() {
      if(isPlaying) stopPlayback();
      showLoading(true, "Signing out...");
      try {
        await signOut(auth);
      } catch(e) {
        showLoading(false);
      }
    };

    function showLoading(show, text = "Loading...") {
      const l = document.getElementById('loading-overlay');
      document.getElementById('loading-text').innerText = text;
      show ? l.classList.remove('hidden') : l.classList.add('hidden');
      if (show) l.classList.add('flex');
    }

    // --- Smart Text Parsing Engine ---
    function normalizeChordTokensForDetection(line) {
      const words = line.trim().split(/\s+/).filter(w => w.length > 0);
      if (words.length && /^x\d+$/i.test(words[words.length - 1])) {
        return words.slice(0, -1);
      }
      return words;
    }

    function isChordLine(line) {
      const words = normalizeChordTokensForDetection(line);
      if (words.length === 0) return false;
      const chordRegex = /^([A-G][#b]?(m|maj|min|aug|dim|sus|add)?\d*(\/[A-G][#b]?)?)$/i;
      return words.every(w => chordRegex.test(w));
    }

    function isTagLine(line) {
      return /^\s*\[[^\]]+\]\s*$/.test(line || "");
    }

    function stripLeadingWhitespace(line = "") {
      return line.replace(/^\s+/, '');
    }

    function parseRawText(text, beatsPerBar = 4) {
      const lines = text.split('\n');
      let parsedLines = [];
      let flatChords = [];
      let currentTime = 0;
      let globalChordIdx = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (isTagLine(line)) {
          parsedLines.push({ type: 'tag', chordHtml: "", lyricLine: stripLeadingWhitespace(line), chords: [] });
          continue;
        }

        if (isChordLine(line)) {
          const normalizedChordLine = stripLeadingWhitespace(line).replace(/\s+$/, '');
          let nextLine = (i + 1 < lines.length && !isChordLine(lines[i + 1]) && !isTagLine(lines[i + 1]) && lines[i+1].trim() !== "") ? lines[i + 1] : "";
          if (nextLine !== "") i++;

          const chordRegex = /[^\s]+/g;
          let match;
          let chordHtml = "";
          let lastIdx = 0;
          let lineChords = [];

          while ((match = chordRegex.exec(normalizedChordLine)) !== null) {
            const chordStr = match[0];
            if (/^x\d+$/i.test(chordStr)) {
              chordHtml += normalizedChordLine.substring(lastIdx, match.index);
              chordHtml += `<span class="text-gray-500 uppercase tracking-[0.2em]">${chordStr}</span>`;
              lastIdx = match.index + chordStr.length;
              continue;
            }
            chordHtml += normalizedChordLine.substring(lastIdx, match.index);
            chordHtml += `<span id="chord-hl-${globalChordIdx}" class="transition-all duration-200">${chordStr}</span>`;
            lastIdx = match.index + chordStr.length;

            const chordObj = { chord: chordStr, time: currentTime, lineIdx: parsedLines.length, globalIdx: globalChordIdx };
            flatChords.push(chordObj);
            lineChords.push(chordObj);
            currentTime += beatsPerBar; // Time Signature dependent
            globalChordIdx++;
          }
          chordHtml += normalizedChordLine.substring(lastIdx);

          parsedLines.push({ type: 'content', chordHtml: chordHtml, lyricLine: stripLeadingWhitespace(nextLine), chords: lineChords });
        } else if (line.trim() !== "") {
          parsedLines.push({ type: 'content', chordHtml: "", lyricLine: stripLeadingWhitespace(line), chords: [] });
        } else {
          if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].chordHtml === '' && parsedLines[parsedLines.length - 1].lyricLine === '') continue;
          parsedLines.push({ type: 'empty', chordHtml: "", lyricLine: "", chords: [] });
        }
      }

      if (flatChords.length === 0) {
         flatChords = [{ chord: "C", time: 0, lineIdx: 0, globalIdx: 0 }];
         parsedLines = [{ type: 'content', chordHtml: `<span id="chord-hl-0">C</span>`, lyricLine: "Empty", chords: flatChords }];
         currentTime = beatsPerBar;
      }

      return { parsedLines, flatChords, totalBeats: currentTime };
    }

    function ensureSongFormat(song) {
       if (!song.rawText && song.chords) {
           song.rawText = song.chords.map(c => `${c.chord}\n${c.lyric}`).join('\n\n');
       }
       song.capo = song.capo || "No capo";
       const rawPattern = (song.strumming || []).map(s => s.raw || (s.type === 'â†“' ? 'D' : (s.type === 'â†‘' ? 'U' : '.'))).join('');
       song.strumming = parseStrumPattern(rawPattern, song.timeSignature || "4/4");
       const beatsPerBar = parseInt((song.timeSignature || "4/4").split('/')[0]) || 4;
       const parsed = parseRawText(song.rawText || "C\nNew Song", beatsPerBar);
       song.parsedLines = parsed.parsedLines;
       song.chords = parsed.flatChords;
       song.totalBeats = parsed.totalBeats;
       song.stats = { views: 0, started: 0, completed: 0, ...(song.stats || {}) };
       song.createdAt = song.createdAt || Date.now();
       return song;
    }

    async function initApp() {
      showLoading(true, "Initializing...");
      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        repository = new FirestoreRepository(db);

        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) {
          try { await signInWithCustomToken(auth, token); } catch(e) { console.error("Token fail:", e); }
        }

        onAuthStateChanged(auth, async (u) => {
          if (u) {
            user = u;
            const isGuest = user.isAnonymous;
            
            document.getElementById('display-username').innerText = isGuest ? "Guest Player" : user.email.split('@')[0];
            document.getElementById('display-username').title = isGuest ? "Guest" : user.email;
            
            const addBtn = document.getElementById('btn-add-song');
            if(isGuest) addBtn.classList.add('hidden');
            else addBtn.classList.remove('hidden');

            await loadUserSettings();
            await loadSongs();
            await loadToolRecordings();
            renderToolRecordings();
            renderChordExplorer();
            renderToolSongsSearch();
            showToolsHome();
            navigate('home');
            showLoading(false);
          } else {
            user = null;
            toolRecordings = [];
            document.getElementById('email-input').value = "";
            document.getElementById('password-input').value = "";
            navigate('auth');
            showLoading(false);
          }
        });
      } catch (err) {
        console.error(err);
        showToast("Failed to connect to servers.");
        showLoading(false);
      }
    }

    async function loadSongs() {
      try {
        songs = await repository.loadSongs({ defaultSong: MOCK_SONG, ensureSongFormat });
        renderHomeList();
      } catch(e) {
        console.error("Failed to load songs", e);
        songs = [ensureSongFormat(MOCK_SONG)]; 
        renderHomeList();
      }
    }

    async function loadToolRecordings() {
      if (!user || user.isAnonymous) {
        toolRecordings = [];
        return;
      }
      try {
        toolRecordings = await repository.loadToolRecordings(user.uid);
      } catch (e) {
        console.error("Failed to load tool recordings", e);
        toolRecordings = [];
      }
    }

    function renderToolRecordings() {
      const list = document.getElementById('tool-recordings-list');
      if (!list) return;
      if (!toolRecordings.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-500">No registered sounds yet.</div>`;
        return;
      }
      list.innerHTML = toolRecordings.map(recording => `
        <div class="bg-black/30 border border-gray-800 rounded-2xl px-4 py-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div>
              <p class="font-semibold text-white">${recording.name || 'Untitled sound'}</p>
              <p class="text-xs text-gray-500">${recording.createdAt ? new Date(recording.createdAt).toLocaleString() : 'Saved clip'}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] uppercase tracking-[0.25em] text-gray-500">${Math.max(1, Math.round((recording.durationMs || 0) / 1000))}s</span>
              <button onclick="downloadToolRecording('${recording.id}')" class="w-8 h-8 rounded-full btn-soft btn-press">
                <i class="fas fa-download text-xs"></i>
              </button>
              <button onclick="deleteToolRecording('${recording.id}')" class="w-8 h-8 rounded-full btn-soft btn-press">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3 mt-3">
            <button onclick="toggleToolRecordingPlayback('${recording.id}')" id="record-play-${recording.id}" class="w-11 h-11 rounded-full bg-primary text-white btn-press shadow-[0_0_18px_rgba(187,134,252,0.22)]">
              <i class="fas fa-play"></i>
            </button>
            <div class="flex-1">
              <div class="flex items-end gap-[3px] h-10 mb-2">
                ${Array.from({ length: 36 }, (_, idx) => {
                  const seed = recording.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                  const height = 18 + ((seed + (idx * 13)) % 22);
                  return `<span class="block flex-1 rounded-full bg-white/12" style="height:${height}px" id="record-wave-${recording.id}-${idx}"></span>`;
                }).join('')}
              </div>
              <div class="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div id="record-progress-${recording.id}" class="h-full bg-primary transition-all duration-150" style="width:0%"></div>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    function getToolAudio(recordingId) {
      const recording = toolRecordings.find(item => item.id === recordingId);
      if (!recording) return null;
      if (!toolAudioPlayers.has(recordingId)) {
        const audio = new Audio(recording.dataUrl);
        audio.addEventListener('timeupdate', () => updateToolRecordingPlaybackUI(recordingId));
        audio.addEventListener('ended', () => {
          activeToolAudioId = null;
          updateToolRecordingPlaybackUI(recordingId, true);
        });
        toolAudioPlayers.set(recordingId, audio);
      }
      return toolAudioPlayers.get(recordingId);
    }

    function updateToolRecordingPlaybackUI(recordingId, reset = false) {
      const audio = toolAudioPlayers.get(recordingId);
      const progress = document.getElementById(`record-progress-${recordingId}`);
      const playBtn = document.getElementById(`record-play-${recordingId}`);
      if (progress) {
        const pct = reset || !audio?.duration ? 0 : (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${pct}%`;
      }
      if (playBtn) {
        playBtn.innerHTML = `<i class="fas ${audio && !audio.paused && !reset ? 'fa-pause' : 'fa-play'}"></i>`;
      }
    }

    window.toggleToolRecordingPlayback = function(recordingId) {
      const audio = getToolAudio(recordingId);
      if (!audio) return;
      if (activeToolAudioId && activeToolAudioId !== recordingId) {
        const current = toolAudioPlayers.get(activeToolAudioId);
        if (current) {
          current.pause();
          updateToolRecordingPlaybackUI(activeToolAudioId, false);
        }
      }
      if (audio.paused) {
        audio.play();
        activeToolAudioId = recordingId;
      } else {
        audio.pause();
        activeToolAudioId = null;
      }
      updateToolRecordingPlaybackUI(recordingId, false);
    };

    window.downloadToolRecording = function(recordingId) {
      const recording = toolRecordings.find(item => item.id === recordingId);
      if (!recording) return;
      const link = document.createElement('a');
      link.href = recording.dataUrl;
      link.download = `${(recording.name || 'recording').replace(/[^a-z0-9_-]+/gi, '_')}.webm`;
      link.click();
    };

    function renderChordExplorer() {
      const grid = document.getElementById('chord-explorer-grid');
      const current = document.getElementById('chord-explorer-current');
      if (!grid) return;
      if (current) current.innerText = selectedChordReference;
      grid.innerHTML = CHORD_EXPLORER_LIST.map(chord => `
        <button onclick="selectChordReference('${chord}')" class="rounded-2xl p-3 btn-press ${selectedChordReference === chord ? 'border border-primary bg-primary/10' : 'btn-soft'}">
          ${UI.renderChordDiagramSvg(chord)}
        </button>
      `).join('');
    }

    window.selectChordReference = function(chord) {
      selectedChordReference = chord;
      renderChordExplorer();
    };

    window.playSelectedChordReference = async function() {
      await ensureAudioReady();
      await playChordPreview(selectedChordReference, 'D', 'No capo');
    };

    window.openToolPage = function(tool) {
      activeToolPage = tool;
      const pages = ['metronome', 'recorder', 'chords', 'songs'];
      document.getElementById('tools-home-panel')?.classList.add('hidden');
      pages.forEach(page => {
        document.getElementById(`tool-page-${page}`)?.classList.toggle('hidden', page !== tool);
      });
      document.getElementById('tools-back-btn')?.classList.remove('hidden');
      const subtitle = document.getElementById('tools-header-subtitle');
      if (subtitle) subtitle.innerText = tool === 'metronome' ? 'Keep steady time.' : tool === 'recorder' ? 'Save and replay short clips.' : 'Browse and hear the chord library.';
    };

    window.showToolsHome = function() {
      activeToolPage = 'home';
      document.getElementById('tools-home-panel')?.classList.remove('hidden');
      ['metronome', 'recorder', 'chords', 'songs'].forEach(page => {
        document.getElementById(`tool-page-${page}`)?.classList.add('hidden');
      });
      document.getElementById('tools-back-btn')?.classList.add('hidden');
      const subtitle = document.getElementById('tools-header-subtitle');
      if (subtitle) subtitle.innerText = 'Choose a tool.';
    };

    window.openTrainingPage = function(page) {
      document.getElementById('training-home-panel')?.classList.add('hidden');
      ['practice', 'dailies', 'strumming'].forEach(id => {
        document.getElementById(`training-page-${id}`)?.classList.toggle('hidden', id !== page);
      });
      document.getElementById('training-back-btn')?.classList.remove('hidden');
      const subtitle = document.getElementById('training-header-subtitle');
      if (subtitle) subtitle.innerText = page === 'practice' ? 'Song practice hub.' : page === 'dailies' ? 'Warm-up routines.' : 'Pattern trainer.';
    };

    window.showTrainingHome = function() {
      document.getElementById('training-home-panel')?.classList.remove('hidden');
      ['practice', 'dailies', 'strumming'].forEach(id => {
        document.getElementById(`training-page-${id}`)?.classList.add('hidden');
      });
      document.getElementById('training-back-btn')?.classList.add('hidden');
      const subtitle = document.getElementById('training-header-subtitle');
      if (subtitle) subtitle.innerText = 'Choose a training page.';
    };

    function updateToolRecordingUI(isRecording) {
      const btn = document.getElementById('btn-tool-record');
      const status = document.getElementById('tool-recording-status');
      if (btn) {
        btn.innerHTML = isRecording ? `<i class="fas fa-stop mr-2"></i> Stop` : `<i class="fas fa-circle mr-2"></i> Register`;
        btn.classList.toggle('bg-danger', isRecording);
      btn.classList.toggle('text-white', isRecording);
      btn.classList.toggle('bg-primary', !isRecording);
      btn.classList.toggle('text-black', false);
      btn.classList.toggle('text-white', true);
      btn.classList.toggle('btn-soft', false);
      }
      if (status) status.innerText = isRecording ? 'Recording' : 'Idle';
    }

    function stopToolRecordingStream() {
      if (toolRecordingTimeout) {
        clearTimeout(toolRecordingTimeout);
        toolRecordingTimeout = null;
      }
      if (toolRecordingStream) {
        toolRecordingStream.getTracks().forEach(track => track.stop());
        toolRecordingStream = null;
      }
    }

    window.toggleToolRecording = async function() {
      if (!user || user.isAnonymous) {
        showToast("Create an account to save sounds to Firebase.");
        return;
      }
      if (toolRecorder && toolRecorder.state === 'recording') {
        toolRecorder.stop();
        return;
      }
      try {
        toolRecordingChunks = [];
        toolRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        toolRecorder = new MediaRecorder(toolRecordingStream);
        const startedAt = Date.now();
        toolRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) toolRecordingChunks.push(event.data);
        };
        toolRecorder.onstop = async () => {
          updateToolRecordingUI(false);
          const blob = new Blob(toolRecordingChunks, { type: toolRecorder.mimeType || 'audio/webm' });
          toolRecorder = null;
          stopToolRecordingStream();
          if (!blob.size) return;
          if (blob.size > 900000) {
            showToast("Recording is too large. Keep it short.");
            return;
          }
          const dataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          const nameInput = document.getElementById('tool-recording-name');
          const name = (nameInput?.value || '').trim() || `Sound ${new Date().toLocaleTimeString()}`;
          await repository.saveToolRecording(user.uid, {
            name,
            dataUrl,
            mimeType: blob.type || 'audio/webm',
            durationMs: Date.now() - startedAt,
            createdAt: Date.now()
          });
          if (nameInput) nameInput.value = '';
          await loadToolRecordings();
          renderToolRecordings();
          showToast("Sound registered successfully.", true);
        };
        toolRecorder.start();
        updateToolRecordingUI(true);
        toolRecordingTimeout = setTimeout(() => {
          if (toolRecorder && toolRecorder.state === 'recording') toolRecorder.stop();
        }, 12000);
      } catch (e) {
        console.error("Tool recording failed", e);
        stopToolRecordingStream();
        toolRecorder = null;
        updateToolRecordingUI(false);
        showToast("Microphone access is required to register a sound.");
      }
    };

    window.deleteToolRecording = async function(recordingId) {
      if (!user || user.isAnonymous) return;
      try {
        const audio = toolAudioPlayers.get(recordingId);
        if (audio) {
          audio.pause();
          toolAudioPlayers.delete(recordingId);
        }
        await repository.deleteToolRecording(user.uid, recordingId);
        toolRecordings = toolRecordings.filter(recording => recording.id !== recordingId);
        renderToolRecordings();
        showToast("Recording deleted.", true);
      } catch (e) {
        console.error("Delete recording failed", e);
        showToast("Could not delete recording.");
      }
    };

    function getBeatsPerBarFromSignature(timeSignature = "4/4") {
      return parseInt((timeSignature || "4/4").split('/')[0], 10) || 4;
    }

    function getPatternSlotCount(beatsPerBar) {
      return beatsPerBar * 2;
    }

    function getPatternCountLabel(idx) {
      return idx % 2 === 0 ? String((idx / 2) + 1) : '&';
    }

    function normalizePatternText(strText, beatsPerBar) {
      const totalSlots = getPatternSlotCount(beatsPerBar);
      const cleanText = (strText || '').replace(/\s+/g, '').toUpperCase();
      return Array.from({ length: totalSlots }, (_, i) => {
        const char = cleanText[i] || '.';
        return ['D', 'U', 'X', '.'].includes(char) ? char : '.';
      }).join('');
    }

    function parseStrumPattern(strText, timeSignature = "4/4") {
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const cleanText = normalizePatternText(strText, beatsPerBar);
      const pattern = [];
      const totalSlots = getPatternSlotCount(beatsPerBar);
      for(let i=0; i < totalSlots; i++) {
        const char = cleanText[i] || '.';
        const time = i * 0.5;
        const type = char === 'D' ? 'â†“' : (char === 'U' ? 'â†‘' : (char === 'X' ? 'x' : '.'));
        pattern.push({ time, type, raw: char });
      }
      return pattern;
    }

    function buildPatternEditor(containerId, value, beatsPerBar, clickHandlerName) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.style.gridTemplateColumns = `repeat(${beatsPerBar}, minmax(0, 1fr))`;
      const normalized = normalizePatternText(value, beatsPerBar);
      container.innerHTML = Array.from({ length: beatsPerBar }, (_, beatIdx) => {
        const leftIdx = beatIdx * 2;
        const rightIdx = leftIdx + 1;
        const buildCell = (char, idx) => {
          const symbol = char === 'D' ? 'â†“' : (char === 'U' ? 'â†‘' : (char === 'X' ? 'x' : 'Â·'));
          return `
            <button type="button" onclick="${clickHandlerName}(${idx})" class="pattern-cell ${char !== '.' ? 'active' : ''}">
              <div class="pattern-action ${char === '.' ? 'rest opacity-40' : ''}">${symbol}</div>
              <div class="pattern-count">${getPatternCountLabel(idx)}</div>
            </button>
          `;
        };
        return `
          <div class="pattern-group">
            ${buildCell(normalized[leftIdx], leftIdx)}
            ${buildCell(normalized[rightIdx], rightIdx)}
            <div class="pattern-pair-bracket"><span></span></div>
          </div>
        `;
      }).join('');
    }

    function renderPatternVisualizer(containerId, pattern, beatsPerBar, activeIndex = -1, validationStates = []) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const normalized = normalizePatternText(pattern.map(s => s.raw || '.').join(''), beatsPerBar);
      container.innerHTML = `
        <div class="pattern-editor-grid" style="grid-template-columns: repeat(${beatsPerBar}, minmax(0, 1fr));">
          ${Array.from({ length: beatsPerBar }, (_, beatIdx) => {
            const leftIdx = beatIdx * 2;
            const rightIdx = leftIdx + 1;
            const buildCell = (char, idx) => {
              const symbol = char === 'D' ? 'â†“' : (char === 'U' ? 'â†‘' : (char === 'X' ? 'x' : 'Â·'));
              const validationClass = validationStates[idx] === 'success' ? 'success' : (validationStates[idx] === 'fail' ? 'fail' : '');
              return `<div class="pattern-cell ${idx === activeIndex ? 'active' : ''} ${validationClass}">
                <div class="pattern-action ${char === '.' ? 'rest' : ''}">${symbol}</div>
                <div class="pattern-count">${getPatternCountLabel(idx)}</div>
              </div>`;
            };
            return `
              <div class="pattern-group">
                ${buildCell(normalized[leftIdx], leftIdx)}
                ${buildCell(normalized[rightIdx], rightIdx)}
                <div class="pattern-pair-bracket"><span></span></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function getChordDiagramData(chordName) {
      const normalized = String(chordName || '').trim();
      if (CHORD_LIBRARY[normalized]) return CHORD_LIBRARY[normalized];
      const fallback = normalized.replace(/maj7|maj|7|sus4|sus2|sus|add\d+|dim|aug/g, '');
      return CHORD_LIBRARY[fallback] || null;
    }

    function renderChordDiagramSvg(chordName, large = false) {
      const data = getChordDiagramData(chordName);
      if (!data) {
        return `<div class="chord-diagram-card ${large ? 'large' : ''} flex items-center justify-center min-h-[120px]"><div class="text-center"><p class="text-xl font-bold text-primary">${chordName}</p><p class="text-[10px] text-gray-500 mt-2">Diagram soon</p></div></div>`;
      }

      const stringXs = [18, 34, 50, 66, 82, 98];
      const fretYs = [37, 56, 75, 94, 113];
      const markers = data.strings.map((fret, idx) => {
        const x = stringXs[idx];
        if (fret === 'x') return `<text x="${x}" y="18" text-anchor="middle" fill="#8b8b8b" font-size="12">x</text>`;
        if (fret === 0) return `<text x="${x}" y="18" text-anchor="middle" fill="#8b8b8b" font-size="12">o</text>`;
        const localFret = Math.max(1, fret - data.baseFret + 1);
        const y = fretYs[Math.min(localFret - 1, fretYs.length - 1)];
        return `<circle cx="${x}" cy="${y}" r="7" fill="#bb86fc"/><text x="${x}" y="${y + 3}" text-anchor="middle" fill="#111" font-size="8" font-weight="700">${data.fingers?.[idx] || ''}</text>`;
      }).join('');

      const baseFretLabel = data.baseFret > 1 ? `<text x="8" y="40" fill="#8b8b8b" font-size="11">${data.baseFret}fr</text>` : '';
      return `
        <div class="chord-diagram-card ${large ? 'large' : ''}">
          <p class="text-center text-primary font-bold ${large ? 'text-3xl mb-3' : 'text-sm mb-2'}">${chordName}</p>
          <svg viewBox="0 0 120 150" class="chord-diagram-svg">
            <use href="#chord-diagram-template"></use>
            ${baseFretLabel}
            ${markers}
          </svg>
        </div>
      `;
    }

    function renderChordLibrary(containerId, chords, largeCurrentChord = null) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (largeCurrentChord) {
        container.innerHTML = renderChordDiagramSvg(largeCurrentChord, true);
        return;
      }
      container.innerHTML = `<div class="chord-library-grid">${chords.map(chord => renderChordDiagramSvg(chord)).join('')}</div>`;
    }

    function renderPracticeCurrentLine(lineData, activeChordGlobalIdx = null) {
      const container = document.getElementById('practice-current-line');
      if (!container) return;
      if (!lineData) {
        container.innerHTML = `<p class="text-sm text-gray-500 text-center">Waiting for first chord...</p>`;
        return;
      }
      const currentIndex = currentSong?.parsedLines?.findIndex(line => line === lineData) ?? -1;
      const previousLine = currentIndex > 0 ? currentSong.parsedLines[currentIndex - 1] : null;
      const nextLine = currentIndex >= 0 && currentIndex < currentSong.parsedLines.length - 1 ? currentSong.parsedLines[currentIndex + 1] : null;

      const renderLine = (entry, state) => {
        if (!entry || (!entry.chordHtml && !entry.lyricLine)) {
          return `<div class="practice-line-preview ${state} min-h-[54px]"></div>`;
        }
        if (entry.type === 'tag') {
          return `
            <div class="practice-line-preview ${state}">
              <div class="text-primary/80 uppercase tracking-[0.25em] text-[10px] sm:text-xs">${entry.lyricLine}</div>
            </div>
          `;
        }
        let chordHtml = entry.chordHtml || '';
        if (state === 'current' && activeChordGlobalIdx !== null) {
          chordHtml = chordHtml.replace(`id="chord-hl-${activeChordGlobalIdx}"`, `id="chord-hl-${activeChordGlobalIdx}" class="text-active drop-shadow-[0_0_8px_rgba(3,218,198,0.8)] inline-block"`);
        }
        return `
          <div class="practice-line-preview ${state}">
            ${chordHtml ? `<div class="text-primary font-bold whitespace-pre text-[11px] sm:text-[13px]">${chordHtml}</div>` : ''}
            ${entry.lyricLine ? `<div class="text-gray-200 whitespace-pre-wrap leading-snug mt-2 ${state === 'current' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}">${entry.lyricLine}</div>` : ''}
          </div>
        `;
      };

      container.innerHTML = `
        <div class="practice-line-stack">
          ${renderLine(previousLine, 'secondary')}
          ${renderLine(lineData, 'current')}
          ${renderLine(nextLine, 'secondary')}
        </div>
      `;
    }

    function getCapoOffset(capoLabel = "No capo") {
      const match = String(capoLabel || '').match(/(\d+)/);
      return match ? parseInt(match[1], 10) || 0 : 0;
    }

    function transposeNoteName(note, semitones = 0) {
      const idx = NOTE_INDEX[note];
      if (idx === undefined) return note;
      return NOTE_NAMES[(idx + semitones + 12) % 12];
    }

    function chordToFrequencies(chordName, capoOffset = 0) {
      const match = String(chordName || '').trim().match(/^([A-G][#b]?)(.*)$/);
      if (!match) return [];
      const baseRoot = transposeNoteName(match[1], capoOffset);
      const quality = (match[2] || '').toLowerCase();
      const rootIndex = NOTE_INDEX[baseRoot];
      if (rootIndex === undefined) return [];

      let intervals = [0, 4, 7];
      if (/dim/.test(quality)) intervals = [0, 3, 6];
      else if (/aug/.test(quality)) intervals = [0, 4, 8];
      else if (/sus2/.test(quality)) intervals = [0, 2, 7];
      else if (/sus4|sus/.test(quality)) intervals = [0, 5, 7];
      else if (/m(?!aj)/.test(quality) || /min/.test(quality)) intervals = [0, 3, 7];

      if (/7/.test(quality) && !/maj7/.test(quality)) intervals.push(10);
      if (/maj7/.test(quality)) intervals.push(11);

      const midiBase = 48 + rootIndex;
      return intervals.map(interval => 440 * Math.pow(2, ((midiBase + interval) - 69) / 12));
    }

    async function ensureAudioReady() {
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }
      return audioCtx;
    }

    function stopActiveChordPreview(release = 0.05) {
      if (!audioCtx || !activeChordVoices.length) return;
      const now = audioCtx.currentTime;
      activeChordVoices.forEach(({ osc, gain }) => {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
          osc.stop(now + release + 0.02);
        } catch {}
      });
      activeChordVoices = [];
    }

    async function playChordPreview(chordName, direction = 'D') {
      const ctx = await ensureAudioReady();
      if (!ctx || !practiceChordAudioEnabled || !chordName) return;
      const freqs = chordToFrequencies(chordName, getCapoOffset(currentSong?.capo || 'No capo'));
      if (!freqs.length) return;
      const now = ctx.currentTime;
      const ordered = direction === 'U' ? [...freqs].reverse() : freqs;
      activeChordVoices = [];
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
        activeChordVoices.push({ osc, gain });
      });
    }

    function getActiveChordForBeat(beat) {
      if (!currentSong?.chords?.length) return null;
      let activeChord = null;
      for (let i = 0; i < currentSong.chords.length; i++) {
        if (beat >= currentSong.chords[i].time) activeChord = currentSong.chords[i];
        else break;
      }
      return activeChord;
    }

    function updatePracticeAudioButton() {
      const btn = document.getElementById('btn-practice-audio');
      if (!btn) return;
      btn.className = `w-9 h-9 rounded-lg border btn-press ${practiceChordAudioEnabled ? 'bg-primary/20 border-primary/40 text-primary' : 'btn-soft'}`;
      btn.innerHTML = `<i class="fas ${practiceChordAudioEnabled ? 'fa-volume-up' : 'fa-volume-mute'} text-sm"></i>`;
    }

    window.togglePracticeChordAudio = function() {
      practiceChordAudioEnabled = !practiceChordAudioEnabled;
      if (!practiceChordAudioEnabled) stopActiveChordPreview(0.03);
      updatePracticeAudioButton();
    };

    async function startPracticeDetection() {
      if (!(userSettings.enableStrumDetection || userSettings.enableChordDetection)) return;
      try {
        stopTuner();
        if (!audioCtx) await ensureAudioReady();
        practiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        practiceAnalyser = audioCtx.createAnalyser();
        practiceAnalyser.fftSize = 2048;
        practiceSource = audioCtx.createMediaStreamSource(practiceStream);
        practiceSource.connect(practiceAnalyser);
      } catch (e) {
        console.error(e);
        showToast("Microphone access is needed for practice detection.");
      }
    }

    function stopPracticeDetection() {
      if (practiceSource) {
        try { practiceSource.disconnect(); } catch {}
        practiceSource = null;
      }
      if (practiceStream) {
        practiceStream.getTracks().forEach(track => track.stop());
        practiceStream = null;
      }
      practiceAnalyser = null;
      practiceValidationStates = [];
      lastPracticeTransientTime = 0;
      lastPracticeRms = 0;
      lastChordValidationState = null;
    }

    function chordToPitchClasses(chordName, capoOffset = 0) {
      const match = String(chordName || '').trim().match(/^([A-G][#b]?)(.*)$/);
      if (!match) return [];
      const baseRoot = transposeNoteName(match[1], capoOffset);
      const quality = (match[2] || '').toLowerCase();
      const rootIndex = NOTE_INDEX[baseRoot];
      if (rootIndex === undefined) return [];
      let intervals = [0, 4, 7];
      if (/dim/.test(quality)) intervals = [0, 3, 6];
      else if (/aug/.test(quality)) intervals = [0, 4, 8];
      else if (/sus2/.test(quality)) intervals = [0, 2, 7];
      else if (/sus4|sus/.test(quality)) intervals = [0, 5, 7];
      else if (/m(?!aj)/.test(quality) || /min/.test(quality)) intervals = [0, 3, 7];
      if (/7/.test(quality) && !/maj7/.test(quality)) intervals.push(10);
      if (/maj7/.test(quality)) intervals.push(11);
      return [...new Set(intervals.map(interval => (rootIndex + interval) % 12))];
    }

    function estimatePitchClassesFromMic() {
      if (!practiceAnalyser || !audioCtx) return [];
      const freqData = new Float32Array(practiceAnalyser.frequencyBinCount);
      practiceAnalyser.getFloatFrequencyData(freqData);
      const sampleRate = audioCtx.sampleRate;
      const binWidth = sampleRate / practiceAnalyser.fftSize;
      const peaks = [];
      for (let i = 5; i < freqData.length; i++) {
        const db = freqData[i];
        const freq = i * binWidth;
        if (db < -78 || freq < 70 || freq > 1200) continue;
        peaks.push({ db, freq });
      }
      peaks.sort((a, b) => b.db - a.db);
      return [...new Set(peaks.slice(0, 8).map(p => Math.round(69 + 12 * Math.log2(p.freq / 440)) % 12).map(v => (v + 12) % 12))];
    }

    function validateChordLoosely(chordName) {
      const expected = chordToPitchClasses(chordName, getCapoOffset(currentSong?.capo || 'No capo'));
      const heard = estimatePitchClassesFromMic();
      if (!expected.length || !heard.length) return null;
      const matches = expected.filter(pc => heard.includes(pc)).length;
      return matches >= Math.max(2, Math.ceil(expected.length / 2));
    }

    function updateActiveChordValidationClass(result) {
      const active = document.querySelector('.text-active');
      if (!active) return;
      active.classList.remove('validation-soft-green', 'validation-soft-red');
      if (result === true) active.classList.add('validation-soft-green');
      if (result === false) active.classList.add('validation-soft-red');
    }

    function detectPracticeTransient() {
      if (!practiceAnalyser || !audioCtx) return false;
      const buffer = new Float32Array(1024);
      practiceAnalyser.getFloatTimeDomainData(buffer);
      let rms = 0;
      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = Math.abs(buffer[i]);
        rms += buffer[i] * buffer[i];
        if (v > peak) peak = v;
      }
      rms = Math.sqrt(rms / buffer.length);
      const now = audioCtx.currentTime;
      const isTransient = peak > 0.22 && rms > 0.035 && (rms - lastPracticeRms) > 0.012 && (now - lastPracticeTransientTime) > 0.12;
      lastPracticeRms = rms;
      if (isTransient) {
        lastPracticeTransientTime = now;
        return true;
      }
      return false;
    }

    function updatePracticeValidation(beat, activeChord) {
      if (!(userSettings.enableStrumDetection || userSettings.enableChordDetection)) return;
      const tolerance = 0.22;
      activeStrumPattern.forEach((slot, idx) => {
        if (slot.raw === '.' || practiceValidationStates[idx]) return;
        if (beat > slot.time + tolerance) practiceValidationStates[idx] = 'fail';
      });

      if (!detectPracticeTransient()) return;

      let matchIndex = -1;
      let bestDistance = Infinity;
      activeStrumPattern.forEach((slot, idx) => {
        if (slot.raw === '.' || practiceValidationStates[idx] === 'success') return;
        const dist = Math.abs(beat - slot.time);
        if (dist <= tolerance && dist < bestDistance) {
          bestDistance = dist;
          matchIndex = idx;
        }
      });

      if (matchIndex >= 0 && userSettings.enableStrumDetection) {
        practiceValidationStates[matchIndex] = 'success';
      }

      if (matchIndex >= 0 && userSettings.enableChordDetection && activeChord && activeStrumPattern[matchIndex]?.raw !== 'X' && currentStepMode !== 2) {
        lastChordValidationState = validateChordLoosely(activeChord.chord);
      }
    }

    window.openAddSong = function() {
      editingSongId = null;
      document.getElementById('add-view-title').innerText = "New Song";
      document.getElementById('btn-save-song').innerHTML = '<i class="fas fa-save mr-2"></i> Save to Library';
      
      document.getElementById('add-title').value = '';
      document.getElementById('add-artist').value = '';
      document.getElementById('add-bpm').value = '';
      document.getElementById('add-time-sig').value = '4/4';
      document.getElementById('add-capo').value = 'No capo';
      document.getElementById('add-chords-text').value = '';
      document.getElementById('add-strum-text').value = normalizePatternText('', 4);
      syncAddPatternEditor();
      
      navigate('add-song');
    };

    window.editCurrentSong = function() {
      if (!currentSong) return;
      editingSongId = currentSong.id;
      
      document.getElementById('add-view-title').innerText = "Edit Song";
      document.getElementById('btn-save-song').innerHTML = '<i class="fas fa-save mr-2"></i> Update Song';
      
      document.getElementById('add-title').value = currentSong.title;
      document.getElementById('add-artist').value = currentSong.artist;
      document.getElementById('add-bpm').value = currentSong.bpm;
      document.getElementById('add-time-sig').value = currentSong.timeSignature || '4/4';
      document.getElementById('add-capo').value = currentSong.capo || 'No capo';
      document.getElementById('add-chords-text').value = currentSong.rawText;
      
      const strumText = currentSong.strumming.map(s => s.raw).join('');
      document.getElementById('add-strum-text').value = normalizePatternText(strumText, getBeatsPerBarFromSignature(currentSong.timeSignature || '4/4'));
      syncAddPatternEditor();
      
      navigate('add-song');
    };

    window.closeAddEdit = function() {
      if (editingSongId) {
        navigate('details');
      } else {
        navigate('home');
      }
    };

    window.saveSong = async function() {
      if (!user) return navigate('auth');
      if (user.isAnonymous) return showToast("Please create an account to edit songs.");

      try {
        const title = document.getElementById('add-title').value || "Untitled";
        const artist = document.getElementById('add-artist').value || "Unknown Artist";
        const bpm = parseInt(document.getElementById('add-bpm').value) || 80;
        const timeSignature = document.getElementById('add-time-sig').value || "4/4";
        const capo = document.getElementById('add-capo').value || "No capo";
        const rawText = document.getElementById('add-chords-text').value || "C\nEmpty";
        
        const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
        const strumText = normalizePatternText(document.getElementById('add-strum-text').value || "", beatsPerBar);
        const strumming = parseStrumPattern(strumText, timeSignature);

        const newSongData = {
          title, artist, bpm, timeSignature, capo, rawText, strumming,
          postedBy: user.email.split('@')[0],
          ownerId: user.uid
        };

        showLoading(true, "Syncing with Cloud...");
        
        await repository.saveSong(newSongData, editingSongId);
        showToast(editingSongId ? "Song updated successfully!" : "Song added successfully!", true);
        
        await loadSongs();
        
        if (editingSongId) {
            openSongDetails(editingSongId);
        } else {
            navigate('home');
        }
        
      } catch (e) {
        console.error("Error saving song:", e);
        showToast("Save failed. Ensure you have network and permissions.");
      } finally {
        showLoading(false);
      }
    };

    window.navigate = function(id) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${id}`).classList.add('active');
      if (TAB_VIEWS.has(id)) activeTab = id;
      updateTabBar();
      if (id === 'tools') showToolsHome();
      if (id === 'training') showTrainingHome();
      if (id !== 'tuner') stopTuner();
      if (id !== 'tools') {
        stopStandaloneMetronome();
        if (toolRecorder && toolRecorder.state === 'recording') toolRecorder.stop();
        else stopToolRecordingStream();
        updateToolRecordingUI(false);
      }
      if (id !== 'training') stopTrainingPlayback();
    };

    async function loadUserSettings() {
      if (!user || user.isAnonymous) {
        applyUserSettings(DEFAULT_SETTINGS);
        return;
      }
      try {
        userSettings = await repository.loadUserSettings(user.uid, DEFAULT_SETTINGS);
      } catch (e) {
        console.error("Could not load settings", e);
        userSettings = { ...DEFAULT_SETTINGS };
      }
      applyUserSettings(userSettings);
    }

    function applyUserSettings(settings) {
      userSettings = { ...DEFAULT_SETTINGS, ...settings };
      const size = userSettings.practiceTextSize || DEFAULT_SETTINGS.practiceTextSize;
      document.documentElement.style.setProperty('--practice-text-size', `${size}px`);
      document.documentElement.style.setProperty('--practice-chord-size', `${Math.max(10, Math.round(size * 0.78))}px`);
      const settingsSlider = document.getElementById('settings-text-size');
      const modalSlider = document.getElementById('modal-text-size');
      const settingsLabel = document.getElementById('settings-text-size-label');
      const modalLabel = document.getElementById('modal-text-size-label');
      if (settingsSlider) settingsSlider.value = size;
      if (modalSlider) modalSlider.value = size;
      if (settingsLabel) settingsLabel.innerText = `${size} px`;
      if (modalLabel) modalLabel.innerText = `${size} px`;
      const strumToggle = document.getElementById('settings-strum-detection');
      const chordToggle = document.getElementById('settings-chord-detection');
      if (strumToggle) strumToggle.checked = !!userSettings.enableStrumDetection;
      if (chordToggle) chordToggle.checked = !!userSettings.enableChordDetection;
    }

    window.previewTextSize = function(value, fromModal = false) {
      const size = parseInt(value, 10) || DEFAULT_SETTINGS.practiceTextSize;
      document.documentElement.style.setProperty('--practice-text-size', `${size}px`);
      document.documentElement.style.setProperty('--practice-chord-size', `${Math.max(10, Math.round(size * 0.78))}px`);
      document.getElementById('settings-text-size-label').innerText = `${size} px`;
      document.getElementById('modal-text-size-label').innerText = `${size} px`;
      document.getElementById('settings-text-size').value = size;
      document.getElementById('modal-text-size').value = size;
    };

    window.openTextSettingsModal = function() {
      const modal = document.getElementById('text-settings-modal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      previewTextSize(userSettings.practiceTextSize || DEFAULT_SETTINGS.practiceTextSize, true);
    };

    window.closeTextSettingsModal = function() {
      const modal = document.getElementById('text-settings-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      applyUserSettings(userSettings);
    };

    window.saveSettings = async function(source = 'page') {
      const sliderId = source === 'modal' ? 'modal-text-size' : 'settings-text-size';
      const size = parseInt(document.getElementById(sliderId).value, 10) || DEFAULT_SETTINGS.practiceTextSize;
      const nextSettings = {
        ...userSettings,
        practiceTextSize: size,
        enableStrumDetection: !!document.getElementById('settings-strum-detection')?.checked,
        enableChordDetection: !!document.getElementById('settings-chord-detection')?.checked
      };
      applyUserSettings(nextSettings);
      if (!user || user.isAnonymous) {
        showToast("Create an account to save settings to Firebase.");
        if (source === 'modal') closeTextSettingsModal();
        return;
      }
      try {
        await repository.saveUserSettings(user.uid, nextSettings);
        userSettings = nextSettings;
        showToast("Settings saved.", true);
        if (source === 'modal') closeTextSettingsModal();
      } catch (e) {
        console.error("Settings save failed", e);
        showToast("Could not save settings.");
      }
    };

    async function persistUserSettingsPartial(patch) {
      userSettings = { ...userSettings, ...patch };
      if (!user || user.isAnonymous) return;
      try {
        await repository.saveUserSettings(user.uid, userSettings);
      } catch (e) {
        console.error('Could not persist settings patch', e);
      }
    }

    async function rememberRecentPractice(songId, progress = null) {
      const current = Array.isArray(userSettings.recentPractice) ? [...userSettings.recentPractice] : [];
      const next = [{ songId, progress: progress || userProgress }, ...current.filter(entry => entry.songId !== songId)].slice(0, 8);
      await persistUserSettingsPartial({ recentPractice: next });
      renderHomeDashboard();
    }

    window.toggleFavoriteSong = async function() {
      if (!currentSong) return;
      const favorites = new Set(userSettings.favoriteSongIds || []);
      if (favorites.has(currentSong.id)) favorites.delete(currentSong.id);
      else favorites.add(currentSong.id);
      await persistUserSettingsPartial({ favoriteSongIds: Array.from(favorites) });
      updateFavoriteButton();
      renderHomeDashboard();
    };

    function updateFavoriteButton() {
      const btn = document.getElementById('btn-favorite-song');
      if (!btn || !currentSong) return;
      const isFavorite = (userSettings.favoriteSongIds || []).includes(currentSong.id);
      btn.classList.remove('favorite-btn', 'idle', 'active', 'bg-primary/10', 'border-primary', 'text-primary');
      btn.classList.add('favorite-btn', isFavorite ? 'active' : 'idle');
      btn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      btn.title = isFavorite ? 'Remove Favorite' : 'Add To Favorites';
      btn.innerHTML = `<i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>`;
    }

    window.saveSettingsFromModal = function() {
      return saveSettings('modal');
    };

    function syncAddPatternEditor() {
      const timeSignature = document.getElementById('add-time-sig')?.value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const hiddenInput = document.getElementById('add-strum-text');
      hiddenInput.value = normalizePatternText(hiddenInput.value, beatsPerBar);
      UI.buildPatternEditor('add-strum-editor', hiddenInput.value, beatsPerBar, 'cycleAddPatternBeat');
    }

    window.cycleAddPatternBeat = function(index) {
      const timeSignature = document.getElementById('add-time-sig').value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const chars = normalizePatternText(document.getElementById('add-strum-text').value, beatsPerBar).split('');
      const next = chars[index] === 'D' ? 'U' : (chars[index] === 'U' ? 'X' : (chars[index] === 'X' ? '.' : 'D'));
      chars[index] = next;
      document.getElementById('add-strum-text').value = chars.join('');
      syncAddPatternEditor();
    };

    window.updateTrainingPatternEditor = function() {
      const timeSignature = document.getElementById('training-time-sig')?.value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const holder = document.getElementById('training-pattern-editor');
      const current = holder.dataset.pattern || '';
      const normalized = normalizePatternText(current, beatsPerBar);
      holder.dataset.pattern = normalized;
      UI.buildPatternEditor('training-pattern-editor', normalized, beatsPerBar, 'cycleTrainingPatternBeat');
      renderTrainingPatternPreview();
    };

    window.cycleTrainingPatternBeat = function(index) {
      const timeSignature = document.getElementById('training-time-sig').value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const holder = document.getElementById('training-pattern-editor');
      const chars = normalizePatternText(holder.dataset.pattern || '', beatsPerBar).split('');
      chars[index] = chars[index] === 'D' ? 'U' : (chars[index] === 'U' ? 'X' : (chars[index] === 'X' ? '.' : 'D'));
      holder.dataset.pattern = chars.join('');
      updateTrainingPatternEditor();
    };

    function renderTrainingPatternPreview(activeIndex = -1) {
      const timeSignature = document.getElementById('training-time-sig')?.value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const bpm = parseInt(document.getElementById('training-bpm')?.value || '126', 10);
      const holder = document.getElementById('training-pattern-editor');
      const pattern = parseStrumPattern(holder.dataset.pattern || '', timeSignature);
      document.getElementById('training-title').innerText = `Chorus ${bpm} bpm`;
      UI.renderPatternVisualizer('training-pattern-viz', pattern, beatsPerBar, activeIndex);
    }

    function stopTrainingPlayback() {
      clearInterval(trainingTimer);
      trainingTimer = null;
      document.getElementById('training-status').innerText = 'Idle';
      document.getElementById('btn-training-toggle').innerHTML = `<i class="fas fa-play mr-2"></i> Start Training`;
      document.getElementById('btn-training-toggle').classList.replace('bg-danger', 'bg-primary');
        document.getElementById('btn-training-toggle').classList.add('text-white');
      renderTrainingPatternPreview();
    }

    function startTrainingPlayback() {
      const timeSignature = document.getElementById('training-time-sig').value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const totalSlots = getPatternSlotCount(beatsPerBar);
      const bpm = Math.max(40, Math.min(240, parseInt(document.getElementById('training-bpm').value || '126', 10)));
      trainingBeatIndex = 0;
      document.getElementById('training-status').innerText = 'Playing';
      document.getElementById('btn-training-toggle').innerHTML = `<i class="fas fa-stop mr-2"></i> Stop Training`;
      document.getElementById('btn-training-toggle').classList.replace('bg-primary', 'bg-danger');
        document.getElementById('btn-training-toggle').classList.add('text-white');
      clickStandaloneMetronome(true);
      renderTrainingPatternPreview(trainingBeatIndex);
      trainingTimer = setInterval(() => {
        trainingBeatIndex = (trainingBeatIndex + 1) % totalSlots;
        if (trainingBeatIndex % 2 === 0) clickStandaloneMetronome(trainingBeatIndex === 0);
        renderTrainingPatternPreview(trainingBeatIndex);
      }, (60 / bpm) * 500);
    }

    window.toggleTrainingPlayback = function() {
      if (trainingTimer) stopTrainingPlayback();
      else startTrainingPlayback();
    };

    function renderHomeList() {
      renderHomeDashboard();
    }

    function getSongRatingAverage(song) {
      return song?.ratingSummary?.average || 0;
    }

    function renderStars(value = 0) {
      const rounded = Math.round(value);
      return `<div class="flex items-center gap-1 text-[11px]">${Array.from({ length: 5 }, (_, index) => `<i class="fas fa-star ${index < rounded ? 'text-primary' : 'text-gray-700'}"></i>`).join('')}</div>`;
    }

    function buildSongDashboardCard(song, options = {}) {
      const stepProgress = userProgress && currentSong?.id === song.id ? userProgress : null;
      const progress = options.progress || stepProgress || { step1: { p: 0 }, step2: { p: 0 }, step3: { p: 0 } };
      const p1 = Math.min(100, progress.step1?.p || 0);
      const p2 = Math.min(100, progress.step2?.p || 0);
      const p3 = Math.min(100, progress.step3?.p || 0);
      const global = Math.round((p1 + p2 + p3) / 3);
      return `
        <button onclick="openSongDetails('${song.id}')" class="w-full text-left btn-soft rounded-2xl px-4 py-4 btn-press">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-bold text-white">${song.title}</div>
              <div class="text-xs text-gray-400 mt-1">${song.artist || 'Unknown artist'}</div>
              <div class="mt-2">${renderStars(getSongRatingAverage(song))}</div>
            </div>
            <span class="text-xs text-gray-300 font-semibold">${global}%</span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-3">
            <div class="h-2.5 rounded-full bg-black/60 overflow-hidden border" style="border-color:rgba(187,134,252,0.35)"><div class="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(187,134,252,0.55)]" style="width:${p1}%"></div></div>
            <div class="h-2.5 rounded-full bg-black/60 overflow-hidden border" style="border-color:rgba(3,218,198,0.35)"><div class="h-full rounded-full bg-active shadow-[0_0_12px_rgba(3,218,198,0.6)]" style="width:${p2}%"></div></div>
            <div class="h-2.5 rounded-full bg-black/60 overflow-hidden border" style="border-color:rgba(207,102,121,0.35)"><div class="h-full rounded-full bg-danger shadow-[0_0_12px_rgba(207,102,121,0.55)]" style="width:${p3}%"></div></div>
          </div>
        </button>
      `;
    }

    function renderHomeDashboard() {
      const search = (document.getElementById('home-song-search')?.value || '').trim().toLowerCase();
      const favorites = songs.filter(song => (userSettings.favoriteSongIds || []).includes(song.id));
      const recentEntries = userSettings.recentPractice || [];
      const recentSongs = recentEntries
        .map(entry => ({ song: songs.find(song => song.id === entry.songId), progress: entry.progress }))
        .filter(entry => entry.song);
      const filteredSongs = songs.filter(song => !search || song.title?.toLowerCase().includes(search) || song.artist?.toLowerCase().includes(search));

      const favoritesContainer = document.getElementById('home-favorites-list');
      const recentContainer = document.getElementById('home-recent-practice-list');
      const allContainer = document.getElementById('home-all-songs-list');
      if (favoritesContainer) favoritesContainer.innerHTML = favorites.length ? favorites.map(song => buildSongDashboardCard(song)).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No favorite songs yet.</div>`;
      if (recentContainer) recentContainer.innerHTML = recentSongs.length ? recentSongs.map(({ song, progress }) => buildSongDashboardCard(song, { progress })).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No started practice songs yet.</div>`;
      if (allContainer) allContainer.innerHTML = filteredSongs.length ? filteredSongs.map(song => buildSongDashboardCard(song)).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No songs found.</div>`;

      const practiceShortcuts = document.getElementById('training-practice-shortcuts');
      if (practiceShortcuts) practiceShortcuts.innerHTML = recentSongs.length ? recentSongs.slice(0, 4).map(({ song, progress }) => buildSongDashboardCard(song, { progress })).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">Start from a song on Home to see it here.</div>`;
    }

    function renderToolSongsSearch(query = '') {
      const container = document.getElementById('tool-songs-results');
      if (!container) return;
      const q = (query || '').trim().toLowerCase();
      const filtered = songs.filter(song => !q || song.title?.toLowerCase().includes(q) || song.artist?.toLowerCase().includes(q));
      if (!filtered.length) {
        container.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No songs found.</div>`;
        return;
      }
      container.innerHTML = filtered.map(song => `
        <button onclick="openSongDetails('${song.id}')" class="w-full text-left btn-soft rounded-xl px-4 py-4 btn-press">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-bold text-white">${song.title}</div>
              <div class="text-xs text-gray-400 mt-1">${song.artist || 'Unknown artist'}</div>
              <div class="mt-2">${renderStars(getSongRatingAverage(song))}</div>
            </div>
            <i class="fas fa-chevron-right text-primary"></i>
          </div>
        </button>
      `).join('');
    }

    window.renderToolSongsSearch = renderToolSongsSearch;

    function renderSongComments() {
      const list = document.getElementById('detail-comments-list');
      const count = document.getElementById('detail-comments-count');
      if (count) count.innerText = String(currentSongComments.length);
      if (!list) return;
      if (!currentSongComments.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No comments yet.</div>`;
        return;
      }
      list.innerHTML = currentSongComments.map(comment => `
        <div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <p class="font-semibold text-white">${comment.authorName || 'Anonymous'}</p>
            <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500">${comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}</p>
          </div>
          <p class="text-sm text-gray-300 mt-2 whitespace-pre-wrap">${comment.text || ''}</p>
        </div>
      `).join('');
    }

    function renderSongRatingSummary() {
      const summary = document.getElementById('detail-rating-summary');
      if (!summary) return;
      if (!currentSongRatings.length) {
        summary.innerText = 'No ratings';
        return;
      }
      const avg = currentSongRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / currentSongRatings.length;
      summary.innerText = `${avg.toFixed(1)} / 5 (${currentSongRatings.length})`;
    }

    async function loadSongSocialData() {
      if (!currentSong) return;
      try {
        currentSongComments = await repository.loadSongComments(currentSong.id);
      } catch (e) {
        console.error('Comments load failed', e);
        currentSongComments = [];
      }
      try {
        currentSongRatings = await repository.loadSongRatings(currentSong.id);
      } catch (e) {
        console.error('Ratings load failed', e);
        currentSongRatings = [];
      }
      renderSongComments();
      renderSongRatingSummary();
    }

    async function bumpSongStat(field) {
      if (!currentSong?.id) return;
      const nextStats = {
        ...(currentSong.stats || { views: 0, started: 0, completed: 0 }),
        [field]: ((currentSong.stats?.[field]) || 0) + 1
      };
      currentSong.stats = nextStats;
      await repository.updateSongMeta(currentSong.id, { stats: nextStats });
    }

    window.openSongDetails = async function(id) {
      currentSong = songs.find(s => s.id === id);
      renderToolSongsSearch(document.getElementById('tool-song-search')?.value || '');
      document.getElementById('detail-title').innerText = currentSong.title;
      document.getElementById('detail-artist').innerText = currentSong.artist;
      document.getElementById('detail-posted').innerText = currentSong.postedBy || "Anonymous";
      document.getElementById('detail-bpm').innerText = currentSong.bpm;
      document.getElementById('detail-time-sig').innerText = `(${currentSong.timeSignature || '4/4'})`;
      document.getElementById('detail-capo').innerText = '• ' + (currentSong.capo || 'No capo');
      document.getElementById('detail-stat-views').innerText = String(currentSong.stats?.views || 0);
      document.getElementById('detail-stat-started').innerText = String(currentSong.stats?.started || 0);
      document.getElementById('detail-stat-completed').innerText = String(currentSong.stats?.completed || 0);
      document.getElementById('detail-created-at').innerText = currentSong.createdAt ? new Date(currentSong.createdAt).toLocaleDateString() : '-';
      
      const btnEdit = document.getElementById('btn-edit-song');
      if (user && user.uid === currentSong.ownerId) {
          btnEdit.classList.remove('hidden');
      } else {
          btnEdit.classList.add('hidden');
      }
      
      UI.renderPatternVisualizer('detail-strum-viz', currentSong.strumming, getBeatsPerBarFromSignature(currentSong.timeSignature || '4/4'));
      
      const unique = [...new Set(currentSong.chords.map(c => c.chord))];
      UI.renderChordLibrary('detail-chords', unique);
      updateFavoriteButton();

      await loadProgress();
      await loadSongSocialData();
      try {
        await bumpSongStat('views');
        document.getElementById('detail-stat-views').innerText = String(currentSong.stats?.views || 0);
      } catch (e) {
        console.error("Could not update views", e);
      }
      renderSteps();
      navigate('details');
    };

    async function loadProgress() {
      if (!user) return;
      try {
        userProgress = await repository.loadProgress(user.uid, currentSong.id);
      } catch(e) {
        console.error("Could not load progress", e);
        userProgress = { step1: {p:0}, step2: {p:0}, step3: {p:0} };
      }
    }

    function renderSteps() {
      UI.renderPracticeSteps('practice-steps-container', userProgress);
    }

    window.submitSongComment = async function() {
      if (!user || user.isAnonymous || !currentSong) {
        showToast("Create an account to comment.");
        return;
      }
      const input = document.getElementById('detail-comment-input');
      const text = input?.value?.trim();
      if (!text) return;
      try {
        await repository.addSongComment(currentSong.id, {
          authorId: user.uid,
          authorName: user.email ? user.email.split('@')[0] : 'Guest',
          text,
          createdAt: Date.now()
        });
        input.value = '';
        await loadSongSocialData();
        showToast("Comment added.", true);
      } catch (e) {
        console.error("Comment save failed", e);
        showToast("Could not save comment.");
      }
    };

    function renderRatingStars(selected = 0) {
      const stars = document.getElementById('rating-stars');
      if (!stars) return;
      stars.innerHTML = Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const active = value <= selected;
        return `<button onclick="setSongRating(${value})" class="btn-press text-3xl ${active ? 'text-primary' : 'text-gray-600'}"><i class="fas fa-star"></i></button>`;
      }).join('');
    }

    window.setSongRating = function(value) {
      pendingSongRating = value;
      renderRatingStars(pendingSongRating);
    };

    window.closeRatingModal = function() {
      document.getElementById('rating-modal')?.classList.add('hidden');
      document.getElementById('rating-modal')?.classList.remove('flex');
    };

    function openRatingModal() {
      pendingSongRating = 0;
      renderRatingStars(0);
      const modal = document.getElementById('rating-modal');
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
    }

    window.submitSongRating = async function() {
      if (!user || user.isAnonymous || !currentSong || pendingSongRating < 1) {
        closeRatingModal();
        return;
      }
      try {
        await repository.upsertSongRating(currentSong.id, user.uid, {
          rating: pendingSongRating,
          authorId: user.uid,
          updatedAt: Date.now()
        });
        await loadSongSocialData();
        const average = currentSongRatings.length ? currentSongRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / currentSongRatings.length : pendingSongRating;
        currentSong.ratingSummary = { average, count: currentSongRatings.length };
        const songIndex = songs.findIndex(song => song.id === currentSong.id);
        if (songIndex >= 0) songs[songIndex].ratingSummary = currentSong.ratingSummary;
        await repository.updateSongMeta(currentSong.id, { ratingSummary: currentSong.ratingSummary });
        renderHomeDashboard();
        renderToolSongsSearch(document.getElementById('tool-song-search')?.value || '');
        showToast("Rating saved.", true);
      } catch (e) {
        console.error("Rating save failed", e);
        showToast("Could not save rating.");
      }
      closeRatingModal();
    };

    window.startPractice = function(step) {
      currentStepMode = step;
      currentBpm = currentSong.bpm;
      document.getElementById('practice-bpm').value = currentBpm;
      document.getElementById('practice-title').innerText = currentSong.title;
      document.getElementById('practice-step-label').innerText = `Step ${step}`;
      document.getElementById('practice-progress-bar').style.width = `0%`;
      lastPlayedStrumIndex = -1;
      practiceValidationStates = [];
      lastChordValidationState = null;
      updatePracticeAudioButton();
      
      const timeline = document.getElementById('practice-timeline');
      const focus = document.getElementById('step2-focus');
      const rhythmViz = document.getElementById('practice-rhythm-viz');
      const chordPanel = document.getElementById('practice-current-chord-panel');
      const beatsPerBar = parseInt((currentSong.timeSignature || "4/4").split('/')[0]) || 4;
      
      timeline.innerHTML = '';
      rhythmViz.innerHTML = '';

      if (step === 0) {
        document.getElementById('practice-step-label').innerText = `Preview`;
        timeline.classList.remove('hidden');
        focus.classList.add('hidden');
        chordPanel.classList.add('hidden');
        timeline.innerHTML = `
          <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
            <div class="bg-surface rounded-2xl p-5 border border-gray-800">
              <div class="grid sm:grid-cols-4 gap-3 text-sm">
                <div><div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Artist</div><div class="text-white font-semibold">${currentSong.artist || '-'}</div></div>
                <div><div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Tempo</div><div class="text-white font-semibold">${currentSong.bpm} BPM</div></div>
                <div><div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Time</div><div class="text-white font-semibold">${currentSong.timeSignature || '4/4'}</div></div>
                <div><div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Capo</div><div class="text-white font-semibold">${currentSong.capo || 'No capo'}</div></div>
              </div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-gray-800">
              <div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Pattern</div>
              <div id="practice-preview-pattern"></div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-gray-800">
              <div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Lyrics And Chords</div>
              <div class="timeline-content flex flex-col">` + currentSong.parsedLines.map((lineData, i) => `
                <div id="block-${i}" class="timeline-block ${lineData.chordHtml === '' && lineData.lyricLine === '' ? 'compact-gap' : 'tight-stack'} px-1 sm:px-3 py-0 border-l-4 border-transparent font-mono">
                  ${lineData.chordHtml || lineData.lyricLine ? `<div class="timeline-pair">${lineData.chordHtml ? `<div class="timeline-line chords text-primary font-bold" style="font-size:var(--practice-chord-size, 11px)">${lineData.chordHtml}</div>` : ''}${lineData.lyricLine ? `<div class="timeline-line ${lineData.type === 'tag' ? 'text-primary/80 uppercase tracking-[0.25em] text-[10px] sm:text-xs' : 'lyrics text-gray-300'}" style="${lineData.type === 'tag' ? '' : 'font-size:var(--practice-text-size, 14px)'}">${lineData.lyricLine}</div>` : ''}</div>` : ''}
                </div>
              `).join('') + `</div>
            </div>
          </div>`;
        const normalizedPreview = currentSong.strumming.map(s => ({ ...s, raw: s.raw || '.' }));
        UI.renderPatternVisualizer('practice-rhythm-viz', normalizedPreview, beatsPerBar, -1, []);
        UI.renderPatternVisualizer('practice-preview-pattern', normalizedPreview, beatsPerBar, -1, []);
        const footerButton = document.getElementById('btn-play');
        footerButton.innerHTML = `<i class="fas fa-play mr-2"></i> Start Step 1`;
        footerButton.onclick = () => startPractice(1);
        navigate('practice');
        return;
      }

      const normalizedStrumming = currentSong.strumming.map(s => ({
        ...s, raw: s.raw || (s.type === 'â†“' ? 'D' : (s.type === 'â†‘' ? 'U' : '.'))
      }));


      if (user && !user.isAnonymous) {
        bumpSongStat('started').then(() => {
          const startedEl = document.getElementById('detail-stat-started');
          if (startedEl) startedEl.innerText = String(currentSong.stats?.started || 0);
        }).catch(err => console.error('Start stat failed', err));
      }
      rememberRecentPractice(currentSong.id, userProgress).catch(err => console.error('Recent practice update failed', err));

      if(step === 2) {
        timeline.classList.add('hidden');
        focus.classList.remove('hidden');
        chordPanel.classList.add('hidden');
        activeStrumPattern = normalizedStrumming;
      } else {
        timeline.classList.remove('hidden');
        focus.classList.add('hidden');
        if (step === 1 || step === 3) {
          chordPanel.classList.remove('hidden');
          timeline.classList.add('hidden');
          const firstChord = currentSong.chords?.[0]?.chord || 'C';
          UI.renderChordLibrary('practice-current-chord', [firstChord], firstChord);
          const firstLine = currentSong.parsedLines?.[currentSong.chords?.[0]?.lineIdx || 0] || null;
          UI.renderPracticeCurrentLine({ containerId: 'practice-current-line', lineData: firstLine, parsedLines: currentSong.parsedLines, activeChordGlobalIdx: currentSong.chords?.[0]?.globalIdx ?? null });
        } else {
          chordPanel.classList.add('hidden');
          timeline.classList.remove('hidden');
        }
        
        timeline.innerHTML = `<div class="timeline-content flex flex-col">` + currentSong.parsedLines.map((lineData, i) => {
          const isEmpty = lineData.chordHtml === '' && lineData.lyricLine === '';
          return `
            <div id="block-${i}" class="timeline-block ${isEmpty ? 'compact-gap' : 'tight-stack'} px-1 sm:px-3 py-0 border-l-4 border-transparent font-mono">
              ${lineData.chordHtml || lineData.lyricLine ? `<div class="timeline-pair">${lineData.chordHtml ? `<div class="timeline-line chords text-primary font-bold" style="font-size:var(--practice-chord-size, 11px)">${lineData.chordHtml}</div>` : ''}${lineData.lyricLine ? `<div class="timeline-line ${lineData.type === 'tag' ? 'text-primary/80 uppercase tracking-[0.25em] text-[10px] sm:text-xs' : 'lyrics text-gray-300'}" style="${lineData.type === 'tag' ? '' : 'font-size:var(--practice-text-size, 14px)'}">${lineData.lyricLine}</div>` : ''}</div>` : ''}
            </div>
          `;
        }).join('') + `</div>`;
        
        // For Step 1, create a pattern dynamically based on the Time Signature
        if (step === 1) {
            activeStrumPattern = [];
            for(let i=0; i<getPatternSlotCount(beatsPerBar); i++) {
                activeStrumPattern.push({ time: i * 0.5, type: i === 0 ? "â†“" : ".", raw: i === 0 ? "D" : "." });
            }
        } else {
            activeStrumPattern = normalizedStrumming;
        }
      }

      practiceValidationStates = new Array(activeStrumPattern.length).fill(null);
      UI.renderPatternVisualizer('practice-rhythm-viz', activeStrumPattern, beatsPerBar, -1, practiceValidationStates);
      startPracticeDetection();

      const footerButton = document.getElementById('btn-play');
      footerButton.innerHTML = `<i class="fas fa-play mr-2"></i> Start`;
      footerButton.onclick = togglePlay;

      navigate('practice');
    };

    window.togglePlay = async function() {
      if(!isPlaying) {
        await ensureAudioReady();
        isPlaying = true;
        startTime = audioCtx.currentTime;
        nextNoteTime = audioCtx.currentTime + 0.05;
        currentBeatInBar = 0;
        lastSavedPercent = -1;
        document.getElementById('btn-play').innerHTML = `<i class="fas fa-stop"></i> Stop`;
        document.getElementById('btn-play').classList.replace('bg-primary', 'bg-danger');
        document.getElementById('btn-play').classList.add('text-white');
        document.getElementById('btn-play').classList.replace('shadow-[0_0_20px_rgba(187,134,252,0.4)]', 'shadow-[0_0_20px_rgba(207,102,121,0.4)]');
        scheduler();
      } else { stopPlayback(); }
    };

    function scheduler() {
      const beatsPerBar = parseInt((currentSong.timeSignature || "4/4").split('/')[0]) || 4;
      
      while (nextNoteTime < audioCtx.currentTime + 0.1) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = currentBeatInBar === 0 ? 1200 : 800;
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(nextNoteTime); osc.stop(nextNoteTime + 0.05);
        gain.gain.setValueAtTime(0.3, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + 0.05);
        
        const uiBpm = parseInt(document.getElementById('practice-bpm').value) || currentBpm;
        if(uiBpm >= 40 && uiBpm <= 300) currentBpm = uiBpm;

        nextNoteTime += 60.0 / currentBpm;
        currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
      }
      if(isPlaying) {
        animationId = requestAnimationFrame(updateUI);
        setTimeout(scheduler, 25);
      }
    }

    function updateUI() {
      if(!isPlaying) return;
      const beat = (audioCtx.currentTime - startTime) / (60 / currentBpm);
      const percent = Math.min(100, (beat / currentSong.totalBeats) * 100);
      document.getElementById('practice-progress-bar').style.width = `${percent}%`;

      const decile = Math.floor(percent / 10) * 10;
      if(decile > lastSavedPercent) {
        lastSavedPercent = decile;
        saveProg(decile);
      }

      const beatsPerBar = parseInt((currentSong.timeSignature || "4/4").split('/')[0]) || 4;
      const subBeat = beat % beatsPerBar;
      
      const activeStrumIndex = Math.floor(subBeat * 2) % getPatternSlotCount(beatsPerBar);
      UI.renderPatternVisualizer('practice-rhythm-viz', activeStrumPattern, beatsPerBar, activeStrumIndex, practiceValidationStates);
      const activeChord = getActiveChordForBeat(beat);
      updatePracticeValidation(beat, activeChord);

      if (activeStrumIndex !== lastPlayedStrumIndex) {
        lastPlayedStrumIndex = activeStrumIndex;
        const activeStrum = activeStrumPattern[activeStrumIndex];
        if (activeStrum) {
          if (activeStrum.raw === '.') {
            // Let the previous chord continue ringing naturally.
          } else if (activeStrum.raw === 'X') {
            stopActiveChordPreview(0.03);
          } else if (activeChord) {
            stopActiveChordPreview(0.03);
            playChordPreview(activeChord.chord, activeStrum.raw);
          }
        }
      }

      // Dual Chord/Line Highlighting Logic
      if(currentStepMode !== 2 && currentSong.chords && currentSong.chords.length > 0) {
        if (activeChord) {
          if (currentStepMode === 1 || currentStepMode === 3) {
            UI.renderChordLibrary('practice-current-chord', [activeChord.chord], activeChord.chord);
            UI.renderPracticeCurrentLine({ containerId: 'practice-current-line', lineData: currentSong.parsedLines?.[activeChord.lineIdx], parsedLines: currentSong.parsedLines, activeChordGlobalIdx: activeChord.globalIdx });
          }
          const blockEl = document.getElementById(`block-${activeChord.lineIdx}`);
          if(blockEl && !blockEl.classList.contains('active')) {
            document.querySelectorAll('.timeline-block').forEach(b => b.classList.remove('active'));
            blockEl.classList.add('active');
            blockEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }

          const chordEl = document.getElementById(`chord-hl-${activeChord.globalIdx}`);
          if (chordEl && !chordEl.classList.contains('text-active')) {
             document.querySelectorAll('[id^="chord-hl-"]').forEach(c => {
                 c.classList.remove('text-active', 'drop-shadow-[0_0_8px_rgba(3,218,198,0.8)]', 'scale-110', 'inline-block');
                 c.classList.add('text-primary');
             });
             chordEl.classList.remove('text-primary');
             chordEl.classList.add('text-active', 'drop-shadow-[0_0_8px_rgba(3,218,198,0.8)]', 'scale-110', 'inline-block');
          }
          if (userSettings.enableChordDetection) updateActiveChordValidationClass(lastChordValidationState);
        }
      }

      if(beat >= currentSong.totalBeats) {
        saveProg(100);
        if (user && !user.isAnonymous) {
          bumpSongStat('completed').then(() => {
            const completedEl = document.getElementById('detail-stat-completed');
            if (completedEl) completedEl.innerText = String(currentSong.stats?.completed || 0);
          }).catch(err => console.error('Completed stat failed', err));
          openRatingModal();
        }
        stopPlayback();
      }
    }

    async function saveProg(p) {
      if (!user) return; 
      const key = `step${currentStepMode}`;
      if(p > (userProgress[key]?.p || 0)) {
        userProgress[key] = { p };
        rememberRecentPractice(currentSong.id, userProgress).catch(err => console.error('Recent practice update failed', err));
        try {
          await repository.saveProgress(user.uid, currentSong.id, userProgress);
        } catch (e) {
          console.error("Progress save failed invisibly", e);
        }
      }
    }

    function stopPlayback() {
      isPlaying = false;
      cancelAnimationFrame(animationId);
      lastPlayedStrumIndex = -1;
      stopActiveChordPreview(0.03);
      stopPracticeDetection();
      
      const btn = document.getElementById('btn-play');
      btn.innerHTML = `<i class="fas fa-play mr-2"></i> Start`;
      btn.classList.replace('bg-danger', 'bg-primary');
      btn.classList.add('text-white');
      btn.classList.replace('shadow-[0_0_20px_rgba(207,102,121,0.4)]', 'shadow-[0_0_20px_rgba(187,134,252,0.4)]');
      
      // Remove visual active states
      document.querySelectorAll('.active').forEach(a => {
        if(a.id !== 'view-practice' && !a.classList.contains('view')) a.classList.remove('active');
      });
      document.querySelectorAll('[id^="chord-hl-"]').forEach(c => {
         c.classList.remove('text-active', 'drop-shadow-[0_0_8px_rgba(3,218,198,0.8)]', 'scale-110', 'inline-block');
         c.classList.add('text-primary');
      });
    }

    window.stopAndExitPractice = () => { 
      stopPlayback(); 
      openSongDetails(currentSong.id); 
    };

    function renderBottomTabs() {
      const tabs = [
        { id: 'home', label: 'Home', icon: 'fa-house' },
        { id: 'training', label: 'Training', icon: 'fa-dumbbell' },
        { id: 'tuner', label: 'Tuner', icon: 'fa-microphone' },
        { id: 'tools', label: 'Tools', icon: 'fa-toolbox' },
        { id: 'settings', label: 'Settings', icon: 'fa-gear' }
      ];
      const tabBar = document.getElementById('bottom-tabbar');
      if (!tabBar) return;
      tabBar.innerHTML = tabs.map(tab => `
        <button onclick="navigate('${tab.id}')" class="tab-item ${activeTab === tab.id ? 'active' : ''} flex-1 flex flex-col items-center justify-center gap-1 text-[11px] text-gray-500 transition-colors">
          <span class="tab-pill w-12 h-8 rounded-full flex items-center justify-center transition-colors"><i class="fas ${tab.icon} text-base"></i></span>
          <span>${tab.label}</span>
        </button>
      `).join('');
    }

    function updateTabBar() {
      renderBottomTabs();
      const showTabBar = TAB_VIEWS.has(activeTab) && document.getElementById(`view-${activeTab}`)?.classList.contains('active');
      const tabBarWrap = document.getElementById('tabbar-wrap');
      if (tabBarWrap) {
        if (showTabBar) tabBarWrap.classList.remove('hidden');
        else tabBarWrap.classList.add('hidden');
      }
    }

    function populateCapoOptions() {
      const capoSelect = document.getElementById('add-capo');
      capoSelect.innerHTML = CAPO_OPTIONS.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    }

    function updateMetronomeSettings() {
      const bpm = parseInt(document.getElementById('metro-bpm')?.value || '100', 10);
      const beats = parseInt(document.getElementById('metro-beats')?.value || '4', 10);
      document.getElementById('metro-bpm-label').innerText = bpm;
      localStorage.setItem(METRONOME_STORAGE_KEY, JSON.stringify({ bpm, beats }));
      renderStandaloneMetronomeVisual();
      if (metronomeTimer) {
        stopStandaloneMetronome();
        startStandaloneMetronome();
      }
    }

    function renderStandaloneMetronomeVisual(active = -1) {
      const beats = parseInt(document.getElementById('metro-beats')?.value || '4', 10);
      document.getElementById('metro-visual').innerHTML = Array.from({ length: beats }, (_, i) => {
        const accented = i === 0;
        const isActive = i === active;
        return `<div class="w-4 h-4 rounded-full transition-all ${isActive ? 'bg-active scale-125 shadow-[0_0_12px_rgba(3,218,198,0.7)]' : accented ? 'bg-primary/80' : 'bg-gray-700'}"></div>`;
      }).join('');
    }

    function clickStandaloneMetronome(isAccent) {
      if (!audioCtx) audioCtx = new AudioContext();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = isAccent ? 1200 : 760;
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    function startStandaloneMetronome() {
      const bpm = parseInt(document.getElementById('metro-bpm').value, 10);
      const beats = parseInt(document.getElementById('metro-beats').value, 10);
      metronomeBeatIndex = 0;
      renderStandaloneMetronomeVisual(metronomeBeatIndex);
      clickStandaloneMetronome(true);
      metronomeTimer = setInterval(() => {
        metronomeBeatIndex = (metronomeBeatIndex + 1) % beats;
        renderStandaloneMetronomeVisual(metronomeBeatIndex);
        clickStandaloneMetronome(metronomeBeatIndex === 0);
      }, (60 / bpm) * 1000);
      const btn = document.getElementById('btn-metro-toggle');
      btn.innerHTML = `<i class="fas fa-stop mr-2"></i> Stop Metronome`;
      btn.classList.replace('bg-primary', 'bg-danger');
      btn.classList.add('text-white');
    }

    function stopStandaloneMetronome() {
      clearInterval(metronomeTimer);
      metronomeTimer = null;
      renderStandaloneMetronomeVisual();
      const btn = document.getElementById('btn-metro-toggle');
      btn.innerHTML = `<i class="fas fa-play mr-2"></i> Start Metronome`;
      btn.classList.replace('bg-danger', 'bg-primary');
      btn.classList.add('text-white');
    }

    window.toggleStandaloneMetronome = function() {
      if (metronomeTimer) stopStandaloneMetronome();
      else startStandaloneMetronome();
    };

    function renderTunerMeter(cents = 0) {
      const meter = document.getElementById('tuner-meter');
      const bars = [];
      for (let i = -6; i <= 6; i++) {
        const distance = Math.abs(i - (cents / 10));
        const active = distance < 1 ? 1 - distance : 0.18;
        const center = i === 0;
        const height = center ? 58 : 36 - Math.min(Math.abs(i) * 3, 18);
        bars.push(`<div class="meter-bar w-3 rounded-full ${center ? 'bg-primary' : 'bg-gray-700'}" style="height:${height}px;opacity:${Math.max(active, 0.2)}"></div>`);
      }
      meter.innerHTML = bars.join('');
    }

    function autoCorrelate(buffer, sampleRate) {
      let rms = 0;
      for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
      rms = Math.sqrt(rms / buffer.length);
      if (rms < 0.01) return -1;

      let r1 = 0, r2 = buffer.length - 1;
      const threshold = 0.2;
      for (let i = 0; i < buffer.length / 2; i++) { if (Math.abs(buffer[i]) < threshold) { r1 = i; break; } }
      for (let i = 1; i < buffer.length / 2; i++) { if (Math.abs(buffer[buffer.length - i]) < threshold) { r2 = buffer.length - i; break; } }
      const trimmed = buffer.slice(r1, r2);
      const c = new Array(trimmed.length).fill(0);
      for (let i = 0; i < trimmed.length; i++) {
        for (let j = 0; j < trimmed.length - i; j++) c[i] += trimmed[j] * trimmed[j + i];
      }
      let d = 0;
      while (c[d] > c[d + 1]) d++;
      let maxPos = -1;
      let maxVal = -1;
      for (let i = d; i < trimmed.length; i++) {
        if (c[i] > maxVal) {
          maxVal = c[i];
          maxPos = i;
        }
      }
      if (maxPos <= 0) return -1;
      return sampleRate / maxPos;
    }

    function closestString(freq) {
      return STANDARD_TUNING.reduce((best, current) => Math.abs(current.freq - freq) < Math.abs(best.freq - freq) ? current : best);
    }

    function startTunerLoop() {
      if (!tunerAnalyser || !audioCtx) return;
      const buffer = new Float32Array(2048);
      const tick = () => {
        tunerAnalyser.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, audioCtx.sampleRate);
        if (freq > 0) {
          const nearest = closestString(freq);
          const cents = Math.max(-50, Math.min(50, 1200 * Math.log2(freq / nearest.freq)));
          document.getElementById('tuner-note').innerText = nearest.note;
          document.getElementById('tuner-frequency').innerText = `${freq.toFixed(2)} Hz detected`;
          document.getElementById('tuner-status').innerText = Math.abs(cents) < 6 ? 'In tune' : (cents < 0 ? `${Math.abs(cents).toFixed(1)} cents flat` : `${cents.toFixed(1)} cents sharp`);
          renderTunerMeter(cents);
        } else {
          document.getElementById('tuner-note').innerText = '--';
          document.getElementById('tuner-frequency').innerText = 'Play one string clearly near your microphone.';
          document.getElementById('tuner-status').innerText = 'Listening...';
          renderTunerMeter(0);
        }
        tunerAnimationId = requestAnimationFrame(tick);
      };
      tick();
    }

    async function startTuner() {
      try {
        if (!audioCtx) audioCtx = new AudioContext();
        tunerStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tunerAnalyser = audioCtx.createAnalyser();
        tunerAnalyser.fftSize = 2048;
        tunerSource = audioCtx.createMediaStreamSource(tunerStream);
        tunerSource.connect(tunerAnalyser);
        document.getElementById('btn-tuner-toggle').innerHTML = `<i class="fas fa-stop mr-2"></i> Stop Tuner`;
        document.getElementById('btn-tuner-toggle').classList.replace('bg-primary', 'bg-danger');
        document.getElementById('btn-tuner-toggle').classList.add('text-white');
        document.getElementById('tuner-status').innerText = 'Listening...';
        startTunerLoop();
      } catch (err) {
        console.error(err);
        showToast("Microphone access is required for the tuner.");
      }
    }

    function stopTuner() {
      cancelAnimationFrame(tunerAnimationId);
      tunerAnimationId = null;
      if (tunerSource) {
        try { tunerSource.disconnect(); } catch {}
        tunerSource = null;
      }
      if (tunerStream) {
        tunerStream.getTracks().forEach(track => track.stop());
        tunerStream = null;
      }
      tunerAnalyser = null;
      const tunerBtn = document.getElementById('btn-tuner-toggle');
      if (tunerBtn) {
        tunerBtn.innerHTML = `<i class="fas fa-microphone mr-2"></i> Start Tuner`;
        tunerBtn.classList.replace('bg-danger', 'bg-primary');
        tunerBtn.classList.add('text-white');
      }
      const status = document.getElementById('tuner-status');
      if (status && activeTab !== 'tuner') status.innerText = 'Idle';
    }

    window.toggleTuner = function() {
      if (tunerStream) stopTuner();
      else startTuner();
    };

    function restoreMetronomeSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(METRONOME_STORAGE_KEY) || '{}');
        if (saved.bpm && saved.bpm >= 40 && saved.bpm <= 240) {
          document.getElementById('metro-bpm').value = saved.bpm;
          document.getElementById('metro-bpm-label').innerText = saved.bpm;
        }
        if (saved.beats && [2, 3, 4, 6].includes(saved.beats)) {
          document.getElementById('metro-beats').value = String(saved.beats);
        }
      } catch {}
    }

    window.updateMetronomeSettings = updateMetronomeSettings;

    window.onload = () => {
      populateCapoOptions();
      renderBottomTabs();
      applyUserSettings(DEFAULT_SETTINGS);
      renderTunerMeter(0);
      renderToolRecordings();
      renderChordExplorer();
      renderToolSongsSearch();
      showToolsHome();
      syncAddPatternEditor();
      updateTrainingPatternEditor();
      restoreMetronomeSettings();
      renderStandaloneMetronomeVisual();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopTuner();
          stopStandaloneMetronome();
          if (toolRecorder && toolRecorder.state === 'recording') toolRecorder.stop();
          else stopToolRecordingStream();
          updateToolRecordingUI(false);
          stopTrainingPlayback();
          stopPracticeDetection();
          if (isPlaying) stopPlayback();
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!document.getElementById('text-settings-modal')?.classList.contains('hidden')) return closeTextSettingsModal();
        if (!document.getElementById('rating-modal')?.classList.contains('hidden')) return closeRatingModal();
        if (document.getElementById('view-practice')?.classList.contains('active')) return stopAndExitPractice();
      });
      initApp();
    };


