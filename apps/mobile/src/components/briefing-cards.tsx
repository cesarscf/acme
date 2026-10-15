import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Briefing, BriefingStep } from '@/hooks/data/briefing/use-briefing-query';
import { Icon } from './icons';
import { OptionRow } from './option-row';

const letters = 'ABCDEFGH';
const availability = { first_message: 'Na 1ª mensagem', coming_soon: 'Em breve' } as const;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card" style={{ borderCurve: 'continuous' }}>
      {children}
    </View>
  );
}

export function ConnectCard({
  connect,
  active,
  disabled,
  onSkip,
}: {
  connect: Briefing['connect'];
  active: boolean;
  disabled: boolean;
  onSkip: () => void;
}) {
  return (
    <Card>
      <Text className="px-4 pt-3.5 pb-1.5 font-bold text-[15px] text-foreground">Conecte para eu começar</Text>
      {connect.items.map((item) => (
        <View key={item.name} className="min-h-14 flex-row items-center gap-3 px-4 py-2.5">
          <View className="size-10 items-center justify-center rounded-xl bg-secondary">
            <Icon name="link" size={19} color="--color-muted-foreground" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-[15px] text-foreground">{item.name}</Text>
            <Text className="mt-px font-normal text-[13px] text-muted-foreground">{item.reason}</Text>
          </View>
          <Text className="h-[22px] overflow-hidden rounded-full bg-secondary px-2 font-semibold text-[11.5px] text-muted-foreground leading-[22px]">
            {availability[item.availability]}
          </Text>
        </View>
      ))}
      {active && (
        <Pressable
          className={`h-11 self-end justify-center px-4 ${disabled ? 'opacity-50' : ''}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSkip}
        >
          <Text className="font-semibold text-[14.5px] text-primary">Agora não</Text>
        </Pressable>
      )}
    </Card>
  );
}

export function QuestionCard({
  step,
  disabled,
  onPick,
  onOther,
}: {
  step: BriefingStep;
  disabled: boolean;
  onPick: (option: string) => void;
  onOther?: () => void;
}) {
  return (
    <Card>
      <Text className="px-3.5 pt-3.5 pb-3 font-bold text-[15px] text-foreground leading-[21px]">{step.question}</Text>
      {step.options.map((option, index) => (
        <OptionRow
          key={option.key}
          letter={letters[index]!}
          label={option.label}
          hint={option.hint}
          badge={option.comingSoon ? 'Em breve' : undefined}
          disabled={disabled || option.comingSoon}
          onPress={() => onPick(option.key)}
        />
      ))}
      {onOther && (
        <OptionRow
          letter={letters[step.options.length]!}
          label="Outro"
          hint="Escreva do seu jeito"
          disabled={disabled}
          onPress={onOther}
        />
      )}
    </Card>
  );
}

export function PlaybookCard({
  title,
  subtitle,
  playbook,
  approved,
  disabled,
  onAdjust,
  onApprove,
  onOpen,
}: {
  title: string;
  subtitle: string;
  playbook: NonNullable<Briefing['playbook']>;
  approved: boolean;
  disabled: boolean;
  onAdjust: () => void;
  onApprove: () => void;
  onOpen: () => void;
}) {
  return (
    <Card>
      <View className="flex-row items-center gap-2.5 border-secondary border-b px-4 py-3.5">
        <View className="min-w-0 flex-1">
          <Text className="font-extrabold text-[15.5px] text-foreground">{title}</Text>
          <Text className="font-normal text-[13px] text-muted-foreground">{subtitle}</Text>
        </View>
        {approved ? (
          <Pressable
            className="h-7 justify-center rounded-full bg-primary/10 px-3 active:opacity-70"
            accessibilityRole="button"
            onPress={onOpen}
          >
            <Text className="font-bold text-[12px] text-foreground">Ver ficha</Text>
          </Pressable>
        ) : (
          <Text className="h-[22px] overflow-hidden rounded-full bg-secondary px-2 font-semibold text-[11.5px] text-muted-foreground leading-[22px]">
            Rascunho
          </Text>
        )}
      </View>
      <View className="gap-2 px-4 pt-2.5 pb-3">
        {playbook.map((row) => (
          <PlaybookRow key={row.label} row={row} />
        ))}
      </View>
      {!approved && (
        <View className="flex-row items-center gap-2 border-secondary border-t px-3.5 pt-2.5 pb-3.5">
          <Text className="flex-1 font-normal text-[12.5px] text-muted-foreground">
            Dá para mudar depois, é só falar.
          </Text>
          <Pressable
            className={`h-10 justify-center rounded-full border border-border px-4 active:bg-secondary ${disabled ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={onAdjust}
          >
            <Text className="font-bold text-[14px] text-foreground">Ajustar</Text>
          </Pressable>
          <Pressable
            className={`h-10 justify-center rounded-full bg-primary px-4 active:opacity-80 ${disabled ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={onApprove}
          >
            <Text className="font-bold text-[14px] text-primary-foreground">Está certo</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

export function PlaybookRow({ row }: { row: NonNullable<Briefing['playbook']>[number] }) {
  return (
    <View className="flex-row gap-3">
      <Text className="w-[84px] font-normal text-[13px] text-muted-foreground leading-5">{row.label}</Text>
      <Text selectable className="flex-1 font-normal text-[14px] text-foreground leading-5">
        {row.value}
        {row.routine && <Text className="font-semibold text-[12px] text-muted-foreground">{'  ↻ Rotina'}</Text>}
      </Text>
    </View>
  );
}

export function AdjustCard({
  playbook,
  disabled,
  onPick,
  onCancel,
}: {
  playbook: NonNullable<Briefing['playbook']>;
  disabled: boolean;
  onPick: (step: string) => void;
  onCancel: () => void;
}) {
  const rows = playbook.filter((row): row is typeof row & { step: string } => row.step !== null);
  return (
    <Card>
      <Text className="px-3.5 pt-3.5 pb-3 font-bold text-[15px] text-foreground">O que você quer ajustar?</Text>
      {rows.map((row, index) => (
        <OptionRow
          key={row.step}
          letter={letters[index]!}
          label={row.label}
          hint={row.value}
          disabled={disabled}
          onPress={() => onPick(row.step)}
        />
      ))}
      <OptionRow letter={letters[rows.length]!} label="Nada, está certo" disabled={disabled} onPress={onCancel} />
    </Card>
  );
}

// The R$ 0,01 test Pix: pasted in the bank app, it shows whose key it is without paying (ADR 0005).
export function TestPixCard({ testPix }: { testPix: NonNullable<Briefing['testPix']> }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <Text className="px-4 pt-3.5 font-normal text-[14px] text-foreground leading-5">{testPix.text}</Text>
      <Text
        selectable
        className="mx-4 mt-2.5 overflow-hidden rounded-xl bg-secondary px-3 py-2 font-normal text-[12px] text-muted-foreground leading-[17px]"
      >
        {testPix.code}
      </Text>
      <Pressable
        className="h-11 self-end justify-center px-4"
        accessibilityRole="button"
        onPress={() => Clipboard.setStringAsync(testPix.code).then(() => setCopied(true))}
      >
        <Text className="font-semibold text-[14.5px] text-primary">{copied ? 'Copiado' : 'Copiar código'}</Text>
      </Pressable>
    </Card>
  );
}

export function SystemLine({ children }: { children: React.ReactNode }) {
  return <View className="flex-row items-center justify-center gap-1.5 py-0.5">{children}</View>;
}
