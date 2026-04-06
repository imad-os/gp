import { getPatternCountLabel, getPatternSlotCount, normalizePatternText, getChordDiagramData } from './music.js';

export function buildPatternEditor(containerId, value, beatsPerBar, clickHandlerName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.gridTemplateColumns = `repeat(${beatsPerBar}, minmax(0, 1fr))`;
  const normalized = normalizePatternText(value, beatsPerBar);
  container.innerHTML = Array.from({ length: beatsPerBar }, (_, beatIdx) => {
    const leftIdx = beatIdx * 2;
    const rightIdx = leftIdx + 1;
    const buildCell = (char, idx) => {
      const symbol = char === 'D' ? '↓' : (char === 'U' ? '↑' : (char === 'X' ? 'x' : '·'));
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

export function renderPatternVisualizer(containerId, pattern, beatsPerBar, activeIndex = -1, validationStates = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const normalized = normalizePatternText(pattern.map(s => s.raw || '.').join(''), beatsPerBar);
  container.innerHTML = `
    <div class="pattern-editor-grid" style="grid-template-columns: repeat(${beatsPerBar}, minmax(0, 1fr));">
      ${Array.from({ length: beatsPerBar }, (_, beatIdx) => {
        const leftIdx = beatIdx * 2;
        const rightIdx = leftIdx + 1;
        const buildCell = (char, idx) => {
          const symbol = char === 'D' ? '↓' : (char === 'U' ? '↑' : (char === 'X' ? 'x' : '·'));
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

export function renderChordDiagramSvg(chordName, large = false) {
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
