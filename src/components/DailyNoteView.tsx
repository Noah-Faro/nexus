import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { DrinkLog, DayProgress, LiquidType, LIQUID_CONFIGS } from '../types';

interface DailyNoteViewProps {
  progress: DayProgress;
  onDeleteLog: (id: string) => void;
}

export default function DailyNoteView({ progress, onDeleteLog }: DailyNoteViewProps) {
  // Format long date string for daily note header
  const getFormattedDateHeader = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const percentage = progress.goal > 0 
    ? Math.round((progress.totalEffective / progress.goal) * 100) 
    : 0;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.markdownHeader}># {getFormattedDateHeader(progress.date)}</Text>
      
      {/* Frontmatter metrics representation */}
      <View style={styles.metricsBox}>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletSymbol}>-</Text>
          <Text style={styles.bulletText}>
            💧 **Total Effective**: <Text style={styles.bulletHighlight}>{progress.totalEffective}ml</Text> / {progress.goal}ml ({percentage}%)
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletSymbol}>-</Text>
          <Text style={styles.bulletText}>
            ⚖️ **Raw Consumption**: <Text style={styles.bulletHighlightMuted}>{progress.totalAmount}ml</Text>
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletSymbol}>-</Text>
          <Text style={styles.bulletText}>
            📊 **Progress state**: <Text style={[
              styles.stateTag,
              percentage >= 100 ? styles.stateSuccess : styles.statePending
            ]}>
              {percentage >= 100 ? '#completed' : '#in-progress'}
            </Text>
          </Text>
        </View>
      </View>

      <Text style={styles.markdownSubHeader}>## Logged Items</Text>

      {progress.logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>*No drinks logged for today yet.*</Text>
          <Text style={styles.emptyHelp}>Add water using the buttons or console below.</Text>
        </View>
      ) : (
        <View style={styles.logsList}>
          {progress.logs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });

            // Retrieve the liquid config by tag or type, fallback to water
            const config = Object.values(LIQUID_CONFIGS).find(c => c.tag === log.tag) || LIQUID_CONFIGS['water'];

            return (
              <View 
                key={log.id} 
                style={[
                  styles.logRow, 
                  { borderLeftWidth: 3, borderLeftColor: config.color }
                ]}
              >
                <View style={styles.checkboxContainer}>
                  <View style={[
                    styles.checkboxChecked, 
                    { borderColor: config.color, backgroundColor: config.color + '1a' }
                  ]}>
                    <Text style={[styles.checkboxX, { color: config.color }]}>x</Text>
                  </View>
                </View>

                <View style={styles.logDetails}>
                  <Text style={styles.logTime}>{timeStr}</Text>
                  <Text style={styles.logContent}>
                     Logged {log.amount}ml of {log.type}
                  </Text>
                  <View style={styles.tagBadgeRow}>
                    <Text style={[styles.logTag, { color: config.color }]}>{log.tag}</Text>
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
                  <Trash2 size={13} color={theme.colors.accentRed} />
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
  markdownHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 18,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  metricsBox: {
    backgroundColor: '#050505',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletSymbol: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accent,
    fontSize: 13,
  },
  bulletText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  bulletHighlight: {
    color: theme.colors.accentAmber,
    fontWeight: theme.typography.weight.bold,
  },
  bulletHighlightMuted: {
    color: theme.colors.text,
  },
  stateTag: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  statePending: {
    color: theme.colors.accentAmber,
    backgroundColor: theme.colors.accentAmberFade,
  },
  stateSuccess: {
    color: theme.colors.accentGreen,
    backgroundColor: 'rgba(78, 166, 78, 0.15)',
  },
  markdownSubHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 14,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  emptyText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  emptyHelp: {
    fontSize: 11,
    color: theme.colors.textSubtle,
  },
  logsList: {
    gap: theme.spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  checkboxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentFade,
  },
  checkboxX: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
    color: theme.colors.accent,
    lineHeight: 12,
    fontWeight: theme.typography.weight.bold,
  },
  logDetails: {
    flex: 1,
    gap: 2,
  },
  logTime: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
    color: theme.colors.textSubtle,
  },
  logContent: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  tagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTag: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
  },
  multiplierHint: {
    fontFamily: theme.typography.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
