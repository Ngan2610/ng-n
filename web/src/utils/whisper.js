// Lớp bọc mỏng để gọi whisper.worker.js từ component React bằng Promise,
// kèm callback báo tiến độ (đang tải model lần đầu / đang nghe).
let worker = null;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/whisper.worker.js', import.meta.url), { type: 'module' });
  }
  return worker;
}

/**
 * @param {Float32Array} audio - âm thanh mono 16kHz (xem utils/audio.js)
 * @param {'vi'|'en'|'zh'} language - ngôn ngữ nói trong video
 * @param {(phase: 'model'|'listening') => void} onPhase - báo giai đoạn hiện tại
 * @returns {Promise<{ text: string, chunks: { text: string, timestamp: [number, number] }[] }>}
 */
export function transcribeVideoAudio(audio, language, onPhase) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    let loaded = false;
    const onMessage = (e) => {
      const { status } = e.data;
      if (status === 'progress') {
        if (!loaded) onPhase && onPhase('model');
      } else if (status === 'loaded') {
        loaded = true;
        onPhase && onPhase('listening');
      } else if (status === 'complete') {
        w.removeEventListener('message', onMessage);
        resolve(e.data.output);
      } else if (status === 'error') {
        w.removeEventListener('message', onMessage);
        reject(new Error(e.data.error));
      }
    };
    w.addEventListener('message', onMessage);
    onPhase && onPhase('model');
    w.postMessage({ audio, language });
  });
}
