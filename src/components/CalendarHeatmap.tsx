import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { DrinkLog, UserSettings, DayProgress } from '../types';
import { getAggregatedProgress, formatDateKey, calculateGoal } from '../storage';

interface CalendarHeatmapProps {
  logs: DrinkLog[];
  settings: UserSettings;
}

export default function CalendarHeatmap({ logs, settings }: CalendarHeatmapProps) {
  const [activeTab, setActiveTab] = useState<'grid' | 'trend'>('grid');

  const {
    progressMap,
    days,
    last7Days,
    currentStreak,
    maxStreak,
    compliantDays,
    activeDays,
    columns,
    todayKey
  } = useMemo(() => {
    const progressMap = getAggregatedProgress(logs, settings);
    
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    
    const totalDays = 63;
    const days: { dateKey: string; dateObj: Date; level: 0 | 1 | 2 | 3; percent: number }[] = [];
    const startOffset = totalDays - 1 - (6 - dayOfWeek); 
    
    for (let i = startOffset; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateKey = formatDateKey(d.getTime());
      const progress = progressMap[dateKey];
      
      let percent = 0;
      let level: 0 | 1 | 2 | 3 = 0;
      
      if (progress && progress.goal > 0) {
        percent = Math.round((progress.totalEffective / progress.goal) * 100);
        if (percent <= 0) level = 0;
        else if (percent < 50) level = 1;
        else if (percent < 100) level = 2;
        else level = 3;
      }
      
      days.push({ dateKey, dateObj: d, level, percent });
    }

    const last7Days: { weekday: string; totalEffective: number; goal: number; percent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateKey = formatDateKey(d.getTime());
      const progress = progressMap[dateKey] || {
        date: dateKey,
        totalAmount: 0,
        totalEffective: 0,
        goal: calculateGoal(settings),
        logs: []
      };
      
      const percent = progress.goal > 0 
        ? Math.round((progress.totalEffective / progress.goal) * 100) 
        : 0;
      
      const weekdayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      last7Days.push({ weekday: weekdayStr, totalEffective: progress.totalEffective, goal: progress.goal, percent });
    }

    // 1. Calculate Current Streak
    let currentStreak = 0;
    let checkDate = new Date();
    const todayKey = formatDateKey(checkDate.getTime());
    const todayProg = progressMap[todayKey];
    const todayPercent = todayProg ? Math.round((todayProg.totalEffective / todayProg.goal) * 100) : 0;
    
    let isStreakActive = true;
    
    if (todayPercent >= 100) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = formatDateKey(yesterday.getTime());
      const yesterdayProg = progressMap[yesterdayKey];
      const yesterdayPercent = yesterdayProg ? Math.round((yesterdayProg.totalEffective / yesterdayProg.goal) * 100) : 0;
      
      if (yesterdayPercent >= 100) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 2);
      } else {
        isStreakActive = false;
      }
    }
    
    if (isStreakActive) {
      while (true) {
        const k = formatDateKey(checkDate.getTime());
        const prog = progressMap[k];
        const pct = prog ? Math.round((prog.totalEffective / prog.goal) * 100) : 0;
        
        if (pct >= 100) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // 2. Calculate Max Streak
    let maxStreak = 0;
    let compliantDays = 0;
    let activeDays = 0;
    
    const sortedActiveKeys = Object.keys(progressMap).filter(k => progressMap[k].totalEffective > 0).sort();
    
    if (sortedActiveKeys.length > 0) {
      const firstDateParts = sortedActiveKeys[0].split('-').map(Number);
      const startDate = new Date(firstDateParts[0], firstDateParts[1] - 1, firstDateParts[2]);
      const endDate = new Date();
      
      let tempStreak = 0;
      let currDate = new Date(startDate);
      
      while (currDate <= endDate) {
        const k = formatDateKey(currDate.getTime());
        const prog = progressMap[k];
        
        if (prog && prog.totalEffective > 0) {
          activeDays++;
        }
        
        const pct = prog ? Math.round((prog.totalEffective / prog.goal) * 100) : 0;
        if (pct >= 100) {
          tempStreak++;
          compliantDays++;
          if (tempStreak > maxStreak) {
            maxStreak = tempStreak;
          }
        } else {
          if (k !== todayKey) {
            tempStreak = 0;
          }
        }
        currDate.setDate(currDate.getDate() + 1);
      }
    }

    const columns: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      columns.push(days.slice(i, i + 7));
    }

    return {
      progressMap,
      days,
      last7Days,
      currentStreak,
      maxStreak,
      compliantDays,
      activeDays,
      columns,
      todayKey
    };
  }, [logs, settings]);

  const rowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>History & Trends</Text>
      
      {/* iOS Segment Control */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'grid' && styles.tabBtnActive]} 
          onPress={() => { Haptics.selectionAsync(); setActiveTab('grid'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'grid' && styles.tabBtnTextActive]}>63-Day Grid</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'trend' && styles.tabBtnActive]} 
          onPress={() => { Haptics.selectionAsync(); setActiveTab('trend'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'trend' && styles.tabBtnTextActive]}>7-Day Trend</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heatmapCard}>
        {activeTab === 'grid' ? (
          <>
            <View style={styles.gridWrapper}>
              <View style={styles.labelsColumn}>
                {rowLabels.map((label, idx) => (
                  <Text key={idx} style={[styles.rowLabel, (idx % 2 !== 0) && { opacity: 0.5 }]}>
                    {label}
                  </Text>
                ))}
              </View>
              
              <View style={styles.gridColumnsContainer}>
                {columns.map((week, colIdx) => (
                  <View key={colIdx} style={styles.gridColumn}>
                    {week.map((day, rowIdx) => {
                      let cellBg = theme.colors.surface;
                      let opacity = 1;
                      
                      if (day.level === 1) {
                        cellBg = theme.colors.accent;
                        opacity = 0.3;
                      } else if (day.level === 2) {
                        cellBg = theme.colors.accent;
                        opacity = 0.6;
                      } else if (day.level === 3) {
                        cellBg = theme.colors.accent;
                        opacity = 1;
                      }

                      return (
                        <View
                          key={day.dateKey}
                          style={[
                            styles.cell, 
                            { backgroundColor: cellBg, opacity },
                            day.dateKey === todayKey && styles.todayCell
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.legendRow}>
              <Text style={styles.legendText}>Less</Text>
              <View style={[styles.legendCell, { backgroundColor: theme.colors.surface }]} />
              <View style={[styles.legendCell, { backgroundColor: theme.colors.accent, opacity: 0.3 }]} />
              <View style={[styles.legendCell, { backgroundColor: theme.colors.accent, opacity: 0.6 }]} />
              <View style={[styles.legendCell, { backgroundColor: theme.colors.accent, opacity: 1 }]} />
              <Text style={styles.legendText}>More</Text>
            </View>
          </>
        ) : (
          <View style={styles.chartWrapper}>
            <View style={styles.chartArea}>
              <View style={styles.barsContainer}>
                {last7Days.map((day, idx) => {
                  const maxPercent = 120;
                  const barHeight = Math.min(156, Math.max(4, (Math.min(maxPercent, Math.max(0, day.percent)) / maxPercent) * 156));
                  const isCompliant = day.percent >= 100;
                  
                  return (
                    <View key={idx} style={styles.barColumn}>
                      <Text style={[styles.barValText, isCompliant && { color: theme.colors.accent, fontWeight: 'bold' }]}>
                        {day.totalEffective > 0 ? `${(day.totalEffective / 1000).toFixed(1)}L` : '0'}
                      </Text>
                      
                      <View style={styles.barSlot}>
                        <View 
                          style={[
                            styles.barFill, 
                            { height: barHeight },
                            isCompliant 
                              ? { backgroundColor: theme.colors.accent } 
                              : { backgroundColor: theme.colors.border }
                          ]} 
                        />
                      </View>
                      
                      <Text style={styles.barDayText}>{day.weekday}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.goalLine} />
              <View style={styles.goalLabelContainer}>
                <Text style={styles.goalLabelText}>GOAL</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.subHeader}>Insights</Text>
      
      <View style={styles.statsList}>
        <View style={styles.statRow}>
          <Text style={styles.statKey}>Current Streak</Text>
          <Text style={styles.statValue}>{currentStreak} Days 🔥</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statKey}>Longest Streak</Text>
          <Text style={styles.statValue}>{maxStreak} Days 👑</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statKey}>Goal Hit Rate</Text>
          <Text style={styles.statValue}>
            {activeDays > 0 ? Math.round((compliantDays / activeDays) * 100) : 0}%
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statKey}>Tracked Days</Text>
          <Text style={styles.statValue}>{Object.keys(progressMap).filter(k => progressMap[k].logs.length > 0).length}</Text>
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
  header: {
    fontFamily: theme.typography.sans,
    fontSize: 22,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  subHeader: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  heatmapCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  gridWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  labelsColumn: {
    justifyContent: 'space-between',
    height: 140,
    paddingVertical: 2,
  },
  rowLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
    width: 14,
  },
  gridColumnsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  gridColumn: {
    gap: 6,
  },
  cell: {
    width: 15,
    height: 15,
    borderRadius: 4,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 6,
  },
  legendText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  statsList: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  statKey: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  statValue: {
    fontFamily: theme.typography.sans,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.typography.weight.semibold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    padding: 2,
    marginBottom: theme.spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm - 2,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  tabBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  tabBtnTextActive: {
    color: '#000000',
    fontWeight: theme.typography.weight.semibold,
  },
  chartWrapper: {
    paddingVertical: theme.spacing.xs,
  },
  chartArea: {
    height: 200,
    position: 'relative',
    marginTop: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30 + 130, 
    height: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    zIndex: 5,
  },
  goalLabelContainer: {
    position: 'absolute',
    left: 4,
    bottom: 30 + 130 + 4,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 6,
    borderRadius: 4,
    zIndex: 6,
  },
  goalLabelText: {
    fontFamily: theme.typography.sans,
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.bold,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 156 + 30 + 14, 
    paddingHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barValText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  barSlot: {
    height: 156,
    width: 28,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barDayText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 10,
  },
});
