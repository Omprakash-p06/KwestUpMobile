import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_VERSION } from "./storage";

const BILLING_KEY = `kwestup_billing_${STORAGE_VERSION}`;

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_BILLING = {
  transactions: [],
  budgets: [],
  recurringBills: [],
  currency: "₹",
};

// ─── Core Load / Save ─────────────────────────────────────────────────────────

export const loadBillingData = async () => {
  try {
    const raw = await AsyncStorage.getItem(BILLING_KEY);
    if (!raw) return { ...DEFAULT_BILLING };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BILLING, ...parsed };
  } catch (err) {
    console.error("billingStorage: loadBillingData failed:", err);
    return { ...DEFAULT_BILLING };
  }
};

export const saveBillingData = async (billingState) => {
  try {
    await AsyncStorage.setItem(BILLING_KEY, JSON.stringify(billingState));
  } catch (err) {
    console.error("billingStorage: saveBillingData failed:", err);
  }
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (tx) => {
  const data = await loadBillingData();
  const updated = { ...data, transactions: [tx, ...data.transactions] };
  await saveBillingData(updated);
  return updated;
};

export const deleteTransaction = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, transactions: data.transactions.filter((t) => t.id !== id) };
  await saveBillingData(updated);
  return updated;
};

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const upsertBudget = async (budget) => {
  const data = await loadBillingData();
  const existing = data.budgets.find((b) => b.id === budget.id || b.category === budget.category);
  let updatedBudgets;
  if (existing) {
    updatedBudgets = data.budgets.map((b) =>
      b.id === existing.id ? { ...existing, ...budget } : b
    );
  } else {
    updatedBudgets = [...data.budgets, budget];
  }
  const updated = { ...data, budgets: updatedBudgets };
  await saveBillingData(updated);
  return updated;
};

export const deleteBudget = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, budgets: data.budgets.filter((b) => b.id !== id) };
  await saveBillingData(updated);
  return updated;
};

// ─── Analytics Helpers ────────────────────────────────────────────────────────

/**
 * Returns { category: totalSpent } map for expense transactions in a given month.
 * @param {Array} transactions
 * @param {string} month - "YYYY-MM"
 */
export const getSpendingByCategory = (transactions, month) => {
  const result = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!tx.date || !tx.date.startsWith(month)) continue;
    result[tx.category] = (result[tx.category] || 0) + tx.amount;
  }
  return result;
};

/**
 * Returns { income, expenses, net } totals for a given month.
 * @param {Array} transactions
 * @param {string} month - "YYYY-MM"
 */
export const getMonthlyTotals = (transactions, month) => {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (!tx.date || !tx.date.startsWith(month)) continue;
    if (tx.type === "income") income += tx.amount;
    if (tx.type === "expense") expenses += tx.amount;
  }
  return { income, expenses, net: income - expenses };
};

// ─── Recurring Bills ──────────────────────────────────────────────────────────

export const addRecurringBill = async (bill) => {
  const data = await loadBillingData();
  const updated = { ...data, recurringBills: [...data.recurringBills, bill] };
  await saveBillingData(updated);
  return updated;
};

export const deleteRecurringBill = async (id) => {
  const data = await loadBillingData();
  const updated = { ...data, recurringBills: data.recurringBills.filter((b) => b.id !== id) };
  await saveBillingData(updated);
  return updated;
};

export const markBillPaid = async (id, paidDate) => {
  const data = await loadBillingData();
  const updated = {
    ...data,
    recurringBills: data.recurringBills.map((b) =>
      b.id === id ? { ...b, lastPaidDate: paidDate } : b
    ),
  };
  await saveBillingData(updated);
  return updated;
};

export const updateBillNotificationIds = async (id, notificationIds) => {
  const data = await loadBillingData();
  const updated = {
    ...data,
    recurringBills: data.recurringBills.map((b) =>
      b.id === id ? { ...b, notificationIds } : b
    ),
  };
  await saveBillingData(updated);
  return updated;
};
