// Giả lập các phần cần điện thoại thật để test giao diện chạy được trên máy tính / CI
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));
// expo-av cần trình phát video thật, nên thay bằng một View trống khi chạy test
jest.mock('expo-av', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Video = React.forwardRef((props, ref) => React.createElement(View, { ref, testID: 'mock-video' }));
  return { Video };
});
// Hình minh họa và sóng âm chỉ là trang trí
jest.mock('./src/components/Scenes', () => ({ __esModule: true, default: () => null }));
jest.mock('./src/components/Wave', () => ({ __esModule: true, default: () => null }));
