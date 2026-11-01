// Trích âm thanh thô từ 1 file video/audio người dùng tải lên, trả về Float32Array
// đơn kênh (mono) ở 16kHz — đúng định dạng model Whisper cần, không gửi gì lên server.
const WHISPER_SAMPLE_RATE = 16000;

export class AudioExtractError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function fileToWhisperAudio(file) {
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new AudioExtractError('read');
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new AudioExtractError('unsupported');
  const ctx = new AudioCtx();

  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    ctx.close();
    throw new AudioExtractError('decode');
  }

  // Hạ về 1 kênh: cộng trung bình các kênh gốc trước khi resample, giữ đúng nội dung thoại.
  let mono = decoded;
  if (decoded.numberOfChannels > 1) {
    mono = ctx.createBuffer(1, decoded.length, decoded.sampleRate);
    const out = mono.getChannelData(0);
    for (let ch = 0; ch < decoded.numberOfChannels; ch += 1) {
      const src = decoded.getChannelData(ch);
      for (let n = 0; n < src.length; n += 1) out[n] += src[n] / decoded.numberOfChannels;
    }
  }

  // Resample về đúng 16kHz mà Whisper yêu cầu, dùng OfflineAudioContext của trình duyệt.
  const targetLen = Math.max(1, Math.ceil((mono.length / mono.sampleRate) * WHISPER_SAMPLE_RATE));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, targetLen, WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = mono;
  source.connect(offline.destination);
  source.start(0);

  let rendered;
  try {
    rendered = await offline.startRendering();
  } catch {
    throw new AudioExtractError('resample');
  } finally {
    ctx.close();
  }

  return { audio: rendered.getChannelData(0), duration: decoded.duration };
}
