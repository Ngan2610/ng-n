import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CUSTOMER, installMockBackend, saveSession } from './mockBackend.js';
import { projectApi } from '../api/projectApi.js';
import { renderApp } from './utils.jsx';
import { I } from '../shared/i18n.js';

const vi_ = (key) => I[key][0]; // bản tiếng Việt (ngôn ngữ mặc định)

// Không gọi dịch vụ dịch thật khi chạy test — giả lập kết quả dịch
vi.mock('../shared/translate.js', async () => {
  const actual = await vi.importActual('../shared/translate.js');
  return {
    ...actual,
    translateLines: vi.fn(async (lines) =>
      lines
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({ vi: l, en: 'EN: ' + l, zh: '中文: ' + l }))
    ),
  };
});

// Môi trường test (jsdom) không có AudioContext/Worker thật — giả lập luôn 2 bước
// trích âm thanh và nhận diện giọng nói (Whisper) để test được luồng "để trống lời thoại".
vi.mock('../utils/audio.js', async () => {
  const actual = await vi.importActual('../utils/audio.js');
  return {
    ...actual,
    fileToWhisperAudio: vi.fn(async () => ({ audio: new Float32Array(10), duration: 4 })),
  };
});

vi.mock('../utils/whisper.js', () => ({
  transcribeVideoAudio: vi.fn(async (_audio, _lang, onPhase) => {
    if (onPhase) { onPhase('model'); onPhase('listening'); }
    return {
      text: 'Đập trứng vào bát. Xào cùng cà chua.',
      chunks: [
        { text: 'Đập trứng vào bát.', timestamp: [0, 2] },
        { text: 'Xào cùng cà chua.', timestamp: [2, 4] },
      ],
    };
  }),
}));

async function fillMinimal(user) {
  const file = new File(['nội dung giả'], 'mon-an.mp4', { type: 'video/mp4' });
  await user.upload(document.querySelector('input[type="file"]'), file);
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Trang Trải nghiệm (luồng dịch thật)', () => {
  it('bấm dịch khi chưa chọn video thì báo lỗi', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));
    expect(await screen.findByText(vi_('d_need'))).toBeInTheDocument();
  });

  it('chỉ còn khung kéo thả video: không có ô dán liên kết, không có ô nhập lời thoại', () => {
    renderApp('/demo');
    expect(screen.getByText(vi_('d_drop'))).toBeInTheDocument();
    expect(screen.queryByLabelText(vi_('d_url'))).toBeNull();
    expect(screen.queryByLabelText(vi_('d_script_label'))).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('tải video lên: tự nhận diện giọng nói rồi lồng tiếng xong hiện video, phụ đề', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    const file = new File(['nội dung giả'], 'mon-an.mp4', { type: 'video/mp4' });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));

    expect(await screen.findByText(vi_('d_done_dub'))).toBeInTheDocument();
    expect(document.querySelector('video')).toBeInTheDocument();
    // Hai mảnh ngắn của Whisper được gộp thành một đoạn trọn vẹn (một mốc duy nhất trên thanh tiến độ)
    expect(screen.getAllByRole('button', { name: new RegExp('^' + vi_('step') + ' \\d+$') })).toHaveLength(1);
    // Không còn cột lời thoại bên phải
    expect(screen.queryByRole('list', { name: vi_('d_steps') })).toBeNull();
  });

  it('tải video lên rồi lồng tiếng: hiện video thật và phụ đề', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    await fillMinimal(user);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));

    expect(await screen.findByText(vi_('d_done_dub'))).toBeInTheDocument();
    expect(document.querySelector('video')).toBeInTheDocument();
    expect(screen.getAllByText('Đập trứng vào bát. Xào cùng cà chua.').length).toBeGreaterThan(0);
    // Tên file hiện cả ở phần "đã chọn" lẫn tiêu đề khu vực kết quả, nên có thể khớp nhiều chỗ
    expect(screen.getAllByText(/mon-an\.mp4/).length).toBeGreaterThan(0);
  });

  it('dịch lỗi (mất mạng) thì hiện thông báo lỗi, không hiện trình phát', async () => {
    const { translateLines, TranslateError } = await import('../shared/translate.js');
    // Phải dùng đúng class TranslateError (không phải Error thường) vì Demo.jsx chỉ nhận diện
    // loại lỗi (net/server/limit) qua `e instanceof TranslateError`.
    translateLines.mockRejectedValueOnce(new TranslateError('net'));

    const user = userEvent.setup();
    renderApp('/demo');
    await fillMinimal(user);
    await user.click(screen.getByLabelText(vi_('d_opt_translate')));
    await user.click(screen.getByRole('button', { name: vi_('d_translate_btn') }));

    expect(await screen.findByText(vi_('e_net'))).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('lưu video và kết quả vào API theo tài khoản, chỉ báo thành công khi cả hai bước hoàn tất', async () => {
    installMockBackend({ users: [CUSTOMER] });
    saveSession();
    const upload = vi.spyOn(projectApi, 'upload').mockResolvedValue({ url: '/api/media/example.mp4' });
    const create = vi.spyOn(projectApi, 'create').mockResolvedValue({ project: { id: 12 } });
    const user = userEvent.setup();
    renderApp('/demo');
    await screen.findByText(/Xin chào, An/);
    await fillMinimal(user);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));
    await screen.findByText(vi_('d_done_dub'));
    await user.click(screen.getByRole('button', { name: 'Lưu vào tài khoản' }));
    expect(await screen.findByText(/Đã lưu dự án #12/)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ token: CUSTOMER.token }), expect.any(File));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: CUSTOMER.email }), expect.objectContaining({
      title: 'mon-an', originalLanguage: 'vi', videoUrl: '/api/media/example.mp4',
      segments: [expect.objectContaining({ vi: 'Đập trứng vào bát. Xào cùng cà chua.' })],
    }));
    expect(screen.getByRole('button', { name: 'Đã lưu dự án' })).toBeDisabled();
  });

  it('lỗi lưu SQL không báo đã lưu; thử lại dùng lại video đã tải lên', async () => {
    installMockBackend({ users: [CUSTOMER] }); saveSession();
    const upload = vi.spyOn(projectApi, 'upload').mockResolvedValue({ url: '/api/media/example.mp4' });
    const create = vi.spyOn(projectApi, 'create').mockRejectedValueOnce(new Error('SQL offline')).mockResolvedValue({ project: { id: 13 } });
    const user = userEvent.setup(); renderApp('/demo');
    await screen.findByText(/Xin chào, An/);
    await fillMinimal(user);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));
    await screen.findByText(vi_('d_done_dub'));
    await user.click(screen.getByRole('button', { name: 'Lưu vào tài khoản' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối hoặc lưu dữ liệu');
    expect(screen.queryByText(/Đã lưu dự án #/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lưu vào tài khoản' }));
    expect(await screen.findByText(/Đã lưu dự án #13/)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledTimes(2);
  });

  it('bật phụ đề tiếng Anh sau khi dịch xong', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    await fillMinimal(user);
    await user.click(screen.getByLabelText(vi_('d_opt_translate')));
    await user.click(screen.getByRole('button', { name: vi_('d_translate_btn') }));
    await screen.findByText(vi_('d_done'));

    const subsGroup = within(screen.getByRole('group', { name: vi_('d_subs') }));
    const en = subsGroup.getByRole('button', { name: 'EN' });
    await user.click(en);
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('EN: Đập trứng vào bát. Xào cùng cà chua.')).toBeInTheDocument();
  });

  it('bấm một mốc trên thanh tiến độ thì chuyển sang đoạn đó; không còn danh sách lời thoại bên phải', async () => {
    const user = userEvent.setup();
    renderApp('/demo');
    await fillMinimal(user);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));
    await screen.findByText(vi_('d_done_dub'));

    expect(screen.queryByRole('list', { name: vi_('d_steps') })).toBeNull();
    const marks = screen.getAllByRole('button', { name: new RegExp('^' + vi_('step') + ' \\d+$') });
    // Hai mảnh ngắn của Whisper được gộp thành một đoạn → chỉ có một mốc
    expect(marks).toHaveLength(1);
    await user.click(marks[0]);
    expect(marks[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: vi_('d_fullscreen') })).toBeInTheDocument();
  });

  it('mặc định chỉ lồng tiếng, không dịch: chỉ có ngôn ngữ gốc, không gọi dịch vụ dịch', async () => {
    const { translateLines } = await import('../shared/translate.js');
    translateLines.mockClear();
    const user = userEvent.setup();
    renderApp('/demo');
    await fillMinimal(user);
    await user.click(screen.getByRole('button', { name: vi_('d_dub_btn') }));
    expect(await screen.findByText(vi_('d_done_dub'))).toBeInTheDocument();

    expect(translateLines).not.toHaveBeenCalled();
    const subsGroup = within(screen.getByRole('group', { name: vi_('d_subs') }));
    expect(subsGroup.getByRole('button', { name: 'VI' })).toBeInTheDocument();
    expect(subsGroup.queryByRole('button', { name: 'EN' })).toBeNull();
  });
});
