import { View } from 'react-native';
import { Icon } from './icons';

export function Check({ checked, size = 24 }: { checked: boolean; size?: number }) {
  return (
    <View
      className={`items-center justify-center rounded-full border-[1.5px] ${checked ? 'border-primary bg-primary' : 'border-input bg-card'}`}
      style={{ width: size, height: size }}
    >
      {checked && <Icon name="check" size={size * 0.56} color="--color-primary-foreground" strokeWidth={3} />}
    </View>
  );
}
