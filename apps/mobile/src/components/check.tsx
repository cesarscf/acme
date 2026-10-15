import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

export function Check({ checked, size = 24 }: { checked: boolean; size?: number }) {
  const color = useCSSVariable('--color-primary-foreground') as string;

  return (
    <View
      className={`items-center justify-center rounded-full border-[1.5px] ${checked ? 'border-primary bg-primary' : 'border-input bg-card'}`}
      style={{ width: size, height: size }}
    >
      {checked && (
        <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3}>
          <Path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
