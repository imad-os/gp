export const NOTE_INDEX = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SUPPORTED_TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '2/16', '3/16', '4/16', '6/16'];

export const CHORD_LIBRARY = {
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

export const MOCK_SONG = {
  title: "Ya Rayah",
  artist: "Cheb Khaled",
  postedBy: "System",
  bpm: 80,
  timeSignature: "4/4",
  capo: "No capo",
  ownerId: "system",
  rawText: "Am                                G\nYa rayah win msafar trouh taaya wa twali\nF                                 E\nChhal nadmou laabad lghafline qablak ou qabli\n\nAm                                G\nYa rayah win msafar trouh taaya wa twali",
  strumming: [
    { time: 0, type: "↓", raw: "D" }, { time: 0.5, type: ".", raw: "." },
    { time: 1, type: "↓", raw: "D" }, { time: 1.5, type: "↑", raw: "U" },
    { time: 2, type: ".", raw: "." }, { time: 2.5, type: "↑", raw: "U" },
    { time: 3, type: "↓", raw: "D" }, { time: 3.5, type: "↑", raw: "U" }
  ]
};

export function normalizeTimeSignature(value = '', fallback = '4/4') {
  const normalized = String(value || '').trim();
  if (SUPPORTED_TIME_SIGNATURES.includes(normalized)) return normalized;
  return SUPPORTED_TIME_SIGNATURES.includes(fallback) ? fallback : '4/4';
}

export function getTimeSignatureParts(timeSignature = '4/4') {
  const normalized = normalizeTimeSignature(timeSignature);
  const [numRaw, denRaw] = normalized.split('/');
  const beatsPerBar = parseInt(numRaw, 10) || 4;
  const denominator = parseInt(denRaw, 10) || 4;
  return { beatsPerBar, denominator, normalized };
}

export function getBeatsPerBarFromSignature(timeSignature = "4/4") {
  return getTimeSignatureParts(timeSignature).beatsPerBar;
}

export function getSubdivisionsPerBeatFromSignature(timeSignature = '4/4') {
  const { denominator } = getTimeSignatureParts(timeSignature);
  if (denominator === 16) return 4;
  return 2;
}

export function getPatternSlotCount(beatsPerBar, subdivisionsPerBeat = 2) {
  return beatsPerBar * subdivisionsPerBeat;
}

export function getPatternCountLabel(idx, subdivisionsPerBeat = 2) {
  const beat = Math.floor(idx / subdivisionsPerBeat) + 1;
  const slot = idx % subdivisionsPerBeat;
  if (subdivisionsPerBeat === 4) return [String(beat), 'e', '&', 'a'][slot] || '';
  return slot === 0 ? String(beat) : '&';
}

export function normalizePatternText(strText, beatsPerBarOrTimeSignature, subdivisionsPerBeat = null) {
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

export function parseStrumPattern(strText, timeSignature = "4/4") {
  const beatsPerBar = getBeatsPerBarFromSignature(timeSignature);
  const subdivisionsPerBeat = getSubdivisionsPerBeatFromSignature(timeSignature);
  const slotDurationBeats = 1 / subdivisionsPerBeat;
  const cleanText = normalizePatternText(strText, timeSignature);
  const pattern = [];
  const totalSlots = getPatternSlotCount(beatsPerBar, subdivisionsPerBeat);
  for (let i = 0; i < totalSlots; i++) {
    const char = cleanText[i] || '.';
    const time = i * slotDurationBeats;
    const type = char === 'D' ? '↓' : (char === 'U' ? '↑' : (char === 'X' ? 'x' : '.'));
    pattern.push({ time, type, raw: char });
  }
  return pattern;
}

export function stripLeadingWhitespace(line = "") {
  return line.replace(/^\s+/, '');
}

export function isChordLine(line) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const chordRegex = /^([A-G][#b]?(m|maj|min|aug|dim|sus|add)?\d*(\/[A-G][#b]?)?)$/i;
  return words.every(word => chordRegex.test(word));
}

export function isTagLine(line) {
  return /^\s*\[[^\]]+\]\s*$/.test(line || "");
}

export function parseRawText(text, beatsPerBar = 4) {
  const lines = text.split('\n');
  let parsedLines = [];
  let flatChords = [];
  let currentTime = 0;
  let globalChordIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTagLine(line)) continue;

    if (isChordLine(line)) {
      const normalizedChordLine = stripLeadingWhitespace(line).replace(/\s+$/, '');
      let nextLine = (i + 1 < lines.length && !isChordLine(lines[i + 1]) && !isTagLine(lines[i + 1]) && lines[i + 1].trim() !== "") ? lines[i + 1] : "";
      if (nextLine !== "") i++;

      const chordRegex = /[^\s]+/g;
      let match;
      let chordHtml = "";
      let lastIdx = 0;
      let lineChords = [];

      while ((match = chordRegex.exec(normalizedChordLine)) !== null) {
        const chordStr = match[0];
        chordHtml += normalizedChordLine.substring(lastIdx, match.index);
        chordHtml += `<span id="chord-hl-${globalChordIdx}" class="transition-all duration-200">${chordStr}</span>`;
        lastIdx = match.index + chordStr.length;

        const chordObj = { chord: chordStr, time: currentTime, lineIdx: parsedLines.length, globalIdx: globalChordIdx };
        flatChords.push(chordObj);
        lineChords.push(chordObj);
        currentTime += beatsPerBar;
        globalChordIdx++;
      }
      chordHtml += normalizedChordLine.substring(lastIdx);
      parsedLines.push({ chordHtml, lyricLine: stripLeadingWhitespace(nextLine), chords: lineChords });
    } else if (line.trim() !== "") {
      parsedLines.push({ chordHtml: "", lyricLine: stripLeadingWhitespace(line), chords: [] });
    } else {
      if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].chordHtml === '' && parsedLines[parsedLines.length - 1].lyricLine === '') continue;
      parsedLines.push({ chordHtml: "", lyricLine: "", chords: [] });
    }
  }

  if (flatChords.length === 0) {
    flatChords = [{ chord: "C", time: 0, lineIdx: 0, globalIdx: 0 }];
    parsedLines = [{ chordHtml: `<span id="chord-hl-0">C</span>`, lyricLine: "Empty", chords: flatChords }];
  }

  return { parsedLines, flatChords, totalBeats: Math.max(flatChords.at(-1)?.time + beatsPerBar, beatsPerBar) };
}

export function ensureSongFormat(song) {
  if (!song.rawText && song.chords) {
    song.rawText = song.chords.map(c => `${c.chord}\n${c.lyric}`).join('\n\n');
  }
  song.capo = song.capo || "No capo";
  const rawPattern = (song.strumming || []).map(s => s.raw || (s.type === '↓' ? 'D' : (s.type === '↑' ? 'U' : '.'))).join('');
  song.strumming = parseStrumPattern(rawPattern, song.timeSignature || "4/4");
  const beatsPerBar = getBeatsPerBarFromSignature(song.timeSignature || "4/4");
  const parsed = parseRawText(song.rawText || "C\nNew Song", beatsPerBar);
  song.parsedLines = parsed.parsedLines;
  song.chords = parsed.flatChords;
  song.totalBeats = parsed.totalBeats;
  return song;
}

export function getCapoOffset(capoLabel = "No capo") {
  const match = String(capoLabel || '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) || 0 : 0;
}

export function transposeNoteName(note, semitones = 0) {
  const idx = NOTE_INDEX[note];
  if (idx === undefined) return note;
  return NOTE_NAMES[(idx + semitones + 12) % 12];
}

export function chordToFrequencies(chordName, capoOffset = 0) {
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

export function chordToPitchClasses(chordName, capoOffset = 0) {
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

export function getChordDiagramData(chordName) {
  const normalized = String(chordName || '').trim();
  if (CHORD_LIBRARY[normalized]) return CHORD_LIBRARY[normalized];
  const fallback = normalized.replace(/maj7|maj|7|sus4|sus2|sus|add\d+|dim|aug/g, '');
  return CHORD_LIBRARY[fallback] || null;
}
