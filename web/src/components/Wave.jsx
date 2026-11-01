import { useMemo } from 'react';

/** Dải sóng âm trang trí, mỗi ngôn ngữ một "seed" để hình dạng khác nhau. */
export default function Wave({ seed }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 44 }, (_, n) => ({
        h: (0.25 + 0.75 * Math.abs(Math.sin(n * 1.7 + seed * 2.1))).toFixed(2),
        d: ((n % 11) * 0.09).toFixed(2) + 's',
      })),
    [seed]
  );
  return (
    <div className="wave" aria-hidden="true">
      {bars.map((b, n) => (
        <i key={n} style={{ '--h': b.h, '--d': b.d }} />
      ))}
    </div>
  );
}
