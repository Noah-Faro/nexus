import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { theme } from '../theme';
import { DrinkLog, UserSettings, DayProgress } from '../types';
import { getAggregatedProgress, formatDateKey } from '../storage';

interface CalendarHeatmapProps {
  logs: DrinkLog[];
  settings: UserSettings;
}

export default function CalendarHeatmap({ logs, settings }: CalendarHeatmapProps) {
  const progressMap = getAggregatedProgress(logs, settings);
  
  // Calculate grid of the last 9 weeks (63 days) ending today
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  
  // Adjust starting point to be 9 weeks ago, aligned to Sunday
  const totalDays = 63;
  const days: { dateKey: string; dateObj: Date; level: 0 | 1 | 2 | 3; percent: number }[] = [];
  
  const startOffset = totalDays - 1 - (6 - dayOfWeek); // align grid to end on Saturday
  
  for (let i = startOffset; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateKey = formatDateKey(d.getTime());
    const progress = progressMap[dateKey];
    
    let percent = 0;
    let level: 0 | 1 | 2 | 3 = 0;
    
    if (progress && progress.goal > 0) {
      percent = Math.round((progress.totalEffective / progress.goal) * 100);
      if (percent === 0) level = 0;
      else if (percent < 50) level = 1;
      else if (percent < 100) level = 2;
      else level = 3;
    }
    
    days.push({
      dateKey,
      dateObj: d,
      level,
      percent,
    });
  }

  // Calculate stats: streaks & consistency
  let currentStreak = 0;
  let maxStreak = 0;
  let compliantDays = 0;
  let activeDays = 0;
  
  // Sort keys to compute streak sequentially
  const dateKeys = Object.keys(progressMap).sort();
  let tempStreak = 0;
  
  for (const k of dateKeys) {
    const prog = progressMap[k];
    if (prog.totalEffective > 0) {
      activeDays++;
      const p = Math.round((prog.totalEffective / prog.goal) * 100);
      if (p >= 100) {
        tempStreak++;
        compliantDays++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
  }
  
  // Check if today is compliant to set current streak
  const todayKey = formatDateKey(Date.now());
  const todayProg = progressMap[todayKey];
  if (todayProg && Math.round((todayProg.totalEffective / todayProg.goal) * 100) >= 100) {
    currentStreak = tempStreak; // Set current streak from calculated chain
  } else {
    // If today is not compliant yet, current streak might be yesterday's streak
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday.getTime());
    const yesterdayProg = progressMap[yesterdayKey];
    if (yesterdayProg && Math.round((yesterdayProg.totalEffective / yesterdayProg.goal) * 100) >= 100) {
      currentStreak = tempStreak;
    }
  }

  // Group days into weeks (9 columns of 7 days)
  const columns: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  // Row labels for days
  const rowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.markdownHeader}># tracker-heatmap.md</Text>
      
      {/* Calendar Grid Container */}
      <View style={styles.heatmapCard}>
        <Text style={styles.cardHeader}>## 63-day-activity-grid</Text>
        
        <View style={styles.gridWrapper}>
          {/* Weekday Row Labels */}
          <View style={styles.labelsColumn}>
            {rowLabels.map((label, idx) => (
              <Text key={label} style={[styles.rowLabel, (idx % 2 !== 0) && { opacity: 0.4 }]}>
                {label.substring(0, 1)}
              </Text>
            ))}
          </View>
          
          {/* Columns */}
          <View style={styles.gridColumnsContainer}>
            {columns.map((week, colIdx) => (
              <View key={colIdx} style={styles.gridColumn}>
                {week.map((day, rowIdx) => {
                  let cellBg = '#121212';
                  let borderCol = '#222222';
                  
                  if (day.level === 1) {
                    cellBg = 'rgba(117, 78, 195, 0.25)';
                    borderCol = 'rgba(117, 78, 195, 0.4)';
                  } else if (day.level === 2) {
                    cellBg = 'rgba(117, 78, 195, 0.6)';
                    borderCol = 'rgba(117, 78, 195, 0.8)';
                  } else if (day.level === 3) {
                    cellBg = theme.colors.accent; // Full Obsidian Purple
                    borderCol = theme.colors.accent;
                  }

                  return (
                    <View
                      key={day.dateKey}
                      style={[
                        styles.cell, 
                        { backgroundColor: cellBg, borderColor: borderCol },
                        day.dateKey === todayKey && styles.todayCell
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Less</Text>
          <View style={[styles.legendCell, { backgroundColor: '#121212', borderColor: '#222' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(117, 78, 195, 0.25)', borderColor: 'rgba(117, 78, 195, 0.4)' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(117, 78, 195, 0.6)', borderColor: 'rgba(117, 78, 195, 0.8)' }]} />
          <View style={[styles.legendCell, { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]} />
          <Text style={styles.legendText}>More (100%+)</Text>
        </View>
      </View>

      {/* Streak Dashboard */}
      <Text style={styles.markdownSubHeader}>## tracker-insights</Text>
      
      <View style={styles.statsList}>
        <View style={styles.statRow}>
          <Text style={styles.statKey}>current_streak: </Text>
          <Text style={styles.statValue}>{currentStreak} days 🔥</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statKey}>longest_streak: </Text>
          <Text style={styles.statValue}>{maxStreak} days 👑</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statKey}>compliant_days: </Text>
          <Text style={styles.statValue}>
            {compliantDays} / {activeDays || 1} ({activeDays > 0 ? Math.round((compliantDays / activeDays) * 100) : 0}%)
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statKey}>tracked_logfiles: </Text>
          <Text style={styles.statValue}>{Object.keys(progressMap).filter(k => progressMap[k].logs.length > 0).length} notes</Text>
        </View>
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
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  markdownHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 18,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  markdownSubHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 14,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginVertical: theme.spacing.md,
  },
  heatmapCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
  },
  cardHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  gridWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  labelsColumn: {
    justifyContent: 'space-between',
    height: 124,
    paddingVertical: 2,
  },
  rowLabel: {
    fontFamily: theme.typography.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    textAlign: 'center',
    width: 12,
  },
  gridColumnsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  gridColumn: {
    gap: 4,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: theme.colors.accentAmber,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.md,
    gap: 4,
  },
  legendText: {
    fontFamily: theme.typography.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 1,
    borderWidth: 1,
  },
  statsList: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statKey: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentAmber,
    fontSize: 12,
  },
  statValue: {
    fontFamily: theme.typography.mono,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: theme.typography.weight.bold,
  },
});
