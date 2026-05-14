export const TOOL_PAGES = Object.freeze([
  'metronome',
  'recorder',
  'chords',
  'chord-builder',
  'guitar-tones',
  'songs',
  'music',
  'looper',
  'tabs-preview',
  'guitarpro-viewer',
  'chord-translation',
  'ai-song',
  'sound-effects'
]);

export const TOOL_PAGE_SET = new Set(TOOL_PAGES);

export const TOOL_SUBTITLES = Object.freeze({
  metronome: 'Keep steady time.',
  recorder: 'Save and replay short clips.',
  'chord-builder': 'Add new chords to the database.',
  'guitar-tones': 'Upload open-string samples and build dynamic guitar tones.',
  songs: 'Find a song quickly.',
  music: 'Play from your saved music library.',
  looper: 'Loop full track or A-B sections.',
  'tabs-preview': 'Paste tabs and preview real notes.',
  'guitarpro-viewer': 'Upload GP3 or GP4 and render notation.',
  'sound-effects': 'Shape audio with layered effects.',
  'chord-translation': 'Translate European Do/Re/Mi chords into USA notation.',
  'ai-song': 'Generate a full song draft with Gemini.',
  chords: 'Browse and hear the chord library.'
});

export async function importToolModule(tool = '') {
  switch (tool) {
    case 'sound-effects':
      return await import('./sound-effects.js');
    default:
      return null;
  }
}
