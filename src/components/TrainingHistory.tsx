import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutSession, Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';

interface TrainingHistoryProps {
  sessions: WorkoutSession[];
  onDeleteSession: (sessionId: string) => void;
  onEditSession: (session: WorkoutSession) => void;
  customExercises: Exercise[];
}

export default function TrainingHistory({ sessions, onDeleteSession, onEditSession, customExercises }: TrainingHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No sessions recorded yet.</Text>
      </View>
    );
  }

  const renderSessionCard = (session: WorkoutSession) => {
    const date = new Date(session.startTime);
    const dateString = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    
    // Count unique exercises
    const uniqueExercises = new Set(session.sets.map(s => s.exerciseId)).size;
    const isExpanded = expandedId === session.id;

    const isLbs = session.sets.length > 0 && session.sets.every(s => s.weightUnit === 'lbs');
    const unit = isLbs ? 'lbs' : 'kg';

    return (
      <Swipeable
        key={session.id}
        renderRightActions={() => (
          <TouchableOpacity 
            style={styles.deleteAction} 
            onPress={() => {
              Alert.alert('Delete Session', 'Are you sure you want to delete this session?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDeleteSession(session.id) }
              ]);
            }}
          >
            <Trash2 size={24} color="#fff" />
          </TouchableOpacity>
        )}
      >
        <TouchableOpacity 
          style={styles.card} 
          activeOpacity={0.7} 
          onPress={() => setExpandedId(isExpanded ? null : session.id)}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.templateName}>{session.templateName} • Session #{session.sessionNumber}</Text>
              <Text style={styles.date}>{dateString} • {session.durationMinutes || 0} min</Text>
            </View>
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); onEditSession(session); }}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.details}>{uniqueExercises} exercises • {session.sets.length} sets</Text>
              <Text style={styles.volume}>Volume: {session.totalVolume} {unit}</Text>
            </View>
            {isExpanded ? <ChevronUp color={theme.colors.textMuted} size={20} /> : <ChevronDown color={theme.colors.textMuted} size={20} />}
          </View>
          
          {isExpanded && (
            <View style={styles.expandedContent}>
              {(session.exercises || Array.from(new Set(session.sets.map(s => s.exerciseId))).map(exId => ({ exerciseId: exId }))).map(tEx => {
                const exId = tEx.exerciseId;
                const exDef = EXERCISE_LIBRARY[exId] || customExercises?.find(c => c.id === exId);
                const name = exDef ? exDef.name : 'Unknown Exercise';
                const unit = exDef ? exDef.weightUnit : 'kg';
                const exSets = session.sets.filter(s => s.exerciseId === exId);
                if (exSets.length === 0) return null;

                return (
                  <View key={exId} style={styles.exBlock}>
                    <Text style={styles.exName}>{name}</Text>
                    {exSets.map(s => (
                      <View key={s.id} style={styles.setRow}>
                        <Text style={styles.setText}>Set {s.setNumber}</Text>
                        <Text style={styles.setText}>{s.weight}{unit} × {s.reps}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {sessions.map(renderSessionCard)}
      </ScrollView>
    </GestureHandlerRootView>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
  },
  editBtnText: {
    fontFamily: theme.typography.sans,
    color: '#64d2ff',
    fontSize: 12,
  },
  templateName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 2,
  },
  date: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  details: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.text,
  },
  volume: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: '#32d74b',
    fontWeight: theme.typography.weight.medium,
  },
  deleteAction: {
    backgroundColor: '#ff453a',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  exBlock: {
    marginBottom: 12,
  },
  exName: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 6,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  setText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
  }
});
