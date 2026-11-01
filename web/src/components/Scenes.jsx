/** 4 cảnh minh họa cho 4 bước của video mẫu (SVG). */
const OUT = { stroke: '#12302A', strokeWidth: 3, strokeLinejoin: 'round' };

function Background() {
  return (
    <>
      <rect width="320" height="180" fill="var(--sc-bg)" />
      <rect y="128" width="320" height="52" fill="var(--sc-tab)" />
      <ellipse cx="160" cy="140" rx="100" ry="8" fill="rgba(0,0,0,.12)" />
    </>
  );
}

function Steam() {
  return (
    <path
      d="M120 70q-9-12 0-22t0-20M150 66q-9-12 0-22t0-20M180 70q-9-12 0-22t0-20"
      fill="none"
      stroke="#12302A"
      strokeOpacity=".3"
      strokeWidth="4"
      strokeLinecap="round"
    />
  );
}

function Pan() {
  return (
    <>
      <ellipse cx="140" cy="118" rx="82" ry="20" fill="#2F3D39" />
      <ellipse cx="140" cy="112" rx="76" ry="16" fill="#3C4C47" />
      <rect x="212" y="108" width="86" height="10" rx="5" fill="#2F3D39" />
    </>
  );
}

function Wedge({ cx, cy, rx, ry, rot }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#D6402F" transform={`rotate(${rot} ${cx} ${cy})`} />;
}

/* 0: đánh trứng */
function Scene0() {
  return (
    <>
      <path d="M92 92Q160 176 228 92Z" fill="#fff" {...OUT} />
      <ellipse cx="160" cy="92" rx="68" ry="12" fill="#FFF3C4" {...OUT} />
      <circle cx="144" cy="92" r="9" fill="#F5B301" />
      <circle cx="172" cy="94" r="9" fill="#F5B301" />
      <circle cx="242" cy="122" r="7" fill="#fff" {...OUT} />
      <circle cx="262" cy="126" r="7" fill="#fff" {...OUT} />
      <path d="M214 34L176 88" stroke="#12302A" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

/* 1: xào trứng */
function Scene1() {
  return (
    <>
      <Pan />
      <ellipse cx="140" cy="112" rx="58" ry="11" fill="#F7CF4B" />
      <ellipse cx="126" cy="109" rx="20" ry="5" fill="#FBE38A" />
      <Steam />
    </>
  );
}

/* 2: thêm cà chua */
function Scene2() {
  return (
    <>
      <Pan />
      <ellipse cx="140" cy="112" rx="50" ry="10" fill="#F7CF4B" />
      <Wedge cx={108} cy={110} rx={14} ry={6} rot={-20} />
      <Wedge cx={134} cy={114} rx={14} ry={6} rot={15} />
      <Wedge cx={158} cy={108} rx={14} ry={6} rot={-10} />
      <Wedge cx={176} cy={114} rx={12} ry={5} rot={25} />
      <Steam />
    </>
  );
}

/* 3: bày ra đĩa */
function Scene3() {
  return (
    <>
      <ellipse cx="160" cy="118" rx="98" ry="22" fill="#fff" {...OUT} />
      <ellipse cx="160" cy="116" rx="72" ry="14" fill="#F2F2EE" />
      <ellipse cx="160" cy="106" rx="54" ry="15" fill="#F7CF4B" />
      <Wedge cx={136} cy={104} rx={14} ry={6} rot={-20} />
      <Wedge cx={164} cy={100} rx={14} ry={6} rot={12} />
      <Wedge cx={184} cy={108} rx={12} ry={5} rot={-15} />
      <path d="M152 92q10-16 26-6-8 12-26 6Z" fill="#3F8F5B" />
      <Steam />
    </>
  );
}

const SCENES = [Scene0, Scene1, Scene2, Scene3];

export default function Scene({ index }) {
  const Content = SCENES[index] || Scene0;
  return (
    <svg viewBox="0 0 320 180" aria-hidden="true">
      <Background />
      <Content />
    </svg>
  );
}
