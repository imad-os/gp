export const AUDIO_FILE_EXTENSIONS = Object.freeze([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wma',
  '.aiff',
  '.alac',
  '.webm'
]);

export const VIDEO_FILE_EXTENSIONS = Object.freeze([
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.wmv',
  '.3gp'
]);

export const AUDIO_UPLOAD_ACCEPT = `${AUDIO_FILE_EXTENSIONS.join(',')},audio/*`;
export const LOOPER_UPLOAD_ACCEPT = `${[...new Set([...AUDIO_FILE_EXTENSIONS, ...VIDEO_FILE_EXTENSIONS])].join(',')},audio/*,video/*`;

export function dataUrlToBlob(dataUrl = '') {
  const raw = String(dataUrl || '');
  const parts = raw.split(',');
  if (parts.length < 2) return null;
  const meta = parts[0] || '';
  const payload = parts.slice(1).join(',');
  const mimeMatch = meta.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) return null;
  const mime = mimeMatch[1] || 'application/octet-stream';
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function readFileAsDataUrl(file) {
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

export function getFileExtension(name = '') {
  const dot = String(name || '').toLowerCase().lastIndexOf('.');
  return dot >= 0 ? String(name).toLowerCase().slice(dot) : '';
}

export function detectUploadMediaType(file, { allowVideo = false } = {}) {
  const mime = String(file?.type || '').toLowerCase();
  const ext = getFileExtension(file?.name || '');
  if (allowVideo && (mime.startsWith('video/') || VIDEO_FILE_EXTENSIONS.includes(ext))) return 'video';
  if (mime.startsWith('audio/') || AUDIO_FILE_EXTENSIONS.includes(ext)) return 'audio';
  return '';
}
