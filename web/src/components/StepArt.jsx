/** 4 hình minh họa cho 4 bước: tải lên, nhận dạng giọng nói, dịch, lồng tiếng. */
const L = { fill: 'none', stroke: 'var(--ink)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Upload() {
  return (
    <>
      <rect x="44" y="26" width="72" height="50" rx="8" fill="var(--panel)" {...L} />
      <path d="M71 41v20l17-10z" fill="var(--vi)" {...L} />
      <path d="M80 20V6M72 13l8-8 8 8" stroke="var(--en)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 84h96" stroke="var(--ink)" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function Listen() {
  const bars = [[40, 12], [52, 26], [64, 40], [76, 20], [88, 34], [100, 16], [112, 28]];
  return (
    <>
      {bars.map(([x, h]) => (
        <rect key={x} x={x - 4} y={48 - h / 2} width="8" height={h} rx="4" fill="var(--en)" />
      ))}
      <rect x="68" y="6" width="24" height="26" rx="12" fill="var(--panel)" {...L} />
      <path d="M60 24a20 20 0 0 0 40 0M80 44v8" {...L} />
    </>
  );
}

function Translate() {
  return (
    <>
      <rect x="22" y="14" width="56" height="42" rx="10" fill="var(--panel)" {...L} />
      <path d="M40 56l-6 12 16-12" fill="var(--panel)" {...L} />
      <text x="50" y="43" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--vi)">A</text>
      <rect x="84" y="34" width="56" height="42" rx="10" fill="var(--panel)" {...L} />
      <path d="M118 76l6 12-16-12" fill="var(--panel)" {...L} />
      <text x="112" y="64" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--zh)">文</text>
    </>
  );
}

function Dub() {
  return (
    <>
      <path d="M36 40h16l22-18v52L52 56H36z" fill="var(--panel)" {...L} />
      <path d="M86 34q10 14 0 28M98 24q16 24 0 48" stroke="var(--vi)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="128" cy="68" r="14" fill="var(--good)" {...L} />
      <path d="M121 68l5 5 9-10" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const ART = [Upload, Listen, Translate, Dub];

export default function StepArt({ index }) {
  const Content = ART[index] || Upload;
  return (
    <svg className="step-art" viewBox="0 0 160 96" aria-hidden="true">
      <rect width="160" height="96" rx="14" fill="var(--sc-bg)" />
      <Content />
    </svg>
  );
}
