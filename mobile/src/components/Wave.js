import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

/** Dải sóng âm trang trí; tự đứng yên nếu người dùng bật "giảm chuyển động". */
export default function Wave({ color, seed, active = true }) {
  const p = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduce || !active) return undefined;
    const loop = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [p, reduce, active]);

  const bars = useMemo(
    () => Array.from({ length: 26 }, (_, n) => 0.25 + 0.75 * Math.abs(Math.sin(n * 1.7 + seed * 2.1))),
    [seed]
  );

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', height: 22, gap: 2 }}>
      {bars.map((h, n) => {
        const a = n % 2 ? h : h * 0.4;
        const b = n % 2 ? h * 0.4 : h;
        const scaleY = reduce || !active ? h : p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [a, b, a] });
        return <Animated.View key={n} style={{ flex: 1, height: 22, borderRadius: 2, backgroundColor: color, transform: [{ scaleY }] }} />;
      })}
    </View>
  );
}
