import { useEffect, useState } from 'react';
import Scene from './Scenes.jsx';

/** Lời hướng dẫn mẫu cho 4 cảnh: [Việt, Anh, Trung]. Chỉ để minh họa nên không đi qua i18n. */
const CUES = [
  ['Đánh trứng thật đều tay', 'Beat the eggs well', '把鸡蛋打匀'],
  ['Cho trứng vào chảo xào', 'Scramble in the pan', '下锅炒鸡蛋'],
  ['Thêm cà chua vào đảo đều', 'Add the tomatoes and stir', '加入番茄翻炒'],
  ['Bày ra đĩa và thưởng thức', 'Plate it and enjoy', '装盘即可享用'],
];

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Khung video mẫu: cảnh nấu ăn đổi theo từng bước, kèm phụ đề 3 ngôn ngữ. */
export default function HeroArt() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % CUES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const [vi, en, zh] = CUES[i];
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="stage hero-stage">
        <Scene index={i} />
        <span className="live-badge">
          <i /> Dubchef
        </span>
        <div className="subs">
          <p className="vi"><b>VI</b><span lang="vi">{vi}</span></p>
          <p className="en"><b>EN</b><span lang="en">{en}</span></p>
          <p className="zh"><b>中</b><span lang="zh-CN">{zh}</span></p>
        </div>
      </div>
      <div className="hero-dots">
        {CUES.map((_, n) => (
          <i key={n} className={n === i ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
