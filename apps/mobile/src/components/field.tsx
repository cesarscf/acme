import { TextInput, type TextInputProps } from 'react-native';
import { useCSSVariable } from 'uniwind';

export function Field({
  className = '',
  ref,
  ...props
}: TextInputProps & { className?: string; ref?: React.Ref<TextInput> }) {
  const placeholder = useCSSVariable('--color-muted-foreground') as string;

  return (
    <TextInput
      ref={ref}
      className={`h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 font-normal text-base text-foreground focus:border-primary ${className}`}
      style={{ borderCurve: 'continuous' }}
      placeholderTextColor={placeholder}
      {...props}
    />
  );
}
