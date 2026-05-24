import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Trash2, CheckCircle2, Circle } from 'lucide-react-native';
import { theme } from '../theme';
import { DayProgress, LIQUID_CONFIGS } from '../types';

interface DailyNoteViewProps {
  progress: DayProgress;
  onDeleteLog: (id: string) => void;
}

export default function DailyNoteView({ progress, onDeleteLog }: DailyNoteViewProps) {
  const getFormattedDateHeader = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const percentage = progress.goal > 0 
    ? Math.round((progress.totalEffective / progress.goal) * 100) 
    : 0;

  const isCompleted = percentage >= 100;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.dateHeader}>{getFormattedDateHeader(progress.date)}</Text>
        <View style={[styles.badge, isCompleted ? styles.badgeSuccess : styles.badgePending]}>
          <Text style={[styles.badgeText, isCompleted ? styles.badgeTextSuccess : styles.badgeTextPending]}>
            {isCompleted ? 'Completed' : `${percentage}%`}
          </Text>
        </View>
      </View>
      
      {/* Metrics representation */}
      <View style={styles.metricsBox}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Effective Intake</Text>
          <Text style={styles.metricValue}>
            <Text style={styles.metricHighlight}>{progress.totalEffective}ml</Text> / {progress.goal}ml
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Raw Fluid</Text>
          <Text style={styles.metricValue}>{progress.totalAmount}ml</Text>
        </View>
      </View>

      <Text style={styles.subHeader}>Timeline</Text>

      {progress.logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No fluids logged today.</Text>
        </View>
      ) : (
        <View style={styles.logsList}>
          {progress.logs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });

            const config = Object.values(LIQUID_CONFIGS).find(c => c.tag === log.tag) || LIQUID_CONFIGS['water'];

            return (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.timelineGraphic}>
                  <View style={[styles.timelineDot, { backgroundColor: config.color }]} />
                  <View style={styles.timelineLine} />
                </View>

                <View style={styles.logDetails}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logContent}>
                      {log.amount}ml {config.label}
                    </Text>
                    <Text style={styles.logTime}>{timeStr}</Text>
                  </View>
                  <View style={styles.tagBadgeRow}>
                    <Text style={[styles.logTag, { color: config.color }]}>{config.label}</Text>
                    {log.effectiveAmount !== log.amount && (
                      <Text style={styles.multiplierHint}>
                         ({Number(log.effectiveAmount.toFixed(1))}ml net)
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => onDeleteLog(log.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
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
    paddingBottom: 160,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dateHeader: {
    fontFamily: theme.typography.sans,
    fontSize: 22,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(50, 215, 75, 0.15)',
  },
  badgePending: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  badgeText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.semibold,
  },
  badgeTextSuccess: {
    color: theme.colors.accentGreen,
  },
  badgeTextPending: {
    color: theme.colors.textMuted,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  metricItem: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  metricLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  metricHighlight: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.bold,
  },
  subHeader: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  emptyText: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  logsList: {
    gap: 0,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  timelineGraphic: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
    alignSelf: 'stretch',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 4,
    marginBottom: -16, // Connect to next item
  },
  logDetails: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginRight: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  logContent: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  tagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTag: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    fontWeight: theme.typography.weight.medium,
  },
  multiplierHint: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  deleteBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
