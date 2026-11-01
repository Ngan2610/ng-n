import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import App from '../../App';
import { CUES, I } from '../shared/i18n';

const vi = (key) => I[key][0]; // bản tiếng Việt (ngôn ngữ mặc định)
// Tên mục vừa có ở thanh tab, vừa có ở chân trang (như web) nên có thể khớp nhiều chỗ; bấm cái đầu tiên đều đi đúng màn hình.
const press = (key) => fireEvent.press(screen.getAllByText(vi(key))[0]);

// Không gọi dịch vụ dịch thật khi chạy test — giả lập kết quả dịch
jest.mock('../shared/translate', () => ({
  ...jest.requireActual('../shared/translate'),
  translateLines: jest.fn(async (lines) =>
    lines
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => ({ vi: l, en: 'EN: ' + l, zh: '中文: ' + l }))
  ),
}));

// Không chạy whisper.rn thật khi test — mặc định giả lập "chưa khả dụng" (giống Expo Go/chưa build native);
// từng test có thể gọi lại mockReturnValueOnce/mockResolvedValueOnce để giả lập trường hợp đã build native.
jest.mock('../utils/sttNative', () => {
  const actual = jest.requireActual('../utils/sttNative');
  return {
    ...actual,
    isNativeSTTAvailable: jest.fn(() => false),
    transcribeVideoFile: jest.fn(),
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
  DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: true });
  // Reset về trạng thái mặc định (chưa build native) trước mỗi test, tránh 1 test
  // gọi mockReturnValue(true) rồi làm "rò rỉ" sang các test chạy sau nó.
  const sttNative = require('../utils/sttNative');
  sttNative.isNativeSTTAvailable.mockReset().mockReturnValue(false);
  sttNative.transcribeVideoFile.mockReset();
});

describe('Ứng dụng di động Dubchef', () => {
  it('trang chủ hiện tiêu đề và 3 dòng lồng tiếng Việt / Anh / Trung', () => {
    render(<App />);
    expect(screen.getByText(vi('h_title'))).toBeTruthy();
    expect(screen.getByText(CUES[0].vi)).toBeTruthy();
    expect(screen.getByText(CUES[0].en)).toBeTruthy();
    expect(screen.getByText(CUES[0].zh)).toBeTruthy();
  });

  it('đổi ngôn ngữ giao diện sang tiếng Anh', async () => {
    render(<App />);
    fireEvent.press(screen.getByRole('radio', { name: 'EN' }));
    expect(await screen.findByText(I.h_title[1])).toBeTruthy();
  });

  it('bảng giá: chọn thanh toán theo năm thì giá giảm 20%', async () => {
    render(<App />);
    press('nav_pricing');
    expect(await screen.findByText(/250\.000/)).toBeTruthy();

    fireEvent.press(screen.getByText(vi('pr_yearly')));
    expect(await screen.findByText(/200\.000/)).toBeTruthy();
  });

  it('bảng giá: tính giá theo số video đăng lên và số video dịch ra', async () => {
    render(<App />);
    press('nav_pricing');
    // mặc định 3 video đăng lên, 3 video dịch ra: 3 × 20.000 + 3 × 10.000
    expect((await screen.findByTestId('pc-total')).props.children).toMatch(/90\.000/);

    fireEvent.changeText(screen.getByLabelText(vi('pc_up')), '10');
    fireEvent.changeText(screen.getByLabelText(vi('pc_out')), '20');
    expect(screen.getByTestId('pc-total').props.children).toMatch(/400\.000/);
  });

  it('bảng giá: số video dịch ra quá 3 lần số video đăng lên thì báo lỗi và không hiện giá', async () => {
    render(<App />);
    press('nav_pricing');
    fireEvent.changeText(await screen.findByLabelText(vi('pc_up')), '2');
    fireEvent.changeText(screen.getByLabelText(vi('pc_out')), '7');
    expect(await screen.findByText(vi('pc_over'))).toBeTruthy();
    expect(screen.queryByTestId('pc-total')).toBeNull();
  });

  it('bảng giá: bấm gói mẫu thì điền sẵn số video vào phần tính giá', async () => {
    render(<App />);
    press('nav_pricing');
    const buttons = await screen.findAllByText(vi('pk_use'));
    fireEvent.press(buttons[2]); // gói "Kênh ẩm thực": 30 video đăng lên, 90 video dịch ra
    expect(screen.getByLabelText(vi('pc_up')).props.value).toBe('30');
    expect(screen.getByLabelText(vi('pc_out')).props.value).toBe('90');
    expect(screen.getByTestId('pc-total').props.children).toMatch(/1\.500\.000/);
    expect(await screen.findByText(vi('pk_filled'))).toBeTruthy();
  });

  it('trải nghiệm: bấm dịch khi chưa chọn video thì báo lỗi', async () => {
    render(<App />);
    press('nav_demo');
    fireEvent.press(await screen.findByRole('button', { name: vi('d_translate_btn') }));
    expect(await screen.findByText(vi('d_need'))).toBeTruthy();
  });

  it('trải nghiệm: có video nhưng chưa nhập lời thoại thì tự nhận diện (báo chưa khả dụng khi build chưa có whisper.rn)', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'video.mp4', uri: 'file:///video.mp4' }],
    });
    render(<App />);
    press('nav_demo');
    fireEvent.press(await screen.findByText(vi('m_pick')));
    fireEvent.press(await screen.findByRole('button', { name: vi('d_translate_btn') }));
    // Trong môi trường test (và trong Expo Go), whisper.rn/ffmpeg-kit chưa được build native vào app
    // nên tính năng tự nhận diện báo "chưa khả dụng" thay vì chạy thật.
    expect(await screen.findByText(vi('d_stt_unavailable'))).toBeTruthy();
  });

  it('trải nghiệm: đủ video và lời thoại thì dịch thật và hiện kết quả', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'mon-an.mp4', uri: 'file:///mon-an.mp4' }],
    });
    render(<App />);
    press('nav_demo');
    fireEvent.press(await screen.findByText(vi('m_pick')));
    fireEvent.changeText(await screen.findByLabelText(vi('d_script_label')), 'Đập trứng vào bát.\nXào cùng cà chua.');
    fireEvent.press(screen.getByRole('button', { name: vi('d_translate_btn') }));

    expect(await screen.findByText(vi('d_done'))).toBeTruthy();
    // Câu này hiện cả ở phụ đề trên video lẫn trong danh sách bước, nên có thể khớp nhiều chỗ
    expect(screen.getAllByText('Đập trứng vào bát.').length).toBeGreaterThan(0);
    expect(screen.getByTestId('mock-video')).toBeTruthy();
  });

  it('trải nghiệm: có video + đã build whisper.rn native thì tự nhận diện và dịch luôn', async () => {
    const sttNative = require('../utils/sttNative');
    sttNative.isNativeSTTAvailable.mockReturnValue(true);
    sttNative.transcribeVideoFile.mockResolvedValue([
      { text: 'Đập trứng vào bát.', start: 0, end: 2 },
      { text: 'Xào cùng cà chua.', start: 2, end: 4.5 },
    ]);

    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'mon-an.mp4', uri: 'file:///mon-an.mp4' }],
    });
    render(<App />);
    press('nav_demo');
    fireEvent.press(await screen.findByText(vi('m_pick')));
    fireEvent.press(await screen.findByRole('button', { name: vi('d_translate_btn') }));

    expect(await screen.findByText(vi('d_done'))).toBeTruthy();
    expect(screen.getAllByText('Đập trứng vào bát.').length).toBeGreaterThan(0);
    expect(sttNative.transcribeVideoFile).toHaveBeenCalledWith('file:///mon-an.mp4', expect.any(String), expect.any(Function));
  });

  it('tài khoản: đăng ký báo lỗi khi để trống, đủ thông tin thì đăng ký thành công', async () => {
    render(<App />);
    press('tab_account');
    press('rg_title');

    fireEvent.press(await screen.findByRole('button', { name: vi('rg_btn') }));
    for (const key of ['e_name', 'e_email', 'e_pass', 'e_pass2', 'e_agree']) {
      expect(await screen.findByText(vi(key))).toBeTruthy();
    }

    fireEvent.changeText(screen.getByLabelText(vi('f_name')), 'An');
    fireEvent.changeText(screen.getByLabelText(vi('f_email')), 'an@example.com');
    fireEvent.changeText(screen.getByLabelText(vi('f_pass')), 'matkhau123');
    fireEvent.changeText(screen.getByLabelText(vi('f_pass2')), 'matkhau123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByRole('button', { name: vi('rg_btn') }));

    expect(await screen.findByText(/Xin chào, An/)).toBeTruthy();
  });
});