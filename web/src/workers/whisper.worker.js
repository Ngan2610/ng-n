// Worker riêng để mô hình Whisper (nhận diện giọng nói) chạy nền, không làm đứng giao diện.
// Model được tải thẳng từ Hugging Face Hub ngay trong trình duyệt người dùng — không có
// server nào của nhóm cả, đúng kiểu "AI chạy tại chỗ" (client-side inference).
import { pipeline, env } from '@xenova/transformers';

// Không có model cài sẵn cục bộ nào, luôn lấy từ Hugging Face Hub (có cache của trình duyệt).
env.allowLocalModels = false;

const MODEL_ID = 'Xenova/whisper-base';
const WHISPER_LANG = { vi: 'vietnamese', en: 'english', zh: 'chinese' };

class WhisperSingleton {
  static instance = null;

  static async getInstance(progressCb) {
    if (!this.instance) {
      this.instance = pipeline('automatic-speech-recognition', MODEL_ID, { progress_callback: progressCb });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { audio, language } = event.data;
  try {
    const transcriber = await WhisperSingleton.getInstance((p) => {
      self.postMessage({ status: 'progress', data: p });
    });
    self.postMessage({ status: 'loaded' });

    const output = await transcriber(audio, {
      language: WHISPER_LANG[language] || 'vietnamese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    self.postMessage({ status: 'complete', output });
  } catch (err) {
    self.postMessage({ status: 'error', error: (err && err.message) || String(err) });
  }
});
