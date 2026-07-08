import React, { useState, useMemo, useCallback } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, Modal,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LiquidGlassCard } from "../components/LiquidGlassCard";
import { CustomTextInput } from "../components/CustomTextInput";
import { CustomButton } from "../components/CustomButton";
import { CustomSegmentedButtons } from "../components/CustomSegmentedButtons";
import { CustomDatePickerModal } from "../components/CustomDateTimePicker";
import { injectFontFamily } from "../theme/styles";
import {
  getSpendingByCategory,
  getMonthlyTotals,
  addTransaction as saveAddTx,
  deleteTransaction as saveDeleteTx,
  upsertBudget as saveUpsertBudget,
  deleteBudget as saveDeleteBudget,
  addRecurringBill as saveAddBill,
  deleteRecurringBill as saveDeleteBill,
  markBillPaid as saveMarkBillPaid,
  updateBillNotificationIds,
} from "../utils/billingStorage";
import {
  scheduleRecurringBillReminder as scheduleBillReminder,
  cancelRecurringBillReminders as cancelBillReminders,
} from "../utils/billingNotifications";


// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Food",      icon: "food",              color: "#ef4444" },
  { label: "Transport", icon: "car",               color: "#f59e0b" },
  { label: "Housing",   icon: "home",              color: "#3b82f6" },
  { label: "Health",    icon: "medical-bag",       color: "#22c55e" },
  { label: "Salary",    icon: "briefcase",         color: "#8b5cf6" },
  { label: "Other",     icon: "dots-horizontal",   color: "#94a3b8" },
];

const getCategoryColor = (cat) =>
  CATEGORIES.find((c) => c.label === cat)?.color || "#94a3b8";
const getCategoryIcon = (cat) =>
  CATEGORIES.find((c) => c.label === cat)?.icon || "dots-horizontal";

// ─── Month helpers ────────────────────────────────────────────────────────────
const toMonthStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthLabel = (monthStr) => {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" }).toUpperCase();
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const BillingScreen = ({ billingData, setBillingData, currentTheme, showConfirmation }) => {
  const { transactions = [], budgets = [], recurringBills = [], currency = "₹" } = billingData || {};

  // ── Month navigation ──
  const [viewMonth, setViewMonth] = useState(toMonthStr(new Date()));
  const prevMonth = () => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setViewMonth(toMonthStr(d));
  };
  const nextMonth = () => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    const next = toMonthStr(d);
    if (next <= toMonthStr(new Date())) setViewMonth(next);
  };

  // ── Transaction tab ──
  const [txTab, setTxTab] = useState("all");

  // ── Add Transaction Modal ──
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCategory, setTxCategory] = useState("Food");
  const [txDate, setTxDate] = useState(new Date());
  const [showTxDatePicker, setShowTxDatePicker] = useState(false);

  // ── Add Budget Modal ──
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");

  // ── Add Recurring Bill Modal ──
  const [showAddBill, setShowAddBill] = useState(false);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("Housing");
  const [billDueDay, setBillDueDay] = useState("1");
  const [billNotifyDays, setBillNotifyDays] = useState("3");

  // ─── Derived data ──────────────────────────────────────────────────────────
  const { income, expenses, net } = useMemo(
    () => getMonthlyTotals(transactions, viewMonth),
    [transactions, viewMonth]
  );

  const spendingByCategory = useMemo(
    () => getSpendingByCategory(transactions, viewMonth),
    [transactions, viewMonth]
  );

  const prevMonthStr = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    return toMonthStr(new Date(y, m - 2, 1));
  }, [viewMonth]);

  const prevExpenses = useMemo(
    () => getMonthlyTotals(transactions, prevMonthStr).expenses,
    [transactions, prevMonthStr]
  );

  const filteredTx = useMemo(() => {
    return transactions
      .filter((t) => {
        if (!t.date.startsWith(viewMonth)) return false;
        if (txTab === "income") return t.type === "income";
        if (txTab === "expenses") return t.type === "expense";
        return true;
      });
  }, [transactions, viewMonth, txTab]);

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonthStr = toMonthStr(today);
  const isCurrentMonth = viewMonth === currentMonthStr;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const resetTxForm = () => {
    setTxType("expense"); setTxAmount(""); setTxDesc("");
    setTxCategory("Food"); setTxDate(new Date());
  };

  const handleSaveTx = useCallback(async () => {
    const amt = parseFloat(txAmount);
    if (!txAmount || isNaN(amt) || amt <= 0) return;
    const newTx = {
      id: Date.now().toString(),
      type: txType,
      amount: amt,
      category: txCategory,
      description: txDesc.trim() || txCategory,
      date: txDate.toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    const updated = await saveAddTx(newTx);
    setBillingData((prev) => ({ ...prev, transactions: updated.transactions }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetTxForm();
    setShowAddTx(false);
  }, [txType, txAmount, txDesc, txCategory, txDate]);

  const handleDeleteTx = useCallback((id) => {
    showConfirmation("Delete this transaction?", async () => {
      const updated = await saveDeleteTx(id);
      setBillingData((prev) => ({ ...prev, transactions: updated.transactions }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
  }, [showConfirmation]);

  const handleSaveBudget = useCallback(async () => {
    const lim = parseFloat(budgetLimit);
    if (!budgetLimit || isNaN(lim) || lim <= 0) return;
    const newBudget = {
      id: Date.now().toString(),
      category: budgetCategory,
      limit: lim,
      period: "monthly",
    };
    const updated = await saveUpsertBudget(newBudget);
    setBillingData((prev) => ({ ...prev, budgets: updated.budgets }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBudgetLimit(""); setBudgetCategory("Food");
    setShowAddBudget(false);
  }, [budgetCategory, budgetLimit]);

  const handleDeleteBudget = useCallback((id) => {
    showConfirmation("Remove this budget envelope?", async () => {
      const updated = await saveDeleteBudget(id);
      setBillingData((prev) => ({ ...prev, budgets: updated.budgets }));
    });
  }, [showConfirmation]);

  const handleSaveBill = useCallback(async () => {
    const amt = parseFloat(billAmount);
    const dueDay = parseInt(billDueDay, 10);
    const notifyDays = parseInt(billNotifyDays, 10);
    if (!billName.trim() || isNaN(amt) || amt <= 0 || isNaN(dueDay)) return;
    const newBill = {
      id: Date.now().toString(),
      name: billName.trim(),
      amount: amt,
      category: billCategory,
      dueDay,
      notifyDaysBefore: isNaN(notifyDays) ? 3 : notifyDays,
      notificationIds: [],
      lastPaidDate: null,
      active: true,
    };
    const notifId = await scheduleBillReminder(newBill, currency);
    if (notifId) newBill.notificationIds = [notifId];
    const updated = await saveAddBill(newBill);
    setBillingData((prev) => ({ ...prev, recurringBills: updated.recurringBills }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBillName(""); setBillAmount(""); setBillCategory("Housing");
    setBillDueDay("1"); setBillNotifyDays("3");
    setShowAddBill(false);
  }, [billName, billAmount, billCategory, billDueDay, billNotifyDays, currency]);

  const handleDeleteBill = useCallback((bill) => {
    showConfirmation("Delete this recurring bill?", async () => {
      await cancelBillReminders(bill.notificationIds || []);
      const updated = await saveDeleteBill(bill.id);
      setBillingData((prev) => ({ ...prev, recurringBills: updated.recurringBills }));
    });
  }, [showConfirmation]);

  const handleMarkBillPaid = useCallback(async (bill) => {
    const paidDate = new Date().toISOString().slice(0, 10);
    // Cancel old, reschedule new
    await cancelBillReminders(bill.notificationIds || []);
    const notifId = await scheduleBillReminder(bill, currency);
    const ids = notifId ? [notifId] : [];
    const updated1 = await saveMarkBillPaid(bill.id, paidDate);
    await updateBillNotificationIds(bill.id, ids);
    setBillingData((prev) => ({
      ...prev,
      recurringBills: updated1.recurringBills.map((b) =>
        b.id === bill.id ? { ...b, lastPaidDate: paidDate, notificationIds: ids } : b
      ),
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currency]);

  // ─── Analytics ─────────────────────────────────────────────────────────────
  const totalSpend = expenses;
  const categoryEntries = Object.entries(spendingByCategory).sort((a, b) => b[1] - a[1]);

  let momText = "";
  if (prevExpenses > 0) {
    const delta = Math.round(((expenses - prevExpenses) / prevExpenses) * 100);
    momText = delta >= 0 ? `▲ ${delta}% more than last month` : `▼ ${Math.abs(delta)}% less than last month`;
  }

  // ─── Recurring bills overdue check ─────────────────────────────────────────
  const isBillOverdue = (bill) => {
    if (!isCurrentMonth) return false;
    if (todayDay < bill.dueDay) return false;
    if (!bill.lastPaidDate) return true;
    return !bill.lastPaidDate.startsWith(currentMonthStr);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[s.container, { backgroundColor: currentTheme.background }]}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section A: Summary Header ─────────────────────────────────── */}
        <LiquidGlassCard theme={currentTheme} style={s.card}>
          <View style={s.headerRow}>
            <View>
              <Text style={[s.screenTitle, { color: currentTheme.text }]}>Billing</Text>
              <Text style={[s.screenSubtitle, { color: currentTheme.secondaryText }]}>Track income, expenses & bills</Text>
            </View>
            <View style={[s.monthBadge, { borderColor: currentTheme.primary + "60", backgroundColor: currentTheme.primary + "12" }]}>
              <Text style={[s.monthBadgeText, { color: currentTheme.primary }]}>{formatMonthLabel(viewMonth)}</Text>
            </View>
          </View>

          <View style={[s.netRow, { borderColor: currentTheme.border + "40" }]}>
            <Text style={[s.netLabel, { color: currentTheme.secondaryText }]}>Net Balance</Text>
            <Text style={[s.netValue, { color: net >= 0 ? currentTheme.primary : "#ef4444" }]}>
              {net >= 0 ? "+" : ""}{currency}{Math.abs(net).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View style={s.summaryRow}>
            <View style={[s.summaryBox, { borderColor: "#22c55e40", backgroundColor: "#22c55e10" }]}>
              <MaterialCommunityIcons name="arrow-up-circle" size={18} color="#22c55e" />
              <Text style={[s.summaryAmt, { color: "#22c55e" }]}>{currency}{income.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
              <Text style={[s.summaryLbl, { color: currentTheme.secondaryText }]}>INCOME</Text>
            </View>
            <View style={[s.summaryBox, { borderColor: "#ef444440", backgroundColor: "#ef444410" }]}>
              <MaterialCommunityIcons name="arrow-down-circle" size={18} color="#ef4444" />
              <Text style={[s.summaryAmt, { color: "#ef4444" }]}>{currency}{expenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
              <Text style={[s.summaryLbl, { color: currentTheme.secondaryText }]}>EXPENSES</Text>
            </View>
          </View>

          {/* Month navigation */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={[s.monthArrow, { borderColor: currentTheme.border }]}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={currentTheme.text} />
            </TouchableOpacity>
            <Text style={[s.monthNavLabel, { color: currentTheme.secondaryText }]}>{formatMonthLabel(viewMonth)}</Text>
            <TouchableOpacity
              onPress={nextMonth}
              style={[s.monthArrow, { borderColor: currentTheme.border, opacity: viewMonth >= toMonthStr(new Date()) ? 0.3 : 1 }]}
              disabled={viewMonth >= toMonthStr(new Date())}
            >
              <MaterialCommunityIcons name="chevron-right" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>
        </LiquidGlassCard>

        {/* ── Section B: Budget Envelopes ───────────────────────────────── */}
        <LiquidGlassCard theme={currentTheme} style={s.card}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <MaterialCommunityIcons name="wallet" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[s.sectionTitle, { color: currentTheme.text }]}>Spending Limits</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddBudget(true)}
              style={[s.addBtn, { borderColor: currentTheme.primary, backgroundColor: currentTheme.primary + "15" }]}
            >
              <MaterialCommunityIcons name="plus" size={16} color={currentTheme.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[s.sectionHint, { color: currentTheme.secondaryText }]}>Set a monthly cap per category. You&apos;ll see how much is left.</Text>

          {budgets.length === 0 ? (
            <Text style={[s.emptyText, { color: currentTheme.secondaryText }]}>No spending limits set yet. Tap + to add one.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {budgets.map((b) => {
                const spent = spendingByCategory[b.category] || 0;
                const pct = Math.min(spent / b.limit, 1);
                const isOver = spent > b.limit;
                const catColor = getCategoryColor(b.category);
                return (
                  <View key={b.id} style={[s.envelopeCard, { borderColor: isOver ? "#ef4444" : (catColor + "60"), backgroundColor: catColor + "10" }]}>
                    <View style={s.envelopeHeader}>
                      <MaterialCommunityIcons name={getCategoryIcon(b.category)} size={14} color={catColor} />
                      <Text style={[s.envelopeCat, { color: catColor }]}>{b.category.toUpperCase()}</Text>
                      <TouchableOpacity onPress={() => handleDeleteBudget(b.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <MaterialCommunityIcons name="close" size={12} color={currentTheme.secondaryText} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[s.envelopeSpent, { color: isOver ? "#ef4444" : currentTheme.text }]}>
                      {currency}{spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </Text>
                    <View style={[s.envelopeBarBg, { backgroundColor: currentTheme.border + "40" }]}>
                      <View style={[s.envelopeBarFill, { width: `${pct * 100}%`, backgroundColor: isOver ? "#ef4444" : catColor }]} />
                    </View>
                    <Text style={[s.envelopeLimit, { color: currentTheme.secondaryText }]}>
                      {isOver ? "OVER" : `${currency}${(b.limit - spent).toLocaleString("en-IN", { maximumFractionDigits: 0 })} left`} / {currency}{b.limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </LiquidGlassCard>

        {/* ── Section D: Recurring Bills ────────────────────────────────── */}
        <LiquidGlassCard theme={currentTheme} style={s.card}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <MaterialCommunityIcons name="repeat" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[s.sectionTitle, { color: currentTheme.text }]}>Bills & Subscriptions</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddBill(true)}
              style={[s.addBtn, { borderColor: currentTheme.primary, backgroundColor: currentTheme.primary + "15" }]}
            >
              <MaterialCommunityIcons name="plus" size={16} color={currentTheme.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[s.sectionHint, { color: currentTheme.secondaryText }]}>Bills due every month. Mark as paid when you&apos;ve settled them.</Text>

          {recurringBills.length === 0 ? (
            <Text style={[s.emptyText, { color: currentTheme.secondaryText }]}>No recurring bills yet. Tap + to track rent, subscriptions, etc.</Text>
          ) : (
            recurringBills.map((bill) => {
              const overdue = isBillOverdue(bill);
              const catColor = getCategoryColor(bill.category);
              return (
                <View
                  key={bill.id}
                  style={[s.billCard, {
                    borderColor: overdue ? "#ef4444" : (currentTheme.border + "60"),
                    backgroundColor: overdue ? "#ef444410" : currentTheme.surface,
                  }]}
                >
                  <View style={s.billLeft}>
                    <Text style={[s.billName, { color: currentTheme.text }]}>{bill.name}</Text>
                    <View style={s.billMeta}>
                      <View style={[s.catChip, { backgroundColor: catColor + "20", borderColor: catColor + "60" }]}>
                        <Text style={[s.catChipText, { color: catColor }]}>{bill.category.toUpperCase()}</Text>
                      </View>
                      <Text style={[s.billDue, { color: overdue ? "#ef4444" : currentTheme.secondaryText }]}>
                        DUE: {bill.dueDay}{bill.dueDay === 1 ? "st" : bill.dueDay === 2 ? "nd" : bill.dueDay === 3 ? "rd" : "th"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.billRight}>
                    <Text style={[s.billAmount, { color: currentTheme.text }]}>{currency}{bill.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
                    <View style={s.billActions}>
                      <TouchableOpacity
                        onPress={() => handleMarkBillPaid(bill)}
                        style={[s.paidBtn, { borderColor: "#22c55e", backgroundColor: "#22c55e15" }]}
                      >
                        <MaterialCommunityIcons name="check" size={13} color="#22c55e" />
                        <Text style={[s.paidBtnText, { color: "#22c55e" }]}>PAID</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteBill(bill)} style={{ padding: 4 }}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={currentTheme.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </LiquidGlassCard>

        {/* ── Section E: Analytics ──────────────────────────────────────── */}
        {categoryEntries.length > 0 && (
          <LiquidGlassCard theme={currentTheme} style={s.card}>
            <View style={s.sectionTitleRow}>
              <MaterialCommunityIcons name="chart-donut" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[s.sectionTitle, { color: currentTheme.text }]}>Where My Money Went</Text>
            </View>

            {/* Segmented bar */}
            <View style={s.analyticsBar}>
              {categoryEntries.map(([cat, amt]) => (
                <View
                  key={cat}
                  style={[s.analyticsSegment, {
                    flex: amt / totalSpend,
                    backgroundColor: getCategoryColor(cat),
                  }]}
                />
              ))}
            </View>

            {/* Legend */}
            {categoryEntries.map(([cat, amt]) => {
              const pct = Math.round((amt / totalSpend) * 100);
              return (
                <View key={cat} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: getCategoryColor(cat) }]} />
                  <Text style={[s.legendCat, { color: currentTheme.text }]}>{cat}</Text>
                  <Text style={[s.legendPct, { color: currentTheme.secondaryText }]}>{pct}%</Text>
                  <Text style={[s.legendAmt, { color: currentTheme.text }]}>{currency}{amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
                </View>
              );
            })}

            {/* Month-over-month */}
            {momText ? (
              <Text style={[s.momText, { color: expenses > prevExpenses ? "#ef4444" : "#22c55e" }]}>{momText}</Text>
            ) : null}
          </LiquidGlassCard>
        )}

        {/* ── Section C: Transaction Log ────────────────────────────────── */}
        <LiquidGlassCard theme={currentTheme} style={[s.card, { paddingBottom: 16 }]}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <MaterialCommunityIcons name="list-box-outline" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
              <Text style={[s.sectionTitle, { color: currentTheme.text }]}>Transaction History</Text>
            </View>
          </View>

          <CustomSegmentedButtons
            options={[
              { value: "all", label: "ALL" },
              { value: "income", label: "INCOME" },
              { value: "expenses", label: "EXPENSES" },
            ]}
            selectedValue={txTab}
            onValueChange={setTxTab}
            theme={currentTheme}
          />

          {filteredTx.length === 0 ? (
            <Text style={[s.emptyText, { color: currentTheme.secondaryText, marginTop: 12 }]}>No transactions found. Tap + to log income or expenses.</Text>
          ) : (
            filteredTx.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                onLongPress={() => handleDeleteTx(tx.id)}
                style={[s.txRow, { borderColor: currentTheme.border + "40" }]}
              >
                <View style={[s.txIcon, { backgroundColor: (tx.type === "income" ? "#22c55e" : "#ef4444") + "20" }]}>
                  <MaterialCommunityIcons
                    name={tx.type === "income" ? "arrow-up" : "arrow-down"}
                    size={16}
                    color={tx.type === "income" ? "#22c55e" : "#ef4444"}
                  />
                </View>
                <View style={s.txInfo}>
                  <Text style={[s.txDesc, { color: currentTheme.text }]} numberOfLines={1}>{tx.description}</Text>
                  <View style={s.txMeta}>
                    <View style={[s.catChip, { backgroundColor: getCategoryColor(tx.category) + "20", borderColor: getCategoryColor(tx.category) + "60" }]}>
                      <Text style={[s.catChipText, { color: getCategoryColor(tx.category) }]}>{tx.category.toUpperCase()}</Text>
                    </View>
                    <Text style={[s.txDate, { color: currentTheme.secondaryText }]}>{tx.date} · hold to delete</Text>
                  </View>
                </View>
                <Text style={[s.txAmount, { color: tx.type === "income" ? "#22c55e" : "#ef4444" }]}>
                  {tx.type === "income" ? "+" : "-"}{currency}{tx.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </LiquidGlassCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: currentTheme.primary }]}
        onPress={() => setShowAddTx(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={26} color="#ffffff" />
      </TouchableOpacity>

      {/* ── Add Transaction Modal ────────────────────────────────────────── */}
      <Modal visible={showAddTx} animationType="slide" transparent onRequestClose={() => setShowAddTx(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
            <Text style={[s.modalTitle, { color: currentTheme.text }]}>ADD_TRANSACTION</Text>

            <CustomSegmentedButtons
              options={[{ value: "expense", label: "EXPENSE" }, { value: "income", label: "INCOME" }]}
              selectedValue={txType}
              onValueChange={setTxType}
              theme={currentTheme}
            />

            <CustomTextInput
              label="AMOUNT"
              value={txAmount}
              onChangeText={setTxAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              theme={currentTheme}
            />
            <CustomTextInput
              label="DESCRIPTION"
              value={txDesc}
              onChangeText={setTxDesc}
              placeholder="What was this for?"
              theme={currentTheme}
            />

            <Text style={[s.fieldLabel, { color: currentTheme.secondaryText }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => setTxCategory(c.label)}
                  style={[s.categoryChip, {
                    backgroundColor: txCategory === c.label ? c.color : currentTheme.surface,
                    borderColor: txCategory === c.label ? c.color : currentTheme.border,
                  }]}
                >
                  <MaterialCommunityIcons name={c.icon} size={13} color={txCategory === c.label ? "#fff" : c.color} />
                  <Text style={[s.categoryChipText, { color: txCategory === c.label ? "#fff" : currentTheme.text }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowTxDatePicker(true)}
              style={[s.datePickerBtn, { borderColor: currentTheme.border }]}
            >
              <MaterialCommunityIcons name="calendar" size={16} color={currentTheme.primary} />
              <Text style={[s.datePickerText, { color: currentTheme.text }]}>DATE: {txDate.toISOString().slice(0, 10)}</Text>
            </TouchableOpacity>

            <View style={s.modalActions}>
              <CustomButton label="CANCEL" onPress={() => { resetTxForm(); setShowAddTx(false); }} variant="secondary" theme={currentTheme} style={{ flex: 1, marginRight: 8 }} />
              <CustomButton label="SAVE" onPress={handleSaveTx} theme={currentTheme} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
        <CustomDatePickerModal
          visible={showTxDatePicker}
          onClose={() => setShowTxDatePicker(false)}
          onDateSelected={(d) => { setTxDate(d); setShowTxDatePicker(false); }}
          initialDate={txDate}
          theme={currentTheme}
        />
      </Modal>

      {/* ── Add Budget Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddBudget} animationType="slide" transparent onRequestClose={() => setShowAddBudget(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
            <Text style={[s.modalTitle, { color: currentTheme.text }]}>SET_BUDGET</Text>

            <Text style={[s.fieldLabel, { color: currentTheme.secondaryText }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => setBudgetCategory(c.label)}
                  style={[s.categoryChip, {
                    backgroundColor: budgetCategory === c.label ? c.color : currentTheme.surface,
                    borderColor: budgetCategory === c.label ? c.color : currentTheme.border,
                  }]}
                >
                  <MaterialCommunityIcons name={c.icon} size={13} color={budgetCategory === c.label ? "#fff" : c.color} />
                  <Text style={[s.categoryChipText, { color: budgetCategory === c.label ? "#fff" : currentTheme.text }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <CustomTextInput
              label="MONTHLY LIMIT"
              value={budgetLimit}
              onChangeText={setBudgetLimit}
              keyboardType="decimal-pad"
              placeholder="0.00"
              theme={currentTheme}
            />

            <View style={s.modalActions}>
              <CustomButton label="CANCEL" onPress={() => setShowAddBudget(false)} variant="secondary" theme={currentTheme} style={{ flex: 1, marginRight: 8 }} />
              <CustomButton label="SET BUDGET" onPress={handleSaveBudget} theme={currentTheme} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Recurring Bill Modal ─────────────────────────────────────── */}
      <Modal visible={showAddBill} animationType="slide" transparent onRequestClose={() => setShowAddBill(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={[s.modalSheet, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border }]}>
              <Text style={[s.modalTitle, { color: currentTheme.text }]}>ADD_RECURRING_BILL</Text>

              <CustomTextInput
                label="BILL NAME"
                value={billName}
                onChangeText={setBillName}
                placeholder="Netflix, Rent, Electricity..."
                theme={currentTheme}
              />
              <CustomTextInput
                label="AMOUNT"
                value={billAmount}
                onChangeText={setBillAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                theme={currentTheme}
              />

              <Text style={[s.fieldLabel, { color: currentTheme.secondaryText }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    onPress={() => setBillCategory(c.label)}
                    style={[s.categoryChip, {
                      backgroundColor: billCategory === c.label ? c.color : currentTheme.surface,
                      borderColor: billCategory === c.label ? c.color : currentTheme.border,
                    }]}
                  >
                    <MaterialCommunityIcons name={c.icon} size={13} color={billCategory === c.label ? "#fff" : c.color} />
                    <Text style={[s.categoryChipText, { color: billCategory === c.label ? "#fff" : currentTheme.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <CustomTextInput
                label="DUE DAY OF MONTH (1-31)"
                value={billDueDay}
                onChangeText={setBillDueDay}
                keyboardType="number-pad"
                placeholder="1"
                theme={currentTheme}
              />

              <Text style={[s.fieldLabel, { color: currentTheme.secondaryText }]}>NOTIFY BEFORE</Text>
              <CustomSegmentedButtons
                options={[
                  { value: "0", label: "ON DAY" },
                  { value: "1", label: "1 DAY" },
                  { value: "3", label: "3 DAYS" },
                  { value: "7", label: "1 WEEK" },
                ]}
                selectedValue={billNotifyDays}
                onValueChange={setBillNotifyDays}
                theme={currentTheme}
              />

              <View style={[s.modalActions, { marginTop: 12 }]}>
                <CustomButton label="CANCEL" onPress={() => setShowAddBill(false)} variant="secondary" theme={currentTheme} style={{ flex: 1, marginRight: 8 }} />
                <CustomButton label="ADD BILL" onPress={handleSaveBill} theme={currentTheme} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const rawStyles = {
  container: { flex: 1 },
  scroll: { padding: 12, paddingTop: 16 },
  card: { marginBottom: 12 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  screenTitle: { fontSize: 18, fontFamily: "JetBrainsMono-Bold", fontWeight: "900", letterSpacing: 1 },
  screenSubtitle: { fontSize: 11, fontFamily: "JetBrainsMono-Regular", marginTop: 2, letterSpacing: 0.3 },
  sectionHint: { fontSize: 11, fontFamily: "JetBrainsMono-Regular", letterSpacing: 0.2, marginBottom: 8, lineHeight: 16 },
  monthBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  monthBadgeText: { fontSize: 10, fontFamily: "JetBrainsMono-Bold", letterSpacing: 1 },

  netRow: { alignItems: "center", borderWidth: 1, padding: 14, marginBottom: 12 },
  netLabel: { fontSize: 9, fontFamily: "JetBrainsMono-Regular", letterSpacing: 2, marginBottom: 4 },
  netValue: { fontSize: 32, fontFamily: "JetBrainsMono-Bold", fontWeight: "900" },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryBox: { flex: 1, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
  summaryAmt: { fontSize: 18, fontFamily: "JetBrainsMono-Bold", fontWeight: "900" },
  summaryLbl: { fontSize: 8, fontFamily: "JetBrainsMono-Regular", letterSpacing: 1 },

  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  monthArrow: { borderWidth: 1, padding: 6 },
  monthNavLabel: { fontSize: 11, fontFamily: "JetBrainsMono-Medium", letterSpacing: 1, minWidth: 90, textAlign: "center" },

  // Sections
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { fontSize: 11, fontFamily: "JetBrainsMono-Bold", letterSpacing: 1, fontWeight: "900" },
  addBtn: { borderWidth: 1, padding: 6 },
  emptyText: { fontSize: 11, fontFamily: "JetBrainsMono-Regular", letterSpacing: 1, textAlign: "center", paddingVertical: 16 },

  // Budget envelopes
  envelopeCard: { width: 140, marginRight: 10, borderWidth: 1, padding: 10 },
  envelopeHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  envelopeCat: { flex: 1, fontSize: 9, fontFamily: "JetBrainsMono-Bold", letterSpacing: 1 },
  envelopeSpent: { fontSize: 18, fontFamily: "JetBrainsMono-Bold", fontWeight: "900", marginBottom: 6 },
  envelopeBarBg: { height: 4, width: "100%", marginBottom: 6 },
  envelopeBarFill: { height: "100%" },
  envelopeLimit: { fontSize: 9, fontFamily: "JetBrainsMono-Regular" },

  // Recurring bills
  billCard: { flexDirection: "row", borderWidth: 1, padding: 10, marginTop: 8, alignItems: "center" },
  billLeft: { flex: 1 },
  billName: { fontSize: 14, fontFamily: "JetBrainsMono-Bold", fontWeight: "700", marginBottom: 4 },
  billMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  billDue: { fontSize: 9, fontFamily: "JetBrainsMono-Regular", letterSpacing: 1 },
  billRight: { alignItems: "flex-end", gap: 6 },
  billAmount: { fontSize: 16, fontFamily: "JetBrainsMono-Bold", fontWeight: "900" },
  billActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  paidBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  paidBtnText: { fontSize: 9, fontFamily: "JetBrainsMono-Bold", letterSpacing: 1 },

  // Analytics
  analyticsBar: { flexDirection: "row", height: 12, marginVertical: 12, overflow: "hidden" },
  analyticsSegment: { height: "100%" },
  legendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendCat: { flex: 1, fontSize: 12, fontFamily: "JetBrainsMono-Medium" },
  legendPct: { fontSize: 11, fontFamily: "JetBrainsMono-Regular", marginRight: 12 },
  legendAmt: { fontSize: 12, fontFamily: "JetBrainsMono-Bold" },
  momText: { fontSize: 10, fontFamily: "JetBrainsMono-Regular", letterSpacing: 1, marginTop: 8, textAlign: "right" },

  // Transaction rows
  txRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 10, gap: 10 },
  txIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 13, fontFamily: "JetBrainsMono-Medium", fontWeight: "600", marginBottom: 3 },
  txMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  txDate: { fontSize: 9, fontFamily: "JetBrainsMono-Regular" },
  txAmount: { fontSize: 14, fontFamily: "JetBrainsMono-Bold", fontWeight: "900" },

  // Category chip
  catChip: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  catChipText: { fontSize: 8, fontFamily: "JetBrainsMono-Bold", letterSpacing: 0.5 },
  categoryChip: { flexDirection: "row", alignItems: "center", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, gap: 4 },
  categoryChipText: { fontSize: 11, fontFamily: "JetBrainsMono-Medium" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: { borderTopWidth: 2, borderLeftWidth: 1, borderRightWidth: 1, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 14, fontFamily: "JetBrainsMono-Bold", letterSpacing: 2, fontWeight: "900", marginBottom: 16 },
  modalActions: { flexDirection: "row", marginTop: 8 },
  fieldLabel: { fontSize: 9, fontFamily: "JetBrainsMono-Regular", letterSpacing: 2, marginBottom: 6 },
  datePickerBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, padding: 10, gap: 8, marginBottom: 12 },
  datePickerText: { fontSize: 12, fontFamily: "JetBrainsMono-Medium" },

  // FAB
  fab: { position: "absolute", bottom: 24, right: 20, width: 52, height: 52, borderRadius: 0, alignItems: "center", justifyContent: "center", elevation: 6 },
};

injectFontFamily(rawStyles);
const s = StyleSheet.create(rawStyles);
