import { useId } from 'react';
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import type { CatalogEntry } from '@/hooks/data/catalog/use-catalog-query';

type Mascot = CatalogEntry['mascot'];

const bodies: Record<Mascot['shape'], (fill: string) => React.ReactNode> = {
  blob: (fill) => (
    <Path d="M56 0A54 50 0 0 1 110 50A50 50 0 0 1 60 100A50 45 0 0 1 10 55A46 55 0 0 1 56 0Z" fill={fill} />
  ),
  triangle: (fill) => <Polygon points="60,4 108,94 12,94" fill={fill} />,
  hexagon: (fill) => <Polygon points="35,4 85,4 109,50 85,96 35,96 11,50" fill={fill} />,
  square: (fill) => <Rect x={10} y={0} width={100} height={100} rx={30} fill={fill} />,
  slab: (fill) => <Rect x={10} y={0} width={100} height={100} rx={24} fill={fill} />,
  pill: (fill) => <Rect x={0} y={10} width={120} height={80} rx={40} fill={fill} />,
  drop: (fill) => (
    <Path d="M60 0A50 62 0 0 1 110 62A50 38 0 0 1 60 100A50 38 0 0 1 10 62A50 62 0 0 1 60 0Z" fill={fill} />
  ),
  circle: (fill) => <Circle cx={60} cy={50} r={50} fill={fill} />,
};

export function Mascot({ mascot, size }: { mascot: Mascot; size: number }) {
  const gradient = useId();
  const eyes = useCSSVariable('--color-foreground') as string;
  const eyesTop = mascot.shape === 'triangle' ? 62 : 42.5;

  return (
    <Svg width={size * 1.2} height={size} viewBox="0 0 120 100" accessible={false}>
      <Defs>
        <RadialGradient id={gradient} cx="32%" cy="26%" r="75%">
          <Stop offset="0" stopColor={mascot.light} />
          <Stop offset="0.62" stopColor={mascot.color} />
        </RadialGradient>
      </Defs>
      <G transform={mascot.shape === 'slab' ? 'translate(10.6 0) skewX(-12)' : undefined}>
        {bodies[mascot.shape](`url(#${gradient})`)}
        <Rect x={43.5} y={eyesTop} width={9} height={15} rx={4.5} fill={eyes} />
        <Rect x={67.5} y={eyesTop} width={9} height={15} rx={4.5} fill={eyes} />
      </G>
    </Svg>
  );
}
