// Nhận diện giọng nói NGAY TRÊN MÁY (native) bằng whisper.rn (whisper.cpp).
//
// Khác với bản web (chạy Whisper trong trình duyệt bằng WebAssembly), trên điện thoại
// KHÔNG có sẵn WebAssembly/Web Worker kiểu đó — phải dùng thư viện native `whisper.rn`,
// và vì đây là module native thật nên:
//   1) Bắt buộc phải `expo prebuild` rồi build app thật (Android Studio / Xcode hoặc EAS Build).
//      Expo Go (quét QR) sẽ KHÔNG chạy được code này.
//   2) whisper.rn chỉ nhận file WAV PCM 16-bit, KHÔNG đọc trực tiếp file video — nên phải
//      tách/convert âm thanh từ video sang .wav 16kHz mono trước, bằng `ffmpeg-kit-react-native`.
//   3) Model nhận diện giọng nói (file .bin vài chục–vài trăm MB) không đi kèm trong app,
//      phải tải một lần về máy (xem `ensureModelDownloaded`).
//
// File này được viết để KHÔNG làm sập app khi hai thư viện native trên chưa được build vào
// (ví dụ khi đang chạy tạm trong Expo Go để test các màn hình khác): mọi `require()` native
// đều bọc trong try/catch, và `isNativeSTTAvailable()` cho biết tính năng có dùng được không.

let _whisperModule = null;
let _ffmpegModule = null;
let _FileSystem = null;

function loadNativeModules() {
  if (_whisperModule && _ffmpegModule && _FileSystem) return true;
  try {
    // eslint-disable-next-line global-require
    _whisperModule = require('whisper.rn');
    // eslint-disable-next-line global-require
    _ffmpegModule = require('ffmpeg-kit-react-native');
    // eslint-disable-next-line global-require
    _FileSystem = require('expo-file-system');
    return true;
  } catch (e) {
    _whisperModule = null;
    _ffmpegModule = null;
    _FileSystem = null;
    return false;
  }
}

/** true nếu app này đã được prebuild/build native với whisper.rn + ffmpeg-kit (không phải Expo Go). */
export function isNativeSTTAvailable() {
  return loadNativeModules();
}

export class SttError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SttError';
    this.code = code; // 'unavailable' | 'download' | 'extract' | 'decode' | 'empty'
  }
}

// Model đa ngôn ngữ nhỏ (~75MB) — nhận diện được cả vi/en/zh, đủ nhanh để chạy trên điện thoại.
// Đổi sang 'ggml-base.bin' (~140MB) nếu cần độ chính xác cao hơn và máy đủ mạnh.
const MODEL_NAME = 'ggml-tiny.bin';
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`;

/** Tải model về bộ nhớ trong của app (chỉ tải lần đầu, các lần sau dùng lại file đã có). */
async function ensureModelDownloaded(onProgress) {
  const dir = _FileSystem.documentDirectory + 'whisper-models/';
  const dest = dir + MODEL_NAME;
  const info = await _FileSystem.getInfoAsync(dest);
  if (info.exists && info.size > 10 * 1024 * 1024) return dest; // file đã có và không rỗng/hỏng

  await _FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const task = _FileSystem.createDownloadResumable(MODEL_URL, dest, {}, (p) => {
    if (onProgress) onProgress(p.totalBytesWritten / Math.max(1, p.totalBytesExpectedToWrite));
  });
  try {
    const res = await task.downloadAsync();
    if (!res || !res.uri) throw new SttError('download');
    return res.uri;
  } catch (e) {
    throw new SttError('download');
  }
}

/** Tách âm thanh từ file video thành .wav 16kHz mono 16-bit PCM (định dạng whisper.rn cần). */
async function extractWavFromVideo(videoUri) {
  const { FFmpegKit, ReturnCode } = _ffmpegModule;
  const outPath = `${_FileSystem.cacheDirectory}stt-${Date.now()}.wav`;
  const inputPath = videoUri.startsWith('file://') ? videoUri.replace('file://', '') : videoUri;
  const cmd = `-y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${outPath.replace('file://', '')}"`;
  const session = await FFmpegKit.execute(cmd);
  const code = await session.getReturnCode();
  if (!ReturnCode.isSuccess(code)) throw new SttError('extract');
  return outPath;
}

/**
 * Nhận diện giọng nói trong một file video, trả về mảng câu kèm thời điểm thật (giây):
 *   [{ text, start, end }, ...]
 * onPhase('model' | 'extract' | 'listen') báo giai đoạn đang chạy để hiển thị lên UI.
 */
export async function transcribeVideoFile(videoUri, language, onPhase) {
  if (!loadNativeModules()) throw new SttError('unavailable');
  const { initWhisper } = _whisperModule;

  if (onPhase) onPhase('model');
  const modelPath = await ensureModelDownloaded();

  if (onPhase) onPhase('extract');
  const wavPath = await extractWavFromVideo(videoUri);

  if (onPhase) onPhase('listen');
  let ctx;
  try {
    ctx = await initWhisper({ filePath: modelPath });
    const { promise } = ctx.transcribe(wavPath, {
      language: language === 'vi' ? 'vi' : language === 'zh' ? 'zh' : 'en',
    });
    const { result, segments } = await promise;

    const list = Array.isArray(segments) && segments.length
      ? segments.map((s) => ({
        text: String(s.text || '').trim(),
        start: Number(s.t0 ?? s.start ?? 0) / (s.t0 != null ? 100 : 1), // t0/t1 của whisper.cpp tính bằng 1/100 giây
        end: Number(s.t1 ?? s.end ?? 0) / (s.t1 != null ? 100 : 1),
      })).filter((s) => s.text)
      : String(result || '')
        .split(/(?<=[.!?。！？\n])\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, n, arr) => ({ text, start: n, end: n + 1, _even: true, _total: arr.length }));

    if (!list.length) throw new SttError('empty');
    return list;
  } catch (e) {
    if (e instanceof SttError) throw e;
    throw new SttError('decode');
  } finally {
    if (ctx && typeof ctx.release === 'function') {
      await ctx.release().catch(() => {});
    }
    _FileSystem.deleteAsync(wavPath, { idempotent: true }).catch(() => {});
  }
}
