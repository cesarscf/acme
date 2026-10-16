import { Text, View } from 'react-native';

// The prototype's six tones, picked from the id so a Customer keeps the same one everywhere.
const tones = [
  ['bg-info', 'text-info-foreground'],
  ['bg-orange', 'text-orange-foreground'],
  ['bg-accent', 'text-accent-foreground'],
  ['bg-purple', 'text-purple-foreground'],
  ['bg-pink', 'text-pink-foreground'],
  ['bg-teal', 'text-teal-foreground'],
] as const;

export function initials(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return `${first?.[0] ?? ''}${second?.[0] ?? ''}`.toUpperCase();
}

export function CustomerAvatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  let index = 0;
  for (const character of id) index = (index + character.charCodeAt(0)) % tones.length;
  const [background, foreground] = tones[index]!;
  return (
    <View
      className={`items-center justify-center rounded-full ${background}`}
      style={{ width: size, height: size }}
      accessible={false}
    >
      <Text className={`font-extrabold ${foreground}`} style={{ fontSize: Math.round(size * 0.36) }}>
        {initials(name)}
      </Text>
    </View>
  );
}
