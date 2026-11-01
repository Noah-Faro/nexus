import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { Exercise, VolumeStateSnapshot, WorkoutSession, WorkoutTemplate } from '../trainingTypes';
import type { StorageLoadStatus } from '../utils';
import type { HistoryCompleteness } from '../recovery/types';
import SegmentedControl from './SegmentedControl';
import MuscleRecoveryView from './recovery/MuscleRecoveryView';

interface TrainingDashboardProps {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  customExercises: Exercise[];
  historyCompleteness: HistoryCompleteness;
  templateLoadStatus: StorageLoadStatus;
}

type ProgressView = 'performance' | 'recovery';

export default function TrainingDashboard({
  sessions,
  templates,
  customExercises,
  historyCompleteness,
  templateLoadStatus,
}: TrainingDashboardProps) {
  const [activeView, setActiveView] = useState<ProgressView>('performance');

  return (
    <View style={styles.container}>
      <View style={styles.segmentContainer} accessibilityLabel="Progress dashboard view">
        <SegmentedControl
          values={['performance', 'recovery'] as const}
          selectedValue={activeView}
          onChange={setActiveView}
          labels={['Performance', 'Recovery']}
        />
      </View>

      {activeView === 'performance' ? (
        <PerformanceDashboard sessions={sessions} />
      ) : (
        <MuscleRecoveryView
          sessions={sessions}
          templates={templates}
          customExercises={customExercises}
          historyCompleteness={historyCompleteness}
          templateLoadStatus={templateLoadStatus}
        />
      )}
    </View>
  );
}

function PerformanceDashboard({ sessions }: { sessions: WorkoutSession[] }) {
  const [volumeSnapshots, setVolumeSnapshots] = useState<VolumeStateSnapshot[]>([]);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    AsyncStorage.getItem('nexus_volume_snapshots').then(data => {
      if (data) {
        setVolumeSnapshots(JSON.parse(data));
      }
    });
  }, []);

  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);

  // Derive muscle groups from snapshots
  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    volumeSnapshots.forEach(s => groups.add(s.muscleGroup));
    return Array.from(groups).sort();
  }, [volumeSnapshots]);

  useEffect(() => {
    if (muscleGroups.length === 0) {
      if (selectedMuscleGroup !== null) setSelectedMuscleGroup(null);
      return;
    }
    if (!selectedMuscleGroup || !muscleGroups.includes(selectedMuscleGroup)) {
      setSelectedMuscleGroup(muscleGroups[0]);
    }
  }, [muscleGroups, selectedMuscleGroup]);

  // Calculate best1RMAnchor trend for selected muscle group
  const e1RMTrend = useMemo(() => {
    if (!selectedMuscleGroup) return [];
    return volumeSnapshots
      .filter(s => s.muscleGroup === selectedMuscleGroup && s.best1RMAnchor !== null)
      .sort((a, b) => a.weekId.localeCompare(b.weekId))
      .map((s, index) => ({ date: index, e1RM: s.best1RMAnchor as number, week: s.weekId }));
  }, [volumeSnapshots, selectedMuscleGroup]);

  // Volume Breakdown data (latest week)
  const latestWeek = useMemo(() => {
    if (volumeSnapshots.length === 0) return null;
    return volumeSnapshots.map(s => s.weekId).sort().pop();
  }, [volumeSnapshots]);

  const currentWeekVolumes = useMemo(() => {
    if (!latestWeek) return [];
    return volumeSnapshots.filter(s => s.weekId === latestWeek);
  }, [volumeSnapshots, latestWeek]);

  const graphW = Math.max(width - (theme.spacing.lg * 2) - 40, 1);
  const graphH = 150;
  
  const chartPath = useMemo(() => {
    if (e1RMTrend.length < 2) return null;
    
    const min1RM = Math.min(...e1RMTrend.map(d => d.e1RM)) * 0.9;
    const max1RM = Math.max(...e1RMTrend.map(d => d.e1RM)) * 1.1;
    const timeRange = e1RMTrend.length - 1;
    
    return e1RMTrend.map((d, i) => {
      const x = (i / timeRange) * graphW;
      const y = graphH - ((d.e1RM - min1RM) / (max1RM - min1RM)) * graphH;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [e1RMTrend, graphW, graphH]);

  const MEV_BASELINE = 10;

  return (
    <ScrollView
      style={styles.dashboardScroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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

      {e1RMTrend.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>e1RM TREND</Text>
          <View style={styles.chartContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {muscleGroups.map(group => (
                <TouchableOpacity 
                  key={group} 
                  style={[styles.pill, selectedMuscleGroup === group && styles.pillActive]}
                  onPress={() => setSelectedMuscleGroup(group)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${group} estimated one-rep-max trend`}
                  accessibilityState={{ selected: selectedMuscleGroup === group }}
                >
                  <Text style={[styles.pillText, selectedMuscleGroup === group && styles.pillTextActive]}>
                    {group.toUpperCase()}
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
                    const timeRange = e1RMTrend.length - 1;
                    const x = (i / timeRange) * graphW;
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
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>VOLUME BREAKDOWN</Text>
      <View style={styles.chartContainer}>
        {currentWeekVolumes.length > 0 ? currentWeekVolumes.map((item, idx) => {
          const progress = Math.min((item.totalSets / MEV_BASELINE) * 100, 100);
          const isOptimal = item.totalSets >= MEV_BASELINE;
          return (
            <View key={item.muscleGroup} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>{item.muscleGroup}</Text>
              
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { backgroundColor: [theme.colors.accentCyan, theme.colors.accentGreen, theme.colors.accentAmber, '#bf5af2', '#ff453a', '#0a84ff'][idx % 6], width: `${progress}%` }]} />
              </View>
              
              <View style={styles.microIndicator}>
                <View style={[styles.indicatorDot, { backgroundColor: isOptimal ? theme.colors.accentGreen : theme.colors.accentAmber }]} />
                <Text style={styles.indicatorText}>{item.totalSets}/{MEV_BASELINE}</Text>
              </View>
            </View>
          );
        }) : (
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
  segmentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  dashboardScroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.typography.semibold,
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
    fontFamily: theme.typography.semibold,
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
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    color: theme.colors.text,
    width: 70,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  microIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 46,
    justifyContent: 'center',
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  indicatorText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
  }
});
