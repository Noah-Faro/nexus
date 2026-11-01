import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Dumbbell, Play } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutSession } from '../trainingTypes';

interface ActiveWorkoutCardProps {
  session: WorkoutSession;
  onResume: () => void;
  onDiscard?: () => void;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutCard({ session, onResume }: ActiveWorkoutCardProps) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - session.startTime) / 1000))
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - session.startTime) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session.startTime]);

  const handleResume = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onResume();
  };

  return (
    <View style={styles.card}>
      <View style={styles.leftCol}>
        <View style={styles.iconContainer}>
          <Dumbbell size={20} color={theme.colors.accent} />
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>
            {session.templateName || 'Active Workout'}
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusTag}>IN PROGRESS</Text>
            <Text style={styles.statusDot}>•</Text>
            <Text style={styles.timerText}>{formatTimer(elapsed)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.resumeBtn}
        onPress={handleResume}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Resume active workout ${session.templateName}`}
      >
        <Play size={14} color="#000000" fill="#000000" style={{ marginRight: 4 }} />
        <Text style={styles.resumeBtnText}>Resume</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.35)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accentGreen,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontFamily: theme.typography.bold,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTag: {
    fontFamily: theme.typography.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.colors.accentGreen,
  },
  statusDot: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginHorizontal: 5,
  },
  timerText: {
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: theme.borderRadius.round,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  resumeBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.background,
  },
});
