import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

/** 4 cảnh minh họa cho 4 bước của video mẫu. */
const OUT = { stroke: '#12302A', strokeWidth: 3, strokeLinejoin: 'round' };

function Steam() {
  return (
    <Path
      d="M120 70q-9-12 0-22t0-20M150 66q-9-12 0-22t0-20M180 70q-9-12 0-22t0-20"
      fill="none"
      stroke="#12302A"
      strokeOpacity={0.3}
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}

function Pan() {
  return (
    <>
      <Ellipse cx="140" cy="118" rx="82" ry="20" fill="#2F3D39" />
      <Ellipse cx="140" cy="112" rx="76" ry="16" fill="#3C4C47" />
      <Rect x="212" y="108" width="86" height="10" rx="5" fill="#2F3D39" />
    </>
  );
}

function Wedge({ cx, cy, rx, ry, rot }) {
  return (
    <G rotation={rot} origin={`${cx}, ${cy}`}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#D6402F" />
    </G>
  );
}

function Content({ index }) {
  switch (index) {
    case 0:
      return (
        <>
          <Path d="M92 92Q160 176 228 92Z" fill="#fff" {...OUT} />
          <Ellipse cx="160" cy="92" rx="68" ry="12" fill="#FFF3C4" {...OUT} />
          <Circle cx="144" cy="92" r="9" fill="#F5B301" />
          <Circle cx="172" cy="94" r="9" fill="#F5B301" />
          <Circle cx="242" cy="122" r="7" fill="#fff" {...OUT} />
          <Circle cx="262" cy="126" r="7" fill="#fff" {...OUT} />
          <Path d="M214 34L176 88" stroke="#12302A" strokeWidth={4} strokeLinecap="round" />
        </>
      );
    case 1:
      return (
        <>
          <Pan />
          <Ellipse cx="140" cy="112" rx="58" ry="11" fill="#F7CF4B" />
          <Ellipse cx="126" cy="109" rx="20" ry="5" fill="#FBE38A" />
          <Steam />
        </>
      );
    case 2:
      return (
        <>
          <Pan />
          <Ellipse cx="140" cy="112" rx="50" ry="10" fill="#F7CF4B" />
          <Wedge cx={108} cy={110} rx={14} ry={6} rot={-20} />
          <Wedge cx={134} cy={114} rx={14} ry={6} rot={15} />
          <Wedge cx={158} cy={108} rx={14} ry={6} rot={-10} />
          <Wedge cx={176} cy={114} rx={12} ry={5} rot={25} />
          <Steam />
        </>
      );
    default:
      return (
        <>
          <Ellipse cx="160" cy="118" rx="98" ry="22" fill="#fff" {...OUT} />
          <Ellipse cx="160" cy="116" rx="72" ry="14" fill="#F2F2EE" />
          <Ellipse cx="160" cy="106" rx="54" ry="15" fill="#F7CF4B" />
          <Wedge cx={136} cy={104} rx={14} ry={6} rot={-20} />
          <Wedge cx={164} cy={100} rx={14} ry={6} rot={12} />
          <Wedge cx={184} cy={108} rx={12} ry={5} rot={-15} />
          <Path d="M152 92q10-16 26-6-8 12-26 6Z" fill="#3F8F5B" />
          <Steam />
        </>
      );
  }
}

export default function Scene({ index }) {
  const c = useTheme();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 180" style={StyleSheet.absoluteFill}>
      <Rect width="320" height="180" fill={c.scBg} />
      <Rect y="128" width="320" height="52" fill={c.scTab} />
      <Ellipse cx="160" cy="140" rx="100" ry="8" fill="rgba(0,0,0,0.12)" />
      <Content index={index} />
    </Svg>
  );
}
