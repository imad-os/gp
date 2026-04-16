import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './modules/renderers.js';
import { FirestoreRepository } from './modules/repository.js';

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
    let userProgressSongId = null;
    let editingSongId = null; 
    let activeArtistName = '';
    
    let audioCtx = null;
    let isPlaying = false;
    let startTime = 0;
    let currentBpm = 70;
    let nextNoteTime = 0;
    let currentBeatInBar = 0;
    let animationId;
    let lastProgressSaveAtMs = 0;
    let currentStepMode = 1;
    let activePlaybackTotalBeats = 0;
    let activeStrumPattern = [];
    let practicePatternAssignments = [];
    let activePatternAssignmentIndex = -1;
    let pausedPracticeBeat = null;
    let practicePausedByBlur = false;
    let lastSavedPercent = -1;
    let lastPlayedStrumIndex = -1;
    let addPatternEntries = [];
    let nextAddPatternEntryId = 1;
    let addPatternPreviewTimer = null;
    let addPatternPreviewEntryId = null;
    let addPatternPreviewStepIndex = 0;
    let addPatternPreviewTotalSteps = 0;
    let practiceChordAudioEnabled = true;
    let activeChordVoices = [];
    let activeTab = 'home';
    let metronomeTimer = null;
    let metronomeBeatIndex = 0;
    let toolRecordings = [];
    let toolAudioPlayers = new Map();
    let activeToolAudioId = null;
    let toolSongsSearchResults = [];
    let lastToolSongsQuery = '';
    let toolRecorder = null;
    let toolRecordingStream = null;
    let toolRecordingChunks = [];
    let toolRecordingTimeout = null;
    let toolRecordingAnalyser = null;
    let toolRecordingSource = null;
    let toolRecordingVizAnimationId = null;
    let selectedChordReference = 'C';
    let chordBuilderEditingId = '';
    let guitarToneProfiles = [];
    let guitarToneEditingId = '';
    let guitarTonePendingSamples = {};
    let guitarToneSampleLoadPromises = new Map();
    let activeChordToneAudios = [];
    let activeChordToneTimers = [];
    let guitarToneUseUrls = false;
    let guitarToneEditorOpen = false;
    let activeToolPage = 'home';
    let looperMode = 'none';
    let looperObjectUrl = '';
    let looperYoutubePlayer = null;
    let looperSyncTimer = null;
    let looperDuration = 0;
    let looperRepeatEnabled = false;
    let looperABEnabled = false;
    let looperAppBackgroundEnabled = false;
    let looperPointA = 0;
    let looperPointB = 0;
    let looperHistory = [];
    let activeLooperHistoryId = '';
    let looperHistorySaveTimer = null;
    let looperActiveSource = null;
    let looperPendingUploadFile = null;
    let looperPendingDataUrl = '';
    let looperHistoryCreatePromise = null;
    let looperDeletingHistoryId = '';
    let looperOpeningHistoryId = '';
    let looperOpeningProgress = 0;
    let tabsPreviewTimerIds = [];
    let tabsPreviewSessionId = 0;
    let tabsPreviewHistory = [];
    let tabsPreviewActiveHistoryId = '';
    let tabsPreviewPlayingHistoryId = '';
    let activeSongTabEvents = [];
    let nextSongTabEventIndex = 0;
    let currentSongComments = [];
    let currentSongRatings = [];
    let pendingSongRating = 0;
    let trainingArticles = [];
    let currentTrainingArticle = null;
    let currentTrainingArticleComments = [];
    let currentTrainingArticleRatings = [];
    let pendingTrainingArticleRating = 0;
    let editingTrainingArticleId = null;
    let activeTrainingArticleCategory = 'trainings';
    let trainingVideoPlayer = null;
    let trainingVideoSyncTimer = null;
    let trainingVideoLastSavedSec = -1;
    let homeSectionExpanded = {
      favorites: false,
      practice: false,
      courses: false
    };
    let lastNonPracticePath = '/';
    let tunerStream = null;
    let tunerAnalyser = null;
    let tunerSource = null;
    let tunerAnimationId = null;
    let tunerSmoothedFreq = 0;
    let tunerSmoothedCents = 0;
    let tunerStableNote = '';
    let tunerPendingNote = '';
    let tunerPendingNoteFrames = 0;
    let tunerNoSignalFrames = 0;
    let tunerAudioMode = 'mic';
    let tunerRecentFreqs = [];
    let trainingTimer = null;
    let trainingBeatIndex = 0;
    const METRONOME_STORAGE_KEY = 'guitartrainer.metronome.settings';
    const GEMINI_API_KEY_STORAGE_KEY = 'guitartrainer.gemini.apiKey';
    const TABS_PREVIEW_HISTORY_STORAGE_KEY = 'guitartrainer.tabs.history.v1';
    const TABS_PREVIEW_HISTORY_LIMIT = 80;
    const LOOPER_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    const GUITAR_TONE_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
    const GUITAR_TONE_STRING_KEYS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    const GUITAR_OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
    const APP_BUILD = {
      version: 'v2026.04.06.3',
    };
    const LIBRARY_ADMIN_EMAILS = ['imad@gmail.com'];
    const LIBRARY_ADMIN_UIDS = [];
    const DEFAULT_SETTINGS = {
      practiceTextSize: 14,
      favoriteSongIds: [],
      recentPractice: [],
      recentCourses: [],
      activeGuitarToneId: '',
      tunerPresetId: 'default',
      chordNotation: 'letter'
    };
    let userSettings = { ...DEFAULT_SETTINGS };
    let practiceValidationStates = [];

    const CAPO_OPTIONS = ["No capo", "1st fret", "2nd fret", "3rd fret", "4th fret", "5th fret", "6th fret", "7th fret", "8th fret", "9th fret", "10th fret", "11th fret", "12th fret"];
    const TAB_VIEWS = new Set(['home', 'training', 'tuner', 'tools', 'profile']);
    const TABS_COLUMNS_PER_BEAT = 4;
    const TABS_PREVIEW_PART_GAP_COLUMNS = 2;
    const EUROPEAN_TO_US_NOTE_MAP = Object.freeze({
      do: 'C',
      re: 'D',
      mi: 'E',
      fa: 'F',
      sol: 'G',
      la: 'A',
      si: 'B',
      ti: 'B'
    });
    const US_TO_SOLFEGE_NOTE_MAP = Object.freeze({
      C: 'Do',
      D: 'Re',
      E: 'Mi',
      F: 'Fa',
      G: 'Sol',
      A: 'La',
      B: 'Si'
    });
    const TUNING_PRESETS = [
      {
        id: 'default',
        label: 'Default - Standard Acoustic (E A D G B E)',
        strings: [
          { note: 'E2', freq: 82.41 },
          { note: 'A2', freq: 110.0 },
          { note: 'D3', freq: 146.83 },
          { note: 'G3', freq: 196.0 },
          { note: 'B3', freq: 246.94 },
          { note: 'E4', freq: 329.63 }
        ]
      },
      {
        id: 'drop-d',
        label: 'Drop D (D A D G B E)',
        strings: [
          { note: 'D2', freq: 73.42 },
          { note: 'A2', freq: 110.0 },
          { note: 'D3', freq: 146.83 },
          { note: 'G3', freq: 196.0 },
          { note: 'B3', freq: 246.94 },
          { note: 'E4', freq: 329.63 }
        ]
      },
      {
        id: 'half-step-down',
        label: 'Half Step Down (Eb Ab Db Gb Bb Eb)',
        strings: [
          { note: 'Eb2', freq: 77.78 },
          { note: 'Ab2', freq: 103.83 },
          { note: 'Db3', freq: 138.59 },
          { note: 'Gb3', freq: 185.0 },
          { note: 'Bb3', freq: 233.08 },
          { note: 'Eb4', freq: 311.13 }
        ]
      },
      {
        id: 'dadgad',
        label: 'DADGAD (D A D G A D)',
        strings: [
          { note: 'D2', freq: 73.42 },
          { note: 'A2', freq: 110.0 },
          { note: 'D3', freq: 146.83 },
          { note: 'G3', freq: 196.0 },
          { note: 'A3', freq: 220.0 },
          { note: 'D4', freq: 293.66 }
        ]
      },
      {
        id: 'open-g',
        label: 'Open G (D G D G B D)',
        strings: [
          { note: 'D2', freq: 73.42 },
          { note: 'G2', freq: 98.0 },
          { note: 'D3', freq: 146.83 },
          { note: 'G3', freq: 196.0 },
          { note: 'B3', freq: 246.94 },
          { note: 'D4', freq: 293.66 }
        ]
      },
      {
        id: 'open-d',
        label: 'Open D (D A D F# A D)',
        strings: [
          { note: 'D2', freq: 73.42 },
          { note: 'A2', freq: 110.0 },
          { note: 'D3', freq: 146.83 },
          { note: 'F#3', freq: 185.0 },
          { note: 'A3', freq: 220.0 },
          { note: 'D4', freq: 293.66 }
        ]
      },
      {
        id: 'whole-step-down',
        label: '2 Notes Flatter (D G C F A D)',
        strings: [
          { note: 'D2', freq: 73.42 },
          { note: 'G2', freq: 98.0 },
          { note: 'C3', freq: 130.81 },
          { note: 'F3', freq: 174.61 },
          { note: 'A3', freq: 220.0 },
          { note: 'D4', freq: 293.66 }
        ]
      }
    ];
    let activeTunerPresetId = DEFAULT_SETTINGS.tunerPresetId;
    const SUPPORTED_TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '2/16', '3/16', '4/16', '6/16'];
    const DEFAULT_CHORD_LIBRARY = {
      C: { baseFret: 1, strings: ['x', 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
      Cm: { baseFret: 3, strings: ['x', 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1] },
      C7: { baseFret: 1, strings: ['x', 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
      D: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
      Dm: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
      D7: { baseFret: 1, strings: ['x', 'x', 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
      Dsus4: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
      E: { baseFret: 1, strings: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
      Em: { baseFret: 1, strings: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
      E7: { baseFret: 1, strings: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
      F: { baseFret: 1, strings: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
      Fmaj7: { baseFret: 1, strings: ['x', 'x', 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
      Fm: { baseFret: 1, strings: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
      'F#': { baseFret: 2, strings: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1] },
      G: { baseFret: 1, strings: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
      G7: { baseFret: 1, strings: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
      G6: { baseFret: 1, strings: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
      A: { baseFret: 1, strings: ['x', 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
      Am: { baseFret: 1, strings: ['x', 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
      A7: { baseFret: 1, strings: ['x', 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
      Asus2: { baseFret: 1, strings: ['x', 0, 2, 2, 0, 0], fingers: [0, 0, 2, 3, 0, 0] },
      Asus4: { baseFret: 1, strings: ['x', 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
      B: { baseFret: 2, strings: ['x', 2, 4, 4, 4, 2], fingers: [0, 1, 3, 4, 4, 1] },
      Bm: { baseFret: 2, strings: ['x', 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
      B7: { baseFret: 1, strings: ['x', 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
      Cadd9: { baseFret: 1, strings: ['x', 3, 2, 0, 3, 3], fingers: [0, 1, 2, 0, 3, 4] },
      Dadd9: { baseFret: 1, strings: ['x', 'x', 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
      Emaj7: { baseFret: 1, strings: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
      'G/B': { baseFret: 1, strings: ['x', 2, 0, 0, 0, 3], fingers: [0, 1, 0, 0, 0, 3] },
      'D/F#': { baseFret: 1, strings: [2, 'x', 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] }
    };
    let CHORD_LIBRARY = { ...DEFAULT_CHORD_LIBRARY };
    const NOTE_INDEX = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let CHORD_EXPLORER_LIST = Object.keys(CHORD_LIBRARY).sort((a, b) => a.localeCompare(b));
    let chordEntries = [];
    let isHandlingRouteChange = false;
    const chordPopoverState = {
      visible: false,
      chordName: '',
      anchorEl: null,
      container: null
    };

    const MOCK_SONG = {
      title: "Ya Rayah", artist: "Cheb Khaled", postedBy: "System", bpm: 80, timeSignature: "4/4", capo: "No capo", ownerId: "system",
      rawText: "Am                                G\nYa rayah win msafar trouh taaya wa twali\nF                                 E\nChhal nadmou laabad lghafline qablak ou qabli\n\nAm                                G\nYa rayah win msafar trouh taaya wa twali",
      strumming: [
        { time: 0, type: "↓", raw: "D" }, { time: 0.5, type: ".", raw: "." },
        { time: 1, type: "↓", raw: "D" }, { time: 1.5, type: "↑", raw: "U" },
        { time: 2, type: ".", raw: "." }, { time: 2.5, type: "↑", raw: "U" },
        { time: 3, type: "↓", raw: "D" }, { time: 3.5, type: "↑", raw: "U" }
      ]
    };

    const DEFAULT_TRAINING_ARTICLES = [
      {
        category: 'trainings',
        title: 'Perfect Posture and Pick Hold',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Set your hands and wrist correctly before speed work.',
        body: `1) Sit tall and keep shoulders relaxed.
2) Keep fretting thumb behind the neck midpoint.
3) Hold pick with light pressure: enough to not drop, not enough to lock wrist.
4) Do 3 rounds: open-string downstrokes 60 BPM for 2 minutes.`,
      },
      {
        category: 'trainings',
        title: 'Clean Chord Changes: C to G to Am',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Fast transition drills with minimal finger movement.',
        body: `Use 4 bars each chord at 70 BPM.
Focus: move fingers together, not one by one.
Routine:
- 3 minutes C -> G
- 3 minutes G -> Am
- 3 minutes C -> Am`,
      },
      {
        category: 'trainings',
        title: 'Palm Muting Control Basics',
        imageUrl: '',
        level: 'medium',
        articleType: 'text',
        description: 'Control tone and attack with right-hand palm position.',
        body: `Place palm edge near bridge.
Move 1 cm toward neck for warmer muted tone.
Drill:
- 2 bars muted eighth notes
- 2 bars open ringing eighth notes
- Repeat for 5 minutes`,
      },
      {
        category: 'dailies',
        title: '10-Minute Daily Warm-Up',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'A daily quick stack for consistency.',
        body: `2 min finger stretch
3 min open-string alternate picking
3 min chord transitions (C, G, Am, F)
2 min slow strumming with metronome`,
      },
      {
        category: 'dailies',
        title: 'Rhythm Daily: Subdivision Focus',
        imageUrl: '',
        level: 'medium',
        articleType: 'text',
        description: 'Tighten timing by counting out loud.',
        body: `At 75 BPM:
- Quarter notes x 2 min
- Eighth notes x 2 min
- Sixteenth notes x 2 min
Count "1 e & a" clearly while strumming.`,
      },
      {
        category: 'dailies',
        title: 'Daily Ear and Tuning Check',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Build pitch awareness before practice.',
        body: `1) Tune each string slowly.
2) Pluck and sing the note.
3) Check octave string pairs.
4) End with one clean chord ring for 20 seconds.`,
      },
      {
        category: 'courses',
        title: 'Marty Music - Beginner Guitar Lesson 1',
        imageUrl: 'https://i.ytimg.com/vi/_QCt3UBTS1Y/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'Very friendly absolute beginner starter lesson.',
        youtubeUrl: 'https://www.youtube.com/watch?v=_QCt3UBTS1Y',
        body: '',
      },
      {
        category: 'courses',
        title: 'Marty Music - Beginner Guitar Lesson 2',
        imageUrl: 'https://i.ytimg.com/vi/RY3AvEGKfZ0/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'Follow-up beginner lesson focusing on chord transitions.',
        youtubeUrl: 'https://www.youtube.com/watch?v=RY3AvEGKfZ0',
        body: '',
      },
      {
        category: 'courses',
        title: 'Andy Guitar - Beginner Lesson (Part 2)',
        imageUrl: 'https://i.ytimg.com/vi/6Jxz9F3CYuo/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'Beginner-friendly pacing and structure.',
        youtubeUrl: 'https://www.youtube.com/watch?v=6Jxz9F3CYuo',
        body: '',
      },
      {
        category: 'trainings',
        title: 'Beginner Finger Independence Drill',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Build left-hand control with a 1-2-3-4 crawl routine.',
        body: `Start on low E string:
- Fret 1,2,3,4 then move to next string.
- Use strict alternate picking.
- 4 reps ascending + 4 reps descending.
Tempo: 55 BPM first week, then +5 BPM.`,
      },
      {
        category: 'trainings',
        title: 'Strumming Dynamics and Accent Control',
        imageUrl: '',
        level: 'medium',
        articleType: 'text',
        description: 'Practice loud/soft accents without breaking tempo.',
        body: `Pattern: D . D U . U D U
Round A: accent beat 2
Round B: accent beat 4
Round C: ghost strum on off-beats
Use metronome at 80 BPM for 8 minutes.`,
      },
      {
        category: 'trainings',
        title: 'Barre Chord Foundations',
        imageUrl: '',
        level: 'advance',
        articleType: 'text',
        description: 'Prepare finger strength and wrist angle for clean barre shapes.',
        body: `1) Thumb behind neck, no squeeze collapse.
2) Roll index finger slightly toward thumb side.
3) Start with mini-barre on top 2 strings.
4) Build to full F major for 10-second holds x 8 reps.`,
      },
      {
        category: 'dailies',
        title: '15-Minute Daily Chord Flow',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Daily transitions for common open chords.',
        body: `5 min: C-G-Am-F (slow)
5 min: D-A-Bm-G (slow)
5 min: pick one song progression and loop
Goal: no pauses between changes.`,
      },
      {
        category: 'dailies',
        title: 'Speed Ladder Daily',
        imageUrl: '',
        level: 'medium',
        articleType: 'text',
        description: 'Controlled speed increase without losing timing.',
        body: `Pick one drill and run:
60 BPM x 1 min
70 BPM x 1 min
80 BPM x 1 min
90 BPM x 1 min
Drop back to 70 BPM for clean finish.`,
      },
      {
        category: 'dailies',
        title: 'Daily Review Loop',
        imageUrl: '',
        level: 'beginner',
        articleType: 'text',
        description: 'Simple structure to keep consistency every day.',
        body: `2 min tuning
4 min rhythm drill
4 min chord transitions
4 min song excerpt
1 min notes: what improved / what failed`,
      },
      {
        category: 'courses',
        title: 'Marty Music - 12 Bar Blues for Absolute Beginner',
        imageUrl: 'https://i.ytimg.com/vi/BU_wgm3M_tw/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'Good first blues form for absolute beginners.',
        youtubeUrl: 'https://www.youtube.com/watch?v=BU_wgm3M_tw',
        body: '',
      },
      {
        category: 'courses',
        title: 'GuitarZero2Hero - Beginner Lesson',
        imageUrl: 'https://i.ytimg.com/vi/_bkxNOU29zk/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'Step-by-step beginner fundamentals and song-ready basics.',
        youtubeUrl: 'https://www.youtube.com/watch?v=_bkxNOU29zk',
        body: '',
      },
      {
        category: 'courses',
        title: 'Nate Savage - Beginner Guitar Lesson 1',
        imageUrl: 'https://i.ytimg.com/vi/HNSaXAe8tyg/hqdefault.jpg',
        level: 'beginner',
        articleType: 'video',
        description: 'First-lesson format with core beginner essentials.',
        youtubeUrl: 'https://www.youtube.com/watch?v=HNSaXAe8tyg',
        body: '',
      }
    ];

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
        closeAuthModal();
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
        closeAuthModal();
        showToast("Account created successfully!", true);
      } catch(err) {
        showLoading(false);
        showToast(err.message.replace('Firebase:', '').trim() || "Signup failed");
      }
    };

    window.openAuthModal = function() {
      const modal = document.getElementById('view-auth');
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    };

    window.closeAuthModal = function() {
      const modal = document.getElementById('view-auth');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
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

    function updateUserHeaderState() {
      const profileBtn = document.getElementById('btn-open-profile');
      const authBtn = document.getElementById('btn-open-auth');
      const logoutBtn = document.getElementById('btn-logout');
      if (!profileBtn || !authBtn || !logoutBtn) return;
      const isGuest = !user || user.isAnonymous;
      profileBtn.innerText = isGuest
        ? 'Guest Player'
        : (user.email ? user.email.split('@')[0] : 'Player');
      profileBtn.title = isGuest ? 'Open profile' : (user.email || 'Open profile');
      authBtn.classList.toggle('hidden', !isGuest);
      logoutBtn.classList.toggle('hidden', isGuest);
    }

    function renderProfileSummary() {
      const nameEl = document.getElementById('profile-user-name');
      const emailEl = document.getElementById('profile-user-email');
      const favoritesEl = document.getElementById('profile-stat-favorites');
      const recentEl = document.getElementById('profile-stat-recent');
      const songsEl = document.getElementById('profile-stat-songs');
      const commentsEl = document.getElementById('profile-stat-comments');
      const isGuest = !user || user.isAnonymous;
      if (nameEl) nameEl.innerText = isGuest ? 'Guest Player' : (user.email ? user.email.split('@')[0] : 'Player');
      if (emailEl) emailEl.innerText = isGuest ? 'Not signed in' : (user.email || 'Signed in');
      if (favoritesEl) favoritesEl.innerText = String((userSettings.favoriteSongIds || []).length);
      if (recentEl) recentEl.innerText = String((userSettings.recentPractice || []).length);
      if (songsEl) songsEl.innerText = String(songs.filter(song => song.ownerId && user && song.ownerId === user.uid).length);
      if (commentsEl) commentsEl.innerText = String(trainingArticles.filter(article => article.ownerId && user && article.ownerId === user.uid).length);
    }

    function getActiveGuitarToneProfile() {
      const targetId = String(userSettings?.activeGuitarToneId || '').trim();
      if (targetId === '__synth__') return null;
      if (targetId) {
        const matched = guitarToneProfiles.find(item => item.id === targetId);
        if (matched) return matched;
      }
      const fallbackDefault = guitarToneProfiles.find(item => {
        const name = String(item?.name || '').trim().toLowerCase();
        return name === 'default' || name === 'default tone' || name === 'default guitar tone';
      });
      if (fallbackDefault) return fallbackDefault;
      return null;
    }

    function renderGuitarToneSettingsOptions() {
      const select = document.getElementById('settings-guitar-tone');
      if (!select) return;
      const activeId = String(userSettings?.activeGuitarToneId || '').trim();
      const fallbackDefault = guitarToneProfiles.find(item => {
        const name = String(item?.name || '').trim().toLowerCase();
        return name === 'default' || name === 'default tone' || name === 'default guitar tone';
      });
      const autoLabel = fallbackDefault
        ? `Default Guitar Tone (Auto: ${escapeHtml(fallbackDefault.name)})`
        : 'Default Synth (No samples)';
      const options = [
        `<option value="">${autoLabel}</option>`,
        `<option value="__synth__">Synth Only (No samples)</option>`,
        ...guitarToneProfiles.map(profile => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`)
      ];
      select.innerHTML = options.join('');
      if (activeId === '__synth__') {
        select.value = '__synth__';
      } else if (activeId && guitarToneProfiles.some(profile => profile.id === activeId)) {
        select.value = activeId;
      } else {
        select.value = '';
      }
    }

    function renderChordNotationSettingsOptions() {
      const mode = normalizeChordNotationMode(userSettings?.chordNotation);
      ['settings-chord-notation', 'detail-chord-notation', 'preview-chord-notation'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.value = mode;
      });
    }

    async function setChordNotationPreference(value = '', options = {}) {
      const { persist = true } = options || {};
      const mode = normalizeChordNotationMode(value);
      const nextSettings = { ...userSettings, chordNotation: mode };
      applyUserSettings(nextSettings);
      if (!persist || !user || user.isAnonymous) return;
      try {
        await repository.saveUserSettings(user.uid, { chordNotation: mode });
      } catch (e) {
        console.error('Could not save chord notation preference', e);
        showToast('Could not save chord notation setting.');
      }
    }

    function renderChordNotationSelectHtml(selectId = 'preview-chord-notation') {
      const mode = normalizeChordNotationMode(userSettings?.chordNotation);
      return `
        <div class="mt-3 bg-black/30 rounded-xl border border-gray-800 p-3">
          <label class="text-[10px] uppercase tracking-[0.2em] text-gray-500 block mb-2">Chord Notation</label>
          <select id="${selectId}" onchange="setChordNotationFromQuick(this.value)" class="w-full bg-transparent text-white outline-none text-sm">
            <option value="letter" ${mode === 'letter' ? 'selected' : ''}>Letter names (C D E F G A B)</option>
            <option value="solfege" ${mode === 'solfege' ? 'selected' : ''}>Solfège / Fixed Do (Do Re Mi Fa Sol La Si)</option>
          </select>
        </div>
      `;
    }

    window.setChordNotationFromQuick = async function(value = '') {
      await setChordNotationPreference(value, { persist: true });
    };

    function refreshChordNotationInCurrentUi() {
      document.querySelectorAll('[data-chord]').forEach(el => {
        const rawChord = String(el.getAttribute('data-chord') || '').trim();
        if (!rawChord) return;
        el.textContent = getDisplayChordName(rawChord);
      });
      if (currentSong) {
        const unique = [...new Set((currentSong.chords || []).map(c => c.chord).filter(Boolean))];
        if (unique.length) {
          renderChordLibrary('detail-chords', unique);
        }
        const practiceChordPanel = document.getElementById('practice-current-chord');
        if (practiceChordPanel && !document.getElementById('practice-current-chord-panel')?.classList.contains('hidden')) {
          const activeChordEl = document.querySelector('[id^="chord-hl-"].text-active');
          const activeChord = activeChordEl?.getAttribute('data-chord') || currentSong.chords?.[0]?.chord || '';
          if (activeChord) renderChordLibrary('practice-current-chord', [activeChord], activeChord);
        }
      }
      const previewName = document.getElementById('practice-preview-chord-name');
      if (previewName) {
        const raw = String(previewName.dataset?.chord || '').trim();
        previewName.innerText = raw ? getDisplayChordName(raw) : 'Tap a chord';
      }
      const translationName = document.getElementById('tool-chord-translation-diagram-name');
      if (translationName) {
        const raw = String(translationName.dataset?.chord || '').trim();
        if (raw) translationName.innerText = getDisplayChordName(raw);
      }
      renderChordExplorer();
    }

    window.openProfilePage = function(options = {}) {
      navigate('profile', options);
      renderProfileSummary();
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

    function isLikelyTabLine(line = '') {
      const raw = String(line || '').trim();
      if (!raw) return false;
      const compact = raw.replace(/\s+/g, '');
      const hyphenCount = (compact.match(/-/g) || []).length;
      if (/^[EADGBeadgbe][|:].*/.test(compact)) return true;
      if (/^[EADGBeadgbe]/.test(compact) && hyphenCount >= 3 && /\d/.test(compact)) return true;
      if (compact.includes('|') && hyphenCount >= 2 && /\d/.test(compact)) return true;
      return false;
    }

    function isChordLine(line) {
      if (isLikelyTabLine(line)) return false;
      const words = normalizeChordTokensForDetection(line);
      if (words.length === 0) return false;
      return words.every(word => {
        const { core } = extractTokenCoreParts(word);
        if (!core) return false;
        return getChordNotationFromCore(core) === 'usa' || getChordNotationFromCore(core) === 'european';
      });
    }

    function isTagLine(line) {
      return /^\s*\[[^\]]+\]\s*$/.test(line || "");
    }

    function stripLeadingWhitespace(line = "") {
      return line.replace(/^\s+/, '');
    }

    function escapeHtml(text = '') {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeTagKey(rawTag = "") {
      const tag = String(rawTag || '')
        .trim()
        .replace(/^\[\s*/, '')
        .replace(/\s*\]$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      return tag;
    }

    function normalizeTagLabel(rawTag = "") {
      const inner = String(rawTag || '')
        .trim()
        .replace(/^\[\s*/, '')
        .replace(/\s*\]$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      return inner ? `[${inner}]` : '';
    }

    function normalizePatternTags(entry = {}) {
      const tags = [];
      const seen = new Set();
      const pushTag = (rawTag) => {
        const key = normalizeTagKey(rawTag);
        if (!key || seen.has(key)) return;
        seen.add(key);
        tags.push({
          key,
          label: normalizeTagLabel(rawTag) || `[${key}]`
        });
      };
      const rawTags = [];
      if (Array.isArray(entry?.tags)) rawTags.push(...entry.tags);
      if (Array.isArray(entry?.tagKeys)) rawTags.push(...entry.tagKeys);
      if (entry?.tag) rawTags.push(entry.tag);
      if (entry?.tagKey) rawTags.push(entry.tagKey);
      rawTags.forEach(pushTag);
      return tags;
    }

    function normalizePatternTagKeys(entry = {}) {
      return normalizePatternTags(entry).map(item => item.key);
    }

    function extractTagOptionsFromRawText(rawText = '') {
      const lines = String(rawText || '').replace(/\r/g, '').split('\n');
      const options = [];
      const seen = new Set();
      lines.forEach(line => {
        const match = String(line || '').match(/^\s*\[([^\]]+)\]\s*$/);
        if (!match) return;
        const key = normalizeTagKey(match[1]);
        if (!key || seen.has(key)) return;
        seen.add(key);
        options.push({ key, label: normalizeTagLabel(match[1]) || `[${key}]` });
      });
      return options;
    }

    function normalizeTimeSignature(value = '', fallback = '4/4') {
      const normalized = String(value || '').trim();
      if (SUPPORTED_TIME_SIGNATURES.includes(normalized)) return normalized;
      return SUPPORTED_TIME_SIGNATURES.includes(fallback) ? fallback : '4/4';
    }

    function getTimeSignatureParts(timeSignature = '4/4') {
      const normalized = normalizeTimeSignature(timeSignature);
      const [numRaw, denRaw] = normalized.split('/');
      const beatsPerBar = parseInt(numRaw, 10) || 4;
      const denominator = parseInt(denRaw, 10) || 4;
      return { beatsPerBar, denominator, normalized };
    }

    function getSubdivisionsPerBeatFromSignature(timeSignature = '4/4') {
      const { denominator } = getTimeSignatureParts(timeSignature);
      if (denominator === 16) return 4;
      return 2;
    }

    function strumTypeToRaw(type = '') {
      const normalized = String(type || '');
      if (normalized === 'D' || normalized === '↓' || normalized === 'â†“') return 'D';
      if (normalized === 'U' || normalized === '↑' || normalized === 'â†‘') return 'U';
      if (normalized === 'X' || normalized === 'x') return 'X';
      return '.';
    }

    function normalizeChordNameKey(name = "") {
      return String(name || '').trim().toLowerCase();
    }

    function normalizeChordShapeKey(strings = []) {
      return strings.map(v => String(v).trim().toLowerCase()).join('|');
    }

    function toDefaultChordEntries() {
      return Object.entries(DEFAULT_CHORD_LIBRARY).map(([name, data]) => ({
        name,
        baseFret: Number(data.baseFret) || 1,
        strings: Array.isArray(data.strings) ? data.strings.map(v => (String(v).toLowerCase() === 'x' ? 'x' : Number(v) || 0)) : ['x', 0, 0, 0, 0, 0],
        fingers: Array.isArray(data.fingers) ? data.fingers.map(v => Number(v) || 0) : [0, 0, 0, 0, 0, 0]
      }));
    }

    function normalizeChordEntry(raw = {}) {
      const name = String(raw.name || '').trim();
      const strings = Array.isArray(raw.strings) && raw.strings.length === 6
        ? raw.strings.map(v => (String(v).toLowerCase() === 'x' ? 'x' : Number(v) || 0))
        : ['x', 0, 0, 0, 0, 0];
      const normalized = {
        id: raw.id || '',
        name,
        nameKey: normalizeChordNameKey(name),
        createdBy: raw.createdBy || '',
        baseFret: Math.max(1, Number(raw.baseFret) || 1),
        strings,
        fingers: Array.isArray(raw.fingers) && raw.fingers.length === 6
          ? raw.fingers.map(v => Number(v) || 0)
          : strings.map(v => (v === 'x' || v === 0 ? 0 : 1))
      };
      normalized.shapeKey = normalizeChordShapeKey(normalized.strings);
      return normalized;
    }

    function normalizeGuitarToneProfile(raw = {}) {
      const name = String(raw.name || '').trim();
      const availableMap = {};
      GUITAR_TONE_STRING_KEYS.forEach(key => {
        availableMap[key] = !!raw?.availableStrings?.[key];
      });
      return {
        id: raw.id || '',
        name: name || 'Untitled Tone',
        ownerId: raw.ownerId || '',
        createdBy: raw.createdBy || '',
        availableStrings: availableMap,
        updatedAt: Number(raw.updatedAt || 0) || 0,
        createdAt: Number(raw.createdAt || 0) || 0
      };
    }

    function refreshChordLibraryFromEntries(entries = []) {
      const next = {};
      entries.forEach(entry => {
        if (!entry.name) return;
        next[entry.name] = {
          baseFret: entry.baseFret,
          strings: entry.strings,
          fingers: entry.fingers
        };
      });
      CHORD_LIBRARY = Object.keys(next).length ? next : { ...DEFAULT_CHORD_LIBRARY };
      CHORD_EXPLORER_LIST = Object.keys(CHORD_LIBRARY).sort((a, b) => a.localeCompare(b));
      if (!CHORD_EXPLORER_LIST.includes(selectedChordReference)) {
        selectedChordReference = CHORD_EXPLORER_LIST[0] || 'C';
      }
    }

    function buildChordTagIndex(parsedLines = []) {
      const lineTagIndex = [];
      let currentTagKey = '';
      parsedLines.forEach((lineData, idx) => {
        if (lineData?.type === 'tag') {
          const match = String(lineData.lyricLine || '').match(/\[([^\]]+)\]/);
          const candidate = match ? match[1] : lineData.lyricLine;
          currentTagKey = normalizeTagKey(candidate);
        }
        lineTagIndex[idx] = currentTagKey;
      });
      return lineTagIndex;
    }

    function extractRawPatternFromEntry(entry = {}) {
      if (typeof entry?.patternText === 'string') return entry.patternText;
      if (typeof entry?.rawPattern === 'string') return entry.rawPattern;
      if (typeof entry?.pattern === 'string') return entry.pattern;
      const arr = Array.isArray(entry?.strumming) ? entry.strumming : [];
      return arr.map(s => s?.raw || strumTypeToRaw(s?.type)).join('');
    }

    function normalizeSongStrummingPatterns(song) {
      const candidateEntries = Array.isArray(song?.strummingPatterns) && song.strummingPatterns.length
        ? song.strummingPatterns
        : [{ tags: [], strumming: song?.strumming || [] }];
      return candidateEntries.map((entry, idx) => {
        const entryTimeSignature = normalizeTimeSignature(entry?.timeSignature || song?.timeSignature || '4/4');
        const beatsPerBar = getBeatsPerBarFromSignature(entryTimeSignature);
        const rawText = normalizePatternText(extractRawPatternFromEntry(entry), entryTimeSignature);
        const tags = normalizePatternTags(entry);
        return {
          id: `song-pattern-${idx}`,
          tag: tags[0]?.label || '',
          tagKey: tags[0]?.key || '',
          tags: tags.map(item => item.label),
          tagKeys: tags.map(item => item.key),
          timeSignature: entryTimeSignature,
          patternText: rawText,
          strumming: parseStrumPattern(rawText, entryTimeSignature)
        };
      }).filter(entry => entry.strumming.length > 0);
    }

    function getUniquePatternTimeSignatures(song = {}) {
      const signatures = (Array.isArray(song?.strummingPatterns) ? song.strummingPatterns : [])
        .map(entry => normalizeTimeSignature(entry?.timeSignature || song?.timeSignature || '4/4'))
        .filter(Boolean);
      return Array.from(new Set(signatures));
    }

    function getSingleSongTimeSignature(song = {}) {
      const unique = getUniquePatternTimeSignatures(song);
      return unique.length === 1 ? unique[0] : '';
    }

    function parseRawText(text, beatsPerBar = 4) {
      const lines = text.split('\n');
      const timeline = buildSongLineBeatTimeline(text, beatsPerBar);
      const lineBeat = Array.isArray(timeline?.lineBeat) ? timeline.lineBeat : [];
      let parsedLines = [];
      let flatChords = [];
      let currentTime = 0;
      let globalChordIdx = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineStartBeat = Math.max(0, Number(lineBeat[i] || currentTime || 0));
        
        if (isTagLine(line)) {
          parsedLines.push({ type: 'tag', chordHtml: "", lyricLine: stripLeadingWhitespace(line), chords: [] });
          continue;
        }

        if (isChordLine(line)) {
          currentTime = lineStartBeat;
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
            const normalizedChord = normalizeChordTokenToUs(chordStr);
            const displayChord = getDisplayChordName(normalizedChord);
            chordHtml += normalizedChordLine.substring(lastIdx, match.index);
            const safeChord = escapeHtml(normalizedChord);
            const safeDisplayChord = escapeHtml(displayChord);
            chordHtml += `<span id="chord-hl-${globalChordIdx}" data-chord="${safeChord}" onclick="openPreviewChordDiagram('${safeChord}', this)" class="transition-all duration-200 clickable-chord">${safeDisplayChord}</span>`;
            lastIdx = match.index + chordStr.length;

            const chordObj = { chord: normalizedChord, time: currentTime, lineIdx: parsedLines.length, globalIdx: globalChordIdx };
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
         const safeDisplayChord = escapeHtml(getDisplayChordName('C'));
         parsedLines = [{ type: 'content', chordHtml: `<span id="chord-hl-0" data-chord="C" onclick="openPreviewChordDiagram('C', this)" class="clickable-chord">${safeDisplayChord}</span>`, lyricLine: "Empty", chords: flatChords }];
         currentTime = beatsPerBar;
      }

      const totalBeats = Math.max(currentTime, Number(timeline?.totalBeats || 0));
      return { parsedLines, flatChords, totalBeats };
    }

    function ensureSongFormat(song) {
       if (!song.rawText && song.chords) {
           song.rawText = song.chords.map(c => `${c.chord}\n${c.lyric}`).join('\n\n');
       }
       song.youtubeUrl = typeof song.youtubeUrl === 'string' ? song.youtubeUrl : '';
       song.capo = song.capo || "No capo";
       const fallbackTimeSignature = normalizeTimeSignature(song.timeSignature || "4/4");
       song.strummingPatterns = normalizeSongStrummingPatterns(song);
       if (!song.strummingPatterns.length) {
         song.strummingPatterns = [{
           id: 'song-pattern-0',
           tag: '',
           tagKey: '',
           tags: [],
           tagKeys: [],
           timeSignature: fallbackTimeSignature,
           patternText: normalizePatternText('', fallbackTimeSignature),
           strumming: parseStrumPattern('', fallbackTimeSignature)
         }];
       }
       const uniquePatternTimes = getUniquePatternTimeSignatures(song);
       const primaryTimeSignature = song.strummingPatterns[0]?.timeSignature || fallbackTimeSignature;
       song.timeSignature = uniquePatternTimes.length === 1 ? uniquePatternTimes[0] : primaryTimeSignature;
       song.singleTimeSignature = uniquePatternTimes.length === 1 ? uniquePatternTimes[0] : '';
       const beatsPerBar = getBeatsPerBarFromSignature(song.timeSignature);
       song.strumming = song.strummingPatterns[0]?.strumming || parseStrumPattern('', song.timeSignature);
       const parsed = parseRawText(song.rawText || "C\nNew Song", beatsPerBar);
       song.parsedLines = parsed.parsedLines;
       song.chords = parsed.flatChords;
       song.chordTagIndex = buildChordTagIndex(parsed.parsedLines);
       song.totalBeats = parsed.totalBeats;
       song.stats = { views: 0, started: 0, completed: 0, ...(song.stats || {}) };
       song.createdAt = song.createdAt || Date.now();
       return song;
    }

    function ensureTrainingArticleFormat(article = {}) {
      const category = ['trainings', 'dailies', 'courses'].includes(String(article.category || '').toLowerCase())
        ? String(article.category || '').toLowerCase()
        : 'trainings';
      const articleType = String(article.articleType || 'text').toLowerCase() === 'video' ? 'video' : 'text';
      const levelRaw = String(article.level || 'beginner').trim().toLowerCase();
      const level = ['beginner', 'medium', 'advance'].includes(levelRaw) ? levelRaw : 'beginner';
      const normalizedYoutube = normalizeYouTubeUrl(article.youtubeUrl || '');
      return {
        id: article.id || '',
        category,
        title: String(article.title || 'Untitled').trim() || 'Untitled',
        imageUrl: String(article.imageUrl || '').trim(),
        level,
        articleType,
        description: String(article.description || '').trim(),
        body: articleType === 'text' ? String(article.body || '').trim() : '',
        youtubeUrl: articleType === 'video' ? normalizedYoutube : '',
        ownerId: article.ownerId || '',
        postedBy: article.postedBy || '',
        createdAt: article.createdAt || Date.now(),
        ratingSummary: article.ratingSummary || { average: 0, count: 0 }
      };
    }

    function normalizeYouTubeUrl(input = '') {
      const raw = String(input || '').trim();
      if (!raw) return '';
      try {
        const parsed = new URL(raw);
        if (!/^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i.test(parsed.hostname)) return '';
        if (parsed.hostname.includes('youtu.be')) {
          const id = parsed.pathname.split('/').filter(Boolean)[0];
          return id ? `https://www.youtube.com/watch?v=${id}` : '';
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          const id = parsed.pathname.split('/').filter(Boolean)[1];
          return id ? `https://www.youtube.com/watch?v=${id}` : '';
        }
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/watch?v=${id}` : '';
      } catch {
        return '';
      }
    }

    function getYouTubeEmbedUrl(url = '') {
      const normalized = normalizeYouTubeUrl(url);
      if (!normalized) return '';
      try {
        const id = new URL(normalized).searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : '';
      } catch {
        return '';
      }
    }

    function getYouTubeVideoId(url = '') {
      const normalized = normalizeYouTubeUrl(url);
      if (!normalized) return '';
      try {
        return new URL(normalized).searchParams.get('v') || '';
      } catch {
        return '';
      }
    }

    async function searchYouTubeFirstVideoByTitle(queryText = '') {
      const query = String(queryText || '').trim();
      if (!query) return '';
      const providers = [
        {
          url: `https://piped.video/api/v1/search?q=${encodeURIComponent(query)}&filter=videos`,
          pick: (data) => {
            const rows = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
            const first = rows.find(item => (item?.type === 'stream' || item?.type === 'video') && (item?.url || item?.id));
            const id = String(first?.id || '').trim() || String(first?.url || '').split('/').pop();
            return id ? `https://www.youtube.com/watch?v=${id}` : '';
          }
        },
        {
          url: `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
          pick: (data) => {
            const rows = Array.isArray(data) ? data : [];
            const first = rows.find(item => (item?.type === 'video' || item?.videoId) && item?.videoId);
            const id = String(first?.videoId || '').trim();
            return id ? `https://www.youtube.com/watch?v=${id}` : '';
          }
        },
        {
          url: `https://yewtu.be/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
          pick: (data) => {
            const rows = Array.isArray(data) ? data : [];
            const first = rows.find(item => (item?.type === 'video' || item?.videoId) && item?.videoId);
            const id = String(first?.videoId || '').trim();
            return id ? `https://www.youtube.com/watch?v=${id}` : '';
          }
        }
      ];
      for (const provider of providers) {
        try {
          const res = await fetch(provider.url);
          if (!res.ok) continue;
          const data = await res.json();
          const candidate = normalizeYouTubeUrl(provider.pick(data));
          if (candidate) return candidate;
        } catch {
          // Try next provider.
        }
      }
      return '';
    }

    function formatLooperTime(seconds = 0) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function formatBytes(bytes = 0) {
      const value = Math.max(0, Number(bytes) || 0);
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
      return `${value} B`;
    }

    function sanitizeLooperTitle(raw = '', fallback = 'Untitled media') {
      const cleaned = String(raw || '').trim();
      return cleaned || fallback;
    }

    function sanitizeLooperNote(raw = '') {
      return String(raw || '').slice(0, 4000);
    }

    function getLooperNoteText() {
      return sanitizeLooperNote(document.getElementById('tool-looper-note')?.value || '');
    }

    function setLooperNoteText(value = '') {
      const input = document.getElementById('tool-looper-note');
      if (!input) return;
      input.value = sanitizeLooperNote(value);
    }

    function buildUploadFingerprint(file) {
      if (!file) return '';
      const name = String(file.name || '').trim().toLowerCase();
      const size = Number(file.size || 0);
      const modified = Number(file.lastModified || 0);
      return `${name}::${size}::${modified}`;
    }

    function getDefaultLooperTitle() {
      if (looperActiveSource?.title) return sanitizeLooperTitle(looperActiveSource.title);
      if (looperMode === 'youtube') return 'YouTube Track';
      if (looperMode === 'video') return 'Uploaded Video';
      if (looperMode === 'audio') return 'Uploaded Audio';
      return 'Untitled media';
    }

    function updateLooperMaxUploadLabel() {
      const label = document.getElementById('tool-looper-max-size-label');
      if (label) label.innerText = formatBytes(LOOPER_MAX_UPLOAD_BYTES);
    }

    function getActiveLooperStatePatch() {
      return {
        duration: Number(looperDuration || getLooperDuration() || 0),
        pointA: Number(looperPointA || 0),
        pointB: Number(looperPointB || 0),
        noteText: getLooperNoteText(),
        lastPosition: 0,
        repeatEnabled: !!looperRepeatEnabled,
        abEnabled: !!looperABEnabled,
        updatedAt: Date.now()
      };
    }

    function hasActiveLooperTrack() {
      return looperMode !== 'none' && !!looperActiveSource;
    }

    function setTabsPreviewStatus(text = '', isError = false) {
      const el = document.getElementById('tool-tabs-status');
      if (!el) return;
      el.innerText = text || 'Paste tabs then tap Preview.';
      el.classList.toggle('text-danger', !!isError);
      el.classList.toggle('text-gray-500', !isError);
    }

    function sanitizeTabsPreviewTitle(raw = '') {
      const cleaned = String(raw || '').trim();
      return cleaned || 'Untitled Tabs';
    }

    function normalizeTabsPreviewTitleKey(raw = '') {
      return sanitizeTabsPreviewTitle(raw).toLowerCase();
    }

    function readTabsPreviewHistoryFromStorage() {
      try {
        const raw = localStorage.getItem(TABS_PREVIEW_HISTORY_STORAGE_KEY);
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map(entry => ({
            id: String(entry?.id || ''),
            title: sanitizeTabsPreviewTitle(entry?.title || ''),
            bpm: Math.max(40, Math.min(240, parseInt(entry?.bpm, 10) || 96)),
            timing: String(entry?.timing || '').trim(),
            text: String(entry?.text || ''),
            createdAt: Number(entry?.createdAt || Date.now()),
            updatedAt: Number(entry?.updatedAt || Date.now())
          }))
          .filter(entry => entry.id && entry.text.trim())
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .slice(0, TABS_PREVIEW_HISTORY_LIMIT);
      } catch {
        return [];
      }
    }

    function persistTabsPreviewHistory() {
      try {
        localStorage.setItem(TABS_PREVIEW_HISTORY_STORAGE_KEY, JSON.stringify(tabsPreviewHistory.slice(0, TABS_PREVIEW_HISTORY_LIMIT)));
      } catch (err) {
        console.error('Could not save tabs preview history', err);
      }
    }

    function loadTabsPreviewHistory() {
      tabsPreviewHistory = readTabsPreviewHistoryFromStorage();
    }

    function renderTabsPreviewHistory() {
      const list = document.getElementById('tool-tabs-history-list');
      if (!list) return;
      if (!tabsPreviewHistory.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-500">No tabs history yet.</div>`;
        return;
      }
      list.innerHTML = tabsPreviewHistory.map(item => `
        <div class="bg-black/30 border ${item.id === tabsPreviewActiveHistoryId ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-3 ${tabsPreviewPlayingHistoryId === item.id ? 'opacity-80' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-sm text-white truncate">${escapeHtml(item.title || 'Untitled Tabs')}</p>
              <p class="text-[11px] text-gray-500 mt-1">${item.bpm} BPM • ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Saved'}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="playTabsPreviewHistoryItem('${item.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Play">
                <i class="fas fa-play text-xs"></i>
              </button>
              <button onclick="loadTabsPreviewHistoryItem('${item.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Load">
                <i class="fas fa-arrow-up-right-from-square text-xs"></i>
              </button>
              <button onclick="deleteTabsPreviewHistoryItem('${item.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Delete">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    window.saveTabsPreviewHistoryItem = function() {
      const text = String(document.getElementById('tool-tabs-text')?.value || '');
      const bpm = Math.max(40, Math.min(240, parseInt(document.getElementById('tool-tabs-bpm')?.value || '96', 10) || 96));
      const timing = String(document.getElementById('tool-tabs-timing')?.value || '').trim();
      const titleInput = document.getElementById('tool-tabs-title');
      const title = sanitizeTabsPreviewTitle(titleInput?.value || '');
      if (!text.trim()) {
        setTabsPreviewStatus('Cannot save empty tabs text.', true);
        return;
      }
      const now = Date.now();
      const titleKey = normalizeTabsPreviewTitleKey(title);
      const byTitle = tabsPreviewHistory
        .filter(entry => normalizeTabsPreviewTitleKey(entry.title) === titleKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
      const entry = {
        id: byTitle?.id || `tabs-${now}-${Math.floor(Math.random() * 10000)}`,
        title,
        bpm,
        timing,
        text,
        createdAt: byTitle?.createdAt || now,
        updatedAt: now
      };
      if (byTitle) {
        const idx = tabsPreviewHistory.findIndex(item => item.id === byTitle.id);
        if (idx >= 0) tabsPreviewHistory[idx] = entry;
      } else {
        tabsPreviewHistory.unshift(entry);
      }
      tabsPreviewHistory = tabsPreviewHistory
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, TABS_PREVIEW_HISTORY_LIMIT);
      tabsPreviewActiveHistoryId = entry.id;
      if (titleInput) titleInput.value = entry.title;
      persistTabsPreviewHistory();
      renderTabsPreviewHistory();
      setTabsPreviewStatus(`Saved "${entry.title}".`);
    };

    window.loadTabsPreviewHistoryItem = function(itemId = '') {
      const item = tabsPreviewHistory.find(entry => entry.id === itemId);
      if (!item) return;
      tabsPreviewActiveHistoryId = item.id;
      const titleInput = document.getElementById('tool-tabs-title');
      const textInput = document.getElementById('tool-tabs-text');
      const bpmInput = document.getElementById('tool-tabs-bpm');
      const timingInput = document.getElementById('tool-tabs-timing');
      if (titleInput) titleInput.value = item.title || '';
      if (textInput) textInput.value = item.text || '';
      if (bpmInput) bpmInput.value = String(item.bpm || 96);
      if (timingInput) timingInput.value = String(item.timing || '1 & 2 & 3 & 4 &');
      renderTabsPreviewHistory();
      setTabsPreviewStatus(`Loaded "${item.title}".`);
    };

    window.deleteTabsPreviewHistoryItem = function(itemId = '') {
      const item = tabsPreviewHistory.find(entry => entry.id === itemId);
      if (!item) return;
      tabsPreviewHistory = tabsPreviewHistory.filter(entry => entry.id !== itemId);
      if (tabsPreviewActiveHistoryId === itemId) tabsPreviewActiveHistoryId = '';
      if (tabsPreviewPlayingHistoryId === itemId) tabsPreviewPlayingHistoryId = '';
      persistTabsPreviewHistory();
      renderTabsPreviewHistory();
      setTabsPreviewStatus(`Deleted "${item.title}".`);
    };

    function updateLooperNowPlayingIndicator() {
      const btn = document.getElementById('btn-looper-now-playing');
      const label = document.getElementById('looper-now-playing-label');
      if (!btn || !label) return;
      const onLooperPage = activeTab === 'tools' && activeToolPage === 'looper';
      const shouldShow = hasActiveLooperTrack() && isLooperPlaying() && !onLooperPage;
      btn.classList.toggle('hidden', !shouldShow);
      if (!shouldShow) return;
      const title = sanitizeLooperTitle(looperActiveSource?.title, 'Looper');
      label.innerText = title.length > 30 ? `${title.slice(0, 30)}...` : title;
      btn.title = `Playing now: ${title}. Open looper.`;
    }

    window.openLooperFromIndicator = function() {
      navigate('tools');
      openToolPage('looper');
    };

    async function ensureActiveLooperHistoryEntry() {
      if (activeLooperHistoryId) return activeLooperHistoryId;
      if (!user || user.isAnonymous || !repository || !hasActiveLooperTrack()) return '';
      if (looperHistoryCreatePromise) {
        try {
          return await looperHistoryCreatePromise;
        } catch {
          return '';
        }
      }

      looperHistoryCreatePromise = (async () => {
        if (looperActiveSource.sourceType === 'upload') {
          if (!looperPendingDataUrl && looperPendingUploadFile) {
            try {
              looperPendingDataUrl = await readFileAsDataUrl(looperPendingUploadFile);
            } catch (err) {
              console.error('Deferred looper encode failed', err);
              return '';
            }
          }
          const fingerprint = looperActiveSource.uploadFingerprint || buildUploadFingerprint(looperPendingUploadFile);
          if (fingerprint) {
            const duplicates = looperHistory.filter(item => item.sourceType === 'upload' && item.uploadFingerprint === fingerprint);
            for (const oldItem of duplicates) {
              try {
                await repository.deleteLooperMediaData(user.uid, oldItem.id);
                await repository.deleteLooperHistory(user.uid, oldItem.id);
              } catch (err) {
                console.error('Could not remove duplicate looper history item', err);
              }
            }
            if (duplicates.length) {
              const duplicateIds = new Set(duplicates.map(item => item.id));
              looperHistory = looperHistory.filter(item => !duplicateIds.has(item.id));
              if (activeLooperHistoryId && duplicateIds.has(activeLooperHistoryId)) activeLooperHistoryId = '';
            }
          }
        }

        const createdId = await createLooperHistoryEntry({
          title: looperActiveSource.title || getDefaultLooperTitle(),
          sourceType: looperActiveSource.sourceType || (looperMode === 'youtube' ? 'youtube' : 'upload'),
          mediaType: looperActiveSource.mediaType || (looperMode === 'video' ? 'video' : 'audio'),
          youtubeUrl: looperActiveSource.youtubeUrl || '',
          uploadFingerprint: looperActiveSource.uploadFingerprint || '',
          mediaStored: looperActiveSource.sourceType === 'upload' ? !!looperPendingDataUrl : true,
          sizeBytes: Number(looperPendingUploadFile?.size || 0),
          duration: Number(looperDuration || getLooperDuration() || 0)
        });
        if (!createdId) return '';

        if (looperActiveSource.sourceType === 'upload' && looperPendingDataUrl) {
          try {
            const chunkCount = await repository.saveLooperMediaData(user.uid, createdId, looperPendingDataUrl);
            looperActiveSource = { ...looperActiveSource, mediaStored: true };
            looperPendingUploadFile = null;
            looperPendingDataUrl = '';
            await repository.updateLooperHistory(user.uid, createdId, { mediaStored: true, mediaChunkCount: chunkCount, updatedAt: Date.now() });
          } catch (err) {
            console.error('Deferred looper Firestore save failed', err);
            return '';
          }
        }
        return createdId || '';
      })();

      try {
        return await looperHistoryCreatePromise;
      } finally {
        looperHistoryCreatePromise = null;
      }
    }

    function scheduleLooperHistorySave(delayMs = 700) {
      if (!user || user.isAnonymous || !repository || !hasActiveLooperTrack()) return;
      if (looperHistorySaveTimer) clearTimeout(looperHistorySaveTimer);
      looperHistorySaveTimer = setTimeout(() => {
        looperHistorySaveTimer = null;
        saveActiveLooperStateNow(false).catch(err => console.error('Looper state auto-save failed', err));
      }, delayMs);
    }

    async function upsertActiveLooperHistoryState(forceReload = false) {
      if (!activeLooperHistoryId || !user || !repository) return;
      const patch = getActiveLooperStatePatch();
      try {
        await repository.updateLooperHistory(user.uid, activeLooperHistoryId, patch);
        const idx = looperHistory.findIndex(item => item.id === activeLooperHistoryId);
        if (idx >= 0) looperHistory[idx] = { ...looperHistory[idx], ...patch };
        looperHistory.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        renderLooperHistory();
        if (forceReload) await loadLooperHistory();
      } catch (e) {
        console.error('Update looper history failed', e);
      }
    }

    async function createLooperHistoryEntry(payload = {}) {
      if (!user || !repository) return '';
      try {
        const createdAt = Date.now();
        const item = {
          title: sanitizeLooperTitle(payload.title, getDefaultLooperTitle()),
          sourceType: payload.sourceType || 'upload',
          mediaType: payload.mediaType || 'audio',
          youtubeUrl: payload.youtubeUrl || '',
          uploadFingerprint: String(payload.uploadFingerprint || ''),
          mediaStored: payload.mediaStored !== false,
          mediaChunkCount: Number(payload.mediaChunkCount || 0),
          sizeBytes: payload.sizeBytes || 0,
          duration: Number(payload.duration || 0),
          noteText: sanitizeLooperNote(payload.noteText || getLooperNoteText()),
          pointA: 0,
          pointB: Number(payload.duration || 0),
          lastPosition: 0,
          repeatEnabled: false,
          abEnabled: false,
          createdAt,
          updatedAt: createdAt
        };
        const id = await repository.addLooperHistory(user.uid, item);
        activeLooperHistoryId = id;
        looperHistory.unshift({ id, ...item });
        renderLooperHistory();
        return id;
      } catch (e) {
        console.error('Create looper history failed', e);
        return '';
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('Missing file'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Read failed'));
        reader.readAsDataURL(file);
      });
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        if (!blob) {
          reject(new Error('Missing blob'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
        reader.readAsDataURL(blob);
      });
    }

    async function fetchAudioUrlAsDataUrl(url) {
      const target = String(url || '').trim();
      if (!target) throw new Error('Missing URL');
      const response = await fetch(target, { mode: 'cors' });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      if (!blob || !blob.size) throw new Error('Empty file');
      if (blob.size > GUITAR_TONE_MAX_UPLOAD_BYTES) {
        throw new Error(`File too large (max ${formatBytes(GUITAR_TONE_MAX_UPLOAD_BYTES)})`);
      }
      return blobToDataUrl(blob);
    }

    function getLooperAudioEl() {
      return document.getElementById('tool-looper-audio');
    }

    function getLooperVideoEl() {
      return document.getElementById('tool-looper-video');
    }

    function getActiveLooperMediaElement() {
      if (looperMode === 'audio') return getLooperAudioEl();
      if (looperMode === 'video') return getLooperVideoEl();
      return null;
    }

    function hideAllLooperPlayers() {
      document.getElementById('tool-looper-audio')?.classList.add('hidden');
      document.getElementById('tool-looper-video')?.classList.add('hidden');
      document.getElementById('tool-looper-youtube-wrap')?.classList.add('hidden');
      document.getElementById('tool-looper-empty')?.classList.add('hidden');
    }

    function resetLooperObjectUrl() {
      if (!looperObjectUrl) return;
      try { URL.revokeObjectURL(looperObjectUrl); } catch {}
      looperObjectUrl = '';
    }

    function stopLooperSyncTimer() {
      if (looperSyncTimer) {
        clearInterval(looperSyncTimer);
        looperSyncTimer = null;
      }
      if (looperHistorySaveTimer) {
        clearTimeout(looperHistorySaveTimer);
        looperHistorySaveTimer = null;
      }
    }

    function getLooperCurrentTime() {
      if (looperMode === 'youtube' && looperYoutubePlayer?.getCurrentTime) {
        const value = Number(looperYoutubePlayer.getCurrentTime());
        return Number.isFinite(value) ? value : 0;
      }
      const media = getActiveLooperMediaElement();
      const value = Number(media?.currentTime || 0);
      return Number.isFinite(value) ? value : 0;
    }

    function getLooperDuration() {
      if (looperMode === 'youtube' && looperYoutubePlayer?.getDuration) {
        const value = Number(looperYoutubePlayer.getDuration());
        return Number.isFinite(value) ? value : 0;
      }
      const media = getActiveLooperMediaElement();
      const value = Number(media?.duration || 0);
      return Number.isFinite(value) ? value : 0;
    }

    function isLooperPlaying() {
      if (looperMode === 'youtube' && looperYoutubePlayer?.getPlayerState && window.YT?.PlayerState) {
        return looperYoutubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING;
      }
      const media = getActiveLooperMediaElement();
      return !!(media && !media.paused && !media.ended);
    }

    function seekLooperTo(seconds = 0) {
      const target = Math.max(0, Number(seconds) || 0);
      if (looperMode === 'youtube' && looperYoutubePlayer?.seekTo) {
        looperYoutubePlayer.seekTo(target, true);
        return;
      }
      const media = getActiveLooperMediaElement();
      if (media) media.currentTime = target;
    }

    function playLooperInternal() {
      if (looperMode === 'youtube' && looperYoutubePlayer?.playVideo) {
        looperYoutubePlayer.playVideo();
        return;
      }
      const media = getActiveLooperMediaElement();
      if (media) media.play().catch(() => {});
    }

    function pauseLooperInternal() {
      if (looperMode === 'youtube' && looperYoutubePlayer?.pauseVideo) {
        looperYoutubePlayer.pauseVideo();
        return;
      }
      const media = getActiveLooperMediaElement();
      if (media) media.pause();
    }

    function enforceLooperBounds() {
      const duration = looperDuration || getLooperDuration();
      if (!duration || duration <= 0) return;
      const now = getLooperCurrentTime();
      if (looperABEnabled) {
        const a = Math.max(0, Math.min(looperPointA, duration));
        const b = Math.max(a + 0.2, Math.min(looperPointB || duration, duration));
        const playing = isLooperPlaying();
        if (now < a - 0.08 || now >= b - 0.02) {
          seekLooperTo(a);
          if (playing && now >= b - 0.02) playLooperInternal();
        }
      }
    }

    function syncLooperTimeUi() {
      const duration = Math.max(0, looperDuration || getLooperDuration());
      const current = Math.max(0, getLooperCurrentTime());
      const safeCurrent = duration > 0 ? Math.min(current, duration) : current;
      const seek = document.getElementById('tool-looper-seek');
      const currentLabel = document.getElementById('tool-looper-time-current');
      const durationLabel = document.getElementById('tool-looper-time-duration');
      if (seek) {
        seek.max = String(duration > 0 ? duration : 100);
        seek.value = String(duration > 0 ? safeCurrent : 0);
      }
      if (currentLabel) currentLabel.innerText = formatLooperTime(safeCurrent);
      if (durationLabel) durationLabel.innerText = formatLooperTime(duration);
    }

    function syncLooperBoundaryUi() {
      const duration = Math.max(0, looperDuration || getLooperDuration());
      const maxValue = duration > 0 ? duration : 0;
      looperPointA = Math.max(0, Math.min(looperPointA, maxValue));
      const fallbackB = maxValue || 0;
      const rawB = looperPointB > 0 ? looperPointB : fallbackB;
      looperPointB = Math.max(looperPointA + (maxValue > 0 ? 0.2 : 0), Math.min(rawB, maxValue || rawB));
      if (duration > 0 && looperPointB > duration) looperPointB = duration;
      const aSlider = document.getElementById('tool-looper-ab-range-a');
      const bSlider = document.getElementById('tool-looper-ab-range-b');
      const aLabel = document.getElementById('tool-looper-a-label');
      const bLabel = document.getElementById('tool-looper-b-label');
      const fill = document.getElementById('tool-looper-ab-fill');
      if (aSlider) {
        aSlider.max = String(maxValue);
        aSlider.value = String(Math.min(looperPointA, maxValue));
      }
      if (bSlider) {
        bSlider.max = String(maxValue);
        bSlider.value = String(Math.min(Math.max(looperPointB, looperPointA), maxValue));
      }
      if (fill) {
        const safeMax = maxValue > 0 ? maxValue : 1;
        const leftPct = Math.max(0, Math.min(100, (looperPointA / safeMax) * 100));
        const rightPct = Math.max(0, Math.min(100, 100 - ((looperPointB / safeMax) * 100)));
        fill.style.left = `${leftPct}%`;
        fill.style.right = `${rightPct}%`;
      }
      if (aLabel) aLabel.innerText = `A ${formatLooperTime(looperPointA)}`;
      if (bLabel) bLabel.innerText = `B ${formatLooperTime(looperPointB)}`;
    }

    function renderLooperModeButtons() {
      const fullBtn = document.getElementById('tool-looper-mode-full');
      const abBtn = document.getElementById('tool-looper-mode-ab');
      if (fullBtn) fullBtn.classList.toggle('active', !!looperRepeatEnabled);
      if (abBtn) abBtn.classList.toggle('active', !!looperABEnabled);
    }

    function setLooperLoopMode(mode = 'none') {
      if (mode === 'full') {
        const next = !looperRepeatEnabled;
        looperRepeatEnabled = next;
        looperABEnabled = false;
      } else if (mode === 'ab') {
        const next = !looperABEnabled;
        looperABEnabled = next;
        looperRepeatEnabled = false;
        if (looperABEnabled && looperPointB <= looperPointA) {
          const duration = looperDuration || getLooperDuration();
          looperPointB = duration || (looperPointA + 0.5);
        }
      } else {
        looperRepeatEnabled = false;
        looperABEnabled = false;
      }
      enforceLooperBounds();
      refreshLooperUi();
      scheduleLooperHistorySave();
    }

    function renderLooperBackgroundOption() {
      const checkbox = document.getElementById('tool-looper-app-bg');
      if (!checkbox) return;
      checkbox.checked = !!looperAppBackgroundEnabled;
    }

    window.toggleLooperAppBackground = function(value) {
      looperAppBackgroundEnabled = !!value;
      renderLooperBackgroundOption();
      showToast(looperAppBackgroundEnabled ? 'Looper background in-app playback enabled.' : 'Looper will stop when leaving looper page.', true);
    };

    function refreshLooperUi() {
      if (looperRepeatEnabled && looperABEnabled) looperRepeatEnabled = false;
      syncLooperTimeUi();
      syncLooperBoundaryUi();
      renderLooperModeButtons();
      renderLooperBackgroundOption();
      enforceLooperBounds();
      updateLooperNowPlayingIndicator();
    }

    function startLooperSyncTimer() {
      stopLooperSyncTimer();
      looperSyncTimer = setInterval(() => {
        refreshLooperUi();
        if (activeLooperHistoryId && isLooperPlaying()) scheduleLooperHistorySave(1200);
      }, 120);
      refreshLooperUi();
    }

    function destroyLooperYoutubePlayer() {
      if (!looperYoutubePlayer) return;
      try { looperYoutubePlayer.destroy(); } catch {}
      looperYoutubePlayer = null;
      const holder = document.getElementById('tool-looper-youtube-player');
      if (holder) holder.innerHTML = '';
    }

    function stopLooperPlayback() {
      if (activeLooperHistoryId) saveActiveLooperStateNow(false).catch(() => {});
      pauseLooperInternal();
      const audio = getLooperAudioEl();
      const video = getLooperVideoEl();
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      destroyLooperYoutubePlayer();
      stopLooperSyncTimer();
      resetLooperObjectUrl();
      looperMode = 'none';
      looperDuration = 0;
      looperPointA = 0;
      looperPointB = 0;
      looperActiveSource = null;
      setLooperNoteText('');
      hideAllLooperPlayers();
      document.getElementById('tool-looper-empty')?.classList.remove('hidden');
      refreshLooperUi();
      updateLooperNowPlayingIndicator();
    }

    function activateLooperMode(mode = 'none') {
      looperMode = mode;
      hideAllLooperPlayers();
      if (mode === 'audio') document.getElementById('tool-looper-audio')?.classList.remove('hidden');
      else if (mode === 'video') document.getElementById('tool-looper-video')?.classList.remove('hidden');
      else if (mode === 'youtube') document.getElementById('tool-looper-youtube-wrap')?.classList.remove('hidden');
      else document.getElementById('tool-looper-empty')?.classList.remove('hidden');
    }

    function handleLooperMediaLoaded() {
      looperDuration = Math.max(0, getLooperDuration());
      if (!Number.isFinite(looperPointA)) looperPointA = 0;
      if (!Number.isFinite(looperPointB) || looperPointB <= 0) looperPointB = looperDuration;
      refreshLooperUi();
      startLooperSyncTimer();
      scheduleLooperHistorySave(120);
    }

    function handleLooperMediaEnded() {
      if (looperABEnabled) {
        seekLooperTo(looperPointA);
        playLooperInternal();
        return;
      }
      if (looperRepeatEnabled) {
        seekLooperTo(0);
        playLooperInternal();
      }
    }

    async function ensureYouTubeIframeApi() {
      if (window.YT?.Player) return;
      if (window.__gtYouTubeApiPromise) {
        await window.__gtYouTubeApiPromise;
        return;
      }
      window.__gtYouTubeApiPromise = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          try { if (typeof prev === 'function') prev(); } catch {}
          resolve();
        };
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('YouTube API load failed'));
        document.head.appendChild(script);
      });
      await window.__gtYouTubeApiPromise;
    }

    async function loadLooperYouTubeByUrl(url = '', options = {}) {
      const { fromHistoryEntry = null } = options || {};
      const videoId = getYouTubeVideoId(url);
      if (!videoId) {
        showToast('Enter a valid YouTube link.');
        return;
      }
      resetLooperObjectUrl();
      const audio = getLooperAudioEl();
      const video = getLooperVideoEl();
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      try {
        await ensureYouTubeIframeApi();
        destroyLooperYoutubePlayer();
        activateLooperMode('youtube');
        const sourceTitle = fromHistoryEntry?.title || `YouTube • ${videoId}`;
        looperActiveSource = {
          sourceType: 'youtube',
          mediaType: 'video',
          youtubeUrl: normalizeYouTubeUrl(url),
          title: sourceTitle
        };
        looperPendingUploadFile = null;
        looperPendingDataUrl = '';
        if (!fromHistoryEntry) activeLooperHistoryId = '';
        setLooperNoteText(fromHistoryEntry?.noteText || '');
        looperDuration = Number(fromHistoryEntry?.duration || 0) || 0;
        looperPointA = Number(fromHistoryEntry?.pointA || 0) || 0;
        looperPointB = Number(fromHistoryEntry?.pointB || 0) || 0;
        looperRepeatEnabled = !!fromHistoryEntry?.repeatEnabled;
        looperABEnabled = !!fromHistoryEntry?.abEnabled;
        looperYoutubePlayer = new window.YT.Player('tool-looper-youtube-player', {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: async () => {
              looperDuration = Math.max(0, getLooperDuration());
              if (!looperPointB || looperPointB <= 0) looperPointB = looperDuration;
              const startAt = looperABEnabled ? looperPointA : 0;
              if (startAt > 0) seekLooperTo(startAt);
              if (!fromHistoryEntry) {
                activeLooperHistoryId = await createLooperHistoryEntry({
                  title: sourceTitle,
                  sourceType: 'youtube',
                  mediaType: 'video',
                  youtubeUrl: normalizeYouTubeUrl(url),
                  noteText: getLooperNoteText(),
                  duration: looperDuration
                });
              } else {
                activeLooperHistoryId = fromHistoryEntry.id || '';
                scheduleLooperHistorySave(120);
              }
              refreshLooperUi();
              startLooperSyncTimer();
            },
            onStateChange: (event) => {
              if (window.YT?.PlayerState && event.data === window.YT.PlayerState.ENDED) handleLooperMediaEnded();
              if (window.YT?.PlayerState && event.data === window.YT.PlayerState.PAUSED) scheduleLooperHistorySave(120);
            }
          }
        });
      } catch (err) {
        console.error(err);
        showToast('Could not load YouTube player.');
      }
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
            updateUserHeaderState();
            refreshLibraryAdminButtons();
            closeAuthModal();
            
            const addBtn = document.getElementById('btn-add-song');
            if(isGuest) addBtn.classList.add('hidden');
            else addBtn.classList.remove('hidden');

            await loadUserSettings();
            await loadSongs();
            await loadTrainingArticles();
            await loadChordLibraryData();
            await loadGuitarToneProfiles();
            await loadToolRecordings();
            await loadLooperHistory();
            renderToolRecordings();
            renderLooperHistory();
            renderChordExplorer();
            renderToolSongsSearch();
            renderProfileSummary();
            refreshLibraryAdminButtons();
            showToolsHome({ skipUrl: true });
            await applyRouteFromLocation({ replaceUnknown: true });
            showLoading(false);
          } else {
            user = null;
            updateUserHeaderState();
            refreshLibraryAdminButtons();
            looperHistory = [];
            renderLooperHistory();
            try {
              await signInAnonymously(auth);
            } catch (e) {
              console.error('Guest sign-in failed', e);
              showToast("Failed to start guest session.");
              showLoading(false);
            }
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

    async function loadTrainingArticles() {
      if (!repository) return;
      try {
        if (user && !user.isAnonymous) {
          await repository.seedTrainingArticles(DEFAULT_TRAINING_ARTICLES.map(entry => ({
            ...entry,
            ownerId: entry.ownerId || user.uid,
            postedBy: entry.postedBy || (user.email ? user.email.split('@')[0] : 'trainer')
          })));
        }
        const raw = await repository.loadTrainingArticles();
        trainingArticles = raw.length
          ? raw.map(ensureTrainingArticleFormat)
          : DEFAULT_TRAINING_ARTICLES.map((entry, idx) => ensureTrainingArticleFormat({ id: `fallback-${idx}`, ...entry }));
      } catch (e) {
        console.error('Failed to load training articles', e);
        trainingArticles = DEFAULT_TRAINING_ARTICLES.map((entry, idx) => ensureTrainingArticleFormat({ id: `local-${idx}`, ...entry }));
      }
      renderTrainingArticleLists();
      refreshTrainingAddButtons();
      renderHomeDashboard();
      renderProfileSummary();
    }

    async function loadChordLibraryData() {
      try {
        const seedDefaults = isLibraryAdmin() ? toDefaultChordEntries() : [];
        const raw = await repository.loadChords(seedDefaults);
        chordEntries = raw.map(normalizeChordEntry).filter(entry => entry.name && entry.nameKey);
        refreshChordLibraryFromEntries(chordEntries);
      } catch (e) {
        console.error("Failed to load chord library", e);
        chordEntries = toDefaultChordEntries().map(normalizeChordEntry);
        refreshChordLibraryFromEntries(chordEntries);
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

    async function loadLooperHistory() {
      if (!user) {
        looperHistory = [];
        return;
      }
      try {
        looperHistory = await repository.loadLooperHistory(user.uid);
      } catch (e) {
        console.error("Failed to load looper history", e);
        looperHistory = [];
      }
    }

    function getLooperHistoryTypeLabel(item = {}) {
      if (item.sourceType === 'youtube') return 'YouTube';
      if (item.mediaType === 'video') return 'Video';
      return 'Audio';
    }

    function renderLooperHistory() {
      const list = document.getElementById('tool-looper-history-list');
      if (!list) return;
      if (!looperHistory.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-500">No looper history yet.</div>`;
        return;
      }
      list.innerHTML = looperHistory.map(item => `
        <div class="bg-black/30 border ${item.id === activeLooperHistoryId ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-3 ${(looperDeletingHistoryId === item.id || looperOpeningHistoryId === item.id) ? 'opacity-70' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-sm text-white truncate">${escapeHtml(item.title || 'Untitled media')}</p>
              <p class="text-[11px] text-gray-500 mt-1">${getLooperHistoryTypeLabel(item)} • ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Saved'}</p>
              <p class="text-[11px] text-gray-500 mt-1">A ${formatLooperTime(item.pointA || 0)} | B ${formatLooperTime(item.pointB || 0)}</p>
              ${item.noteText ? `<p class="text-[11px] text-gray-400 mt-1">${escapeHtml(String(item.noteText || '').replace(/\s+/g, ' ').trim())}</p>` : ''}
              ${looperDeletingHistoryId === item.id ? `<p class="text-[11px] text-primary mt-1"><i class="fas fa-spinner fa-spin mr-1"></i>Deleting...</p>` : ''}
              ${looperOpeningHistoryId === item.id ? `
                <p class="text-[11px] text-primary mt-1"><i class="fas fa-spinner fa-spin mr-1"></i>Loading... ${Math.max(0, Math.min(100, Math.round(looperOpeningProgress)))}%</p>
                <div class="mt-1.5 h-1.5 rounded-full bg-gray-800 overflow-hidden"><div class="h-full bg-primary transition-all duration-150" style="width:${Math.max(0, Math.min(100, looperOpeningProgress))}%"></div></div>
              ` : ''}
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="openLooperHistoryItem('${item.id}')" class="w-8 h-8 rounded-full btn-soft btn-press ${(looperDeletingHistoryId === item.id || looperOpeningHistoryId === item.id) ? 'opacity-50 pointer-events-none' : ''}" title="Open">
                <i class="fas fa-play text-xs"></i>
              </button>
              <button onclick="deleteLooperHistoryItem('${item.id}')" class="w-8 h-8 rounded-full btn-soft btn-press ${(looperDeletingHistoryId === item.id || looperOpeningHistoryId === item.id) ? 'opacity-50 pointer-events-none' : ''}" title="Delete">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');
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
      if (current) current.innerText = getDisplayChordName(selectedChordReference);
      grid.innerHTML = CHORD_EXPLORER_LIST.map(chord => `
        <button onclick="selectChordReference('${chord}')" class="rounded-2xl p-3 btn-press ${selectedChordReference === chord ? 'border border-primary bg-primary/10' : 'btn-soft'}">
          ${renderChordDiagramSvg(chord)}
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

    function getSelectedChordEntry() {
      const key = normalizeChordNameKey(selectedChordReference);
      return chordEntries.find(entry => entry.nameKey === key) || null;
    }

    window.loadSelectedChordToBuilder = async function() {
      const entry = getSelectedChordEntry();
      if (!entry) {
        showToast('Select a chord first.');
        return;
      }
      chordBuilderEditingId = entry.id || '';
      const nameEl = document.getElementById('tool-chord-name');
      if (nameEl) nameEl.value = entry.name || '';
      const values = entry.strings || ['x', 'x', 'x', 'x', 'x', 'x'];
      ['tool-chord-string-e6', 'tool-chord-string-a', 'tool-chord-string-d', 'tool-chord-string-g', 'tool-chord-string-b', 'tool-chord-string-e1'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) el.value = String(values[idx]);
      });
      updateChordBuilderPreview();
      openToolPage('chord-builder');
      showToast(`Loaded ${entry.name} for editing.`, true);
    };

    function getChordBuilderStrings() {
      const ids = ['tool-chord-string-e6', 'tool-chord-string-a', 'tool-chord-string-d', 'tool-chord-string-g', 'tool-chord-string-b', 'tool-chord-string-e1'];
      return ids.map(id => {
        const value = document.getElementById(id)?.value || 'x';
        return value === 'x' ? 'x' : Number(value);
      });
    }

    function updateChordBuilderPreview() {
      const name = (document.getElementById('tool-chord-name')?.value || '').trim() || 'Preview';
      const strings = getChordBuilderStrings();
      const temp = { name, strings, fingers: strings.map(v => (v === 'x' || v === 0 ? 0 : 1)) };
      const minFret = strings.filter(v => typeof v === 'number' && v > 0).reduce((min, v) => Math.min(min, v), Infinity);
      temp.baseFret = Number.isFinite(minFret) ? Math.max(1, minFret) : 1;
      const wrap = document.getElementById('tool-chord-preview');
      if (wrap) {
        wrap.innerHTML = renderChordDiagramSvg(temp.name, true, temp);
      }
      return temp;
    }

    function resetChordBuilder() {
      chordBuilderEditingId = '';
      const nameEl = document.getElementById('tool-chord-name');
      if (nameEl) nameEl.value = '';
      ['tool-chord-string-e6', 'tool-chord-string-a', 'tool-chord-string-d', 'tool-chord-string-g', 'tool-chord-string-b', 'tool-chord-string-e1'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'x';
      });
      updateChordBuilderPreview();
    }

    window.updateChordBuilderPreview = updateChordBuilderPreview;

    window.saveChordToLibrary = async function() {
      if (!user || user.isAnonymous) {
        showToast("Create an account to add chords.");
        return;
      }
      if (!isLibraryAdmin()) {
        showToast("Only the library owner can add or edit chords.");
        return;
      }
      const name = (document.getElementById('tool-chord-name')?.value || '').trim();
      if (!name) {
        showToast("Please enter a chord name.");
        return;
      }
      const strings = getChordBuilderStrings();
      const hasFrettedNote = strings.some(v => typeof v === 'number' && v > 0);
      if (!hasFrettedNote) {
        showToast("Select at least one fretted string position.");
        return;
      }
      await loadChordLibraryData();
      const nameKey = normalizeChordNameKey(name);
      const shapeKey = normalizeChordShapeKey(strings);
      const duplicateByName = chordEntries.find(entry => entry.nameKey === nameKey);
      const duplicateByShape = chordEntries.find(entry => entry.shapeKey === shapeKey);
      const isEditingExisting = !!chordBuilderEditingId;
      const editingEntry = isEditingExisting ? chordEntries.find(entry => entry.id === chordBuilderEditingId) : null;
      const duplicateByNameIsOther = duplicateByName && duplicateByName.id !== chordBuilderEditingId;
      const duplicateByShapeIsOther = duplicateByShape && duplicateByShape.id !== chordBuilderEditingId;
      if (duplicateByNameIsOther && duplicateByShapeIsOther) {
        showToast(`Already exists: name "${duplicateByName.name}" and shape match.`);
        return;
      }
      if (duplicateByNameIsOther) {
        showToast(`Chord name "${duplicateByName.name}" already exists.`);
        return;
      }
      if (duplicateByShapeIsOther) {
        showToast(`Chord shape already exists as "${duplicateByShape.name}".`);
        return;
      }
      const targetEntry = editingEntry || duplicateByName || null;
      if (targetEntry?.createdBy && targetEntry.createdBy !== user.uid && !isLibraryAdmin()) {
        showToast("You can only edit chords you created.");
        return;
      }
      const minFret = strings.filter(v => typeof v === 'number' && v > 0).reduce((min, v) => Math.min(min, v), Infinity);
      const baseFret = Number.isFinite(minFret) ? Math.max(1, minFret) : 1;
      const chordPayload = {
        name,
        baseFret,
        strings,
        fingers: strings.map(v => (v === 'x' || v === 0 ? 0 : 1)),
        createdAt: targetEntry?.createdAt || Date.now(),
        createdBy: targetEntry?.createdBy || user.uid
      };
      try {
        await repository.saveChord(chordPayload, targetEntry?.id || null);
        await loadChordLibraryData();
        renderChordExplorer();
        resetChordBuilder();
        showToast(targetEntry ? "Chord updated." : "Chord added to library.", true);
      } catch (e) {
        console.error("Save chord failed", e);
        showToast("Could not save chord.");
      }
    };

    function getToneStringInputId(stringKey) {
      return `tool-guitar-tone-file-${stringKey.toLowerCase()}`;
    }

    function setGuitarToneEditorOpen(open = false) {
      guitarToneEditorOpen = !!open;
      const panel = document.getElementById('tool-guitar-tone-editor');
      const addBtn = document.getElementById('btn-guitar-tone-add');
      if (panel) panel.classList.toggle('hidden', !guitarToneEditorOpen);
      if (addBtn) {
        addBtn.innerHTML = guitarToneEditorOpen
          ? '<i class="fas fa-times mr-2"></i>Close'
          : '<i class="fas fa-plus mr-2"></i>Add';
      }
    }

    window.toggleGuitarToneEditor = function() {
      if (guitarToneEditorOpen) {
        resetGuitarToneEditor();
        setGuitarToneEditorOpen(false);
      } else {
        resetGuitarToneEditor();
        setGuitarToneEditorOpen(true);
      }
    };

    function getToneSampleCacheKey(toneId, stringKey) {
      return `${toneId}::${stringKey}`;
    }

    function resetGuitarToneEditor() {
      guitarToneEditingId = '';
      guitarTonePendingSamples = {};
      guitarToneUseUrls = false;
      const nameInput = document.getElementById('tool-guitar-tone-name');
      if (nameInput) nameInput.value = '';
      GUITAR_TONE_STRING_KEYS.forEach(stringKey => {
        const input = document.getElementById(getToneStringInputId(stringKey));
        if (input) input.value = '';
        const urlInput = document.getElementById(`tool-guitar-tone-url-${stringKey.toLowerCase()}`);
        if (urlInput) urlInput.value = '';
      });
      const modeCheckbox = document.getElementById('tool-guitar-tone-use-urls');
      if (modeCheckbox) modeCheckbox.checked = false;
      updateGuitarToneInputModeUi();
      renderGuitarToneEditorStatus();
    }

    function updateGuitarToneInputModeUi() {
      const uploadWrap = document.getElementById('tool-guitar-tone-upload-wrap');
      const urlWrap = document.getElementById('tool-guitar-tone-url-wrap');
      if (uploadWrap) uploadWrap.classList.toggle('hidden', guitarToneUseUrls);
      if (urlWrap) urlWrap.classList.toggle('hidden', !guitarToneUseUrls);
    }

    window.toggleGuitarToneUseUrls = function(value) {
      guitarToneUseUrls = !!value;
      updateGuitarToneInputModeUi();
      renderGuitarToneEditorStatus();
    };

    function renderGuitarToneEditorStatus() {
      const label = document.getElementById('tool-guitar-tone-editor-status');
      if (!label) return;
      const pendingKeys = Object.keys(guitarTonePendingSamples);
      if (!pendingKeys.length) {
        const base = guitarToneUseUrls
          ? 'Use direct file URLs for the strings you want to set or replace.'
          : 'Upload files for the strings you want to set or replace.';
        label.innerText = guitarToneEditingId ? `Editing existing tone. ${base}` : `New tone. ${base}`;
        return;
      }
      label.innerText = `Ready: ${pendingKeys.join(', ')} sample${pendingKeys.length > 1 ? 's' : ''} selected.`;
    }

    window.handleGuitarToneFileSelected = async function(stringKey, event) {
      const key = String(stringKey || '').toUpperCase();
      if (!GUITAR_TONE_STRING_KEYS.includes(key)) return;
      const file = event?.target?.files?.[0];
      if (!file) {
        delete guitarTonePendingSamples[key];
        renderGuitarToneEditorStatus();
        return;
      }
      if (file.size > GUITAR_TONE_MAX_UPLOAD_BYTES) {
        showToast(`${key} sample too large. Max ${formatBytes(GUITAR_TONE_MAX_UPLOAD_BYTES)}.`);
        event.target.value = '';
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        guitarTonePendingSamples[key] = {
          dataUrl,
          name: String(file.name || '').trim(),
          size: Number(file.size || 0)
        };
        renderGuitarToneEditorStatus();
      } catch (err) {
        console.error('Read guitar tone sample failed', err);
        showToast(`Could not read ${key} sample.`);
      }
    };

    async function loadGuitarToneProfiles() {
      try {
        const raw = await repository.loadGuitarTones();
        guitarToneProfiles = raw.map(normalizeGuitarToneProfile);
      } catch (e) {
        console.error('Failed to load guitar tones', e);
        guitarToneProfiles = [];
      }
      const activeId = String(userSettings?.activeGuitarToneId || '').trim();
      if (activeId && activeId !== '__synth__' && !guitarToneProfiles.some(item => item.id === activeId)) {
        userSettings = { ...userSettings, activeGuitarToneId: '' };
      }
      renderGuitarToneSettingsOptions();
      renderGuitarToneProfilesList();
    }

    function clearGuitarToneCacheForProfile(profileId) {
      const prefix = `${profileId}::`;
      for (const key of [...guitarToneSampleLoadPromises.keys()]) {
        if (key.startsWith(prefix)) guitarToneSampleLoadPromises.delete(key);
      }
    }

    window.loadGuitarToneToEditor = function(profileId) {
      const profile = guitarToneProfiles.find(item => item.id === profileId);
      if (!profile) return;
      guitarToneEditingId = profile.id;
      guitarTonePendingSamples = {};
       guitarToneUseUrls = false;
      const nameInput = document.getElementById('tool-guitar-tone-name');
      if (nameInput) nameInput.value = profile.name || '';
      GUITAR_TONE_STRING_KEYS.forEach(stringKey => {
        const input = document.getElementById(getToneStringInputId(stringKey));
        if (input) input.value = '';
        const urlInput = document.getElementById(`tool-guitar-tone-url-${stringKey.toLowerCase()}`);
        if (urlInput) urlInput.value = '';
      });
      const modeCheckbox = document.getElementById('tool-guitar-tone-use-urls');
      if (modeCheckbox) modeCheckbox.checked = false;
      updateGuitarToneInputModeUi();
      renderGuitarToneEditorStatus();
      setGuitarToneEditorOpen(true);
      showToast(`Loaded "${profile.name}" for editing.`, true);
    };

    window.selectGuitarToneProfile = async function(profileId) {
      userSettings = { ...userSettings, activeGuitarToneId: profileId || '' };
      renderGuitarToneSettingsOptions();
      renderGuitarToneProfilesList();
      if (!user || user.isAnonymous) {
        showToast('Sign in to save selected guitar tone.');
        return;
      }
      try {
        await repository.saveUserSettings(user.uid, { activeGuitarToneId: userSettings.activeGuitarToneId || '' });
        showToast('Guitar tone selected.', true);
      } catch (e) {
        console.error('Select guitar tone failed', e);
        showToast('Could not save guitar tone selection.');
      }
    };

    window.deleteGuitarToneProfile = async function(profileId) {
      if (!user || user.isAnonymous) {
        showToast('Sign in to delete guitar tones.');
        return;
      }
      const profile = guitarToneProfiles.find(item => item.id === profileId);
      if (!profile) return;
      if (profile.ownerId && profile.ownerId !== user.uid && !isLibraryAdmin()) {
        showToast('You can only delete tones you created.');
        return;
      }
      try {
        await repository.deleteGuitarTone(profile.id);
        clearGuitarToneCacheForProfile(profile.id);
        if (userSettings.activeGuitarToneId === profile.id) {
          userSettings = { ...userSettings, activeGuitarToneId: '' };
          await repository.saveUserSettings(user.uid, { activeGuitarToneId: '' });
        }
        await loadGuitarToneProfiles();
        showToast('Guitar tone deleted.', true);
      } catch (e) {
        console.error('Delete guitar tone failed', e);
        showToast('Could not delete guitar tone.');
      }
    };

    function renderGuitarToneProfilesList() {
      const list = document.getElementById('tool-guitar-tones-list');
      if (!list) return;
      if (!guitarToneProfiles.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-500">No guitar tones yet.</div>`;
        return;
      }
      const activeId = String(userSettings?.activeGuitarToneId || '');
      const effectiveProfileId = getActiveGuitarToneProfile()?.id || '';
      list.innerHTML = guitarToneProfiles.map(profile => {
        const available = GUITAR_TONE_STRING_KEYS.filter(key => profile.availableStrings?.[key]);
        const active = profile.id === effectiveProfileId || (profile.id === activeId && activeId !== '');
        const mine = !!user && profile.ownerId === user.uid;
        return `
          <div class="bg-black/30 border ${active ? 'border-primary/60' : 'border-gray-800'} rounded-xl px-3 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold text-sm text-white truncate">${escapeHtml(profile.name)}</p>
                <p class="text-[11px] text-gray-500 mt-1">${available.length}/6 strings available${active ? ' • Active' : ''}</p>
                <p class="text-[11px] text-gray-500 mt-1">${available.join(', ') || 'No samples'}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button onclick="selectGuitarToneProfile('${profile.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Use this tone"><i class="fas fa-check text-xs"></i></button>
                <button onclick="loadGuitarToneToEditor('${profile.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="View"><i class="fas fa-eye text-xs"></i></button>
                ${mine ? `<button onclick="loadGuitarToneToEditor('${profile.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Edit"><i class="fas fa-pen text-xs"></i></button>` : ''}
                ${mine ? `<button onclick="deleteGuitarToneProfile('${profile.id}')" class="w-8 h-8 rounded-full btn-soft btn-press" title="Delete"><i class="fas fa-trash text-xs"></i></button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    window.resetGuitarToneEditor = function() {
      resetGuitarToneEditor();
    };

    window.saveGuitarToneProfile = async function() {
      if (!user || user.isAnonymous) {
        showToast('Create an account to save guitar tones.');
        return;
      }
      if (!isLibraryAdmin()) {
        showToast('Only the library owner can add or edit guitar tones.');
        return;
      }
      const name = String(document.getElementById('tool-guitar-tone-name')?.value || '').trim();
      if (!name) {
        showToast('Enter a guitar tone name.');
        return;
      }
      if (guitarToneUseUrls) {
        guitarTonePendingSamples = {};
        try {
          for (const key of GUITAR_TONE_STRING_KEYS) {
            const input = document.getElementById(`tool-guitar-tone-url-${key.toLowerCase()}`);
            const rawUrl = String(input?.value || '').trim();
            if (!rawUrl) continue;
            const dataUrl = await fetchAudioUrlAsDataUrl(rawUrl);
            guitarTonePendingSamples[key] = {
              dataUrl,
              name: rawUrl,
              size: 0
            };
          }
        } catch (err) {
          console.error('URL sample fetch failed', err);
          showToast(`Could not load URL sample: ${err?.message || 'unknown error'}`);
          return;
        }
      }
      const pendingKeys = Object.keys(guitarTonePendingSamples);
      if (!pendingKeys.length && !guitarToneEditingId) {
        showToast(guitarToneUseUrls ? 'Add at least one valid audio URL.' : 'Upload at least one string sample.');
        return;
      }
      const editingEntry = guitarToneEditingId ? guitarToneProfiles.find(item => item.id === guitarToneEditingId) : null;
      if (editingEntry?.ownerId && editingEntry.ownerId !== user.uid && !isLibraryAdmin()) {
        showToast('You can only edit tones you created.');
        return;
      }
      const availableStrings = { ...(editingEntry?.availableStrings || {}) };
      pendingKeys.forEach(key => {
        availableStrings[key] = true;
      });
      const payload = {
        name,
        ownerId: editingEntry?.ownerId || user.uid,
        createdBy: editingEntry?.createdBy || user.uid,
        createdAt: editingEntry?.createdAt || Date.now(),
        updatedAt: Date.now(),
        availableStrings
      };
      try {
        const toneId = await repository.saveGuitarTone(payload, editingEntry?.id || null);
        for (const key of pendingKeys) {
          await repository.saveGuitarToneStringData(toneId, key, guitarTonePendingSamples[key].dataUrl);
          guitarToneSampleLoadPromises.set(getToneSampleCacheKey(toneId, key), Promise.resolve(guitarTonePendingSamples[key].dataUrl));
        }
        await loadGuitarToneProfiles();
        if (!userSettings.activeGuitarToneId) {
          await selectGuitarToneProfile(toneId);
        }
        resetGuitarToneEditor();
        setGuitarToneEditorOpen(false);
        showToast(editingEntry ? 'Guitar tone updated.' : 'Guitar tone saved.', true);
      } catch (e) {
        console.error('Save guitar tone failed', e);
        showToast('Could not save guitar tone.');
      }
    };

    async function attachLooperMediaSource(sourceUrl, mediaType = 'audio', options = {}) {
      const { fromHistoryEntry = null } = options || {};
      const isVideo = mediaType === 'video';
      const target = isVideo ? getLooperVideoEl() : getLooperAudioEl();
      const other = isVideo ? getLooperAudioEl() : getLooperVideoEl();
      if (other) {
        other.pause();
        other.removeAttribute('src');
        other.load();
      }
      if (!target) return;
      target.pause();
      target.src = sourceUrl;
      target.loop = false;
      activateLooperMode(isVideo ? 'video' : 'audio');
      looperDuration = Number(fromHistoryEntry?.duration || 0) || 0;
      looperPointA = Number(fromHistoryEntry?.pointA || 0) || 0;
      looperPointB = Number(fromHistoryEntry?.pointB || 0) || 0;
      looperRepeatEnabled = !!fromHistoryEntry?.repeatEnabled;
      looperABEnabled = !!fromHistoryEntry?.abEnabled;
      target.onloadedmetadata = () => {
        handleLooperMediaLoaded();
        const startAt = looperABEnabled ? looperPointA : 0;
        if (startAt > 0) seekLooperTo(startAt);
      };
      target.onended = () => {
        handleLooperMediaEnded();
      };
      target.ontimeupdate = () => {
        refreshLooperUi();
        scheduleLooperHistorySave();
      };
      target.onpause = () => {
        scheduleLooperHistorySave(120);
      };
      target.load();
    }

    async function saveActiveLooperStateNow(showFeedback = true) {
      if (!hasActiveLooperTrack()) {
        if (showFeedback) showToast('Load track first.');
        return;
      }
      if (!user || user.isAnonymous) {
        if (showFeedback) showToast('Sign in to save looper history.');
        return;
      }
      if (!activeLooperHistoryId) {
        const ensuredId = await ensureActiveLooperHistoryEntry();
        if (!ensuredId) {
          if (showFeedback) showToast('Could not save history right now.');
          return;
        }
      }
      await upsertActiveLooperHistoryState(false);
      if (showFeedback) showToast('Looper state saved.', true);
    }

    window.saveActiveLooperStateNow = saveActiveLooperStateNow;

    window.onLooperNotesInput = function() {
      if (!hasActiveLooperTrack()) return;
      scheduleLooperHistorySave(900);
    };

    window.saveLooperNotes = async function() {
      if (!hasActiveLooperTrack()) {
        showToast('Load track first.');
        return;
      }
      if (!user || user.isAnonymous) {
        showToast('Sign in to save looper history.');
        return;
      }
      if (!activeLooperHistoryId) {
        const ensuredId = await ensureActiveLooperHistoryEntry();
        if (!ensuredId) {
          showToast('Could not save notes right now.');
          return;
        }
      }
      await upsertActiveLooperHistoryState(false);
      showToast('Looper notes saved.', true);
    };

    window.handleLooperFileSelected = async function(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (file.size > LOOPER_MAX_UPLOAD_BYTES) {
        showToast(`File too large. Max ${formatBytes(LOOPER_MAX_UPLOAD_BYTES)}.`);
        event.target.value = '';
        return;
      }
      destroyLooperYoutubePlayer();
      resetLooperObjectUrl();
      looperObjectUrl = URL.createObjectURL(file);
      const isVideo = String(file.type || '').startsWith('video/');
      activeLooperHistoryId = '';
      looperPendingUploadFile = file;
      looperPendingDataUrl = '';
      setLooperNoteText('');
      looperActiveSource = {
        sourceType: 'upload',
        mediaType: isVideo ? 'video' : 'audio',
        title: sanitizeLooperTitle(file.name, isVideo ? 'Uploaded Video' : 'Uploaded Audio'),
        uploadFingerprint: buildUploadFingerprint(file),
        mediaStored: false
      };
      await attachLooperMediaSource(looperObjectUrl, looperActiveSource.mediaType);
      const youtubeInput = document.getElementById('tool-looper-youtube-url');
      if (youtubeInput) youtubeInput.value = '';
      try {
        looperPendingDataUrl = await readFileAsDataUrl(file);
        activeLooperHistoryId = await ensureActiveLooperHistoryEntry();
        scheduleLooperHistorySave(120);
      } catch (e) {
        console.error('Save looper media to Firestore failed', e);
        showToast('Loaded locally, but Firestore save failed.');
      }
      showToast(`Loaded ${isVideo ? 'video' : 'audio'} file.`, true);
    };

    window.loadLooperYouTube = async function() {
      const input = document.getElementById('tool-looper-youtube-url');
      const value = input?.value?.trim() || '';
      if (!value) {
        showToast('Paste a YouTube link or type a title.');
        return;
      }
      const fileInput = document.getElementById('tool-looper-file');
      if (fileInput) fileInput.value = '';
      const directUrl = normalizeYouTubeUrl(value);
      if (directUrl) {
        await loadLooperYouTubeByUrl(directUrl);
        return;
      }
      showToast('Searching YouTube...');
      const foundUrl = await searchYouTubeFirstVideoByTitle(value);
      if (!foundUrl) {
        showToast('No result found from title search. Try a direct YouTube link.');
        return;
      }
      if (input) input.value = foundUrl;
      showToast('Loaded first result from title search.', true);
      await loadLooperYouTubeByUrl(foundUrl);
    };

    window.openLooperHistoryItem = async function(itemId) {
      const item = looperHistory.find(entry => entry.id === itemId);
      if (!item) return;
      if (looperOpeningHistoryId) return;
      looperOpeningHistoryId = itemId;
      looperOpeningProgress = 6;
      renderLooperHistory();
      activeLooperHistoryId = item.id;
      setLooperNoteText(item.noteText || '');
      looperPendingUploadFile = null;
      looperPendingDataUrl = '';
      try {
        if (item.sourceType === 'youtube' && item.youtubeUrl) {
          looperOpeningProgress = 45;
          renderLooperHistory();
          await loadLooperYouTubeByUrl(item.youtubeUrl, { fromHistoryEntry: item });
          looperOpeningProgress = 100;
        } else if (item.sourceType === 'upload') {
          destroyLooperYoutubePlayer();
          resetLooperObjectUrl();
          looperOpeningProgress = 12;
          renderLooperHistory();
          const mediaDataUrl = await repository.loadLooperMediaData(user.uid, item.id, (progress) => {
            looperOpeningProgress = Math.max(looperOpeningProgress, progress);
            renderLooperHistory();
          });
          if (!mediaDataUrl) {
            showToast('This history item has no playable source.');
            return;
          }
          looperActiveSource = {
            sourceType: 'upload',
            mediaType: item.mediaType === 'video' ? 'video' : 'audio',
            title: sanitizeLooperTitle(item.title),
            mediaStored: true
          };
          looperOpeningProgress = 97;
          renderLooperHistory();
          await attachLooperMediaSource(mediaDataUrl, looperActiveSource.mediaType, { fromHistoryEntry: item });
          looperOpeningProgress = 100;
        } else {
          showToast('This history item has no playable source.');
        }
      } finally {
        renderLooperHistory();
        setTimeout(() => {
          if (looperOpeningHistoryId === itemId) {
            looperOpeningHistoryId = '';
            looperOpeningProgress = 0;
            renderLooperHistory();
          }
        }, 220);
      }
      renderLooperHistory();
    };

    window.deleteLooperHistoryItem = async function(itemId) {
      const item = looperHistory.find(entry => entry.id === itemId);
      if (!item || !user) return;
      if (looperDeletingHistoryId === itemId) return;
      looperDeletingHistoryId = itemId;
      renderLooperHistory();
      try {
        await repository.deleteLooperMediaData(user.uid, itemId);
        await repository.deleteLooperHistory(user.uid, itemId);
        looperHistory = looperHistory.filter(entry => entry.id !== itemId);
        if (activeLooperHistoryId === itemId) {
          activeLooperHistoryId = '';
          setLooperNoteText('');
        }
        showToast('History item removed.', true);
      } catch (e) {
        console.error('Delete looper history failed', e);
        showToast('Could not delete history item.');
      } finally {
        looperDeletingHistoryId = '';
        renderLooperHistory();
      }
    };

    window.toggleLooperPlay = function() {
      if (looperMode === 'none') {
        showToast('Load media first.');
        return;
      }
      if (isLooperPlaying()) pauseLooperInternal();
      else {
        enforceLooperBounds();
        playLooperInternal();
      }
      scheduleLooperHistorySave();
      startLooperSyncTimer();
    };

    window.seekLooperBy = function(delta = 0) {
      if (looperMode === 'none') return;
      const duration = looperDuration || getLooperDuration();
      const next = Math.max(0, Math.min(getLooperCurrentTime() + (Number(delta) || 0), duration || Infinity));
      seekLooperTo(next);
      refreshLooperUi();
      scheduleLooperHistorySave();
    };

    window.resetLooperPosition = function() {
      if (looperMode === 'none') return;
      const target = looperABEnabled ? looperPointA : 0;
      seekLooperTo(target);
      refreshLooperUi();
      scheduleLooperHistorySave();
    };

    window.onLooperSeekInput = function(value) {
      if (looperMode === 'none') return;
      seekLooperTo(Number(value) || 0);
      refreshLooperUi();
      scheduleLooperHistorySave();
    };

    window.toggleLooperFullTrack = function() {
      setLooperLoopMode('full');
    };

    window.toggleLooperABMode = function() {
      setLooperLoopMode('ab');
    };

    window.onLooperBoundaryInput = function(which, value) {
      const duration = looperDuration || getLooperDuration();
      const current = Math.max(0, Math.min(Number(value) || 0, duration || Infinity));
      if (which === 'a') {
        looperPointA = current;
        if (looperPointB < looperPointA + 0.2) looperPointB = Math.min(duration || looperPointA + 0.2, looperPointA + 0.2);
      } else {
        looperPointB = current;
        if (looperPointB < looperPointA + 0.2) looperPointA = Math.max(0, looperPointB - 0.2);
      }
      refreshLooperUi();
      scheduleLooperHistorySave();
    };

    window.setLooperBoundaryFromCurrent = function(which) {
      if (looperMode === 'none') return;
      const now = getLooperCurrentTime();
      if (which === 'a') looperPointA = now;
      else looperPointB = now;
      if (looperPointB < looperPointA + 0.2) {
        if (which === 'a') looperPointB = looperPointA + 0.2;
        else looperPointA = Math.max(0, looperPointB - 0.2);
      }
      refreshLooperUi();
      scheduleLooperHistorySave();
    };

    function initLooperUi() {
      looperRepeatEnabled = false;
      looperABEnabled = false;
      looperAppBackgroundEnabled = false;
      looperPointA = 0;
      looperPointB = 0;
      activeLooperHistoryId = '';
      looperActiveSource = null;
      looperPendingUploadFile = null;
      looperPendingDataUrl = '';
      looperHistoryCreatePromise = null;
      looperDeletingHistoryId = '';
      looperOpeningHistoryId = '';
      looperOpeningProgress = 0;
      setLooperNoteText('');
      updateLooperMaxUploadLabel();
      renderLooperHistory();
      refreshLooperUi();
      updateLooperNowPlayingIndicator();
    };

    function normalizeChordAccidental(value = '') {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (raw === '#' || raw === '♯') return '#';
      if (raw === 'b' || raw === '♭') return 'b';
      return '';
    }

    function extractTokenCoreParts(token = '') {
      const raw = String(token || '');
      const match = raw.match(/^([^A-Za-z0-9#b♯♭]*)(.*?)([^A-Za-z0-9#b♯♭]*)$/);
      if (!match) return { prefix: '', core: raw, suffix: '' };
      return {
        prefix: match[1] || '',
        core: match[2] || '',
        suffix: match[3] || ''
      };
    }

    function normalizeMinorSuffix(rest = '') {
      const raw = String(rest || '');
      if (!raw) return '';
      if (raw.startsWith('-')) return `m${raw.slice(1)}`;
      if (/^min\b/i.test(raw)) return `m${raw.slice(3)}`;
      return raw;
    }

    function isLikelyChordSuffix(rest = '') {
      const raw = String(rest || '');
      if (!raw) return true;
      return /^(m($|[0-9#b♯♭/+()\-])|m(maj|min|add|sus|dim|aug)|maj|min|dim|aug|sus|add|[0-9#b♯♭/+()\-])/i.test(raw);
    }

    function detectNotationForChordSegment(segment = '') {
      const raw = String(segment || '');
      if (!raw) return '';
      const european = raw.match(/^(do|re|mi|fa|sol|la|si|ti)([#♯b♭]?)(.*)$/i);
      if (european && isLikelyChordSuffix(european[3] || '')) return 'european';
      const usa = raw.match(/^([A-G])([#♯b♭]?)(.*)$/i);
      if (usa && isLikelyChordSuffix(usa[3] || '')) return 'usa';
      return '';
    }

    function translateChordSegmentToUs(segment = '') {
      const raw = String(segment || '');
      if (!raw) return raw;
      const match = raw.match(/^(do|re|mi|fa|sol|la|si|ti)([#♯b♭]?)(.*)$/i);
      if (!match || detectNotationForChordSegment(raw) !== 'european') return raw;
      const rootKey = String(match[1] || '').toLowerCase();
      const mappedRoot = EUROPEAN_TO_US_NOTE_MAP[rootKey];
      if (!mappedRoot) return raw;
      const accidental = normalizeChordAccidental(match[2] || '');
      const suffix = normalizeMinorSuffix(match[3] || '');
      return `${mappedRoot}${accidental}${suffix}`;
    }

    function translateChordCoreToUs(core = '') {
      const raw = String(core || '');
      if (!raw) return raw;
      return raw.split('/').map(part => translateChordSegmentToUs(part)).join('/');
    }

    function normalizeChordNotationMode(mode = '') {
      return String(mode || '').trim().toLowerCase() === 'solfege' ? 'solfege' : 'letter';
    }

    function normalizeEuropeanSegmentForDisplay(segment = '') {
      const raw = String(segment || '');
      const match = raw.match(/^(do|re|mi|fa|sol|la|si|ti)([#♯b♭]?)(.*)$/i);
      if (!match || detectNotationForChordSegment(raw) !== 'european') return raw;
      const key = String(match[1] || '').toLowerCase();
      const root = key === 'ti'
        ? 'Si'
        : key === 'do'
          ? 'Do'
          : key === 're'
            ? 'Re'
            : key === 'mi'
              ? 'Mi'
              : key === 'fa'
                ? 'Fa'
                : key === 'sol'
                  ? 'Sol'
                  : key === 'la'
                    ? 'La'
                    : 'Si';
      const accidental = normalizeChordAccidental(match[2] || '');
      const suffix = normalizeMinorSuffix(match[3] || '');
      return `${root}${accidental}${suffix}`;
    }

    function translateChordSegmentToSolfege(segment = '') {
      const raw = String(segment || '');
      if (!raw) return raw;
      const match = raw.match(/^([A-G])([#♯b♭]?)(.*)$/i);
      if (!match || detectNotationForChordSegment(raw) !== 'usa') return raw;
      const mappedRoot = US_TO_SOLFEGE_NOTE_MAP[String(match[1] || '').toUpperCase()];
      if (!mappedRoot) return raw;
      const accidental = normalizeChordAccidental(match[2] || '');
      const suffix = normalizeMinorSuffix(match[3] || '');
      return `${mappedRoot}${accidental}${suffix}`;
    }

    function translateChordCoreToSolfege(core = '') {
      const raw = String(core || '');
      if (!raw) return raw;
      return raw.split('/').map(part => {
        const notation = detectNotationForChordSegment(part);
        if (notation === 'european') return normalizeEuropeanSegmentForDisplay(part);
        if (notation === 'usa') return translateChordSegmentToSolfege(part);
        return part;
      }).join('/');
    }

    function formatChordCoreForDisplay(core = '', notationMode = normalizeChordNotationMode(userSettings?.chordNotation)) {
      const mode = normalizeChordNotationMode(notationMode);
      return mode === 'solfege' ? translateChordCoreToSolfege(core) : translateChordCoreToUs(core);
    }

    function normalizeChordTokenToUs(token = '') {
      const raw = String(token || '');
      if (!raw) return raw;
      const { prefix, core, suffix } = extractTokenCoreParts(raw);
      if (!core) return raw;
      return `${prefix}${translateChordCoreToUs(core)}${suffix}`;
    }

    function getDisplayChordName(chordName = '', notationMode = normalizeChordNotationMode(userSettings?.chordNotation)) {
      const raw = String(chordName || '');
      if (!raw) return '';
      const { prefix, core, suffix } = extractTokenCoreParts(raw);
      if (!core) return raw;
      return `${prefix}${formatChordCoreForDisplay(core, notationMode)}${suffix}`;
    }

    function getChordNotationFromCore(core = '') {
      const raw = String(core || '').trim();
      if (!raw) return '';
      const lead = raw.split('/')[0] || '';
      return detectNotationForChordSegment(lead);
    }

    function detectChordNotationStyle(text = '') {
      const raw = String(text || '');
      if (!raw.trim()) return 'empty';
      let european = 0;
      let usa = 0;
      raw.split(/\s+/).forEach(token => {
        if (!token) return;
        const { core } = extractTokenCoreParts(token);
        const notation = getChordNotationFromCore(core);
        if (notation === 'european') european += 1;
        else if (notation === 'usa') usa += 1;
      });
      if (european > 0 && usa > 0) return 'mixed';
      if (european > 0) return 'european';
      if (usa > 0) return 'usa';
      return 'unknown';
    }

    function translateTextToUsChordNotation(text = '') {
      const raw = String(text || '');
      if (!raw) return '';
      return raw.split(/(\s+)/).map(part => {
        if (!part || /^\s+$/.test(part)) return part;
        const { prefix, core, suffix } = extractTokenCoreParts(part);
        if (!core) return part;
        const translatedCore = translateChordCoreToUs(core);
        return `${prefix}${translatedCore}${suffix}`;
      }).join('');
    }

    function isUsChordCore(core = '') {
      const raw = String(core || '').trim();
      if (!raw) return false;
      const segments = raw.split('/').filter(Boolean);
      if (!segments.length) return false;
      return segments.every(segment => detectNotationForChordSegment(segment) === 'usa');
    }

    function renderChordTranslationOutput(translatedText = '') {
      const outputEl = document.getElementById('tool-chord-translation-output');
      if (!outputEl) return;
      const text = String(translatedText || '').replace(/\r/g, '');
      if (!text) {
        outputEl.innerHTML = '';
        return;
      }
      const html = text.split('\n').map(line => {
        return line.split(/(\s+)/).map(part => {
          if (!part) return '';
          if (/^\s+$/.test(part)) return escapeHtml(part);
          const { prefix, core, suffix } = extractTokenCoreParts(part);
          if (!core || !isUsChordCore(core)) return escapeHtml(part);
          const safePrefix = escapeHtml(prefix);
          const safeCore = escapeHtml(core);
          const safeSuffix = escapeHtml(suffix);
          return `${safePrefix}<span data-chord="${safeCore}" onclick="openChordTranslationChordDiagram(this.dataset.chord, this)" class="transition-all duration-200 clickable-chord">${safeCore}</span>${safeSuffix}`;
        }).join('');
      }).join('<br>');
      outputEl.innerHTML = html;
    }

    window.openChordTranslationChordDiagram = function(chordName = '', anchorEl = null) {
      const normalized = normalizeChordLookupName(chordName);
      if (!normalized) return;
      const wrap = document.getElementById('tool-chord-translation-diagram-wrap');
      const nameEl = document.getElementById('tool-chord-translation-diagram-name');
      const diagramEl = document.getElementById('tool-chord-translation-diagram');
      if (!wrap || !nameEl || !diagramEl) return;
      nameEl.dataset.chord = normalized;
      nameEl.innerText = getDisplayChordName(normalized);
      diagramEl.innerHTML = renderChordDiagramSvg(normalized, true);
      wrap.classList.remove('hidden');
      showChordPopover(normalized, anchorEl);
    };

    function updateChordTranslationDetectedLabel(mode = 'empty') {
      const label = document.getElementById('tool-chord-translation-detected');
      if (!label) return;
      label.textContent = mode === 'european'
        ? 'Detected: European notation (Do Re Mi).'
        : mode === 'usa'
          ? 'Detected: USA notation (C D E).'
          : mode === 'mixed'
            ? 'Detected: Mixed notation.'
            : mode === 'unknown'
              ? 'Detected: unknown text (no clear chord notation).'
              : 'Detected: waiting for input.';
    }

    window.runChordTranslation = function(liveMode = false) {
      const inputEl = document.getElementById('tool-chord-translation-input');
      const outputEl = document.getElementById('tool-chord-translation-output');
      if (!inputEl || !outputEl) return;
      const inputText = String(inputEl.value || '');
      if (!inputText.trim()) {
        outputEl.innerHTML = '';
        updateChordTranslationDetectedLabel('empty');
        if (!liveMode) showToast('Paste chords first.');
        return;
      }
      const detected = detectChordNotationStyle(inputText);
      const translated = translateTextToUsChordNotation(inputText);
      renderChordTranslationOutput(translated);
      updateChordTranslationDetectedLabel(detected);
      if (!liveMode) showToast('Chord translation ready.', true);
    };

    window.clearChordTranslation = function() {
      const inputEl = document.getElementById('tool-chord-translation-input');
      const outputEl = document.getElementById('tool-chord-translation-output');
      const diagramWrap = document.getElementById('tool-chord-translation-diagram-wrap');
      const diagramEl = document.getElementById('tool-chord-translation-diagram');
      const diagramName = document.getElementById('tool-chord-translation-diagram-name');
      if (inputEl) inputEl.value = '';
      if (outputEl) outputEl.innerHTML = '';
      if (diagramEl) diagramEl.innerHTML = '';
      if (diagramName) {
        diagramName.innerText = '';
        diagramName.dataset.chord = '';
      }
      if (diagramWrap) diagramWrap.classList.add('hidden');
      updateChordTranslationDetectedLabel('empty');
    };

    window.openToolPage = function(tool, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      if (tool !== 'looper' && !looperAppBackgroundEnabled && hasActiveLooperTrack()) {
        stopLooperPlayback();
      }
      activeToolPage = tool;
      const pages = ['metronome', 'recorder', 'chords', 'chord-builder', 'guitar-tones', 'songs', 'looper', 'tabs-preview', 'chord-translation', 'ai-song'];
      if (tool !== 'tabs-preview') stopTabsPreviewPlayback();
      document.getElementById('tools-home-panel')?.classList.add('hidden');
      pages.forEach(page => {
        const el = document.getElementById(`tool-page-${page}`);
        if (!el) return;
        if (page === tool) el.classList.remove('hidden');
        else el.classList.add('hidden');
      });
      document.getElementById('tools-back-btn')?.classList.remove('hidden');
      const subtitle = document.getElementById('tools-header-subtitle');
      if (subtitle) subtitle.innerText = tool === 'metronome'
        ? 'Keep steady time.'
        : tool === 'recorder'
          ? 'Save and replay short clips.'
          : tool === 'chord-builder'
            ? 'Add new chords to the database.'
            : tool === 'guitar-tones'
              ? 'Upload open-string samples and build dynamic guitar tones.'
            : tool === 'songs'
              ? 'Find a song quickly.'
              : tool === 'looper'
              ? 'Loop full track or A-B sections.'
              : tool === 'tabs-preview'
                ? 'Paste tabs and preview real notes.'
              : tool === 'chord-translation'
                ? 'Translate European Do/Re/Mi chords into USA notation.'
              : tool === 'ai-song'
                ? 'Generate a full song draft with Gemini.'
                : 'Browse and hear the chord library.';
      if (tool === 'chord-builder') updateChordBuilderPreview();
      if (tool === 'chords') renderChordExplorer();
      if (tool === 'guitar-tones') {
        setGuitarToneEditorOpen(false);
        renderGuitarToneEditorStatus();
        renderGuitarToneProfilesList();
      }
      if (tool === 'songs') renderToolSongsSearch(document.getElementById('tool-song-search')?.value || '');
      if (tool === 'looper') {
        refreshLooperUi();
        renderLooperHistory();
      }
      if (tool === 'tabs-preview') {
        setTabsPreviewStatus('Paste tabs then tap Preview.');
        renderTabsPreviewHistory();
      }
      if (tool === 'chord-translation') {
        window.runChordTranslation(true);
      }
      updateLooperNowPlayingIndicator();
      if (tool === 'ai-song') {
        const keyInput = document.getElementById('ai-gemini-key');
        if (keyInput) keyInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '';
      }
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath(`/tools/${encodeURIComponent(tool)}`, { replace: replaceUrl });
      }
    };

    window.showToolsHome = function(options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      activeToolPage = 'home';
      document.getElementById('tools-home-panel')?.classList.remove('hidden');
      stopTabsPreviewPlayback();
      ['metronome', 'recorder', 'chords', 'chord-builder', 'guitar-tones', 'songs', 'looper', 'tabs-preview', 'chord-translation', 'ai-song'].forEach(page => {
        const el = document.getElementById(`tool-page-${page}`);
        if (el) el.classList.add('hidden');
      });
      document.getElementById('tools-back-btn')?.classList.add('hidden');
      const subtitle = document.getElementById('tools-header-subtitle');
      if (subtitle) subtitle.innerText = 'Choose a tool.';
      updateLooperNowPlayingIndicator();
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath('/tools', { replace: replaceUrl });
      }
    };

    function extractJsonObject(text = '') {
      const raw = String(text || '').trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {}
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch {}
      }
      return null;
    }

    function normalizeAiPatterns(patterns = [], timeSignature = '4/4') {
      const fallbackTimeSignature = normalizeTimeSignature(timeSignature);
      const cleaned = (Array.isArray(patterns) ? patterns : []).map(entry => ({
        tag: String(entry?.tag || '').trim(),
        timeSignature: normalizeTimeSignature(entry?.timeSignature || fallbackTimeSignature, fallbackTimeSignature),
        patternText: normalizePatternText(String(entry?.patternText || ''), normalizeTimeSignature(entry?.timeSignature || fallbackTimeSignature, fallbackTimeSignature))
      })).filter(entry => !!entry.patternText);
      if (!cleaned.length) {
        return [{
          tag: '',
          timeSignature: fallbackTimeSignature,
          patternText: normalizePatternText('', fallbackTimeSignature)
        }];
      }
      const uniquePatternCount = new Set(cleaned.map(entry => entry.patternText)).size;
      if (uniquePatternCount === 1) {
        return [{ tag: '', timeSignature: cleaned[0].timeSignature, patternText: cleaned[0].patternText }];
      }
      return cleaned;
    }

    function normalizeAiRawText(rawText = '') {
      const text = String(rawText || '').replace(/\r/g, '').trim();
      if (!text) return 'C\nEmpty';
      return text;
    }

    function normalizeAiDraft(raw = {}, fallback = {}) {
      const timeSignature = normalizeTimeSignature(raw.timeSignature || fallback.timeSignature || '4/4');
      return {
        title: String(raw.title || fallback.title || 'Untitled').trim() || 'Untitled',
        artist: String(raw.artist || fallback.artist || 'Unknown Artist').trim() || 'Unknown Artist',
        youtubeUrl: normalizeYouTubeUrl(raw.youtubeUrl || fallback.youtubeUrl || ''),
        bpm: Math.max(40, Math.min(240, parseInt(raw.bpm, 10) || 80)),
        timeSignature,
        capo: String(raw.capo || 'No capo').trim() || 'No capo',
        rawText: normalizeAiRawText(raw.rawText),
        strummingPatterns: normalizeAiPatterns(raw.strummingPatterns, timeSignature)
      };
    }

    async function fetchYouTubeMetadata(url = '') {
      const normalized = normalizeYouTubeUrl(url);
      if (!normalized) return null;
      try {
        const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalized)}&format=json`;
        const response = await fetch(endpoint);
        if (!response.ok) return null;
        const data = await response.json();
        return {
          title: String(data?.title || '').trim(),
          authorName: String(data?.author_name || '').trim()
        };
      } catch {
        return null;
      }
    }

    async function callGeminiJson(apiKey, prompt) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json'
          }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('\n') || '';
      const parsed = extractJsonObject(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('AI response was not valid JSON.');
      return parsed;
    }

    window.generateSongWithAI = async function() {
      const btn = document.getElementById('btn-generate-ai-song');
      const apiKey = (document.getElementById('ai-gemini-key')?.value || '').trim();
      const youtubeInput = (document.getElementById('ai-youtube-link')?.value || '').trim();
      const titleInput = (document.getElementById('ai-song-title')?.value || '').trim();
      const artistInput = (document.getElementById('ai-song-artist')?.value || '').trim();
      const simpleMode = !!document.getElementById('ai-simple-mode')?.checked;

      if (!apiKey) return showToast("Enter Gemini API key first.");
      if (!youtubeInput && !titleInput && !artistInput) {
        return showToast("Provide YouTube link OR title and artist.");
      }

      const normalizedYoutube = normalizeYouTubeUrl(youtubeInput);
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey);
      if (btn) btn.disabled = true;
      if (btn) btn.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i> Generating...`;

      const ytMeta = normalizedYoutube ? await fetchYouTubeMetadata(normalizedYoutube) : null;
      const sourceHint = normalizedYoutube
        ? `youtube link: ${normalizedYoutube}`
        : `title: "${titleInput}" by artist: "${artistInput}"`;
      const difficultyHint = simpleMode
        ? 'Use simple mode: easy open-position chords only (avoid barre and complex 4-finger shapes), and an easy strumming pattern.'
        : 'Use normal mode: keep musically realistic chords and pattern.';

      const prompt = `
Generate one guitar song draft as strict JSON only, no markdown.
Song identity input (must keep exact identity, no alternatives):
${sourceHint}
YouTube metadata hint (if available): title="${ytMeta?.title || ''}", artist/channel="${ytMeta?.authorName || ''}".
${difficultyHint}

Output JSON shape:
{
  "found" : true,
  "title": "string",
  "artist": "string",
  "youtubeUrl": "string (can be empty)",
  "bpm": 80,
  "timeSignature": "4/4",
  "capo": "No capo",
  "rawText": "chords and lyrics in app format",
  "strummingPatterns": [
    { "tag": "[verse 1]", "timeSignature": "4/4", "patternText": "D.DU.UD." }
  ]
}

Rules:
- timeSignature must be one of: 2/4, 3/4, 4/4, 6/8, 2/16, 3/16, 4/16, 6/16.
- Each strumming pattern may define its own timeSignature. If missing, use the top-level timeSignature.
- patternText must contain only D, U, X, .
- 'X' : chuck , '.' : rest
- Return one song only.
- Use at least one strumming pattern.
- If all sections use the same strumming, return only one pattern entry without repeated copies.
- Do not return any alternatives, variants, or other artists.
- rawText must use two-line block style only:
  1) one full chords line
  2) next full lyrics line
  Never insert chord names inline between lyric words.
- Keep section tags like [intro], [verse 1], [chorus] on separate lines.
- Keep response compact and valid JSON.
- get me real songs , that exist , do not make up songs that do not exist , if you do not know a song that matches the input criteria just return "found":false;
`.trim();

      try {
        const parsed = await callGeminiJson(apiKey, prompt);
        if (!parsed || typeof parsed !== 'object') throw new Error('No song returned by AI.');
        const found = parsed.found === true || String(parsed.found || '').toLowerCase() === 'true';
        if (!found) {
          showToast("Could not match a real song for this input.");
          return;
        }
        const fallback = { title: titleInput || ytMeta?.title || 'Untitled', artist: artistInput || ytMeta?.authorName || 'Unknown Artist', youtubeUrl: normalizedYoutube || '' };
        const draft = normalizeAiDraft(parsed, fallback);
        if (artistInput) draft.artist = artistInput;
        if (titleInput) draft.title = titleInput;
        if (normalizedYoutube) draft.youtubeUrl = normalizedYoutube;
        openAddSong({ draft });
        showToast("AI draft generated. Review and save.", true);
      } catch (err) {
        console.error('AI generation failed', err);
        showToast("AI generation failed. Check inputs/API key.");
      } finally {
        if (btn) btn.disabled = false;
        if (btn) btn.innerHTML = `<i class="fas fa-sparkles mr-2"></i> Generate Song Draft`;
      }
    };

    function getTrainingCategoryLabel(category = '') {
      if (category === 'courses') return 'Courses';
      if (category === 'dailies') return 'Dailies';
      return 'Trainings';
    }

    function normalizeRecentCourses(entries = []) {
      if (!Array.isArray(entries)) return [];
      return entries
        .map(item => ({
          articleId: String(item?.articleId || '').trim(),
          positionSec: Math.max(0, Math.floor(Number(item?.positionSec || 0))),
          updatedAt: Number(item?.updatedAt || 0) || 0
        }))
        .filter(item => !!item.articleId);
    }

    function getRecentCourseEntry(articleId) {
      const targetId = String(articleId || '').trim();
      if (!targetId) return null;
      const list = normalizeRecentCourses(userSettings.recentCourses || []);
      return list.find(item => item.articleId === targetId) || null;
    }

    async function rememberRecentCourseProgress(articleId, positionSec = 0) {
      const targetId = String(articleId || '').trim();
      if (!targetId) return;
      const safeSec = Math.max(0, Math.floor(Number(positionSec || 0)));
      const now = Date.now();
      const current = normalizeRecentCourses(userSettings.recentCourses || []);
      const next = [{ articleId: targetId, positionSec: safeSec, updatedAt: now }, ...current.filter(item => item.articleId !== targetId)].slice(0, 20);
      await persistUserSettingsPartial({ recentCourses: next });
      renderHomeDashboard();
    }

    function stopTrainingVideoSync() {
      if (trainingVideoSyncTimer) {
        clearInterval(trainingVideoSyncTimer);
        trainingVideoSyncTimer = null;
      }
    }

    async function saveCurrentTrainingVideoProgress() {
      if (!trainingVideoPlayer || !currentTrainingArticle || currentTrainingArticle.category !== 'courses') return;
      let currentSec = 0;
      try {
        currentSec = Math.max(0, Math.floor(Number(trainingVideoPlayer.getCurrentTime?.() || 0)));
      } catch {
        currentSec = 0;
      }
      if (currentSec <= 0) return;
      if (Math.abs(currentSec - trainingVideoLastSavedSec) < 2) return;
      trainingVideoLastSavedSec = currentSec;
      await rememberRecentCourseProgress(currentTrainingArticle.id, currentSec);
    }

    function stopTrainingVideoPlayer() {
      stopTrainingVideoSync();
      if (trainingVideoPlayer) {
        try { trainingVideoPlayer.destroy(); } catch {}
        trainingVideoPlayer = null;
      }
      trainingVideoLastSavedSec = -1;
      const holder = document.getElementById('training-detail-video-player');
      if (holder) holder.innerHTML = '';
    }

    async function startTrainingVideoPlayer(article, startAtSec = 0) {
      if (!article?.youtubeUrl) return;
      const videoId = getYouTubeVideoId(article.youtubeUrl);
      if (!videoId) return;
      await ensureYouTubeIframeApi();
      stopTrainingVideoPlayer();
      trainingVideoPlayer = new window.YT.Player('training-detail-video-player', {
        videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          start: Math.max(0, Math.floor(Number(startAtSec || 0)))
        },
        events: {
          onReady: async () => {
            if (startAtSec > 0) {
              try { trainingVideoPlayer.seekTo(startAtSec, true); } catch {}
            }
          },
          onStateChange: async (event) => {
            if (!window.YT?.PlayerState) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (article.category === 'courses') {
                await rememberRecentCourseProgress(article.id, Math.max(0, Math.floor(Number(trainingVideoPlayer.getCurrentTime?.() || 0))));
              }
              stopTrainingVideoSync();
              if (article.category === 'courses') {
                trainingVideoSyncTimer = setInterval(() => {
                  saveCurrentTrainingVideoProgress().catch(() => {});
                }, 2500);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              if (article.category === 'courses') await saveCurrentTrainingVideoProgress();
              stopTrainingVideoSync();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (article.category === 'courses') await rememberRecentCourseProgress(article.id, 0);
              stopTrainingVideoSync();
            }
          }
        }
      });
    }

    function refreshTrainingAddButtons() {
      const canEdit = !!user && !user.isAnonymous;
      ['trainings', 'dailies', 'courses'].forEach(category => {
        const btn = document.getElementById(`btn-training-new-${category}`);
        if (!btn) return;
        btn.classList.toggle('hidden', !canEdit);
      });
    }

    function isLibraryAdmin() {
      if (!user || user.isAnonymous) return false;
      const uid = String(user.uid || '');
      const email = String(user.email || '').trim().toLowerCase();
      return LIBRARY_ADMIN_UIDS.includes(uid) || LIBRARY_ADMIN_EMAILS.includes(email);
    }

    function refreshLibraryAdminButtons() {
      const canWrite = isLibraryAdmin();
      const chordSave = document.getElementById('btn-save-chord-library');
      const chordEdit = document.getElementById('btn-chord-explorer-edit');
      const chordHint = document.getElementById('chord-builder-admin-hint');
      const toneAdd = document.getElementById('btn-guitar-tone-add');
      const toneSave = document.getElementById('btn-save-guitar-tone');

      [chordSave, chordEdit, toneSave].forEach(btn => {
        if (!btn) return;
        btn.disabled = !canWrite;
        btn.classList.toggle('opacity-40', !canWrite);
        btn.classList.toggle('pointer-events-none', !canWrite);
      });
      if (toneAdd) toneAdd.classList.toggle('hidden', !canWrite);
      if (chordHint) chordHint.classList.toggle('hidden', canWrite);
      if (!canWrite && guitarToneEditorOpen) setGuitarToneEditorOpen(false);
    }

    function buildTrainingArticleCard(article = {}) {
      const typeBadge = article.articleType === 'video' ? 'Video' : 'Text';
      const levelLabel = article.level === 'advance' ? 'Advance' : (article.level === 'medium' ? 'Medium' : 'Beginner');
      const ratingText = article.ratingSummary?.count
        ? `${Number(article.ratingSummary.average || 0).toFixed(1)} ★ (${article.ratingSummary.count})`
        : 'No ratings';
      const image = article.imageUrl
        ? `<img src="${escapeHtml(article.imageUrl)}" alt="" class="w-16 h-16 rounded-xl object-cover border border-gray-700">`
        : `<div class="w-16 h-16 rounded-xl border border-gray-700 bg-black/40 flex items-center justify-center text-primary"><i class="fas ${article.articleType === 'video' ? 'fa-play' : 'fa-file-lines'}"></i></div>`;
      return `
        <button onclick="openTrainingArticleDetail('${article.id}')" class="w-full text-left tool-nav-card btn-press">
          <div class="flex items-start gap-3">
            ${image}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">${levelLabel}</span>
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-500">•</span>
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">${typeBadge}</span>
              </div>
              <p class="font-bold text-white truncate">${escapeHtml(article.title || 'Untitled')}</p>
              <p class="text-xs text-gray-400 mt-1 line-clamp-2">${escapeHtml(article.description || 'No description')}</p>
              <p class="text-[11px] text-primary mt-2">${ratingText}</p>
            </div>
            <i class="fas fa-chevron-right text-primary mt-1"></i>
          </div>
        </button>
      `;
    }

    function renderTrainingArticlesList(category = 'trainings') {
      const holder = document.getElementById(`training-articles-${category}`);
      if (!holder) return;
      const searchInput = document.getElementById(`training-search-${category}`);
      const term = String(searchInput?.value || '').trim().toLowerCase();
      const matches = trainingArticles.filter(article => {
        if (article.category !== category) return false;
        if (!term) return true;
        return String(article.title || '').toLowerCase().includes(term)
          || String(article.description || '').toLowerCase().includes(term)
          || String(article.body || '').toLowerCase().includes(term);
      });
      holder.innerHTML = matches.length
        ? matches.map(buildTrainingArticleCard).join('')
        : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No articles found.</div>`;
    }

    function renderTrainingArticleLists() {
      renderTrainingArticlesList('trainings');
      renderTrainingArticlesList('dailies');
      renderTrainingArticlesList('courses');
    }

    function renderTrainingArticleRatingStars(selected = 0) {
      const stars = document.getElementById('training-rating-stars');
      if (!stars) return;
      const canRate = !!user && !user.isAnonymous;
      stars.innerHTML = Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const active = value <= selected;
        return `<button onclick="setTrainingArticleRating(${value})" ${canRate ? '' : 'disabled'} class="btn-press ${active ? 'text-primary' : 'text-gray-600'} ${canRate ? '' : 'opacity-40 cursor-not-allowed'}"><i class="fas fa-star"></i></button>`;
      }).join('');
    }

    function renderTrainingArticleRatingSummary() {
      const summary = document.getElementById('training-rating-summary');
      if (!summary) return;
      if (!currentTrainingArticleRatings.length) {
        summary.innerText = 'No ratings';
        return;
      }
      const avg = currentTrainingArticleRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / currentTrainingArticleRatings.length;
      summary.innerText = `${avg.toFixed(1)} / 5 (${currentTrainingArticleRatings.length} ratings)`;
    }

    function renderTrainingArticleComments() {
      const list = document.getElementById('training-comments-list');
      if (!list) return;
      if (!currentTrainingArticleComments.length) {
        list.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-400">No comments yet.</div>`;
        return;
      }
      list.innerHTML = currentTrainingArticleComments.map(comment => `
        <div class="bg-black/40 border border-gray-800 rounded-xl px-3 py-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold text-white">${escapeHtml(comment.authorName || 'Anonymous')}</p>
            <p class="text-[10px] uppercase tracking-[0.15em] text-gray-500">${comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}</p>
          </div>
          <p class="text-sm text-gray-300 mt-1 whitespace-pre-wrap">${escapeHtml(comment.text || '')}</p>
        </div>
      `).join('');
    }

    async function loadTrainingArticleSocialData(articleId) {
      if (!repository || !articleId) return;
      try {
        currentTrainingArticleComments = await repository.loadTrainingArticleComments(articleId);
      } catch {
        currentTrainingArticleComments = [];
      }
      try {
        currentTrainingArticleRatings = await repository.loadTrainingArticleRatings(articleId);
      } catch {
        currentTrainingArticleRatings = [];
      }
      renderTrainingArticleComments();
      renderTrainingArticleRatingSummary();
      const existing = user ? currentTrainingArticleRatings.find(item => item.id === user.uid) : null;
      pendingTrainingArticleRating = existing?.rating || 0;
      renderTrainingArticleRatingStars(pendingTrainingArticleRating);
    }

    window.submitTrainingArticlesSearch = function(event, category) {
      if (event?.preventDefault) event.preventDefault();
      renderTrainingArticlesList(category);
    };

    window.openTrainingPage = function(page, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      if (page !== 'article-detail') {
        saveCurrentTrainingVideoProgress().catch(() => {});
        stopTrainingVideoPlayer();
      }
      activeTrainingArticleCategory = ['trainings', 'dailies', 'courses'].includes(page) ? page : activeTrainingArticleCategory;
      document.getElementById('training-home-panel')?.classList.add('hidden');
      ['trainings', 'dailies', 'courses', 'article-detail', 'article-editor', 'strumming'].forEach(id => {
        document.getElementById(`training-page-${id}`)?.classList.toggle('hidden', id !== page);
      });
      document.getElementById('training-back-btn')?.classList.remove('hidden');
      const subtitle = document.getElementById('training-header-subtitle');
      if (subtitle) {
        subtitle.innerText = page === 'strumming'
          ? 'Pattern trainer.'
          : page === 'article-detail'
            ? 'Article details.'
            : page === 'article-editor'
              ? 'Create or edit article.'
              : `${getTrainingCategoryLabel(page)} hub.`;
      }
      if (['trainings', 'dailies', 'courses'].includes(page)) renderTrainingArticlesList(page);
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath(`/training/${encodeURIComponent(page)}`, { replace: replaceUrl });
      }
    };

    window.showTrainingHome = function(options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      saveCurrentTrainingVideoProgress().catch(() => {});
      stopTrainingVideoPlayer();
      document.getElementById('training-home-panel')?.classList.remove('hidden');
      ['trainings', 'dailies', 'courses', 'article-detail', 'article-editor', 'strumming'].forEach(id => {
        document.getElementById(`training-page-${id}`)?.classList.add('hidden');
      });
      document.getElementById('training-back-btn')?.classList.add('hidden');
      const subtitle = document.getElementById('training-header-subtitle');
      if (subtitle) subtitle.innerText = 'Choose a training page.';
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath('/training', { replace: replaceUrl });
      }
    };

    window.openTrainingArticleDetail = async function(articleId, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      const article = trainingArticles.find(item => item.id === articleId);
      if (!article) return showToast('Article not found.');
      currentTrainingArticle = article;
      activeTrainingArticleCategory = article.category || 'trainings';
      document.getElementById('training-detail-category').innerText = getTrainingCategoryLabel(activeTrainingArticleCategory);
      document.getElementById('training-detail-title').innerText = article.title;
      document.getElementById('training-detail-description').innerText = article.description || '';
      document.getElementById('training-detail-level').innerText = article.level || 'beginner';
      document.getElementById('training-detail-type').innerText = article.articleType || 'text';
      const body = document.getElementById('training-detail-body');
      if (body) body.innerText = article.body || '';
      const image = document.getElementById('training-detail-image');
      if (image) {
        if (article.imageUrl) {
          image.src = article.imageUrl;
          image.classList.remove('hidden');
        } else {
          image.classList.add('hidden');
          image.removeAttribute('src');
        }
      }
      const videoWrap = document.getElementById('training-detail-video-wrap');
      const videoLink = document.getElementById('training-detail-video-link');
      if (article.articleType === 'video' && article.youtubeUrl) {
        if (videoLink) {
          videoLink.href = article.youtubeUrl;
          videoLink.innerText = 'Open on YouTube';
        }
        videoWrap?.classList.remove('hidden');
        const savedEntry = getRecentCourseEntry(article.id);
        await startTrainingVideoPlayer(article, savedEntry?.positionSec || 0);
      } else {
        videoWrap?.classList.add('hidden');
        stopTrainingVideoPlayer();
        if (videoLink) {
          videoLink.href = '#';
          videoLink.innerText = '';
        }
      }
      const canEdit = !!user && !user.isAnonymous;
      document.getElementById('btn-training-edit-article')?.classList.toggle('hidden', !canEdit);
      document.getElementById('btn-training-delete-article')?.classList.toggle('hidden', !canEdit);
      await loadTrainingArticleSocialData(article.id);
      openTrainingPage('article-detail', { skipUrl: true });
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath(`/training/${encodeURIComponent(activeTrainingArticleCategory)}/${encodeURIComponent(article.id)}`, { replace: replaceUrl });
      }
    };

    window.openTrainingArticleEditor = function(category = 'trainings', articleId = null, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      if (!user || user.isAnonymous) return showToast('Create an account to manage articles.');
      activeTrainingArticleCategory = ['trainings', 'dailies', 'courses'].includes(category) ? category : 'trainings';
      editingTrainingArticleId = articleId || null;
      const editingArticle = articleId ? trainingArticles.find(item => item.id === articleId) : null;
      document.getElementById('training-editor-title').innerText = editingArticle ? 'Edit Article' : 'New Article';
      document.getElementById('training-editor-article-title').value = editingArticle?.title || '';
      document.getElementById('training-editor-article-image').value = editingArticle?.imageUrl || '';
      document.getElementById('training-editor-article-level').value = editingArticle?.level || 'beginner';
      document.getElementById('training-editor-article-type').value = editingArticle?.articleType || 'text';
      document.getElementById('training-editor-article-description').value = editingArticle?.description || '';
      document.getElementById('training-editor-article-body').value = editingArticle?.body || '';
      document.getElementById('training-editor-article-youtube').value = editingArticle?.youtubeUrl || '';
      toggleTrainingEditorTypeFields();
      openTrainingPage('article-editor', { skipUrl: true });
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath(`/training/${encodeURIComponent(activeTrainingArticleCategory)}/editor`, { replace: replaceUrl });
      }
    };

    window.cancelTrainingArticleEditor = function() {
      editingTrainingArticleId = null;
      openTrainingPage(activeTrainingArticleCategory);
    };

    window.toggleTrainingEditorTypeFields = function() {
      const type = document.getElementById('training-editor-article-type')?.value || 'text';
      document.getElementById('training-editor-article-body')?.classList.toggle('hidden', type !== 'text');
      document.getElementById('training-editor-article-youtube')?.classList.toggle('hidden', type !== 'video');
    };

    window.saveTrainingArticle = async function() {
      if (!user || user.isAnonymous) return showToast('Create an account to manage articles.');
      try {
        const payload = ensureTrainingArticleFormat({
          id: editingTrainingArticleId || '',
          category: activeTrainingArticleCategory,
          title: document.getElementById('training-editor-article-title')?.value || '',
          imageUrl: document.getElementById('training-editor-article-image')?.value || '',
          level: document.getElementById('training-editor-article-level')?.value || 'beginner',
          articleType: document.getElementById('training-editor-article-type')?.value || 'text',
          description: document.getElementById('training-editor-article-description')?.value || '',
          body: document.getElementById('training-editor-article-body')?.value || '',
          youtubeUrl: document.getElementById('training-editor-article-youtube')?.value || '',
          ownerId: user.uid,
          postedBy: user.email ? user.email.split('@')[0] : 'trainer',
          createdAt: editingTrainingArticleId
            ? (trainingArticles.find(item => item.id === editingTrainingArticleId)?.createdAt || Date.now())
            : Date.now()
        });
        if (!payload.title.trim()) return showToast('Title is required.');
        if (payload.articleType === 'video' && !payload.youtubeUrl) return showToast('Valid YouTube link is required for video.');
        const savedId = await repository.saveTrainingArticle(payload, editingTrainingArticleId);
        await loadTrainingArticles();
        const latest = trainingArticles.find(item => item.id === savedId);
        if (latest) await openTrainingArticleDetail(latest.id);
        else openTrainingPage(activeTrainingArticleCategory);
        showToast('Article saved.', true);
      } catch (e) {
        console.error('Save training article failed', e);
        showToast('Could not save article.');
      }
    };

    window.editCurrentTrainingArticle = function() {
      if (!currentTrainingArticle) return;
      openTrainingArticleEditor(currentTrainingArticle.category || 'trainings', currentTrainingArticle.id);
    };

    window.deleteCurrentTrainingArticle = async function() {
      if (!currentTrainingArticle || !repository) return;
      if (!user || user.isAnonymous) return showToast('Create an account to manage articles.');
      if (!confirm('Delete this article?')) return;
      try {
        const category = currentTrainingArticle.category || 'trainings';
        await repository.deleteTrainingArticle(currentTrainingArticle.id);
        currentTrainingArticle = null;
        currentTrainingArticleComments = [];
        currentTrainingArticleRatings = [];
        await loadTrainingArticles();
        openTrainingPage(category);
        showToast('Article deleted.', true);
      } catch (e) {
        console.error('Delete training article failed', e);
        showToast('Could not delete article.');
      }
    };

    window.submitTrainingArticleComment = async function() {
      if (!currentTrainingArticle || !repository) return;
      if (!user || user.isAnonymous) return showToast('Create an account to comment.');
      const input = document.getElementById('training-comment-input');
      const text = String(input?.value || '').trim();
      if (!text) return;
      try {
        await repository.addTrainingArticleComment(currentTrainingArticle.id, {
          text,
          authorId: user.uid,
          authorName: user.email ? user.email.split('@')[0] : 'member',
          createdAt: Date.now()
        });
        input.value = '';
        await loadTrainingArticleSocialData(currentTrainingArticle.id);
        showToast('Comment added.', true);
      } catch (e) {
        console.error('Add training comment failed', e);
        showToast('Could not save comment.');
      }
    };

    window.setTrainingArticleRating = async function(value) {
      if (!currentTrainingArticle || !repository) return;
      if (!user || user.isAnonymous) return showToast('Create an account to rate.');
      pendingTrainingArticleRating = value;
      renderTrainingArticleRatingStars(pendingTrainingArticleRating);
      try {
        await repository.upsertTrainingArticleRating(currentTrainingArticle.id, user.uid, {
          rating: value,
          authorId: user.uid,
          updatedAt: Date.now()
        });
        await loadTrainingArticleSocialData(currentTrainingArticle.id);
        const avg = currentTrainingArticleRatings.length
          ? currentTrainingArticleRatings.reduce((sum, item) => sum + (item.rating || 0), 0) / currentTrainingArticleRatings.length
          : value;
        currentTrainingArticle.ratingSummary = { average: avg, count: currentTrainingArticleRatings.length };
        await repository.updateTrainingArticleMeta(currentTrainingArticle.id, { ratingSummary: currentTrainingArticle.ratingSummary });
        const idx = trainingArticles.findIndex(item => item.id === currentTrainingArticle.id);
        if (idx >= 0) trainingArticles[idx].ratingSummary = currentTrainingArticle.ratingSummary;
        renderTrainingArticleLists();
      } catch (e) {
        console.error('Training rating save failed', e);
        showToast('Could not save rating.');
      }
    };

    function ensureToolRecordingVizBars() {
      const viz = document.getElementById('tool-recording-viz');
      if (!viz) return [];
      if (!viz.children.length) {
        viz.innerHTML = Array.from({ length: 28 }, () => `<span class="block flex-1 rounded-full bg-primary/70 transition-all duration-75" style="height:6px"></span>`).join('');
      }
      return Array.from(viz.children);
    }

    function setToolRecordingVizIdle() {
      const bars = ensureToolRecordingVizBars();
      bars.forEach((bar, idx) => {
        const base = idx % 3 === 0 ? 8 : 6;
        bar.style.height = `${base}px`;
        bar.style.opacity = '0.35';
      });
    }

    function stopToolRecordingVisualizer() {
      if (toolRecordingVizAnimationId) {
        cancelAnimationFrame(toolRecordingVizAnimationId);
        toolRecordingVizAnimationId = null;
      }
      if (toolRecordingSource) {
        try { toolRecordingSource.disconnect(); } catch {}
        toolRecordingSource = null;
      }
      toolRecordingAnalyser = null;
      setToolRecordingVizIdle();
    }

    async function startToolRecordingVisualizer(stream) {
      try {
        const ctx = await ensureAudioReady();
        if (!ctx || !stream) return;
        stopToolRecordingVisualizer();
        toolRecordingAnalyser = ctx.createAnalyser();
        toolRecordingAnalyser.fftSize = 256;
        toolRecordingAnalyser.smoothingTimeConstant = 0.78;
        toolRecordingSource = ctx.createMediaStreamSource(stream);
        toolRecordingSource.connect(toolRecordingAnalyser);
        const bars = ensureToolRecordingVizBars();
        const freqData = new Uint8Array(toolRecordingAnalyser.frequencyBinCount);
        const render = () => {
          if (!toolRecordingAnalyser) return;
          toolRecordingAnalyser.getByteFrequencyData(freqData);
          const chunk = Math.max(1, Math.floor(freqData.length / bars.length));
          bars.forEach((bar, idx) => {
            const start = idx * chunk;
            const end = Math.min(freqData.length, start + chunk);
            let sum = 0;
            for (let i = start; i < end; i++) sum += freqData[i];
            const avg = end > start ? sum / (end - start) : 0;
            const height = 6 + (avg / 255) * 40;
            bar.style.height = `${height.toFixed(1)}px`;
            bar.style.opacity = `${Math.max(0.35, avg / 255)}`;
          });
          toolRecordingVizAnimationId = requestAnimationFrame(render);
        };
        render();
      } catch (e) {
        console.error("Recorder visualizer start failed", e);
      }
    }

    function updateToolRecordingUI(isRecording) {
      const btn = document.getElementById('btn-tool-record');
      const status = document.getElementById('tool-recording-status');
      const vizWrap = document.getElementById('tool-recording-viz-wrap');
      const vizLabel = document.getElementById('tool-recording-viz-label');
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
      if (vizWrap) vizWrap.classList.toggle('hidden', !isRecording);
      if (vizLabel) vizLabel.innerText = isRecording ? 'Capturing...' : 'Idle';
      if (!isRecording) stopToolRecordingVisualizer();
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
        startToolRecordingVisualizer(toolRecordingStream);
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
      return getTimeSignatureParts(timeSignature).beatsPerBar;
    }

    function getPatternSlotCount(beatsPerBar, subdivisionsPerBeat = 2) {
      return beatsPerBar * subdivisionsPerBeat;
    }

    function getPatternCountLabel(idx, subdivisionsPerBeat = 2) {
      const beat = Math.floor(idx / subdivisionsPerBeat) + 1;
      const slot = idx % subdivisionsPerBeat;
      if (subdivisionsPerBeat === 4) {
        return ['' + beat, 'e', '&', 'a'][slot] || '';
      }
      return slot === 0 ? String(beat) : '&';
    }

    function normalizePatternText(strText, beatsPerBarOrTimeSignature, subdivisionsPerBeat = null) {
      const isSignature = typeof beatsPerBarOrTimeSignature === 'string';
      const beatsPerBar = isSignature
        ? getBeatsPerBarFromSignature(beatsPerBarOrTimeSignature || '4/4')
        : (parseInt(beatsPerBarOrTimeSignature, 10) || 4);
      const subdivisions = isSignature
        ? getSubdivisionsPerBeatFromSignature(beatsPerBarOrTimeSignature || '4/4')
        : (subdivisionsPerBeat || 2);
      const totalSlots = getPatternSlotCount(beatsPerBar, subdivisions);
      const cleanText = (strText || '').replace(/\s+/g, '').toUpperCase();
      return Array.from({ length: totalSlots }, (_, i) => {
        const char = cleanText[i] || '.';
        return ['D', 'U', 'X', '.'].includes(char) ? char : '.';
      }).join('');
    }

    function parseStrumPattern(strText, timeSignature = "4/4") {
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      const slotDurationBeats = 1 / subdivisionsPerBeat;
      const cleanText = normalizePatternText(strText, timeSignature);
      const pattern = [];
      const totalSlots = getPatternSlotCount(beatsPerBar, subdivisionsPerBeat);
      for(let i=0; i < totalSlots; i++) {
        const char = cleanText[i] || '.';
        const time = i * slotDurationBeats;
        const type = char === 'D' ? '↓' : (char === 'U' ? '↑' : (char === 'X' ? 'x' : '.'));
        pattern.push({ time, type, raw: char });
      }
      return pattern;
    }

    function updateAddPatternPreviewButtons() {
      addPatternEntries.forEach(entry => {
        const btn = document.getElementById(`add-pattern-preview-btn-${entry.id}`);
        if (!btn) return;
        const isActive = addPatternPreviewEntryId === entry.id;
        btn.innerHTML = isActive
          ? `<i class="fas fa-stop mr-1"></i> Stop`
          : `<i class="fas fa-play mr-1"></i> Play`;
        btn.classList.toggle('bg-danger', isActive);
        btn.classList.toggle('text-white', true);
        btn.classList.toggle('btn-soft', !isActive);
      });
    }

    function stopAddPatternPreview() {
      if (addPatternPreviewTimer) {
        clearInterval(addPatternPreviewTimer);
        addPatternPreviewTimer = null;
      }
      addPatternPreviewEntryId = null;
      addPatternPreviewStepIndex = 0;
      addPatternPreviewTotalSteps = 0;
      updateAddPatternPreviewButtons();
    }

    async function playAddPatternPulse(raw = '.', isBarStart = false, isBeatStart = false) {
      const ctx = await ensureAudioReady();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const char = String(raw || '.').toUpperCase();
      if (char === 'D') osc.frequency.value = isBarStart ? 980 : 820;
      else if (char === 'U') osc.frequency.value = isBarStart ? 1120 : 940;
      else if (char === 'X') osc.frequency.value = 420;
      else osc.frequency.value = isBeatStart ? (isBarStart ? 1100 : 760) : 560;
      const attack = 0.003;
      const decay = char === 'X' ? 0.035 : 0.06;
      const level = char === '.' ? 0.12 : 0.24;
      osc.type = char === 'X' ? 'square' : 'triangle';
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(level, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + decay + 0.01);
    }

    function getFirstChordFromAddEditor() {
      const rawText = document.getElementById('add-chords-text')?.value || '';
      const parsed = parseRawText(rawText, 4);
      return parsed?.flatChords?.[0]?.chord || '';
    }

    window.toggleAddPatternPreview = async function(entryId) {
      if (addPatternPreviewEntryId === entryId) {
        stopAddPatternPreview();
        return;
      }
      const target = addPatternEntries.find(entry => entry.id === entryId);
      if (!target) return;
      const timeSignature = normalizeTimeSignature(target.timeSignature || '4/4');
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      const patternText = normalizePatternText(target.patternText || '', timeSignature);
      const bpm = Math.max(40, Math.min(240, parseInt(document.getElementById('add-bpm')?.value || '80', 10)));
      const slotMs = (60 / bpm) * 1000 / subdivisionsPerBeat;
      const totalSlots = getPatternSlotCount(beatsPerBar, subdivisionsPerBeat);
      const loops = 2;
      const previewChord = getFirstChordFromAddEditor();
      stopAddPatternPreview();
      addPatternPreviewEntryId = entryId;
      addPatternPreviewTotalSteps = totalSlots * loops;
      addPatternPreviewStepIndex = 0;
      updateAddPatternPreviewButtons();
      await playAddPatternPulse(patternText[0] || '.', true, true);
      if ((patternText[0] || '.') !== '.' && (patternText[0] || '.') !== 'X' && previewChord) {
        playChordPreview(previewChord, patternText[0] || 'D', document.getElementById('add-capo')?.value || 'No capo');
      }
      addPatternPreviewStepIndex = 1;
      addPatternPreviewTimer = setInterval(() => {
        if (addPatternPreviewStepIndex >= addPatternPreviewTotalSteps) {
          stopAddPatternPreview();
          return;
        }
        const idx = addPatternPreviewStepIndex % totalSlots;
        const isBeatStart = idx % subdivisionsPerBeat === 0;
        const isBarStart = idx === 0;
        const char = patternText[idx] || '.';
        playAddPatternPulse(char, isBarStart, isBeatStart);
        if (char !== '.' && char !== 'X' && previewChord) {
          playChordPreview(previewChord, char, document.getElementById('add-capo')?.value || 'No capo');
        }
        addPatternPreviewStepIndex += 1;
      }, slotMs);
    };

    function buildPatternEditor(containerId, value, beatsPerBar, clickHandlerName, subdivisionsPerBeat = 2) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.style.gridTemplateColumns = `repeat(${beatsPerBar}, minmax(0, 1fr))`;
      const normalized = normalizePatternText(value, beatsPerBar, subdivisionsPerBeat);
      container.innerHTML = Array.from({ length: beatsPerBar }, (_, beatIdx) => {
        const buildCell = (char, idx) => {
          const symbol = char === 'D' ? '&#8595;' : (char === 'U' ? '&#8593;' : (char === 'X' ? 'x' : '&middot;'));
          const clickExpr = String(clickHandlerName || '').includes('__INDEX__')
            ? String(clickHandlerName).replace('__INDEX__', idx)
            : `${clickHandlerName}(${idx})`;
          return `
            <button type="button" onclick="${clickExpr}" class="pattern-cell ${char !== '.' ? 'active' : ''}">
              <div class="pattern-action ${char === '.' ? 'rest opacity-40' : ''}">${symbol}</div>
              <div class="pattern-count">${getPatternCountLabel(idx, subdivisionsPerBeat)}</div>
            </button>
          `;
        };
        const slotStart = beatIdx * subdivisionsPerBeat;
        const cells = Array.from({ length: subdivisionsPerBeat }, (_, slot) => {
          const idx = slotStart + slot;
          return buildCell(normalized[idx], idx);
        }).join('');
        return `
          <div class="pattern-group" style="grid-template-columns: repeat(${subdivisionsPerBeat}, minmax(0, 1fr));">
            ${cells}
            ${subdivisionsPerBeat === 2 ? '<div class="pattern-pair-bracket"><span></span></div>' : ''}
          </div>
        `;
      }).join('');
    }

    function renderPatternVisualizer(containerId, pattern, beatsPerBar, activeIndex = -1, validationStates = [], subdivisionsPerBeat = 2) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const normalized = normalizePatternText(pattern.map(s => s.raw || '.').join(''), beatsPerBar, subdivisionsPerBeat);
      container.innerHTML = `
        <div class="pattern-editor-grid" style="grid-template-columns: repeat(${beatsPerBar}, minmax(0, 1fr));">
          ${Array.from({ length: beatsPerBar }, (_, beatIdx) => {
            const buildCell = (char, idx) => {
              const symbol = char === 'D' ? '&#8595;' : (char === 'U' ? '&#8593;' : (char === 'X' ? 'x' : '&middot;'));
              const validationClass = validationStates[idx] === 'success' ? 'success' : (validationStates[idx] === 'fail' ? 'fail' : '');
              return `<div class="pattern-cell ${idx === activeIndex ? 'active' : ''} ${validationClass}">
                <div class="pattern-action ${char === '.' ? 'rest' : ''}">${symbol}</div>
                <div class="pattern-count">${getPatternCountLabel(idx, subdivisionsPerBeat)}</div>
              </div>`;
            };
            const slotStart = beatIdx * subdivisionsPerBeat;
            const cells = Array.from({ length: subdivisionsPerBeat }, (_, slot) => {
              const idx = slotStart + slot;
              return buildCell(normalized[idx], idx);
            }).join('');
            return `
              <div class="pattern-group" style="grid-template-columns: repeat(${subdivisionsPerBeat}, minmax(0, 1fr));">
                ${cells}
                ${subdivisionsPerBeat === 2 ? '<div class="pattern-pair-bracket"><span></span></div>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function normalizeChordLookupName(chordName) {
      return String(chordName || '')
        .replace(/[<>()[\]{}]/g, '')
        .replace(/\s+/g, '')
        .trim();
    }

    function getChordDiagramData(chordName) {
      const normalized = normalizeChordLookupName(chordName);
      if (CHORD_LIBRARY[normalized]) return CHORD_LIBRARY[normalized];
      const slashRoot = normalized.split('/')[0];
      if (CHORD_LIBRARY[slashRoot]) return CHORD_LIBRARY[slashRoot];
      const fallback = slashRoot.replace(/maj7|maj|7|sus4|sus2|sus|add\d+|dim|aug/g, '');
      return CHORD_LIBRARY[fallback] || null;
    }

    function renderChordDiagramSvg(chordName, large = false, overrideData = null) {
      const data = overrideData || getChordDiagramData(chordName);
      return UI.renderChordDiagramSvgWithData(getDisplayChordName(chordName), data, large);
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

    function setPreviewChordDiagram(chordName = '') {
      const wrap = document.getElementById('practice-preview-chord-diagram');
      const title = document.getElementById('practice-preview-chord-name');
      if (!wrap || !title) return;
      if (!chordName) {
        title.dataset.chord = '';
        title.innerText = 'Tap a chord';
        wrap.innerHTML = '<p class="text-xs text-gray-500 text-center">Tap any chord above to open its diagram.</p>';
        return;
      }
      title.dataset.chord = chordName;
      title.innerText = getDisplayChordName(chordName);
      wrap.innerHTML = renderChordDiagramSvg(chordName, true);
    }

    function renderPreviewChordsFound(song = currentSong) {
      const container = document.getElementById('practice-preview-chords-found');
      if (!container) return;
      const uniqueChords = Array.from(new Set(
        (Array.isArray(song?.chords) ? song.chords : [])
          .map(item => normalizeChordLookupName(item?.chord || ''))
          .filter(Boolean)
      ));
      if (!uniqueChords.length) {
        container.innerHTML = '<p class="text-xs text-gray-500">No chords detected.</p>';
        return;
      }
      container.innerHTML = `<div class="chord-library-grid">${uniqueChords.map(chord => renderChordDiagramSvg(chord)).join('')}</div>`;
    }

    function ensureChordPopoverContainer() {
      if (chordPopoverState.container && document.body.contains(chordPopoverState.container)) return chordPopoverState.container;
      const existing = document.getElementById('chord-hover-modal');
      if (existing) {
        chordPopoverState.container = existing;
        return existing;
      }
      const node = document.createElement('div');
      node.id = 'chord-hover-modal';
      node.className = 'chord-hover-modal hidden';
      document.body.appendChild(node);
      chordPopoverState.container = node;
      return node;
    }

    function positionChordPopover() {
      const modal = chordPopoverState.container;
      const anchor = chordPopoverState.anchorEl;
      if (!modal || !anchor || !document.body.contains(anchor)) return;
      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.width <= 0 || anchorRect.height <= 0) {
        hideChordPopover();
        return;
      }
      const gap = 10;
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const modalRect = modal.getBoundingClientRect();
      const preferredTop = anchorRect.top - modalRect.height - gap;
      const top = preferredTop < 8 ? Math.min(vh - modalRect.height - 8, anchorRect.bottom + gap) : preferredTop;
      const centerLeft = anchorRect.left + (anchorRect.width / 2) - (modalRect.width / 2);
      const left = Math.max(8, Math.min(vw - modalRect.width - 8, centerLeft));
      modal.style.top = `${Math.max(8, top)}px`;
      modal.style.left = `${left}px`;
    }

    function showChordPopover(chordName, anchorEl = null) {
      const modal = ensureChordPopoverContainer();
      if (!modal) return;
      modal.innerHTML = renderChordDiagramSvg(chordName, false);
      modal.classList.remove('hidden');
      chordPopoverState.visible = true;
      chordPopoverState.chordName = chordName;
      chordPopoverState.anchorEl = anchorEl instanceof HTMLElement ? anchorEl : null;
      positionChordPopover();
    }

    function hideChordPopover() {
      const modal = ensureChordPopoverContainer();
      if (!modal) return;
      modal.classList.add('hidden');
      chordPopoverState.visible = false;
      chordPopoverState.chordName = '';
      chordPopoverState.anchorEl = null;
      modal.innerHTML = '';
    }

    function setupChordPopoverHandlers() {
      if (window.__chordPopoverHandlersBound) return;
      window.__chordPopoverHandlersBound = true;
      document.addEventListener('click', (event) => {
        if (!chordPopoverState.visible) return;
        const target = event.target;
        if (target instanceof Element && (target.closest('#chord-hover-modal') || target.closest('.clickable-chord'))) return;
        hideChordPopover();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideChordPopover();
      });
      window.addEventListener('resize', () => {
        if (chordPopoverState.visible) positionChordPopover();
      });
      window.addEventListener('scroll', () => {
        if (chordPopoverState.visible) positionChordPopover();
      }, true);
    }

    window.openPreviewChordDiagram = function(chordName, anchorEl = null) {
      const normalized = normalizeChordLookupName(chordName);
      if (!normalized) return;
      setPreviewChordDiagram(normalized);
      showChordPopover(normalized, anchorEl);
    };

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
          chordHtml = chordHtml.replace(`id="chord-hl-${activeChordGlobalIdx}"`, `id="chord-hl-${activeChordGlobalIdx}" class="text-active drop-shadow-[0_0_10px_rgba(245,255,74,0.9)] inline-block"`);
        }
        return `
          <div class="practice-line-preview ${state}">
            ${chordHtml ? `<div class="text-primary font-bold whitespace-pre text-[11px] sm:text-[13px]">${chordHtml}</div>` : ''}
            ${entry.lyricLine ? `<div class="practice-lyrics-line text-gray-200 whitespace-pre-wrap leading-snug mt-2 ${state === 'current' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}">${entry.lyricLine}</div>` : ''}
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

    function getChordVoicingData(chordName, capoOffset = 0) {
      const shape = getChordDiagramData(chordName);
      if (!shape?.strings?.length) return [];
      const voices = [];
      shape.strings.forEach((fretValue, stringIdx) => {
        if (String(fretValue).toLowerCase() === 'x') return;
        const fret = Math.max(0, Number(fretValue) || 0);
        const semitones = fret + Math.max(0, Number(capoOffset) || 0);
        const midi = GUITAR_OPEN_STRING_MIDI[stringIdx] + semitones;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        voices.push({
          stringIdx,
          semitones,
          freq
        });
      });
      return voices;
    }

    function chordToFrequencies(chordName, capoOffset = 0) {
      const voiced = getChordVoicingData(chordName, capoOffset).map(item => item.freq);
      if (voiced.length) return voiced;
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

    async function getGuitarToneStringDataUrl(profileId, stringKey) {
      if (!profileId || !stringKey) return '';
      const cacheKey = getToneSampleCacheKey(profileId, stringKey);
      if (guitarToneSampleLoadPromises.has(cacheKey)) {
        return guitarToneSampleLoadPromises.get(cacheKey);
      }
      const promise = repository.loadGuitarToneStringData(profileId, stringKey)
        .then(dataUrl => {
          const value = String(dataUrl || '');
          if (!value) guitarToneSampleLoadPromises.delete(cacheKey);
          return value;
        })
        .catch(err => {
          console.error('Load guitar tone string failed', err);
          guitarToneSampleLoadPromises.delete(cacheKey);
          return '';
        });
      guitarToneSampleLoadPromises.set(cacheKey, promise);
      return promise;
    }

    function stopActiveChordTonePlayers() {
      if (activeChordToneTimers.length) {
        activeChordToneTimers.forEach(timerId => clearTimeout(timerId));
        activeChordToneTimers = [];
      }
      if (!activeChordToneAudios.length) return;
      activeChordToneAudios.forEach(audio => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      });
      activeChordToneAudios = [];
    }

    async function playChordFromSelectedGuitarTone(chordName, direction = 'D', capoOffset = 0) {
      const profile = getActiveGuitarToneProfile();
      if (!profile?.id) return false;
      const voices = getChordVoicingData(chordName, capoOffset);
      if (!voices.length) return false;
      const normalizedDirection = strumTypeToRaw(direction);
      const orderedVoices = normalizedDirection === 'U' ? [...voices].reverse() : voices;
      const audioPayload = await Promise.all(orderedVoices.map(async voice => {
        const stringKey = GUITAR_TONE_STRING_KEYS[voice.stringIdx];
        if (!profile.availableStrings?.[stringKey]) return null;
        const dataUrl = await getGuitarToneStringDataUrl(profile.id, stringKey);
        if (!dataUrl) return null;
        return { voice, dataUrl };
      }));
      if (!audioPayload.length || audioPayload.some(item => !item)) return false;
      stopActiveChordTonePlayers();
      audioPayload.forEach((item, idx) => {
        const audio = new Audio(item.dataUrl);
        audio.preload = 'auto';
        audio.currentTime = 0;
        audio.volume = 0.92;
        audio.playbackRate = Math.max(0.35, Math.min(4, Math.pow(2, item.voice.semitones / 12)));
        audio.preservesPitch = false;
        audio.mozPreservesPitch = false;
        audio.webkitPreservesPitch = false;
        activeChordToneAudios.push(audio);
        audio.onended = () => {
          activeChordToneAudios = activeChordToneAudios.filter(entry => entry !== audio);
        };
        const timer = setTimeout(() => {
          audio.play().catch(() => {
            activeChordToneAudios = activeChordToneAudios.filter(entry => entry !== audio);
          });
        }, idx * 22);
        activeChordToneTimers.push(timer);
      });
      return true;
    }

    function frequencyFromStringFret(stringIdx = 0, fret = 0) {
      const safeStringIdx = Math.max(0, Math.min(5, Number(stringIdx) || 0));
      const safeFret = Math.max(0, Number(fret) || 0);
      const midi = GUITAR_OPEN_STRING_MIDI[safeStringIdx] + safeFret;
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    async function playTabNoteFromSelectedGuitarTone(stringIdx = 0, fret = 0) {
      const profile = getActiveGuitarToneProfile();
      const safeStringIdx = Math.max(0, Math.min(5, Number(stringIdx) || 0));
      const safeFret = Math.max(0, Number(fret) || 0);
      if (profile?.id) {
        const stringKey = GUITAR_TONE_STRING_KEYS[safeStringIdx];
        if (profile.availableStrings?.[stringKey]) {
          const dataUrl = await getGuitarToneStringDataUrl(profile.id, stringKey);
          if (dataUrl) {
            const audio = new Audio(dataUrl);
            audio.preload = 'auto';
            audio.currentTime = 0;
            audio.volume = 0.94;
            audio.playbackRate = Math.max(0.35, Math.min(4, Math.pow(2, safeFret / 12)));
            audio.preservesPitch = false;
            audio.mozPreservesPitch = false;
            audio.webkitPreservesPitch = false;
            audio.play().catch(() => {});
            return true;
          }
        }
      }
      return false;
    }

    async function playTabNote(stringIdx = 0, fret = 0) {
      const tonePlayed = await playTabNoteFromSelectedGuitarTone(stringIdx, fret);
      if (tonePlayed) return;
      const ctx = await ensureAudioReady();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequencyFromStringFret(stringIdx, fret);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.18);
    }

    function mapTabLabelToStringIdx(label = '') {
      const raw = String(label || '').trim();
      if (raw === 'e') return 5;
      if (raw === 'B' || raw === 'b') return 4;
      if (raw === 'G' || raw === 'g') return 3;
      if (raw === 'D' || raw === 'd') return 2;
      if (raw === 'A' || raw === 'a') return 1;
      if (raw === 'E') return 0;
      return null;
    }

    function parseTabEventsFromRows(rows = [], colOffset = 0) {
      const events = [];
      const maxLen = rows.reduce((max, row) => Math.max(max, row.content.length), 0);
      if (!maxLen) return { events, maxLen };
      for (let col = 0; col < maxLen; col += 1) {
        rows.forEach(row => {
          const ch = row.content[col] || '';
          if (!/\d/.test(ch)) return;
          const prev = row.content[col - 1] || '';
          if (/\d/.test(prev)) return;
          let end = col + 1;
          while (end < row.content.length && /\d/.test(row.content[end])) end += 1;
          const fret = parseInt(row.content.slice(col, end), 10);
          if (!Number.isFinite(fret)) return;
          events.push({ col: colOffset + col, stringIdx: row.stringIdx, fret });
        });
      }
      events.sort((a, b) => (a.col - b.col) || (a.stringIdx - b.stringIdx));
      return { events, maxLen };
    }

    function parseTimedTabEventsFromRows(rows = [], timingText = '', colOffset = 0) {
      const timingTokens = String(timingText || '').trim().split(/\s+/).filter(Boolean);
      if (!timingTokens.length) return { events: [], maxLen: 0, usedTiming: false };
      const rowTokensList = rows.map(row => String(row?.content || '').trim().split(/\s+/).filter(Boolean));
      const maxTokenLen = rowTokensList.reduce((max, tokens) => Math.max(max, tokens.length), 0);
      if (!maxTokenLen) return { events: [], maxLen: 0, usedTiming: false };

      const slotCount = Math.max(1, timingTokens.length);
      const beatsFromTiming = timingTokens.reduce((best, token) => {
        const asNum = parseInt(token, 10);
        return Number.isFinite(asNum) ? Math.max(best, asNum) : best;
      }, 0);
      const beatsPerCycle = Math.max(1, beatsFromTiming || 4);
      const totalColumns = beatsPerCycle * TABS_COLUMNS_PER_BEAT;
      const columnsPerSlot = totalColumns / slotCount;
      const events = [];
      rowTokensList.forEach((tokens, rowIdx) => {
        tokens.forEach((token, tokenIdx) => {
          if (!/^\d+$/.test(token)) return;
          const fret = parseInt(token, 10);
          if (!Number.isFinite(fret)) return;
          const normalizedCol = tokenIdx * columnsPerSlot;
          events.push({
            col: colOffset + normalizedCol,
            stringIdx: rows[rowIdx].stringIdx,
            fret
          });
        });
      });
      events.sort((a, b) => (a.col - b.col) || (a.stringIdx - b.stringIdx));
      return { events, maxLen: Math.max(totalColumns, maxTokenLen * columnsPerSlot), usedTiming: true };
    }

    function collectTabGroupsFromLines(lines = []) {
      const groups = [];
      let current = [];
      let startLine = 0;
      const flush = () => {
        if (!current.length) return;
        groups.push({ startLine, rows: current });
        current = [];
      };
      lines.forEach((line, lineIdx) => {
        const trimmed = String(line || '').trim();
        if (!trimmed) {
          flush();
          return;
        }
        const match = trimmed.match(/^([eEbBgGdDaA])\|(.+?)(?:\|)?\s*$/);
        if (!match) {
          flush();
          return;
        }
        const stringIdx = mapTabLabelToStringIdx(match[1]);
        if (stringIdx === null) {
          flush();
          return;
        }
        if (!current.length) startLine = lineIdx;
        current.push({ stringIdx, content: match[2] || '' });
      });
      flush();
      return groups;
    }

    function parseTabsPreviewText(text = '', timingText = '') {
      const lines = String(text || '').replace(/\r/g, '').split('\n');
      const groups = collectTabGroupsFromLines(lines);
      const events = [];
      let timelineCol = 0;
      let partCount = 0;
      groups.forEach(group => {
        const timed = parseTimedTabEventsFromRows(group.rows, timingText, timelineCol);
        const fallback = parseTabEventsFromRows(group.rows, timelineCol);
        const partEvents = (timed.usedTiming && timed.events.length) ? timed.events : fallback.events;
        const maxLen = timed.usedTiming ? Math.max(timed.maxLen, fallback.maxLen || 0) : fallback.maxLen;
        if (!maxLen) return;
        partCount += 1;
        events.push(...partEvents);
        timelineCol += maxLen + TABS_PREVIEW_PART_GAP_COLUMNS;
      });

      events.sort((a, b) => (a.col - b.col) || (a.stringIdx - b.stringIdx));
      return { events, partCount };
    }

    function stopTabsPreviewPlayback() {
      if (tabsPreviewTimerIds.length) {
        tabsPreviewTimerIds.forEach(timer => clearTimeout(timer));
        tabsPreviewTimerIds = [];
      }
      tabsPreviewPlayingHistoryId = '';
      if (document.getElementById('tool-tabs-history-list')) renderTabsPreviewHistory();
      tabsPreviewSessionId += 1;
    }

    window.stopTabsPreview = function() {
      stopTabsPreviewPlayback();
      tabsPreviewPlayingHistoryId = '';
      renderTabsPreviewHistory();
      setTabsPreviewStatus('Stopped.');
    };

    async function playTabsPreviewFromSource({ text = '', bpm = 96, title = '', timing = '' } = {}) {
      const { events, partCount } = parseTabsPreviewText(text, timing);
      if (!events.length) {
        setTabsPreviewStatus('No playable tab notes found. Use lines like e|--0--1--|', true);
        return;
      }
      stopTabsPreviewPlayback();
      const sessionId = tabsPreviewSessionId;
      const msPerColumn = (60_000 / bpm) / TABS_COLUMNS_PER_BEAT;
      const firstCol = events[0].col;
      const lastCol = events[events.length - 1].col;
      const sourceLabel = title ? ` from "${title}"` : '';
      setTabsPreviewStatus(`Playing ${events.length} note${events.length > 1 ? 's' : ''} across ${partCount} part${partCount === 1 ? '' : 's'}${sourceLabel}...`);
      await ensureAudioReady();
      events.forEach((event, idx) => {
        const atMs = Math.max(0, (event.col - firstCol) * msPerColumn);
        const timer = setTimeout(() => {
          if (sessionId !== tabsPreviewSessionId) return;
          playTabNote(event.stringIdx, event.fret);
        }, atMs + (idx % 2 ? 3 : 0));
        tabsPreviewTimerIds.push(timer);
      });
      const endTimer = setTimeout(() => {
        if (sessionId !== tabsPreviewSessionId) return;
        tabsPreviewTimerIds = [];
        setTabsPreviewStatus(`Finished (${Math.max(0, lastCol - firstCol + 1)} columns at ${bpm} BPM).`, false);
        tabsPreviewPlayingHistoryId = '';
        renderTabsPreviewHistory();
      }, Math.max(0, (lastCol - firstCol + 1) * msPerColumn) + 420);
      tabsPreviewTimerIds.push(endTimer);
    }

    window.playTabsPreview = async function() {
      const textarea = document.getElementById('tool-tabs-text');
      const bpmInput = document.getElementById('tool-tabs-bpm');
      const titleInput = document.getElementById('tool-tabs-title');
      const timingInput = document.getElementById('tool-tabs-timing');
      const text = textarea?.value || '';
      const bpm = Math.max(40, Math.min(240, parseInt(bpmInput?.value || '96', 10) || 96));
      const title = sanitizeTabsPreviewTitle(titleInput?.value || '');
      const timing = String(timingInput?.value || '').trim();
      tabsPreviewPlayingHistoryId = tabsPreviewActiveHistoryId || '';
      renderTabsPreviewHistory();
      await playTabsPreviewFromSource({ text, bpm, title, timing });
    };

    window.playTabsPreviewHistoryItem = async function(itemId = '') {
      const item = tabsPreviewHistory.find(entry => entry.id === itemId);
      if (!item) return;
      tabsPreviewPlayingHistoryId = item.id;
      tabsPreviewActiveHistoryId = item.id;
      renderTabsPreviewHistory();
      await playTabsPreviewFromSource({
        text: item.text || '',
        bpm: Math.max(40, Math.min(240, parseInt(item.bpm, 10) || 96)),
        title: sanitizeTabsPreviewTitle(item.title || ''),
        timing: String(item.timing || '').trim()
      });
    };

    function buildSongLineBeatTimeline(rawText = '', beatsPerBar = 4) {
      const lines = String(rawText || '').replace(/\r/g, '').split('\n');
      const lineBeat = new Array(lines.length).fill(0);
      const groups = collectTabGroupsFromLines(lines).map(group => {
        const rowCount = Array.isArray(group?.rows) ? group.rows.length : 0;
        const endLine = Math.max(group.startLine || 0, (group.startLine || 0) + Math.max(0, rowCount - 1));
        const { maxLen } = parseTabEventsFromRows(group.rows || [], 0);
        const durationBeats = maxLen > 0 ? (maxLen / TABS_COLUMNS_PER_BEAT) : 0;
        return { ...group, endLine, durationBeats };
      });
      const groupByStart = new Map(groups.map(group => [group.startLine, group]));
      let currentTime = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const tabGroup = groupByStart.get(i);
        if (tabGroup) {
          for (let lineIdx = i; lineIdx <= tabGroup.endLine && lineIdx < lines.length; lineIdx += 1) {
            lineBeat[lineIdx] = currentTime;
          }
          currentTime += tabGroup.durationBeats;
          i = tabGroup.endLine;
          continue;
        }
        const line = String(lines[i] || '');
        lineBeat[i] = currentTime;
        if (isTagLine(line)) continue;
        if (!isChordLine(line)) continue;
        const tokens = stripLeadingWhitespace(line).replace(/\s+$/, '').match(/[^\s]+/g) || [];
        const chordCount = tokens.filter(token => !/^x\d+$/i.test(token)).length;
        currentTime += chordCount * beatsPerBar;
        if (i + 1 < lines.length) {
          const next = lines[i + 1];
          if (!isChordLine(next) && !isTagLine(next) && String(next || '').trim() !== '') {
            i += 1;
            lineBeat[i] = currentTime;
          }
        }
      }
      return { lineBeat, totalBeats: currentTime };
    }

    function buildSongTabTimelineByRawLine(rawText = '', beatsPerBar = 4) {
      const timeline = buildSongLineBeatTimeline(rawText, beatsPerBar);
      return timeline.lineBeat || [];
    }

    function buildSongTabPlaybackEvents(song = null) {
      const rawText = String(song?.rawText || '');
      if (!rawText.trim()) return { events: [], maxBeat: 0 };
      const beatsPerBar = getBeatsPerBarFromSignature(song?.timeSignature || '4/4');
      const lines = rawText.replace(/\r/g, '').split('\n');
      const groups = collectTabGroupsFromLines(lines);
      if (!groups.length) return { events: [], maxBeat: 0 };
      const timelineByLine = buildSongTabTimelineByRawLine(rawText, beatsPerBar);
      const events = [];
      let maxBeat = 0;
      groups.forEach(group => {
        const anchorBeat = Math.max(0, Number(timelineByLine[group.startLine] || 0));
        const { events: groupEvents } = parseTabEventsFromRows(group.rows, 0);
        groupEvents.forEach(event => {
          const beat = anchorBeat + (event.col / TABS_COLUMNS_PER_BEAT);
          maxBeat = Math.max(maxBeat, beat);
          events.push({ beat, stringIdx: event.stringIdx, fret: event.fret });
        });
      });
      events.sort((a, b) => (a.beat - b.beat) || (a.stringIdx - b.stringIdx));
      return { events, maxBeat };
    }

    async function ensureAudioReady() {
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }
      return audioCtx;
    }

    function stopActiveChordPreview(release = 0.05) {
      stopActiveChordTonePlayers();
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

    async function playChordPreview(chordName, direction = 'D', capoLabel = null) {
      if (!practiceChordAudioEnabled || !chordName) return;
      const capoOffset = getCapoOffset(capoLabel || currentSong?.capo || 'No capo');
      const tonePlayed = await playChordFromSelectedGuitarTone(chordName, direction, capoOffset);
      if (tonePlayed) return;
      const ctx = await ensureAudioReady();
      if (!ctx) return;
      const freqs = chordToFrequencies(chordName, capoOffset);
      if (!freqs.length) return;
      const now = ctx.currentTime;
      const ordered = strumTypeToRaw(direction) === 'U' ? [...freqs].reverse() : freqs;
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

    function buildPracticePatternAssignments(song) {
      const fallbackPattern = (song?.strummingPatterns?.[0]?.strumming || song?.strumming || []).map(slot => ({
        ...slot,
        raw: slot?.raw || '.'
      }));
      const fallbackTimeSignature = normalizeTimeSignature(song?.strummingPatterns?.[0]?.timeSignature || song?.timeSignature || '4/4');
      const fallback = fallbackPattern.length ? fallbackPattern : parseStrumPattern('', fallbackTimeSignature);
      const patternEntries = (song?.strummingPatterns || []).map((entry, idx) => {
        const tags = normalizePatternTagKeys(entry);
        return {
          id: entry?.id || `song-pattern-${idx}`,
          tagKeys: tags,
          pattern: (entry?.strumming || fallback).map(slot => ({ ...slot, raw: slot?.raw || '.' })),
          timeSignature: normalizeTimeSignature(entry?.timeSignature || fallbackTimeSignature, fallbackTimeSignature)
        };
      });
      const catchAllEntry = patternEntries.find(entry => entry.tagKeys.length === 0) || null;
      const assignments = [];
      let lastPatternId = '';
      let lastTagKey = null;
      const chordList = song?.chords || [];
      const chordTagIndex = song?.chordTagIndex || [];
      chordList.forEach(chord => {
        const tagKey = chordTagIndex[chord.lineIdx] || '';
        const matchedEntry = tagKey
          ? patternEntries.find(entry => entry.tagKeys.includes(tagKey))
          : null;
        const selected = matchedEntry || catchAllEntry || {
          id: 'fallback',
          pattern: fallback,
          timeSignature: fallbackTimeSignature
        };
        if (selected.id !== lastPatternId || tagKey !== lastTagKey) {
          assignments.push({ startBeat: chord.time || 0, pattern: selected.pattern, timeSignature: selected.timeSignature, tagKey });
          lastPatternId = selected.id;
          lastTagKey = tagKey;
        }
      });
      if (!assignments.length) {
        assignments.push({ startBeat: 0, pattern: fallback, timeSignature: fallbackTimeSignature, tagKey: '' });
      }
      return assignments;
    }

    function getPracticePatternForBeat(beat) {
      if (!practicePatternAssignments.length) return { index: 0, pattern: activeStrumPattern, timeSignature: currentSong?.timeSignature || '4/4' };
      let chosenIndex = 0;
      for (let i = 0; i < practicePatternAssignments.length; i++) {
        if (beat >= practicePatternAssignments[i].startBeat) chosenIndex = i;
        else break;
      }
      const chosen = practicePatternAssignments[chosenIndex];
      return {
        index: chosenIndex,
        pattern: chosen?.pattern || activeStrumPattern,
        timeSignature: normalizeTimeSignature(chosen?.timeSignature || currentSong?.timeSignature || '4/4')
      };
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

    function applySongDraftToAddForm(draft = {}) {
      const title = String(draft.title || '').trim();
      const artist = String(draft.artist || '').trim();
      const youtubeUrl = normalizeYouTubeUrl(draft.youtubeUrl || '');
      const bpm = Math.max(40, Math.min(240, parseInt(draft.bpm, 10) || 80));
      const defaultTimeSignature = normalizeTimeSignature(draft.timeSignature || '4/4');
      const capo = String(draft.capo || 'No capo').trim() || 'No capo';
      const rawText = String(draft.rawText || '').trim();

      document.getElementById('add-title').value = title || 'Untitled';
      document.getElementById('add-artist').value = artist || 'Unknown Artist';
      document.getElementById('add-youtube-url').value = youtubeUrl;
      document.getElementById('add-bpm').value = String(bpm);
      document.getElementById('add-capo').value = capo;
      document.getElementById('add-chords-text').value = rawText || 'C\nEmpty';

      const patterns = Array.isArray(draft.strummingPatterns) ? draft.strummingPatterns : [];
      addPatternEntries = (patterns.length ? patterns : [{ tags: [], patternText: '' }]).map(entry => ({
        id: nextAddPatternEntryId++,
        tags: normalizePatternTagKeys(entry),
        timeSignature: normalizeTimeSignature(entry?.timeSignature || defaultTimeSignature, defaultTimeSignature),
        patternText: normalizePatternText(extractRawPatternFromEntry(entry), normalizeTimeSignature(entry?.timeSignature || defaultTimeSignature, defaultTimeSignature))
      }));
      syncAddPatternEditor();
    }

    async function startPracticeDetection() {
      return;
    }

    function stopPracticeDetection() {
      practiceValidationStates = [];
    }

    function updatePracticeValidation() {}

    window.openAddSong = function(options = {}) {
      const { skipUrl = false, replaceUrl = false, draft = null } = options || {};
      editingSongId = null;
      document.getElementById('add-view-title').innerText = "New Song";
      document.getElementById('btn-save-song').innerHTML = '<i class="fas fa-save mr-2"></i> Save to Library';
      
      document.getElementById('add-title').value = '';
      document.getElementById('add-artist').value = '';
      document.getElementById('add-youtube-url').value = '';
      document.getElementById('add-bpm').value = '';
      document.getElementById('add-capo').value = 'No capo';
      document.getElementById('add-chords-text').value = '';
      addPatternEntries = [{ id: nextAddPatternEntryId++, tags: [], timeSignature: '4/4', patternText: normalizePatternText('', 4) }];
      syncAddPatternEditor();
      if (draft) applySongDraftToAddForm(draft);
      
      navigate('add-song', { skipUrl, replaceUrl, pathOverride: '/songs/new' });
    };

    window.editCurrentSong = function(options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      if (!currentSong) return;
      editingSongId = currentSong.id;
      
      document.getElementById('add-view-title').innerText = "Edit Song";
      document.getElementById('btn-save-song').innerHTML = '<i class="fas fa-save mr-2"></i> Update Song';
      
      document.getElementById('add-title').value = currentSong.title;
      document.getElementById('add-artist').value = currentSong.artist;
      document.getElementById('add-youtube-url').value = currentSong.youtubeUrl || '';
      document.getElementById('add-bpm').value = currentSong.bpm;
      document.getElementById('add-capo').value = currentSong.capo || 'No capo';
      document.getElementById('add-chords-text').value = currentSong.rawText;
      const defaultTimeSignature = normalizeTimeSignature(currentSong.timeSignature || '4/4');
      const sourcePatterns = Array.isArray(currentSong.strummingPatterns) && currentSong.strummingPatterns.length
        ? currentSong.strummingPatterns
        : [{ tags: [], strumming: currentSong.strumming || [] }];
      addPatternEntries = sourcePatterns.map(entry => ({
        id: nextAddPatternEntryId++,
        tags: normalizePatternTagKeys(entry),
        timeSignature: normalizeTimeSignature(entry.timeSignature || defaultTimeSignature, defaultTimeSignature),
        patternText: normalizePatternText(extractRawPatternFromEntry(entry), normalizeTimeSignature(entry.timeSignature || defaultTimeSignature, defaultTimeSignature))
      }));
      syncAddPatternEditor();
      
      navigate('add-song', { skipUrl, replaceUrl, pathOverride: `/songs/${encodeURIComponent(currentSong.id)}/edit` });
    };

    window.closeAddEdit = function() {
      if (editingSongId) {
        navigate('details');
      } else {
        navigate('home');
      }
    };

    window.saveSong = async function() {
      if (!user) return openAuthModal();
      if (user.isAnonymous) return showToast("Please create an account to edit songs.");

      try {
        const title = document.getElementById('add-title').value || "Untitled";
        const artist = document.getElementById('add-artist').value || "Unknown Artist";
        const youtubeUrl = normalizeYouTubeUrl(document.getElementById('add-youtube-url').value || '');
        const bpm = parseInt(document.getElementById('add-bpm').value) || 80;
        const capo = document.getElementById('add-capo').value || "No capo";
        const rawText = document.getElementById('add-chords-text').value || "C\nEmpty";
        
        const tagOptionMap = new Map(extractTagOptionsFromRawText(rawText).map(item => [item.key, item.label]));
        const preparedPatterns = addPatternEntries.map((entry, idx) => {
          const timeSignature = normalizeTimeSignature(entry.timeSignature || '4/4');
          const patternText = normalizePatternText(entry.patternText || "", timeSignature);
          const tagKeys = normalizePatternTagKeys(entry);
          const tags = tagKeys.map(key => tagOptionMap.get(key) || `[${key}]`);
          return {
            tag: tags[0] || '',
            tagKey: tagKeys[0] || '',
            tags,
            tagKeys,
            timeSignature,
            patternText,
            strumming: parseStrumPattern(patternText, timeSignature),
            index: idx
          };
        }).filter(entry => entry.strumming.length > 0);
        const fallbackPattern = {
          tag: '',
          tagKey: '',
          tags: [],
          tagKeys: [],
          timeSignature: '4/4',
          patternText: normalizePatternText("", '4/4'),
          strumming: parseStrumPattern("", '4/4'),
          index: 0
        };
        const normalizedPatterns = preparedPatterns.length ? preparedPatterns : [fallbackPattern];
        const primaryPattern = normalizedPatterns[0];
        const uniqueTimes = Array.from(new Set(normalizedPatterns.map(entry => normalizeTimeSignature(entry.timeSignature || '4/4'))));
        const songTimeSignature = uniqueTimes.length === 1
          ? uniqueTimes[0]
          : normalizeTimeSignature(primaryPattern?.timeSignature || '4/4');

        const newSongData = {
          title, artist, youtubeUrl, bpm, timeSignature: songTimeSignature, capo, rawText,
          strumming: primaryPattern.strumming,
          strummingPatterns: normalizedPatterns.map(entry => ({
            tag: entry.tag,
            tags: entry.tags,
            tagKey: entry.tagKey,
            tagKeys: entry.tagKeys,
            timeSignature: normalizeTimeSignature(entry.timeSignature || '4/4'),
            patternText: entry.patternText,
            strumming: entry.strumming
          })),
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

    function normalizePathname(path = '/') {
      const raw = String(path || '/').split('?')[0].split('#')[0];
      const trimmed = raw.replace(/\/+$/, '');
      return trimmed || '/';
    }

    function restoreRedirectedRouteFromQuery() {
      try {
        const url = new URL(window.location.href);
        const redirected = url.searchParams.get('r');
        if (!redirected) return;
        const restored = normalizePathname(redirected);
        window.history.replaceState({ path: restored }, '', restored);
      } catch {}
    }

    function pushUrlPath(path, { replace = false } = {}) {
      const normalized = normalizePathname(path);
      const current = normalizePathname(window.location.pathname || '/');
      if (normalized === current) return;
      if (!current.startsWith('/practice')) {
        lastNonPracticePath = current;
      }
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ path: normalized }, '', normalized);
    }

    function buildPathForView(id) {
      if (id === 'home') return '/';
      if (id === 'training') return '/training';
      if (id === 'tuner') return '/tuner';
      if (id === 'tools') return '/tools';
      if (id === 'profile') return '/profile';
      if (id === 'add-song') {
        if (editingSongId) return `/songs/${encodeURIComponent(editingSongId)}/edit`;
        return '/songs/new';
      }
      if (id === 'details') {
        if (currentSong?.id) return `/songs/${encodeURIComponent(currentSong.id)}`;
        return '/songs';
      }
      if (id === 'practice') {
        if (currentSong?.id) return `/practice/${encodeURIComponent(currentSong.id)}/${currentStepMode}`;
        return '/practice';
      }
      if (id === 'artist') {
        if (activeArtistName) return `/artists/${encodeURIComponent(activeArtistName)}`;
        return '/artists';
      }
      return '/';
    }

    window.navigate = function(id, options = {}) {
      const { skipUrl = false, replaceUrl = false, pathOverride = null } = options || {};
      if (id !== 'practice' && isPlaying) stopPlayback();
      hideChordPopover();
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${id}`).classList.add('active');
      if (TAB_VIEWS.has(id)) activeTab = id;
      updateTabBar();
      if (id === 'tools') showToolsHome();
      if (id === 'training') showTrainingHome();
      if (id !== 'tuner') stopTuner();
      if (id !== 'tools') {
        stopTabsPreviewPlayback();
        if (!looperAppBackgroundEnabled && hasActiveLooperTrack()) {
          stopLooperPlayback();
        }
        stopStandaloneMetronome();
        if (toolRecorder && toolRecorder.state === 'recording') toolRecorder.stop();
        else stopToolRecordingStream();
        updateToolRecordingUI(false);
      }
      if (id !== 'training') stopTrainingPlayback();
      if (id !== 'training') {
        saveCurrentTrainingVideoProgress().catch(() => {});
        stopTrainingVideoPlayer();
      }
      if (id !== 'add-song') stopAddPatternPreview();
      if (!skipUrl && !isHandlingRouteChange) {
        pushUrlPath(pathOverride || buildPathForView(id), { replace: replaceUrl });
      }
      updateLooperNowPlayingIndicator();
      updatePracticeFloatingStopButton();
    };

    async function applyRouteFromLocation({ replaceUnknown = true } = {}) {
      if (isHandlingRouteChange) return;
      isHandlingRouteChange = true;
      try {
        const path = normalizePathname(window.location.pathname || '/');
        const parts = path.split('/').filter(Boolean);

        if (!user) {
          navigate('home', { skipUrl: true });
          if (path !== '/') pushUrlPath('/', { replace: true });
          return;
        }

        if (path === '/' || path === '/home') {
          navigate('home', { skipUrl: true });
          return;
        }

        if (path === '/settings' || path === '/profile') {
          navigate('profile', { skipUrl: true });
          return;
        }

        if (path === '/tuner') {
          navigate('tuner', { skipUrl: true });
          return;
        }

        if (parts[0] === 'tools') {
          navigate('tools', { skipUrl: true });
          const tool = decodeURIComponent(parts[1] || '');
          const allowed = new Set(['metronome', 'recorder', 'chords', 'chord-builder', 'guitar-tones', 'songs', 'looper', 'tabs-preview', 'chord-translation', 'ai-song']);
          if (tool && allowed.has(tool)) openToolPage(tool, { skipUrl: true });
          else showToolsHome({ skipUrl: true });
          return;
        }

        if (parts[0] === 'training') {
          navigate('training', { skipUrl: true });
          const page = decodeURIComponent(parts[1] || '');
          const allowed = new Set(['trainings', 'dailies', 'courses', 'strumming']);
          if (page === 'editor') {
            openTrainingArticleEditor(activeTrainingArticleCategory || 'trainings', null, { skipUrl: true });
            return;
          }
          if (page && allowed.has(page)) {
            if (parts[2]) {
              const segment = decodeURIComponent(parts[2] || '');
              if (segment === 'editor') {
                openTrainingArticleEditor(page, null, { skipUrl: true });
                return;
              }
              const articleId = segment;
              const match = trainingArticles.find(item => item.id === articleId && item.category === page);
              if (match) {
                await openTrainingArticleDetail(articleId, { skipUrl: true });
              } else {
                openTrainingPage(page, { skipUrl: true });
              }
            } else {
              openTrainingPage(page, { skipUrl: true });
            }
          } else showTrainingHome({ skipUrl: true });
          return;
        }

        if (parts[0] === 'songs') {
          if (parts.length === 1) {
            navigate('tools', { skipUrl: true });
            openToolPage('songs', { skipUrl: true });
            return;
          }
          if (parts[1] === 'new') {
            openAddSong({ skipUrl: true });
            return;
          }
          const songId = decodeURIComponent(parts[1] || '');
          if (!songId) {
            navigate('home', { skipUrl: true });
            if (replaceUnknown) pushUrlPath('/', { replace: true });
            return;
          }
          if (parts[2] === 'edit') {
            await openSongDetails(songId, { skipUrl: true });
            editCurrentSong({ skipUrl: true });
            return;
          }
          await openSongDetails(songId, { skipUrl: true });
          return;
        }

        if (parts[0] === 'artists') {
          const artistName = decodeURIComponent(parts[1] || '');
          if (!artistName) {
            navigate('home', { skipUrl: true });
            if (replaceUnknown) pushUrlPath('/', { replace: true });
            return;
          }
          openArtistPage(artistName, { skipUrl: true });
          return;
        }

        if (parts[0] === 'practice') {
          const songId = decodeURIComponent(parts[1] || '');
          const parsedStep = parseInt(parts[2] || '1', 10);
          const step = [0, 1, 2, 3].includes(parsedStep) ? parsedStep : 1;
          if (!songId) {
            navigate('home', { skipUrl: true });
            if (replaceUnknown) pushUrlPath('/', { replace: true });
            return;
          }
          await openSongDetails(songId, { skipUrl: true });
          startPractice(step, { skipUrl: true });
          return;
        }

        navigate('home', { skipUrl: true });
        if (replaceUnknown) pushUrlPath('/', { replace: true });
      } catch (e) {
        console.error('Route apply failed', e);
        navigate('home', { skipUrl: true });
      } finally {
        isHandlingRouteChange = false;
      }
    }

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
      activeTunerPresetId = normalizeTunerPresetId(userSettings.tunerPresetId);
      userSettings.tunerPresetId = activeTunerPresetId;
      userSettings.chordNotation = normalizeChordNotationMode(userSettings.chordNotation);
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
      populateTunerPresetOptions();
      renderTuningReference('');
      renderGuitarToneSettingsOptions();
      renderChordNotationSettingsOptions();
      renderGuitarToneProfilesList();
      renderProfileSummary();
      songs = songs.map(song => ensureSongFormat(song));
      if (currentSong?.id) {
        const updated = songs.find(song => song.id === currentSong.id);
        if (updated) currentSong = updated;
      }
      refreshChordNotationInCurrentUi();
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
      const selectedTone = String(document.getElementById('settings-guitar-tone')?.value || '').trim();
      const chordNotation = normalizeChordNotationMode(document.getElementById('settings-chord-notation')?.value || userSettings.chordNotation);
      const nextSettings = {
        ...userSettings,
        practiceTextSize: size,
        activeGuitarToneId: selectedTone,
        chordNotation
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

    window.toggleFavoriteFromList = async function(songId, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!songId) return;
      const favorites = new Set(userSettings.favoriteSongIds || []);
      if (favorites.has(songId)) favorites.delete(songId);
      else favorites.add(songId);
      await persistUserSettingsPartial({ favoriteSongIds: Array.from(favorites) });
      renderHomeDashboard();
      renderToolSongsSearch(document.getElementById('tool-song-search')?.value || '');
      renderArtistPageSongs();
      if (currentSong?.id === songId) updateFavoriteButton();
    };

    function renderArtistSongCard(song) {
      const meta = getSongListMeta(song);
      return `
        <div onclick="openSongPreviewFromList('${song.id}')" class="w-full text-left tool-nav-card btn-press cursor-pointer">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-bold text-white">${song.title}</div>
              <button onclick="openArtistPage('${encodeURIComponent(song.artist || 'Unknown artist')}', event)" class="text-xs text-gray-400 mt-1 underline decoration-transparent hover:decoration-gray-500">${song.artist || 'Unknown artist'}</button>
              <div class="mt-2">${renderStars(getSongRatingAverage(song))}</div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="toggleFavoriteFromList('${song.id}', event)" class="w-8 h-8 rounded-full btn-soft btn-press" title="${meta.favoriteTitle}">
                <i class="${meta.favoriteIcon}"></i>
              </button>
              <i class="fas fa-chevron-right text-primary"></i>
            </div>
          </div>
        </div>
      `;
    }

    function renderArtistPageSongs() {
      const container = document.getElementById('artist-page-results');
      if (!container) return;
      const key = String(activeArtistName || '').trim().toLowerCase();
      const matches = songs.filter(song => String(song.artist || 'Unknown artist').trim().toLowerCase() === key);
      if (!matches.length) {
        container.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No songs found for this artist.</div>`;
        return;
      }
      container.innerHTML = matches.map(song => renderArtistSongCard(song)).join('');
    }

    window.openArtistPage = function(artistName, eventOrOptions = null, maybeOptions = {}) {
      let opts = {};
      if (eventOrOptions && typeof eventOrOptions.preventDefault === 'function') {
        eventOrOptions.preventDefault();
        eventOrOptions.stopPropagation();
        opts = maybeOptions || {};
      } else {
        opts = eventOrOptions || {};
      }
      const { skipUrl = false, replaceUrl = false } = opts || {};
      const decoded = decodeURIComponent(String(artistName || '').trim());
      activeArtistName = decoded || 'Unknown artist';
      const title = document.getElementById('artist-page-title');
      if (title) title.innerText = activeArtistName;
      renderArtistPageSongs();
      navigate('artist', { skipUrl, replaceUrl, pathOverride: `/artists/${encodeURIComponent(activeArtistName)}` });
    };

    window.goBackFromArtistPage = function() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('home');
      }
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

    function renderAddPatternEditors() {
      const holder = document.getElementById('add-strum-editor');
      if (!holder) return;
      const rawText = document.getElementById('add-chords-text')?.value || '';
      const tagOptions = extractTagOptionsFromRawText(rawText);
      const tagLabelByKey = new Map(tagOptions.map(item => [item.key, item.label]));
      addPatternEntries.forEach(entry => {
        normalizePatternTagKeys(entry).forEach(key => {
          if (!tagLabelByKey.has(key)) tagLabelByKey.set(key, `[${key}]`);
        });
      });
      const mergedTagOptions = Array.from(tagLabelByKey.entries()).map(([key, label]) => ({ key, label }));
      if (!addPatternEntries.length) {
        addPatternEntries = [{ id: nextAddPatternEntryId++, tags: [], timeSignature: '4/4', patternText: normalizePatternText('', 4) }];
      }
      addPatternEntries = addPatternEntries.map(entry => ({
        ...entry,
        tags: normalizePatternTagKeys(entry),
        timeSignature: normalizeTimeSignature(entry.timeSignature || '4/4'),
        patternText: normalizePatternText(entry.patternText || '', normalizeTimeSignature(entry.timeSignature || '4/4'))
      }));
      holder.innerHTML = addPatternEntries.map((entry, idx) => `
        <div class="bg-surface border border-gray-700 rounded-xl p-3 mb-3">
          <div class="flex items-start gap-2 mb-2">
            <details class="flex-1 group">
              <summary class="list-none cursor-pointer bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span class="truncate">${entry.tags.length
                  ? entry.tags.map(key => escapeHtml(tagLabelByKey.get(key) || `[${key}]`)).join(', ')
                  : '<span class="text-active font-semibold">All</span>'}</span>
                <i class="fas fa-chevron-down text-[10px] text-gray-400 transition-transform group-open:rotate-180"></i>
              </summary>
              <div class="mt-2 bg-black/40 border border-gray-800 rounded-lg p-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onclick="toggleAddPatternTag(${entry.id}, '__ALL__')"
                  class="rounded-full px-3 py-1 text-[11px] border ${entry.tags.length === 0 ? 'bg-active/20 border-active/60 text-active' : 'bg-black/30 border-gray-700 text-gray-300'}"
                >All</button>
                ${mergedTagOptions.map(option => `
                  <button
                    type="button"
                    onclick="toggleAddPatternTag(${entry.id}, decodeURIComponent('${encodeURIComponent(option.key)}'))"
                    class="rounded-full px-3 py-1 text-[11px] border ${entry.tags.includes(option.key) ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-black/30 border-gray-700 text-gray-300'}"
                  >${escapeHtml(option.label)}</button>
                `).join('')}
              </div>
            </details>
            <select
              onchange="updateAddPatternTimeSignature(${entry.id}, this.value)"
              class="bg-black/30 border border-gray-700 rounded-lg px-2 py-2 text-xs focus:border-primary focus:outline-none text-white"
            >
              ${SUPPORTED_TIME_SIGNATURES.map(sig => `<option value="${sig}" ${entry.timeSignature === sig ? 'selected' : ''}>${sig}</option>`).join('')}
            </select>
            <button
              id="add-pattern-preview-btn-${entry.id}"
              type="button"
              onclick="toggleAddPatternPreview(${entry.id})"
              class="h-9 rounded-lg px-3 text-xs btn-soft btn-press"
              title="Hear pattern"
            >
              <i class="fas fa-play mr-1"></i> Play
            </button>
            <button
              type="button"
              onclick="removeAddPattern(${entry.id})"
              class="w-9 h-9 rounded-lg btn-soft btn-press ${addPatternEntries.length === 1 ? 'opacity-40 pointer-events-none' : ''}"
              title="Remove pattern"
            >
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>
          <div id="add-strum-editor-${entry.id}" class="pattern-editor-grid"></div>
          <div class="text-[10px] text-gray-500 mt-2">Pattern ${idx + 1} • choose <b>All</b> or one/more section tags.</div>
        </div>
      `).join('');
      addPatternEntries.forEach(entry => {
        const timeSignature = normalizeTimeSignature(entry.timeSignature || '4/4');
        const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
        const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
        buildPatternEditor(`add-strum-editor-${entry.id}`, entry.patternText, beatsPerBar, `cycleAddPatternBeat(${entry.id}, __INDEX__)`, subdivisionsPerBeat);
      });
      if (addPatternPreviewEntryId && !addPatternEntries.some(entry => entry.id === addPatternPreviewEntryId)) {
        stopAddPatternPreview();
      } else {
        updateAddPatternPreviewButtons();
      }
    }

    function syncAddPatternEditor() {
      renderAddPatternEditors();
    }
    window.syncAddPatternEditor = syncAddPatternEditor;

    window.addPatternRow = function() {
      stopAddPatternPreview();
      const timeSignature = normalizeTimeSignature(addPatternEntries[addPatternEntries.length - 1]?.timeSignature || '4/4');
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      addPatternEntries.push({
        id: nextAddPatternEntryId++,
        tags: [],
        timeSignature,
        patternText: normalizePatternText('', beatsPerBar, subdivisionsPerBeat)
      });
      renderAddPatternEditors();
    };

    window.removeAddPattern = function(entryId) {
      if (addPatternEntries.length <= 1) return;
      if (addPatternPreviewEntryId === entryId) stopAddPatternPreview();
      addPatternEntries = addPatternEntries.filter(entry => entry.id !== entryId);
      renderAddPatternEditors();
    };

    window.toggleAddPatternTag = function(entryId, value) {
      const target = addPatternEntries.find(entry => entry.id === entryId);
      if (!target) return;
      const normalized = normalizeTagKey(value);
      if (normalized === '__all__') {
        target.tags = [];
        renderAddPatternEditors();
        return;
      }
      if (!normalized) return;
      const next = new Set(normalizePatternTagKeys(target));
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      target.tags = Array.from(next);
      renderAddPatternEditors();
    };

    window.updateAddPatternTimeSignature = function(entryId, value) {
      const target = addPatternEntries.find(entry => entry.id === entryId);
      if (!target) return;
      if (addPatternPreviewEntryId === entryId) stopAddPatternPreview();
      target.timeSignature = normalizeTimeSignature(value || '4/4');
      const beatsPerBar = getBeatsPerBarFromSignature(target.timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(target.timeSignature);
      target.patternText = normalizePatternText(target.patternText || '', beatsPerBar, subdivisionsPerBeat);
      renderAddPatternEditors();
    };

    window.cycleAddPatternBeat = function(entryId, index) {
      const target = addPatternEntries.find(entry => entry.id === entryId);
      if (!target) return;
      if (addPatternPreviewEntryId === entryId) stopAddPatternPreview();
      const timeSignature = normalizeTimeSignature(target.timeSignature || '4/4');
      const chars = normalizePatternText(target.patternText, timeSignature).split('');
      const next = chars[index] === 'D' ? 'U' : (chars[index] === 'U' ? 'X' : (chars[index] === 'X' ? '.' : 'D'));
      chars[index] = next;
      target.patternText = chars.join('');
      renderAddPatternEditors();
    };

    window.updateTrainingPatternEditor = function() {
      const timeSignature = document.getElementById('training-time-sig')?.value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      const holder = document.getElementById('training-pattern-editor');
      const current = holder.dataset.pattern || '';
      const normalized = normalizePatternText(current, beatsPerBar, subdivisionsPerBeat);
      holder.dataset.pattern = normalized;
      UI.buildPatternEditor('training-pattern-editor', normalized, beatsPerBar, 'cycleTrainingPatternBeat', subdivisionsPerBeat);
      renderTrainingPatternPreview();
    };

    window.cycleTrainingPatternBeat = function(index) {
      const timeSignature = document.getElementById('training-time-sig').value || '4/4';
      const holder = document.getElementById('training-pattern-editor');
      const chars = normalizePatternText(holder.dataset.pattern || '', timeSignature).split('');
      chars[index] = chars[index] === 'D' ? 'U' : (chars[index] === 'U' ? 'X' : (chars[index] === 'X' ? '.' : 'D'));
      holder.dataset.pattern = chars.join('');
      updateTrainingPatternEditor();
    };

    function renderTrainingPatternPreview(activeIndex = -1) {
      const timeSignature = document.getElementById('training-time-sig')?.value || '4/4';
      const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      const bpm = parseInt(document.getElementById('training-bpm')?.value || '126', 10);
      const holder = document.getElementById('training-pattern-editor');
      const pattern = parseStrumPattern(holder.dataset.pattern || '', timeSignature);
      document.getElementById('training-title').innerText = `Chorus ${bpm} bpm`;
      UI.renderPatternVisualizer('training-pattern-viz', pattern, beatsPerBar, activeIndex, [], subdivisionsPerBeat);
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
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
      const totalSlots = getPatternSlotCount(beatsPerBar, subdivisionsPerBeat);
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

    function isSongFavorite(songId) {
      return (userSettings.favoriteSongIds || []).includes(songId);
    }

    function getSongListMeta(song) {
      const isFav = isSongFavorite(song.id);
      return {
        favoriteIcon: isFav ? 'fas fa-heart text-primary' : 'far fa-heart text-gray-400',
        favoriteTitle: isFav ? 'Remove favorite' : 'Add favorite'
      };
    }

    function buildContinueCourseCard(article, positionSec = 0) {
      const levelLabel = article.level === 'advance' ? 'Advance' : (article.level === 'medium' ? 'Medium' : 'Beginner');
      const safePos = Math.max(0, Math.floor(Number(positionSec || 0)));
      const image = article.imageUrl
        ? `<img src="${escapeHtml(article.imageUrl)}" alt="" class="w-16 h-16 rounded-xl object-cover border border-gray-700">`
        : `<div class="w-16 h-16 rounded-xl border border-gray-700 bg-black/40 flex items-center justify-center text-primary"><i class="fas fa-play"></i></div>`;
      return `
        <button onclick="openCourseFromHome('${article.id}')" class="w-full text-left tool-nav-card btn-press">
          <div class="flex items-start gap-3">
            ${image}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">${levelLabel}</span>
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-500">•</span>
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">Video</span>
              </div>
              <p class="font-bold text-white truncate">${escapeHtml(article.title || 'Untitled')}</p>
              <p class="text-xs text-gray-400 mt-1 line-clamp-2">${escapeHtml(article.description || 'Continue where you left off.')}</p>
              <p class="text-[11px] text-primary mt-2">Continue at ${formatLooperTime(safePos)}</p>
            </div>
            <i class="fas fa-chevron-right text-primary mt-1"></i>
          </div>
        </button>
      `;
    }

    window.openCourseFromHome = async function(articleId) {
      const article = trainingArticles.find(item => item.id === articleId);
      if (!article) {
        showToast('Course not found.');
        return;
      }
      navigate('training', { skipUrl: true });
      await openTrainingArticleDetail(articleId, { skipUrl: true });
      pushUrlPath(`/training/${encodeURIComponent(article.category || 'courses')}/${encodeURIComponent(articleId)}`);
    };

    window.toggleHomeSection = function(sectionKey) {
      const key = String(sectionKey || '').trim();
      if (!['favorites', 'practice', 'courses'].includes(key)) return;
      homeSectionExpanded[key] = !homeSectionExpanded[key];
      renderHomeDashboard();
    };

    function buildSongDashboardCard(song, options = {}) {
      const stepProgress = userProgress && currentSong?.id === song.id ? userProgress : null;
      const progress = options.progress || stepProgress || { step1: { p: 0 }, step2: { p: 0 }, step3: { p: 0 } };
      const p1 = Math.min(100, progress.step1?.p || 0);
      const p2 = Math.min(100, progress.step2?.p || 0);
      const p3 = Math.min(100, progress.step3?.p || 0);
      const hasProgress = p1 > 0 || p2 > 0 || p3 > 0;
      const p1w = p1 > 0 ? Math.max(4, p1) : 0;
      const p2w = p2 > 0 ? Math.max(4, p2) : 0;
      const p3w = p3 > 0 ? Math.max(4, p3) : 0;
      const meta = getSongListMeta(song);
      const stepsBlock = hasProgress
        ? `<div class="grid gap-2 mt-3 text-[10px]" style="grid-template-columns:repeat(3,minmax(0,1fr));">
            <div>
              <div class="h-2 rounded-full bg-black/80 overflow-hidden border" style="border-color:rgba(187,134,252,0.7)"><div class="h-full rounded-full bg-gradient-to-r from-[#d9b8ff] to-[#bb86fc] shadow-[0_0_12px_rgba(187,134,252,0.9)]" style="width:${p1w}%"></div></div>
            </div>
            <div>
              <div class="h-2 rounded-full bg-black/80 overflow-hidden border" style="border-color:rgba(3,218,198,0.75)"><div class="h-full rounded-full bg-gradient-to-r from-[#6ffff0] to-[#03dac6] shadow-[0_0_12px_rgba(3,218,198,0.95)]" style="width:${p2w}%"></div></div>
            </div>
            <div>
              <div class="h-2 rounded-full bg-black/80 overflow-hidden border" style="border-color:rgba(207,102,121,0.75)"><div class="h-full rounded-full bg-gradient-to-r from-[#ffb3c2] to-[#cf6679] shadow-[0_0_12px_rgba(207,102,121,0.95)]" style="width:${p3w}%"></div></div>
            </div>
          </div>`
        : '';
      return `
        <div onclick="openSongPreviewFromList('${song.id}')" class="w-full text-left tool-nav-card btn-press cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-bold text-white">${song.title}</div>
              <button onclick="openArtistPage('${encodeURIComponent(song.artist || 'Unknown artist')}', event)" class="text-xs text-gray-400 mt-1 underline decoration-transparent hover:decoration-gray-500">${song.artist || 'Unknown artist'}</button>
              <div class="mt-2">${renderStars(getSongRatingAverage(song))}</div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="toggleFavoriteFromList('${song.id}', event)" class="w-8 h-8 rounded-full btn-soft btn-press" title="${meta.favoriteTitle}">
                <i class="${meta.favoriteIcon}"></i>
              </button>
              <i class="fas fa-chevron-right text-primary text-xs"></i>
            </div>
          </div>
          ${stepsBlock}
        </div>
      `;
    }

    function renderHomeDashboard() {
      const favorites = songs.filter(song => (userSettings.favoriteSongIds || []).includes(song.id));
      const recentEntries = userSettings.recentPractice || [];
      const recentSongs = recentEntries
        .map(entry => ({ song: songs.find(song => song.id === entry.songId), progress: entry.progress }))
        .filter(entry => entry.song);
      const recentCourses = normalizeRecentCourses(userSettings.recentCourses || [])
        .map(entry => ({
          article: trainingArticles.find(item => item.id === entry.articleId && item.category === 'courses'),
          positionSec: entry.positionSec
        }))
        .filter(item => !!item.article);

      const favoritesContainer = document.getElementById('home-favorites-list');
      const recentContainer = document.getElementById('home-recent-practice-list');
      const coursesContainer = document.getElementById('home-continue-courses-list');
      const favoritesShowAllBtn = document.getElementById('home-favorites-show-all');
      const practiceShowAllBtn = document.getElementById('home-practice-show-all');
      const coursesShowAllBtn = document.getElementById('home-courses-show-all');

      const favoritesVisible = homeSectionExpanded.favorites ? favorites : favorites.slice(0, 5);
      const practiceVisible = homeSectionExpanded.practice ? recentSongs : recentSongs.slice(0, 5);
      const coursesVisible = homeSectionExpanded.courses ? recentCourses : recentCourses.slice(0, 5);

      if (favoritesShowAllBtn) {
        const hasMore = favorites.length > 5;
        favoritesShowAllBtn.classList.toggle('hidden', !hasMore);
        favoritesShowAllBtn.innerText = homeSectionExpanded.favorites ? 'Show less' : 'Show all';
      }
      if (practiceShowAllBtn) {
        const hasMore = recentSongs.length > 5;
        practiceShowAllBtn.classList.toggle('hidden', !hasMore);
        practiceShowAllBtn.innerText = homeSectionExpanded.practice ? 'Show less' : 'Show all';
      }
      if (coursesShowAllBtn) {
        const hasMore = recentCourses.length > 5;
        coursesShowAllBtn.classList.toggle('hidden', !hasMore);
        coursesShowAllBtn.innerText = homeSectionExpanded.courses ? 'Show less' : 'Show all';
      }

      if (favoritesContainer) favoritesContainer.innerHTML = favorites.length ? favoritesVisible.map(song => buildSongDashboardCard(song)).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No favorite songs yet.</div>`;
      if (recentContainer) recentContainer.innerHTML = recentSongs.length ? practiceVisible.map(({ song, progress }) => buildSongDashboardCard(song, { progress })).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No started practice songs yet.</div>`;
      if (coursesContainer) coursesContainer.innerHTML = recentCourses.length ? coursesVisible.map(({ article, positionSec }) => buildContinueCourseCard(article, positionSec)).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No started courses yet.</div>`;

      const practiceShortcuts = document.getElementById('training-practice-shortcuts');
      if (practiceShortcuts) practiceShortcuts.innerHTML = recentSongs.length ? recentSongs.slice(0, 4).map(({ song, progress }) => buildSongDashboardCard(song, { progress })).join('') : `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">Start from a song on Home to see it here.</div>`;
      renderProfileSummary();
    }

    window.submitHomeSongsSearch = async function(event) {
      if (event) event.preventDefault();
      const input = document.getElementById('home-song-search');
      const query = String(input?.value || '').trim();
      if (!query) return;
      navigate('tools', { skipUrl: true });
      openToolPage('songs', { skipUrl: true });
      pushUrlPath('/tools/songs');
      const toolInput = document.getElementById('tool-song-search');
      if (toolInput) toolInput.value = query;
      submitToolSongsSearch();
    };

    function renderToolSongsSearch(query = '') {
      const container = document.getElementById('tool-songs-results');
      if (!container) return;
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        container.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">Enter a title or artist, then press search.</div>`;
        return;
      }
      const filtered = toolSongsSearchResults || [];
      if (!filtered.length) {
        container.innerHTML = `<div class="bg-black/30 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">No songs found for "${escapeHtml(query)}".</div>`;
        return;
      }
      container.innerHTML = filtered.map(song => renderArtistSongCard(song)).join('');
    }

    window.renderToolSongsSearch = renderToolSongsSearch;

    window.submitToolSongsSearch = async function(event) {
      if (event) event.preventDefault();
      const input = document.getElementById('tool-song-search');
      const query = String(input?.value || '').trim();
      lastToolSongsQuery = query;
      if (!query) {
        toolSongsSearchResults = [];
        renderToolSongsSearch('');
        return;
      }
      try {
        toolSongsSearchResults = await repository.searchSongs(query, { ensureSongFormat, max: 40 });
      } catch (err) {
        console.error('Tool songs online search failed', err);
        toolSongsSearchResults = [];
        showToast("Online search failed.");
      }
      renderToolSongsSearch(query);
    };

    function setPracticeProgressDisplay(percent = 0) {
      const safe = Math.max(0, Math.min(100, percent));
      const visible = safe > 0 ? Math.max(2, safe) : 0;
      const bar = document.getElementById('practice-progress-bar');
      const text = document.getElementById('practice-progress-text');
      if (bar) bar.style.width = `${visible}%`;
      if (text) text.innerText = `${Math.round(safe)}%`;
    }

    function setPracticePreviewControls(isPreview) {
      const footer = document.getElementById('practice-footer');
      const fab = document.getElementById('btn-start-step1-fab');
      const liveControls = document.getElementById('practice-header-live-controls');
      const audioBtn = document.getElementById('btn-practice-audio');
      const bpmWrap = document.getElementById('practice-bpm-wrap');
      const textBtn = document.getElementById('btn-practice-text-settings');
      if (footer) footer.classList.toggle('hidden', !!isPreview);
      if (fab) fab.classList.toggle('hidden', !isPreview);
      if (liveControls) liveControls.classList.toggle('hidden', !!isPreview);
      if (audioBtn) audioBtn.classList.toggle('hidden', !!isPreview);
      if (bpmWrap) bpmWrap.classList.toggle('hidden', !!isPreview);
      if (textBtn) textBtn.classList.remove('hidden');
    }

    function updatePracticeFloatingStopButton() {
      const btn = document.getElementById('practice-floating-stop');
      const practiceView = document.getElementById('view-practice');
      if (!btn || !practiceView) return;
      const visible = !!isPlaying && practiceView.classList.contains('active');
      btn.classList.toggle('hidden', !visible);
    }

    window.stopPracticePlaybackNow = function() {
      if (!isPlaying) return;
      stopPlayback();
      updatePracticeFloatingStopButton();
    };

    function updatePreviewPlayButton() {
      const btn = document.getElementById('btn-preview-play');
      if (!btn) return;
      if (currentStepMode !== 0) {
        btn.classList.add('hidden');
        return;
      }
      btn.classList.remove('hidden');
      if (isPlaying) {
        btn.innerHTML = `<i class="fas fa-stop mr-2"></i> Stop Preview`;
        btn.classList.add('bg-danger', 'text-white');
        btn.classList.remove('bg-primary', 'text-black');
      } else {
        btn.innerHTML = `<i class="fas fa-play mr-2"></i> Play Preview`;
        btn.classList.add('bg-primary', 'text-black');
        btn.classList.remove('bg-danger', 'text-white');
      }
    }

    window.updatePracticeBpmLabel = function(value) {
      const safe = Math.max(40, Math.min(240, parseInt(value, 10) || 80));
      const label = document.getElementById('practice-bpm-value');
      if (label) label.innerText = String(safe);
    };

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

    function renderSongYouTube() {
      const section = document.getElementById('detail-youtube-section');
      const linkEl = document.getElementById('detail-youtube-link');
      const embedEl = document.getElementById('detail-youtube-embed');
      if (!section || !linkEl || !embedEl) return;
      const url = normalizeYouTubeUrl(currentSong?.youtubeUrl || '');
      const embed = getYouTubeEmbedUrl(url);
      if (!url || !embed) {
        section.classList.add('hidden');
        linkEl.href = '#';
        linkEl.innerText = '';
        embedEl.src = '';
        return;
      }
      section.classList.remove('hidden');
      linkEl.href = url;
      linkEl.innerText = url;
      embedEl.src = embed;
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

    window.openSongPreviewFromList = function(songId) {
      const song = songs.find(s => s.id === songId);
      if (!song) {
        showToast("Song not found.");
        return;
      }
      currentSong = song;
      userProgress = getRecentProgressForSong(songId) || getEmptyProgress();
      userProgressSongId = songId;
      startPractice(0);
      if (user && !user.isAnonymous) {
        repository.loadProgress(user.uid, songId)
          .then(remote => {
            if (currentSong?.id !== songId) return;
            userProgress = mergeProgressKeepingMax(userProgress, remote);
            userProgressSongId = songId;
          })
          .catch(err => console.error("Background progress load failed", err));
      }
    };

    window.startSongQuickPreview = function() {
      if (!currentSong) return;
      startPractice(0);
      setTimeout(() => {
        if (!isPlaying) togglePlay();
      }, 160);
    };

    window.openSongDetails = async function(id, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      currentSong = songs.find(s => s.id === id);
      if (!currentSong) {
        showToast("Song not found.");
        navigate('home', { skipUrl, replaceUrl });
        if (skipUrl || isHandlingRouteChange) pushUrlPath('/songs', { replace: true });
        return;
      }
      userProgress = getRecentProgressForSong(currentSong.id) || getEmptyProgress();
      userProgressSongId = currentSong.id;
      renderToolSongsSearch(document.getElementById('tool-song-search')?.value || '');
      document.getElementById('detail-title').innerText = currentSong.title;
      document.getElementById('detail-artist').innerText = currentSong.artist;
      document.getElementById('detail-posted').innerText = currentSong.postedBy || "Anonymous";
      document.getElementById('detail-bpm').innerText = currentSong.bpm;
      const detailSingleTime = getSingleSongTimeSignature(currentSong);
      const detailMetaLabel = document.getElementById('detail-meta-label');
      if (detailMetaLabel) detailMetaLabel.innerText = detailSingleTime ? 'Target BPM, Time & Capo' : 'Target BPM & Capo';
      document.getElementById('detail-time-sig').innerText = detailSingleTime ? `(${detailSingleTime})` : '';
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
      
      renderSongDetailPatterns(currentSong);
      
      const unique = [...new Set(currentSong.chords.map(c => c.chord))];
      renderChordLibrary('detail-chords', unique);
      updateFavoriteButton();
      renderSongYouTube();

      navigate('details', { skipUrl, replaceUrl, pathOverride: `/songs/${encodeURIComponent(currentSong.id)}` });
      renderSteps();
      loadProgress()
        .then(() => renderSteps())
        .catch(err => console.error("Could not load progress", err));
      loadSongSocialData().catch(err => console.error("Could not load social data", err));
      bumpSongStat('views')
        .then(() => {
          const viewEl = document.getElementById('detail-stat-views');
          if (viewEl) viewEl.innerText = String(currentSong.stats?.views || 0);
        })
        .catch(err => console.error("Could not update views", err));
    };

    async function loadProgress() {
      if (!user) return;
      try {
        const remote = await repository.loadProgress(user.uid, currentSong.id);
        userProgress = mergeProgressKeepingMax(userProgress, remote);
        userProgressSongId = currentSong.id;
      } catch(e) {
        console.error("Could not load progress", e);
        userProgress = userProgressSongId === currentSong?.id && userProgress ? userProgress : getEmptyProgress();
        userProgressSongId = currentSong?.id || null;
      }
    }

    function getEmptyProgress() {
      return { step1: { p: 0 }, step2: { p: 0 }, step3: { p: 0 } };
    }

    function mergeProgressKeepingMax(current = null, incoming = null) {
      const base = current || getEmptyProgress();
      const next = incoming || getEmptyProgress();
      return {
        step1: { p: Math.max(base.step1?.p || 0, next.step1?.p || 0) },
        step2: { p: Math.max(base.step2?.p || 0, next.step2?.p || 0) },
        step3: { p: Math.max(base.step3?.p || 0, next.step3?.p || 0) }
      };
    }

    function getRecentProgressForSong(songId) {
      const recent = (userSettings.recentPractice || []).find(entry => entry.songId === songId);
      return recent?.progress || null;
    }

    function renderSongDetailPatterns(song) {
      const container = document.getElementById('detail-strum-viz');
      if (!container) return;
      const patterns = (Array.isArray(song?.strummingPatterns) && song.strummingPatterns.length)
        ? song.strummingPatterns
        : [{
            tag: '',
            tags: [],
            timeSignature: normalizeTimeSignature(song?.timeSignature || '4/4'),
            strumming: Array.isArray(song?.strumming) ? song.strumming : parseStrumPattern('', song?.timeSignature || '4/4')
          }];
      container.classList.remove('pattern-card');
      container.innerHTML = patterns.map((entry, idx) => {
        const labels = normalizePatternTags(entry).map(item => item.label);
        const label = labels.length ? labels.join(', ') : `All Sections`;
        const timeSig = normalizeTimeSignature(entry?.timeSignature || song?.timeSignature || '4/4');
        return `
          <div class="pattern-card mb-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white">${escapeHtml(label)}</span>
              <span class="text-[10px] uppercase tracking-[0.2em] text-gray-500">${timeSig}</span>
            </div>
            <div id="detail-strum-viz-${idx}"></div>
          </div>
        `;
      }).join('');
      patterns.forEach((entry, idx) => {
        const timeSig = normalizeTimeSignature(entry?.timeSignature || song?.timeSignature || '4/4');
        UI.renderPatternVisualizer(
          `detail-strum-viz-${idx}`,
          Array.isArray(entry?.strumming) ? entry.strumming : parseStrumPattern(entry?.patternText || '', timeSig),
          getBeatsPerBarFromSignature(timeSig),
          -1,
          [],
          getSubdivisionsPerBeatFromSignature(timeSig)
        );
      });
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

    window.startPractice = function(step, options = {}) {
      const { skipUrl = false, replaceUrl = false } = options || {};
      if (!currentSong) return;
      if (userProgressSongId !== currentSong.id || !userProgress?.step1 || !userProgress?.step2 || !userProgress?.step3) {
        userProgress = getRecentProgressForSong(currentSong.id) || getEmptyProgress();
        userProgressSongId = currentSong.id;
      }
      currentStepMode = step;
      activePlaybackTotalBeats = Math.max(1, Number(currentSong.totalBeats || 0));
      activeSongTabEvents = [];
      nextSongTabEventIndex = 0;
      currentBpm = currentSong.bpm;
      document.getElementById('practice-bpm').value = currentBpm;
      updatePracticeBpmLabel(currentBpm);
      document.getElementById('practice-title').innerText = currentSong.title;
      document.getElementById('practice-step-label').innerText = `Step ${step}`;
      setPracticeProgressDisplay(0);
      lastPlayedStrumIndex = -1;
      pausedPracticeBeat = null;
      practicePausedByBlur = false;
      practiceValidationStates = [];
      practicePatternAssignments = [];
      activePatternAssignmentIndex = -1;
      updatePracticeAudioButton();
      
      const timeline = document.getElementById('practice-timeline');
      const focus = document.getElementById('step2-focus');
      const rhythmViz = document.getElementById('practice-rhythm-viz');
      const chordPanel = document.getElementById('practice-current-chord-panel');
      const activeTimeSignature = normalizeTimeSignature(currentSong.timeSignature || "4/4");
      const beatsPerBar = getBeatsPerBarFromSignature(activeTimeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(activeTimeSignature);
      
      timeline.innerHTML = '';
      rhythmViz.innerHTML = '';

      if (step === 0) {
        setPracticePreviewControls(true);
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
              ${renderChordNotationSelectHtml('preview-chord-notation')}
              <div class="mt-4 flex items-center justify-end gap-2">
                <button id="btn-preview-play" onclick="togglePlay()" class="bg-primary text-black rounded-full px-5 py-2 text-sm font-bold btn-press">
                  <i class="fas fa-play mr-2"></i> Play Preview
                </button>
                <button onclick="openSongDetails('${currentSong.id}')" class="btn-soft rounded-full px-5 py-2 text-sm btn-press">
                  <i class="fas fa-file-lines mr-2"></i> Open Song Details
                </button>
              </div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-gray-800">
              <div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Pattern</div>
              <div id="practice-preview-pattern"></div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-gray-800">
              <div class="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Chords Found</div>
              <div id="practice-preview-chords-found" class="flex flex-wrap items-center"></div>
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
        activeStrumPattern = normalizedPreview;
        practicePatternAssignments = [{ startBeat: 0, pattern: normalizedPreview, timeSignature: normalizeTimeSignature(currentSong.timeSignature || '4/4'), tagKey: '' }];
        const { events: songTabEvents, maxBeat: songTabMaxBeat } = buildSongTabPlaybackEvents(currentSong);
        activeSongTabEvents = songTabEvents;
        nextSongTabEventIndex = 0;
        if (songTabMaxBeat > activePlaybackTotalBeats) {
          activePlaybackTotalBeats = Math.ceil(songTabMaxBeat + 1);
        }
        practiceValidationStates = new Array(activeStrumPattern.length).fill(null);
        updatePreviewPlayButton();
        UI.renderPatternVisualizer('practice-preview-pattern', normalizedPreview, beatsPerBar, -1, [], subdivisionsPerBeat);
        renderPreviewChordsFound(currentSong);
        const previewFab = document.getElementById('btn-start-step1-fab');
        if (previewFab) previewFab.onclick = () => startPractice(1);
        navigate('practice', {
          skipUrl,
          replaceUrl,
          pathOverride: `/practice/${encodeURIComponent(currentSong?.id || '')}/0`
        });
        return;
      }
      setPracticePreviewControls(false);

      const normalizedStrumming = currentSong.strumming.map(s => ({
        ...s, raw: s.raw || strumTypeToRaw(s.type)
      }));
      const normalizedAssignments = buildPracticePatternAssignments(currentSong);


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
        activeStrumPattern = normalizedAssignments[0]?.pattern || normalizedStrumming;
        practicePatternAssignments = [{
          startBeat: 0,
          pattern: activeStrumPattern,
          timeSignature: normalizeTimeSignature(normalizedAssignments[0]?.timeSignature || currentSong.timeSignature || '4/4'),
          tagKey: ''
        }];
      } else {
        timeline.classList.remove('hidden');
        focus.classList.add('hidden');
        if (step === 1 || step === 3) {
          chordPanel.classList.remove('hidden');
          timeline.classList.add('hidden');
          const firstChord = currentSong.chords?.[0]?.chord || 'C';
          renderChordLibrary('practice-current-chord', [firstChord], firstChord);
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
            for(let i=0; i<getPatternSlotCount(beatsPerBar, subdivisionsPerBeat); i++) {
                activeStrumPattern.push({ time: i * (1 / subdivisionsPerBeat), type: i === 0 ? "↓" : ".", raw: i === 0 ? "D" : "." });
            }
            practicePatternAssignments = [{ startBeat: 0, pattern: activeStrumPattern, timeSignature: normalizeTimeSignature(currentSong.timeSignature || '4/4'), tagKey: '' }];
        } else {
            activeStrumPattern = normalizedAssignments[0]?.pattern || normalizedStrumming;
            practicePatternAssignments = normalizedAssignments;
        }
      }

      practiceValidationStates = new Array(activeStrumPattern.length).fill(null);
      UI.renderPatternVisualizer('practice-rhythm-viz', activeStrumPattern, beatsPerBar, -1, practiceValidationStates, subdivisionsPerBeat);

      const footerButton = document.getElementById('btn-play');
      footerButton.innerHTML = `<i class="fas fa-play mr-2"></i> Start`;
      footerButton.onclick = togglePlay;

      navigate('practice', {
        skipUrl,
        replaceUrl,
        pathOverride: `/practice/${encodeURIComponent(currentSong?.id || '')}/${step}`
      });
    };

    window.togglePlay = async function() {
      if(!isPlaying) {
        await ensureAudioReady();
        const resumingFromPause = pausedPracticeBeat !== null;
        isPlaying = true;
        startTime = audioCtx.currentTime - ((pausedPracticeBeat || 0) * (60 / currentBpm));
        nextNoteTime = audioCtx.currentTime + 0.05;
        const beatsPerBar = getBeatsPerBarFromSignature(currentSong.timeSignature || "4/4");
        currentBeatInBar = Math.floor((pausedPracticeBeat || 0) % beatsPerBar);
        lastSavedPercent = -1;
        lastProgressSaveAtMs = Date.now();
        pausedPracticeBeat = null;
        practicePausedByBlur = false;
        document.getElementById('btn-play').innerHTML = `<i class="fas fa-stop"></i> Stop`;
        document.getElementById('btn-play').classList.replace('bg-primary', 'bg-danger');
        document.getElementById('btn-play').classList.add('text-white');
        document.getElementById('btn-play').classList.replace('shadow-[0_0_20px_rgba(187,134,252,0.4)]', 'shadow-[0_0_20px_rgba(207,102,121,0.4)]');
        updatePreviewPlayButton();
        updatePracticeFloatingStopButton();
        scheduler();
      } else { 
        stopPlayback();
      }
      updatePreviewPlayButton();
      updatePracticeFloatingStopButton();
    };

    function scheduler() {
      const beatsPerBar = getBeatsPerBarFromSignature(currentSong.timeSignature || "4/4");
      
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
      const totalBeats = Math.max(1, Number(activePlaybackTotalBeats || currentSong?.totalBeats || 1));
      const percent = Math.min(100, (beat / totalBeats) * 100);
      setPracticeProgressDisplay(percent);

      const nowMs = Date.now();
      if (currentStepMode > 0 && nowMs - lastProgressSaveAtMs >= 5000) {
        lastProgressSaveAtMs = nowMs;
        const snapshot = Math.round(percent);
        if (snapshot > lastSavedPercent) {
          lastSavedPercent = snapshot;
          saveProg(snapshot);
        }
      }

      const { index: assignmentIndex, pattern: selectedPattern, timeSignature: selectedTimeSignature } = getPracticePatternForBeat(beat);
      const effectiveTimeSignature = normalizeTimeSignature(selectedTimeSignature || currentSong.timeSignature || '4/4');
      const beatsPerBar = getBeatsPerBarFromSignature(effectiveTimeSignature);
      const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(effectiveTimeSignature);
      const subBeat = beat % beatsPerBar;
      if (selectedPattern && selectedPattern !== activeStrumPattern) {
        activeStrumPattern = selectedPattern;
      }
      if (assignmentIndex !== activePatternAssignmentIndex) {
        activePatternAssignmentIndex = assignmentIndex;
        practiceValidationStates = new Array(activeStrumPattern.length).fill(null);
        lastPlayedStrumIndex = -1;
      }
      const activeStrumIndex = Math.floor(subBeat * subdivisionsPerBeat) % getPatternSlotCount(beatsPerBar, subdivisionsPerBeat);
      UI.renderPatternVisualizer('practice-rhythm-viz', activeStrumPattern, beatsPerBar, activeStrumIndex, practiceValidationStates, subdivisionsPerBeat);
      const activeChord = getActiveChordForBeat(beat);
      updatePracticeValidation();

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

      if (currentStepMode === 0 && activeSongTabEvents.length) {
        while (nextSongTabEventIndex < activeSongTabEvents.length && beat >= activeSongTabEvents[nextSongTabEventIndex].beat) {
          const event = activeSongTabEvents[nextSongTabEventIndex];
          playTabNote(event.stringIdx, event.fret);
          nextSongTabEventIndex += 1;
        }
      }

      // Dual Chord/Line Highlighting Logic
      if(currentStepMode !== 2 && currentSong.chords && currentSong.chords.length > 0) {
        if (activeChord) {
          if (currentStepMode === 1 || currentStepMode === 3) {
            renderChordLibrary('practice-current-chord', [activeChord.chord], activeChord.chord);
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
                 c.classList.remove('text-active', 'drop-shadow-[0_0_10px_rgba(245,255,74,0.9)]', 'scale-110', 'inline-block');
                 c.classList.add('text-primary');
             });
             chordEl.classList.remove('text-primary');
             chordEl.classList.add('text-active', 'drop-shadow-[0_0_10px_rgba(245,255,74,0.9)]', 'scale-110', 'inline-block');
          }
        }
      }

      if(beat >= totalBeats) {
        if (currentStepMode > 0) saveProg(100);
        if (currentStepMode > 0 && user && !user.isAnonymous) {
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
      if (!currentSong) return;
      if (currentStepMode === 0) return;
      if (userProgressSongId !== currentSong.id) {
        userProgress = getRecentProgressForSong(currentSong.id) || getEmptyProgress();
        userProgressSongId = currentSong.id;
      }
      const key = `step${currentStepMode}`;
      if (!userProgress[key]) userProgress[key] = { p: 0 };
      if(p > (userProgress[key]?.p || 0)) {
        userProgress[key] = { p };
        rememberRecentPractice(currentSong.id, userProgress).catch(err => console.error('Recent practice update failed', err));
        if (user && !user.isAnonymous) {
          try {
            await repository.saveProgress(user.uid, currentSong.id, userProgress);
          } catch (e) {
            console.error("Progress save failed invisibly", e);
          }
        }
      }
    }

    function pausePracticePlayback(showContinue = true) {
      if (!isPlaying) return;
      const beat = Math.max(0, (audioCtx.currentTime - startTime) / (60 / currentBpm));
      pausedPracticeBeat = beat;
      const percent = Math.min(100, (beat / (currentSong?.totalBeats || 1)) * 100);
      const snapshot = Math.round(percent);
      if (currentStepMode > 0 && snapshot > lastSavedPercent) {
        lastSavedPercent = snapshot;
        saveProg(snapshot);
      }
      isPlaying = false;
      cancelAnimationFrame(animationId);
      stopActiveChordPreview(0.03);
      stopPracticeDetection();
      const btn = document.getElementById('btn-play');
      if (btn) {
        btn.innerHTML = showContinue ? `<i class="fas fa-play mr-2"></i> Continue` : `<i class="fas fa-play mr-2"></i> Start`;
        btn.classList.replace('bg-danger', 'bg-primary');
        btn.classList.add('text-white');
        btn.classList.replace('shadow-[0_0_20px_rgba(207,102,121,0.4)]', 'shadow-[0_0_20px_rgba(187,134,252,0.4)]');
      }
      updatePreviewPlayButton();
      updatePracticeFloatingStopButton();
    }

    function stopPlayback() {
      if (currentStepMode > 0 && isPlaying && audioCtx && currentSong?.totalBeats) {
        const beat = Math.max(0, (audioCtx.currentTime - startTime) / (60 / currentBpm));
        const percent = Math.min(100, (beat / currentSong.totalBeats) * 100);
        const snapshot = Math.round(percent);
        if (snapshot > lastSavedPercent) {
          lastSavedPercent = snapshot;
          saveProg(snapshot);
        }
      }
      isPlaying = false;
      pausedPracticeBeat = null;
      practicePausedByBlur = false;
      cancelAnimationFrame(animationId);
      lastPlayedStrumIndex = -1;
      activeSongTabEvents = [];
      nextSongTabEventIndex = 0;
      activePlaybackTotalBeats = Math.max(1, Number(currentSong?.totalBeats || 1));
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
         c.classList.remove('text-active', 'drop-shadow-[0_0_10px_rgba(245,255,74,0.9)]', 'scale-110', 'inline-block');
         c.classList.add('text-primary');
      });
      updatePreviewPlayButton();
      updatePracticeFloatingStopButton();
    }

    window.stopAndExitPractice = () => { 
      stopPlayback();
      const fallbackPath = currentSong?.id ? `/songs/${encodeURIComponent(currentSong.id)}` : (lastNonPracticePath || '/');
      const canGoBack = window.history.length > 1;
      if (canGoBack) {
        window.history.back();
      } else {
        pushUrlPath(fallbackPath, { replace: true });
        applyRouteFromLocation({ replaceUnknown: true }).catch(err => console.error('Route fallback failed', err));
      }
    };

    function renderBottomTabs() {
      const tabs = [
        { id: 'home', label: 'Home', icon: 'fa-house' },
        { id: 'training', label: 'Training', icon: 'fa-dumbbell' },
        { id: 'tuner', label: 'Tuner', icon: 'fa-microphone' },
        { id: 'tools', label: 'Tools', icon: 'fa-toolbox' }
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
      if (!meter) return;
      const step = Math.abs(getTuneStepValue(cents) ?? 99);
      const pointerTone = step <= 1 ? 'green' : (step <= 3 ? 'orange' : 'red');
      const pointerColorClass = pointerTone === 'green'
        ? 'border-b-[#16c47f] drop-shadow-[0_0_8px_rgba(22,196,127,0.85)]'
        : (pointerTone === 'orange'
          ? 'border-b-[#ff9f1a] drop-shadow-[0_0_8px_rgba(255,159,26,0.85)]'
          : 'border-b-[#ff4d4f] drop-shadow-[0_0_8px_rgba(255,77,79,0.85)]');
      const bars = [];
      for (let i = -8; i <= 8; i++) {
        const distance = Math.abs(i - (cents / 10));
        const active = distance < 1 ? 1 - distance : 0.16;
        const center = i === 0;
        const height = center ? 62 : 40 - Math.min(Math.abs(i) * 2.6, 22);
        bars.push(`<div class="meter-bar w-[10px] rounded-full ${center ? 'bg-primary' : 'bg-gray-700'}" style="height:${height}px;opacity:${Math.max(active, 0.2)}"></div>`);
      }
      const pointerOffset = Math.max(-48, Math.min(48, (cents / 50) * 48));
      meter.innerHTML = `
        <div class="absolute inset-x-0 top-0 flex justify-center pointer-events-none">
          <div class="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[11px] border-l-transparent border-r-transparent ${pointerColorClass}" style="transform:translateX(${pointerOffset}px)"></div>
        </div>
        ${bars.join('')}
      `;
    }

    function normalizeTunerPresetId(presetId = '') {
      const normalized = String(presetId || '').trim().toLowerCase();
      const mapped = normalized === 'standard' ? 'default' : normalized;
      return TUNING_PRESETS.some(item => item.id === mapped) ? mapped : DEFAULT_SETTINGS.tunerPresetId;
    }

    function getActiveTuningPreset() {
      activeTunerPresetId = normalizeTunerPresetId(activeTunerPresetId);
      return TUNING_PRESETS.find(item => item.id === activeTunerPresetId) || TUNING_PRESETS[0];
    }

    function getActiveTuningStrings() {
      return getActiveTuningPreset().strings || [];
    }

    function populateTunerPresetOptions() {
      const select = document.getElementById('tuner-preset');
      if (!select) return;
      activeTunerPresetId = normalizeTunerPresetId(activeTunerPresetId);
      select.innerHTML = TUNING_PRESETS.map(item => `<option value="${item.id}" ${item.id === activeTunerPresetId ? 'selected' : ''}>${item.label}</option>`).join('');
    }

    function renderTuningReference(activeNote = '') {
      const container = document.getElementById('tuner-reference-list');
      if (!container) return;
      container.innerHTML = getActiveTuningStrings().map(item => `
        <div class="tuning-chip ${activeNote === item.note ? 'active' : ''}">
          <p class="text-primary font-bold">${item.note}</p>
          <p class="text-gray-500 mt-1">${item.freq.toFixed(2)}</p>
        </div>
      `).join('');
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
      const strings = getActiveTuningStrings();
      return strings.reduce((best, current) => Math.abs(current.freq - freq) < Math.abs(best.freq - freq) ? current : best);
    }

    function getTuningByNote(note = '') {
      return getActiveTuningStrings().find(item => item.note === note) || null;
    }

    function getTuneStepValue(cents = 0) {
      if (!Number.isFinite(cents)) return null;
      if (Math.abs(cents) < 3) return 0;
      const steps = Math.max(1, Math.round(Math.abs(cents) / 6));
      return cents > 0 ? steps : -steps;
    }

    function centsToTuneSteps(cents = 0) {
      const step = getTuneStepValue(cents);
      if (step === null) return '--';
      if (step === 0) return '0';
      return `${step > 0 ? '+' : ''}${step}`;
    }

    function getMedian(values = []) {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function resolveClosestStringCandidateFrequency(freq = 0) {
      if (!Number.isFinite(freq) || freq <= 0) return freq;
      let bestFreq = freq;
      let bestDistance = Infinity;
      const strings = getActiveTuningStrings();
      [freq, freq * 0.5, freq * 2].forEach(candidate => {
        strings.forEach(item => {
          const distance = Math.abs(1200 * Math.log2(candidate / item.freq));
          if (distance < bestDistance) {
            bestDistance = distance;
            bestFreq = candidate;
          }
        });
      });
      return bestFreq;
    }

    window.changeTunerPreset = function(presetId) {
      const normalizedPresetId = normalizeTunerPresetId(presetId);
      if (!TUNING_PRESETS.some(item => item.id === normalizedPresetId)) return;
      activeTunerPresetId = normalizedPresetId;
      userSettings = { ...userSettings, tunerPresetId: activeTunerPresetId };
      persistUserSettingsPartial({ tunerPresetId: activeTunerPresetId });
      resetTunerStabilityState();
      const noteEl = document.getElementById('tuner-note');
      if (noteEl) noteEl.innerText = '--';
      renderTunerMeter(0);
      renderTuningReference('');
    };

    function resetTunerStabilityState() {
      tunerSmoothedFreq = 0;
      tunerSmoothedCents = 0;
      tunerStableNote = '';
      tunerPendingNote = '';
      tunerPendingNoteFrames = 0;
      tunerNoSignalFrames = 0;
      tunerRecentFreqs = [];
    }

    function startTunerLoop() {
      if (!tunerAnalyser || !audioCtx) return;
      const buffer = new Float32Array(2048);
      const tick = () => {
        tunerAnalyser.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, audioCtx.sampleRate);
        if (freq > 0) {
          tunerNoSignalFrames = 0;
          const correctedFreq = resolveClosestStringCandidateFrequency(freq);
          tunerRecentFreqs.push(correctedFreq);
          if (tunerRecentFreqs.length > 7) tunerRecentFreqs.shift();
          const medianFreq = getMedian(tunerRecentFreqs);
          tunerSmoothedFreq = tunerSmoothedFreq > 0
            ? (tunerSmoothedFreq * 0.87) + (medianFreq * 0.13)
            : medianFreq;

          const nearest = closestString(tunerSmoothedFreq);
          if (!tunerStableNote) tunerStableNote = nearest.note;
          if (nearest.note !== tunerStableNote) {
            if (tunerPendingNote === nearest.note) tunerPendingNoteFrames += 1;
            else {
              tunerPendingNote = nearest.note;
              tunerPendingNoteFrames = 1;
            }
            if (tunerPendingNoteFrames >= 5) {
              tunerStableNote = nearest.note;
              tunerPendingNote = '';
              tunerPendingNoteFrames = 0;
            }
          } else {
            tunerPendingNote = '';
            tunerPendingNoteFrames = 0;
          }

          const locked = getTuningByNote(tunerStableNote) || nearest;
          const rawCents = Math.max(-50, Math.min(50, 1200 * Math.log2(tunerSmoothedFreq / locked.freq)));
          tunerSmoothedCents = (tunerSmoothedCents * 0.78) + (rawCents * 0.22);

          document.getElementById('tuner-note').innerText = centsToTuneSteps(tunerSmoothedCents);
          renderTunerMeter(tunerSmoothedCents);
          renderTuningReference(locked.note);
        } else {
          tunerNoSignalFrames += 1;
          tunerSmoothedCents *= 0.9;
          if (tunerNoSignalFrames >= 12) {
            document.getElementById('tuner-note').innerText = '--';
            renderTunerMeter(0);
            renderTuningReference('');
            if (tunerNoSignalFrames >= 30) resetTunerStabilityState();
          } else {
            renderTunerMeter(tunerSmoothedCents);
            renderTuningReference(tunerStableNote);
          }
        }
        tunerAnimationId = requestAnimationFrame(tick);
      };
      tick();
    }

    async function startTuner() {
      try {
        if (!audioCtx) audioCtx = new AudioContext();
        resetTunerStabilityState();
        const useSystemAudio = !!document.getElementById('tuner-use-system-audio')?.checked;
        tunerAudioMode = useSystemAudio ? 'system' : 'mic';
        if (useSystemAudio) {
          if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('System audio capture is not supported in this browser.');
          tunerStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          const hasAudioTrack = (tunerStream.getAudioTracks() || []).length > 0;
          if (!hasAudioTrack) {
            tunerStream.getTracks().forEach(track => track.stop());
            tunerStream = null;
            throw new Error('No audio track was shared. Enable audio in the share dialog.');
          }
        } else {
          tunerStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        tunerAnalyser = audioCtx.createAnalyser();
        tunerAnalyser.fftSize = 2048;
        tunerSource = audioCtx.createMediaStreamSource(tunerStream);
        tunerSource.connect(tunerAnalyser);
        document.getElementById('btn-tuner-toggle').innerHTML = `<i class="fas fa-stop mr-2"></i> Stop Tuner`;
        document.getElementById('btn-tuner-toggle').classList.replace('bg-primary', 'bg-danger');
        document.getElementById('btn-tuner-toggle').classList.add('text-white');
        startTunerLoop();
      } catch (err) {
        console.error(err);
        showToast(tunerAudioMode === 'system'
          ? "Could not capture PC/screen audio. Share with audio enabled."
          : "Microphone access is required for the tuner.");
      }
    }

    function stopTuner() {
      cancelAnimationFrame(tunerAnimationId);
      tunerAnimationId = null;
      resetTunerStabilityState();
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
      renderTuningReference('');
      tunerAudioMode = 'mic';
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

    function renderBuildInfo() {
      const el = document.getElementById('settings-build-info');
      if (!el) return;
      const localPcTime = new Date().toLocaleString();
      el.innerText = `Version ${APP_BUILD.version} • Updated ${localPcTime}`;
    }

    async function registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      try {
        if (isLocalhost) {
          // In local dev we want instant JS/CSS updates without stale SW cache.
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(reg => reg.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
          }
          return;
        }
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.error('Service worker registration failed', err);
      }
    }

    let appBooted = false;
    function bootApp() {
      if (appBooted) return;
      appBooted = true;
      registerServiceWorker();
      restoreRedirectedRouteFromQuery();
      populateCapoOptions();
      renderBottomTabs();
      setupChordPopoverHandlers();
      applyUserSettings(DEFAULT_SETTINGS);
      populateTunerPresetOptions();
      renderTunerMeter(0);
      renderTuningReference('');
      renderToolRecordings();
      setToolRecordingVizIdle();
      renderChordExplorer();
      resetGuitarToneEditor();
      setGuitarToneEditorOpen(false);
      renderGuitarToneSettingsOptions();
      initLooperUi();
      loadTabsPreviewHistory();
      renderTabsPreviewHistory();
      renderToolSongsSearch();
      renderBuildInfo();
      refreshLibraryAdminButtons();
      showToolsHome({ skipUrl: true });
      syncAddPatternEditor();
      updateTrainingPatternEditor();
      restoreMetronomeSettings();
      renderStandaloneMetronomeVisual();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          saveCurrentTrainingVideoProgress().catch(() => {});
          if (activeLooperHistoryId) saveActiveLooperStateNow(false).catch(() => {});
          stopTuner();
          stopStandaloneMetronome();
          if (toolRecorder && toolRecorder.state === 'recording') toolRecorder.stop();
          else stopToolRecordingStream();
          updateToolRecordingUI(false);
          stopTrainingPlayback();
          stopPracticeDetection();
          if (isPlaying) {
            pausePracticePlayback(true);
            practicePausedByBlur = true;
          }
        } else if (practicePausedByBlur && document.getElementById('view-practice')?.classList.contains('active')) {
          showToast("Practice paused. Tap Continue to resume.", true);
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!document.getElementById('text-settings-modal')?.classList.contains('hidden')) return closeTextSettingsModal();
        if (!document.getElementById('rating-modal')?.classList.contains('hidden')) return closeRatingModal();
        if (document.getElementById('view-practice')?.classList.contains('active')) return stopAndExitPractice();
      });
      window.addEventListener('popstate', () => {
        applyRouteFromLocation({ replaceUnknown: true }).catch(err => console.error('Popstate route failed', err));
      });
      window.addEventListener('beforeunload', () => {
        stopLooperPlayback();
      });
      initApp();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      bootApp();
    } else {
      window.addEventListener('load', bootApp, { once: true });
    }
