import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useHabits } from "../context/HabitContext";
import { useCommandGateway } from "../commands/useCommandGateway";
import { generateWeeklyReview } from "../ai/weeklyReviewEngine";
import { logger } from "../utils/logger";

export const WeeklyReviewModal = ({ visible, onClose, currentTheme }) => {
  const { habits, behaviorEvents, identities } = useHabits();
  const { dispatchCommand } = useCommandGateway();

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [appliedAdjustments, setAppliedAdjustments] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const theme = currentTheme || {
    primary: "#FFFFFF",
    background: "#121212",
    cardBackground: "#1E1E1E",
    text: "#FFFFFF",
    secondaryText: "#A0A0A0",
    border: "#333333",
  };

  const getAdjustmentKey = (adj) =>
    adj ? `${adj.habitId}_${adj.action}_${adj.ruleId || adj.description}` : "";

  const loadWeeklyReview = useCallback(async () => {
    setLoading(true);
    try {
      const generatedReport = await generateWeeklyReview(
        habits || [],
        behaviorEvents || [],
        identities || [],
        { forceHeuristic: false }
      );
      if (isMountedRef.current) {
        setReport(generatedReport);
      }
    } catch (err) {
      logger.debug("Failed to generate weekly review report:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [habits, behaviorEvents, identities]);

  useEffect(() => {
    if (visible) {
      loadWeeklyReview();
    } else {
      setConfirmDialog(null);
    }
  }, [visible, loadWeeklyReview]);

  const handleApplyAdjustment = async (adjustment) => {
    try {
      const result = await dispatchCommand(adjustment.action, adjustment.payload);
      if (result?.success) {
        const key = getAdjustmentKey(adjustment);
        setAppliedAdjustments((prev) => new Set([...prev, key]));
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Safe no-op in headless / unmocked envs
        }
      } else {
        logger.warn("Adjustment dispatch was unsuccessful:", result?.error);
      }
      setConfirmDialog(null);
    } catch (err) {
      logger.debug("Failed to apply weekly adjustment command:", err);
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="calendar-check-outline" size={24} color={theme.primary} />
              <View style={styles.headerTextCol}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Weekly Reflection</Text>
                {report && (
                  <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                    {report.periodStart} — {report.periodEnd}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={22} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
                Analyzing weekly behavior patterns...
              </Text>
            </View>
          ) : report ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Identity Evidence Votes */}
              <View style={[styles.sectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="shield-star-outline" size={20} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Identity Evidence Votes</Text>
                </View>
                {Object.values(report.identityVotes).length > 0 ? (
                  Object.values(report.identityVotes).map((iv) => (
                    <View key={iv.identityId} style={styles.identityRow}>
                      <View style={styles.identityTextCol}>
                        <Text style={[styles.identityStatement, { color: theme.text }]}>
                          {`"${iv.statement}"`}
                        </Text>
                        <Text style={[styles.identityTotal, { color: theme.secondaryText }]}>
                          Cumulative Votes: {iv.totalVotes}
                        </Text>
                      </View>
                      <View style={[styles.voteBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.voteBadgeText}>+{iv.votesThisWeek}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.bodyText, { color: theme.secondaryText }]}>
                    {report.totalCompletions} habit repetitions recorded this week.
                  </Text>
                )}
              </View>

              {/* Consistency & Recovery Scorecard */}
              <View style={styles.scorecardRow}>
                <View style={[styles.metricCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>Consistency</Text>
                  <Text style={[styles.metricValue, { color: theme.primary }]}>
                    {Math.round(report.overallConsistencyRate * 100)}%
                  </Text>
                  <Text style={[styles.metricSub, { color: theme.secondaryText }]}>
                    {report.totalCompletions} completed
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>Recovery Adherence</Text>
                  <Text style={[styles.metricValue, { color: theme.primary }]}>
                    {Math.round(report.recoveryAdherenceRate * 100)}%
                  </Text>
                  <Text style={[styles.metricSub, { color: theme.secondaryText }]}>
                    Never Miss Twice
                  </Text>
                </View>
              </View>

              {/* Top Friction Categories */}
              {report.topFrictionCategories.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF9800" />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Obstacles Observed</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {report.topFrictionCategories.map((item) => (
                      <View key={item.category} style={[styles.frictionChip, { borderColor: theme.border }]}>
                        <Text style={[styles.frictionChipCategory, { color: theme.text }]}>
                          {item.category.toUpperCase()}
                        </Text>
                        <Text style={[styles.frictionChipCount, { color: theme.secondaryText }]}>
                          ({item.count})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Narrative Reflection */}
              <View style={[styles.sectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="format-quote-open" size={20} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Weekly Narrative</Text>
                </View>
                <Text style={[styles.narrativeBody, { color: theme.text }]}>
                  {report.narrativeSummary}
                </Text>
              </View>

              {/* Suggested Adaptations */}
              {report.suggestedAdjustments.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialCommunityIcons name="tune-vertical" size={20} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Recommended System Adaptations</Text>
                  </View>
                  {report.suggestedAdjustments.map((adj, index) => {
                    const adjKey = getAdjustmentKey(adj);
                    const isApplied = appliedAdjustments.has(adjKey);
                    return (
                      <View key={`${adjKey}_${index}`} style={[styles.adjustmentItem, { borderColor: theme.border }]}>
                        <Text style={[styles.adjustmentDesc, { color: theme.text }]}>
                          {adj.description}
                        </Text>
                        <TouchableOpacity
                          disabled={isApplied}
                          onPress={() => setConfirmDialog(adj)}
                          style={[
                            styles.actionButton,
                            { backgroundColor: isApplied ? "#4CAF50" : theme.primary },
                          ]}
                        >
                          <Text style={[styles.actionButtonText, { color: isApplied ? "#FFFFFF" : "#000000" }]}>
                            {isApplied ? "ADAPTED ✓" : "APPLY ADJUSTMENT"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.bodyText, { color: theme.secondaryText }]}>
                No review data available for this period.
              </Text>
            </View>
          )}

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.doneButton, { backgroundColor: theme.primary }]}>
              <Text style={styles.doneButtonText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirmation Modal for Adjustments */}
        {confirmDialog && (
          <RNModal transparent visible animationType="fade">
            <View style={styles.confirmOverlay}>
              <View style={[styles.confirmCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <Text style={[styles.confirmTitle, { color: theme.text }]}>Confirm System Adaptation</Text>
                <Text style={[styles.confirmMessage, { color: theme.secondaryText }]}>
                  Are you sure you want to apply this adjustment?{"\n\n"}
                  {`"${confirmDialog.description}"`}
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    onPress={() => handleApplyAdjustment(confirmDialog)}
                    style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={styles.confirmBtnText}>APPLY</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmDialog(null)}
                    style={[styles.confirmCancelBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.confirmCancelText, { color: theme.text }]}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </RNModal>
        )}
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    maxHeight: "90%",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTextCol: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  identityTextCol: {
    flex: 1,
    marginRight: 8,
  },
  identityStatement: {
    fontSize: 13,
    fontWeight: "600",
  },
  identityTotal: {
    fontSize: 11,
    marginTop: 2,
  },
  voteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  voteBadgeText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 12,
  },
  scorecardRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 11,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frictionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  frictionChipCategory: {
    fontSize: 11,
    fontWeight: "700",
  },
  frictionChipCount: {
    fontSize: 11,
  },
  narrativeBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  adjustmentItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    gap: 8,
  },
  adjustmentDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  doneButtonText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  confirmBtnText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 12,
  },
  confirmCancelBtn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  confirmCancelText: {
    fontSize: 12,
  },
});
