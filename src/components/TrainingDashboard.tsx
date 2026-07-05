import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Line, Circle, Path, Text as SvgText, G } from 'react-native-svg';
import { theme } from '../theme';
import { WorkoutSession, LoggedSet } from '../trainingTypes';

interface TrainingDashboardProps {
  sessions: WorkoutSession[];
}

export default function TrainingDashboard({ sessions }: TrainingDashboardProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);

  // Group volume by exercise
  const volumeByExercise = useMemo(() => {
    const map: Record<string, { name: string, volume: number }> = {};
    sessions.forEach(s => {
      s.sets.forEach(set => {
        if (!map[set.exerciseId]) {
          map[set.exerciseId] = { name: set.exerciseName, volume: 0 };
        }
        map[set.exerciseId].volume += (set.weight * set.reps);
      });
    });
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.volume - a.volume);
  }, [sessions]);

  // Set default selected exercise to the one with most volume
  if (!selectedExerciseId && volumeByExercise.length > 0) {
    setSelectedExerciseId(volumeByExercise[0].id);
  }

  // Calculate e1RM trend for selected exercise
  const e1RMTrend = useMemo(() => {
    if (!selectedExerciseId) return [];
    
    // Group sets by session/day to find max e1RM per session
    const dataPoints: { date: number, e1RM: number }[] = [];
    
    const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);
    sortedSessions.forEach(s => {
      const exSets = s.sets.filter(set => set.exerciseId === selectedExerciseId);
      if (exSets.length > 0) {
        const max1RM = Math.max(...exSets.map(set => set.estimated1RM));
        dataPoints.push({ date: s.startTime, e1RM: max1RM });
      }
    });
    return dataPoints;
  }, [sessions, selectedExerciseId]);

  const { width } = Dimensions.get('window');
  const graphW = width - 64;
  const graphH = 150;
  
  const chartPath = useMemo(() => {
    if (e1RMTrend.length < 2) return null;
    
    const min1RM = Math.min(...e1RMTrend.map(d => d.e1RM)) * 0.9;
    const max1RM = Math.max(...e1RMTrend.map(d => d.e1RM)) * 1.1;
    const timeRange = e1RMTrend[e1RMTrend.length - 1].date - e1RMTrend[0].date || 1;
    
    return e1RMTrend.map((d, i) => {
      const x = ((d.date - e1RMTrend[0].date) / timeRange) * graphW;
      const y = graphH - ((d.e1RM - min1RM) / (max1RM - min1RM)) * graphH;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [e1RMTrend, graphW, graphH]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>ALL-TIME PROGRESS</Text>
      
      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(totalVolume / 1000).toFixed(1)}t</Text>
          <Text style={styles.statLabel}>Total Tonnage</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>e1RM TREND</Text>
      <View style={styles.chartContainer}>
        {volumeByExercise.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {volumeByExercise.slice(0, 10).map(ex => (
                <TouchableOpacity 
                  key={ex.id} 
                  style={[styles.pill, selectedExerciseId === ex.id && styles.pillActive]}
                  onPress={() => setSelectedExerciseId(ex.id)}
                >
                  <Text style={[styles.pillText, selectedExerciseId === ex.id && styles.pillTextActive]}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={{ height: graphH + 20, marginTop: 16 }}>
              {chartPath ? (
                <Svg width="100%" height="100%">
                  <Path d={chartPath} fill="none" stroke={theme.colors.accentCyan} strokeWidth={3} />
                  {e1RMTrend.map((d, i) => {
                    const min1RM = Math.min(...e1RMTrend.map(x => x.e1RM)) * 0.9;
                    const max1RM = Math.max(...e1RMTrend.map(x => x.e1RM)) * 1.1;
                    const timeRange = e1RMTrend[e1RMTrend.length - 1].date - e1RMTrend[0].date || 1;
                    const x = ((d.date - e1RMTrend[0].date) / timeRange) * graphW;
                    const y = graphH - ((d.e1RM - min1RM) / (max1RM - min1RM)) * graphH;
                    return (
                      <Circle key={i} cx={x} cy={y} r={4} fill={theme.colors.accentCyan} stroke={theme.colors.background} strokeWidth={2} />
                    );
                  })}
                </Svg>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.typography.sans }}>Not enough data for chart</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginVertical: 20 }}>No exercise data</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>VOLUME BREAKDOWN</Text>
      <View style={styles.chartContainer}>
        {volumeByExercise.slice(0, 6).map((item, idx) => (
          <View key={item.id} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>{item.name}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { backgroundColor: [theme.colors.accentCyan, theme.colors.accentGreen, theme.colors.accentAmber, '#bf5af2', '#ff453a', '#0a84ff'][idx % 6], width: totalVolume ? `${(item.volume / totalVolume) * 100}%` : '0%' }]} />
            </View>
            <Text style={styles.barValue}>{(item.volume).toFixed(0)}</Text>
          </View>
        ))}
        {volumeByExercise.length === 0 && (
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>No volume recorded</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: 16,
    marginTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 28,
    color: theme.colors.text,
  },
  statLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    marginBottom: 20,
  },
  pillsScroll: {
    maxHeight: 36,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.accentCyanFade,
    borderColor: theme.colors.accentCyan,
  },
  pillText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  pillTextActive: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.accentCyan,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  barLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: theme.colors.text,
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barValue: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    width: 60,
    textAlign: 'right',
  }
});
