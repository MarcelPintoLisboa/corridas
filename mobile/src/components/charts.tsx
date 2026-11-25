import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ChartPoint {
  x: number; // índice ou timestamp
  y: number;
  label?: string;
}

/** Caminho suavizado (Catmull-Rom → Bézier) */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * Gráfico de linha com área em gradiente e animação de "desenho".
 * `invert` = valores menores ficam no topo (útil para pace: menor = melhor).
 */
export function EvolutionChart({
  data,
  width,
  height = 160,
  color = colors.primary,
  color2 = colors.secondary,
  invert = false,
  formatY = (v: number) => v.toFixed(1),
  showLabels = true,
  textColor = colors.textDim,
}: {
  data: ChartPoint[];
  width: number;
  height?: number;
  color?: string;
  color2?: string;
  invert?: boolean;
  formatY?: (v: number) => string;
  showLabels?: boolean;
  textColor?: string;
}) {
  const progress = useSharedValue(0);
  const key = data.map((d) => d.y).join(',');
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [key, progress]);

  const padX = showLabels ? 34 : 8;
  const padY = 16;
  const ys = data.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = width - padX - 8;
  const h = height - padY * 2;

  const pts = data.map((d, i) => {
    const x = padX + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
    const norm = (d.y - min) / span;
    const y = padY + (invert ? norm : 1 - norm) * h;
    return { x, y };
  });

  const line = smoothPath(pts);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z` : '';
  const LENGTH = 2000;

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: progress.value }));
  const last = pts[pts.length - 1];
  const dotProps = useAnimatedProps(() => ({ r: 6 * progress.value }));

  if (!data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textDim }}>Sem dados ainda</Text>
      </View>
    );
  }

  const ticks = [max, (max + min) / 2, min];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color2} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {showLabels &&
        ticks.map((t, i) => {
          const norm = (t - min) / span;
          const y = padY + (invert ? norm : 1 - norm) * h;
          return (
            <Line key={i} x1={padX} x2={width - 8} y1={y} y2={y} stroke={textColor} strokeOpacity={0.25} strokeDasharray="4 6" />
          );
        })}
      {showLabels &&
        ticks.map((t, i) => {
          const norm = (t - min) / span;
          const y = padY + (invert ? norm : 1 - norm) * h;
          return (
            <SvgText key={`l${i}`} x={2} y={y + 4} fill={textColor} fontSize={10} fontWeight="600">
              {formatY(t)}
            </SvgText>
          );
        })}
      {area ? <AnimatedPath d={area} fill="url(#fill)" animatedProps={areaProps} /> : null}
      <AnimatedPath
        d={line}
        stroke="url(#stroke)"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${LENGTH}`}
        animatedProps={lineProps}
      />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.7} />
      ))}
      {last ? (
        <>
          <AnimatedCircle cx={last.x} cy={last.y} fill={color} opacity={0.3} animatedProps={dotProps} />
          <Circle cx={last.x} cy={last.y} r={4} fill="#fff" />
        </>
      ) : null}
    </Svg>
  );
}

/** Anel de progresso animado */
export function ProgressRing({
  progress,
  size = 110,
  stroke = 10,
  color = colors.primary,
  color2 = colors.secondary,
  label,
  sublabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  color2?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [progress, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor={color2} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          animatedProps={props}
        />
      </Svg>
      {label ? <Text style={{ color: colors.text, fontWeight: '900', fontSize: size * 0.22 }}>{label}</Text> : null}
      {sublabel ? <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{sublabel}</Text> : null}
    </View>
  );
}

/** Barras simples (km por semana) */
export function WeeklyBars({ values, labels, width, height = 120, color = colors.primary }: {
  values: number[]; labels: string[]; width: number; height?: number; color?: string;
}) {
  const max = Math.max(1, ...values);
  const barW = Math.max(8, width / values.length - 10);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: height + 20, width }}>
      {values.map((v, i) => (
        <View key={i} style={{ alignItems: 'center', width: barW }}>
          <Bar height={(v / max) * height} color={color} width={barW} delay={i * 60} />
          <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 4 }}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

function Bar({ height, color, width, delay }: { height: number; color: string; width: number; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => (h.value = withTiming(height, { duration: 700, easing: Easing.out(Easing.back(1.4)) })), delay);
    return () => clearTimeout(t);
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(3, h.value) }));
  return <Animated.View style={[{ width, borderRadius: 6, backgroundColor: color }, style]} />;
}
