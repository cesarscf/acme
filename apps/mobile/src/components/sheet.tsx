import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Sheet({
  open,
  onClose,
  tall,
  children,
}: {
  open: boolean;
  onClose: () => void;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-foreground/40" accessibilityLabel="Fechar" onPress={onClose} />
        <View
          className={`rounded-t-[28px] bg-card px-5 pt-2.5 ${tall ? 'h-[80%]' : ''}`}
          style={{ paddingBottom: bottom + 20 }}
        >
          <View className="mx-auto mb-4 h-[5px] w-10 rounded-full bg-input" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
