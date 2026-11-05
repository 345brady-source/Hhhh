import React from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: ColorValue; size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const });
const stroke = (color: ColorValue) => ({ stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const InvestmentsIcon = ({ color, size = 24 }: P) => (
  <Svg {...base(size)}>
    <Rect x={3.5} y={7} width={17} height={12.5} rx={1.5} {...stroke(color)} />
    <Path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" {...stroke(color)} />
  </Svg>
);
export const DistributionsIcon = ({ color, size = 24 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={8.5} {...stroke(color)} />
    <Path d="M12 7.5v9m-3.5-3.5L12 16.5l3.5-3.5" {...stroke(color)} />
  </Svg>
);
export const DocumentsIcon = ({ color, size = 24 }: P) => (
  <Svg {...base(size)}>
    <Path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" {...stroke(color)} />
    <Path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" {...stroke(color)} />
  </Svg>
);
export const AccountIcon = ({ color, size = 24 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={8.5} r={4} {...stroke(color)} />
    <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" {...stroke(color)} />
  </Svg>
);
export const SettingsIcon = ({ color, size = 24 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...stroke(color)} />
    <Circle cx={16} cy={7} r={2.2} {...stroke(color)} />
    <Circle cx={8} cy={17} r={2.2} {...stroke(color)} />
  </Svg>
);
export const ChevronIcon = ({ color, size = 16 }: P) => (
  <Svg {...base(size)}>
    <Path d="m9 5 7 7-7 7" {...stroke(color)} />
  </Svg>
);
export const CloseIcon = ({ color, size = 18 }: P) => (
  <Svg {...base(size)}>
    <Path d="M6 6l12 12M18 6 6 18" {...stroke(color)} />
  </Svg>
);
export const LockIcon = ({ color, size = 18 }: P) => (
  <Svg {...base(size)}>
    <Rect x={5} y={10.5} width={14} height={10} rx={1.5} {...stroke(color)} />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...stroke(color)} />
  </Svg>
);
