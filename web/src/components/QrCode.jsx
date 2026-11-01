import { useMemo } from 'react';
import { qrMatrix, qrPath } from '../utils/qr.js';

/** Hiển thị mã QR cho chuỗi `value` bằng SVG (luôn nền trắng, ô đen để dễ quét kể cả khi giao diện tối). */
export default function QrCode({ value, label, size = 200, testId }) {
  const qr = useMemo(() => {
    try { return qrPath(qrMatrix(value)); } catch (e) { return null; }
  }, [value]);
  if (!qr) return null;
  return (
    <svg className="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} width={size} height={size} role="img" aria-label={label} data-testid={testId} data-value={value} shapeRendering="crispEdges">
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#000" />
    </svg>
  );
}
