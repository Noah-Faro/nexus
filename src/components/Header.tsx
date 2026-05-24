import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Settings, BarChart2, Calendar, FileText } from 'lucide-react-native';
import { theme } from '../theme';

interface HeaderProps {
  activeView: 'tracker' | 'stats' | 'calendar';
  onViewChange: (view: 'tracker' | 'stats' | 'calendar') => void;
  onOpenSettings: () => void;
}

export default function Header({ activeView, onViewChange, onOpenSettings }: HeaderProps) {
  return (
    <View style={styles.container}>
      {/* Obsidian-Style Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeView === 'tracker' && styles.activeTab]} 
          onPress={() => onViewChange('tracker')}
        >
          <FileText size={14} color={activeView === 'tracker' ? theme.colors.accent : theme.colors.textMuted} />
          <Text style={[styles.tabText, activeView === 'tracker' && styles.activeTabText]}>
            water-intake.md
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeView === 'stats' && styles.activeTab]} 
          onPress={() => onViewChange('stats')}
        >
          <BarChart2 size={14} color={activeView === 'stats' ? theme.colors.accent : theme.colors.textMuted} />
          <Text style={[styles.tabText, activeView === 'stats' && styles.activeTabText]}>
            graph-view.md
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeView === 'calendar' && styles.activeTab]} 
          onPress={() => onViewChange('calendar')}
        >
          <Calendar size={14} color={activeView === 'calendar' ? theme.colors.accent : theme.colors.textMuted} />
          <Text style={[styles.tabText, activeView === 'calendar' && styles.activeTabText]}>
            heatmap.md
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pane Title Bar */}
      <View style={styles.titleBar}>
        <View style={styles.titleContainer}>
          <Text style={styles.linkBrackets}>[[</Text>
          <Text style={styles.titleText}>
            {activeView === 'tracker' && 'Daily Log'}
            {activeView === 'stats' && 'Insights'}
            {activeView === 'calendar' && 'Annual Heatmap'}
          </Text>
          <Text style={styles.linkBrackets}>]]</Text>
        </View>

        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings} activeOpacity={0.7}>
          <Settings size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderMuted,
    backgroundColor: '#050505',
    paddingTop: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: theme.colors.borderMuted,
    gap: 6,
  },
  activeTab: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.accent,
  },
  tabText: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  activeTabText: {
    color: theme.colors.text,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkBrackets: {
    fontFamily: theme.typography.mono,
    fontSize: 16,
    color: theme.colors.accent,
    fontWeight: theme.typography.weight.bold,
  },
  titleText: {
    fontFamily: theme.typography.mono,
    fontSize: 15,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    paddingHorizontal: 2,
  },
  settingsButton: {
    padding: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
});
