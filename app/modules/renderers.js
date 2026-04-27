import { getPatternCountLabel, normalizePatternText, getChordDiagramData } from './music.js';

export function buildPatternEditor(containerId, value, beatsPerBar, clickHandlerName, subdivisionsPerBeat = 2) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.gridTemplateColumns = `repeat(${beatsPerBar}, minmax(0, 1fr))`;
  const normalized = normalizePatternText(value, beatsPerBar, subdivisionsPerBeat);
  container.innerHTML = Array.from({ length: beatsPerBar }, (_, beatIdx) => {
    const buildCell = (char, idx) => {
      const symbol = char === 'D' ? '&#8595;' : (char === 'U' ? '&#8593;' : (char === 'X' ? 'x' : '&middot;'));
      return `
        <button type="button" onclick="${clickHandlerName}(${idx})" class="pattern-cell ${char !== '.' ? 'active' : ''}">
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

export function renderPatternVisualizer(containerId, pattern, beatsPerBar, activeIndex = -1, validationStates = [], subdivisionsPerBeat = 2) {
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

export function renderChordDiagramSvg(chordName, large = false) {
  const data = getChordDiagramData(chordName);
  return renderChordDiagramSvgWithData(chordName, data, large);
}

export function renderChordDiagramSvgWithData(chordName, data, large = false) {
  if (!data) {
    return `<div class="chord-diagram-card ${large ? 'large' : ''} flex items-center justify-center min-h-[120px]"><div class="text-center"><p class="text-xl font-bold text-primary">${chordName}</p><p class="text-[10px] text-gray-500 mt-2">Diagram soon</p></div></div>`;
  }

  const stringXs = [18, 34, 50, 66, 82, 98];
  const fretYs = [37, 56, 75, 94, 113];
  const baseFret = Math.max(1, Number(data.baseFret) || 1);
  const strings = Array.isArray(data.strings) ? data.strings : [];
  const fingers = Array.isArray(data.fingers) ? data.fingers : [];
  const barreGroups = new Map();
  strings.forEach((fret, idx) => {
    const finger = Number(fingers[idx]) || 0;
    if (typeof fret !== 'number' || fret <= 0 || finger <= 0) return;
    const key = `${finger}:${fret}`;
    if (!barreGroups.has(key)) barreGroups.set(key, []);
    barreGroups.get(key).push(idx);
  });

  const barreCandidate = [...barreGroups.entries()]
    .map(([key, idxs]) => {
      const [finger, fret] = key.split(':').map(v => Number(v) || 0);
      const indices = idxs.slice().sort((a, b) => a - b);
      return { finger, fret, indices, span: indices[indices.length - 1] - indices[0] };
    })
    .filter(item => item.indices.length >= 2)
    .sort((a, b) => {
      if (a.fret !== b.fret) return a.fret - b.fret;
      return b.span - a.span;
    })[0] || null;

  const barreIndices = new Set(barreCandidate?.indices || []);
  const barreFinger = barreCandidate?.finger || 0;
  const barreLocalFret = barreCandidate ? Math.max(1, barreCandidate.fret - baseFret + 1) : -1;
  const barreY = barreLocalFret >= 1 ? fretYs[Math.min(barreLocalFret - 1, fretYs.length - 1)] : null;
  const barreMarkup = (barreCandidate && barreY !== null && barreLocalFret <= fretYs.length)
    ? (() => {
      const startX = stringXs[Math.max(0, barreCandidate.indices[0])] - 7;
      const endX = stringXs[Math.min(stringXs.length - 1, barreCandidate.indices[barreCandidate.indices.length - 1])] + 7;
      return `
        <rect x="${startX}" y="${barreY - 6}" width="${Math.max(12, endX - startX)}" height="12" rx="6" fill="#f2e7dc" stroke="#c9b29b" stroke-width="0.9"></rect>
        ${barreFinger ? `<text x="${((startX + endX) / 2) - 0.8}" y="${barreY + 4}" text-anchor="middle" fill="#4f3726" font-size="12" font-weight="500">${barreFinger}</text>` : ''}
      `;
    })()
    : '';

  const markers = strings.map((fret, idx) => {
    const x = stringXs[idx];
    if (fret === 'x') return `<text x="${x}" y="18" text-anchor="middle" fill="#8b8b8b" font-size="12">x</text>`;
    if (fret === 0) return `<text x="${x}" y="18" text-anchor="middle" fill="#8b8b8b" font-size="12">o</text>`;
    if (barreCandidate && barreIndices.has(idx) && fret === barreCandidate.fret && (Number(fingers[idx]) || 0) === barreFinger) return '';
    const localFret = Math.max(1, fret - baseFret + 1);
    const y = fretYs[Math.min(localFret - 1, fretYs.length - 1)];
    return `<circle cx="${x}" cy="${y}" r="7" fill="#f3e9df" stroke="#cfb8a0" stroke-width="1"/><text x="${x}" y="${y + 3}" text-anchor="middle" fill="#4f3726" font-size="8" font-weight="700">${fingers[idx] || ''}</text>`;
  }).join('');

  const nutLine = baseFret === 1 ? `<line x1="18" y1="28" x2="102" y2="28" stroke="#9a9a9a" stroke-width="4"/>` : '';
  const positionBadge = baseFret > 1
    ? `<rect x="0" y="27" width="22" height="24" rx="5" fill="#1f1f1f" stroke="#5a5a5a" stroke-width="1.2"/><text x="10.4" y="43.5" text-anchor="middle" fill="#f2f2f2" font-size="14" font-weight="500">${baseFret}</text>`
    : '';
  return `
    <div class="chord-diagram-card ${large ? 'large' : ''}">
      <p class="text-center text-primary font-bold ${large ? 'text-3xl mb-3' : 'text-sm mb-2'}">${chordName}</p>
      <svg viewBox="0 0 120 150" class="chord-diagram-svg">
        <use href="#chord-diagram-template"></use>
        ${nutLine}
        ${positionBadge}
        ${barreMarkup}
        ${markers}
      </svg>
    </div>
  `;
}

export function renderChordLibrary(containerId, chords, largeCurrentChord = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (largeCurrentChord) {
    container.innerHTML = renderChordDiagramSvg(largeCurrentChord, true);
    return;
  }
  container.innerHTML = `<div class="chord-library-grid">${chords.map(chord => renderChordDiagramSvg(chord)).join('')}</div>`;
}

export function renderPracticeCurrentLine({ containerId, lineData, parsedLines, activeChordGlobalIdx = null }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!lineData) {
    container.innerHTML = `<p class="text-sm text-gray-500 text-center">Waiting for first chord...</p>`;
    return;
  }
  const currentIndex = parsedLines?.findIndex(line => line === lineData) ?? -1;
  const previousLine = currentIndex > 0 ? parsedLines[currentIndex - 1] : null;
  const nextLine = currentIndex >= 0 && currentIndex < parsedLines.length - 1 ? parsedLines[currentIndex + 1] : null;

  const renderLine = (entry, state) => {
    if (!entry || (!entry.chordHtml && !entry.lyricLine)) {
      return `<div class="practice-line-preview ${state} min-h-[54px]"></div>`;
    }
    let chordHtml = entry.chordHtml || '';
    if (state === 'current' && activeChordGlobalIdx !== null) {
      chordHtml = chordHtml.replace(`id="chord-hl-${activeChordGlobalIdx}"`, `id="chord-hl-${activeChordGlobalIdx}" class="text-active drop-shadow-[0_0_8px_rgba(3,218,198,0.8)] inline-block"`);
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

export function renderSongList(containerId, songs) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = songs.map(s => `
    <div onclick="openSongDetails('${s.id}')" class="bg-surface rounded-xl p-4 flex justify-between items-center border border-gray-800 btn-press hover:border-primary transition-colors cursor-pointer">
      <div><h3 class="font-bold text-white">${s.title}</h3><p class="text-xs text-gray-500">${s.artist}</p></div>
      <i class="fas fa-chevron-right text-primary opacity-50"></i>
    </div>
  `).join('');
}

export function renderPracticeSteps(containerId, userProgress) {
  const steps = [
    { id: 0, name: "Preview", desc: "See lyrics, chords, capo, and pattern before you play", icon: "fa-eye" },
    { id: 1, name: "Chords Mastery", desc: "1 Downstroke per measure", icon: "fa-guitar" },
    { id: 2, name: "Rhythm Pattern", desc: "Focus on the strumming visual", icon: "fa-drum" },
    { id: 3, name: "Full Song", desc: "The ultimate performance", icon: "fa-music" }
  ];
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = steps.map(s => {
    if (s.id === 0) {
      return `
        <div onclick="startPractice(0)" class="bg-surface-light rounded-xl p-4 flex justify-between items-center cursor-pointer border border-gray-800 hover:border-gray-600 transition-colors btn-press relative overflow-hidden">
          <div class="flex gap-4 items-center pl-2">
            <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shadow-sm">
              <i class="fas fa-eye"></i>
            </div>
            <div><h4 class="font-bold text-sm text-white">${s.name}</h4><p class="text-[10px] text-gray-500">${s.desc}</p></div>
          </div>
          <span class="text-xs font-bold text-gray-400">Open</span>
        </div>
      `;
    }
    const p = userProgress[`step${s.id}`]?.p || 0;
    const isComplete = p >= 100;
    return `
      <div onclick="startPractice(${s.id})" class="bg-surface-light rounded-xl p-4 flex justify-between items-center cursor-pointer border border-gray-800 hover:border-gray-600 transition-colors btn-press relative overflow-hidden">
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-${isComplete ? '100' : '0'}"></div>
        <div class="flex gap-4 items-center pl-2">
          <div class="w-8 h-8 rounded-full ${isComplete ? 'bg-active text-black' : 'bg-primary/20 text-primary'} flex items-center justify-center font-bold shadow-sm">
            ${isComplete ? '<i class="fas fa-check"></i>' : `<i class="fas ${s.icon || 'fa-circle'}"></i>`}
          </div>
          <div><h4 class="font-bold text-sm ${isComplete ? 'text-white' : ''}">${s.name}</h4><p class="text-[10px] text-gray-500">${s.desc}</p></div>
        </div>
        <span class="text-xs font-bold ${isComplete ? 'text-active drop-shadow-[0_0_8px_rgba(3,218,198,0.5)]' : 'text-gray-400'}">${Math.floor(p)}%</span>
      </div>
    `;
  }).join('');
}
