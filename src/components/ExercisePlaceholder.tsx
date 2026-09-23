import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

const FALLBACK_COLOR = colors.textMuted;

interface ExercisePlaceholderProps {
  name: string;
  muscleGroupSlug: string;
  size?: number;
}

function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export function ExercisePlaceholder({ name, muscleGroupSlug, size = 48 }: ExercisePlaceholderProps) {
  const background =
    colors.muscleGroup[muscleGroupSlug as keyof typeof colors.muscleGroup] ?? FALLBACK_COLOR;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { backgroundColor: background, width: size, height: size, borderRadius: radius.pill },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
