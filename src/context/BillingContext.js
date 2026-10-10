import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loadBillingData,
  saveBillingData,
  addTransaction,
  deleteTransaction,
  upsertBudget,
  deleteBudget,
  addRecurringBill,
  deleteRecurringBill,
} from "../utils/billingStorage";
import { logger } from "../utils/logger";
import { eventBus } from "../behavior/eventBus";

const BillingContext = createContext(null);

const DEFAULT_BILLING = {
  transactions: [],
  budgets: [],
  recurringBills: [],
  currency: "₹",
};

export const BillingProvider = ({
  children,
  initialBillingData = DEFAULT_BILLING,
}) => {
  const [billingData, setBillingData] = useState(initialBillingData);

  useEffect(() => {
    if (initialBillingData && initialBillingData.transactions) {
      setBillingData(initialBillingData);
    }
  }, [initialBillingData]);

  const refreshBillingData = useCallback(async () => {
    try {
      const data = await loadBillingData();
      setBillingData(data);
      return data;
    } catch (err) {
      logger.error("❌ Failed to refresh billing data:", err);
      return DEFAULT_BILLING;
    }
  }, []);

  const addTransactionAction = useCallback(async (tx) => {
    try {
      const updated = await addTransaction(tx);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_PAID",
        entityId: String(tx.id || Date.now()),
        source: "app",
        payload: {
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
        },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to add transaction:", err);
    }
  }, []);

  const deleteTransactionAction = useCallback(async (id) => {
    try {
      const updated = await deleteTransaction(id);
      setBillingData(updated);
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete transaction:", err);
    }
  }, []);

  const upsertBudgetAction = useCallback(async (budget) => {
    try {
      const updated = await upsertBudget(budget);
      setBillingData(updated);
      return updated;
    } catch (err) {
      logger.error("❌ Failed to upsert budget:", err);
    }
  }, []);

  const deleteBudgetAction = useCallback(async (id) => {
    try {
      const updated = await deleteBudget(id);
      setBillingData(updated);
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete budget:", err);
    }
  }, []);

  const addRecurringBillAction = useCallback(async (bill) => {
    try {
      const updated = await addRecurringBill(bill);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_CREATED",
        entityId: String(bill.id || Date.now()),
        source: "app",
        payload: {
          amount: bill.amount,
          category: bill.category,
          dueDate: bill.dueDate,
        },
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to add recurring bill:", err);
    }
  }, []);

  const deleteRecurringBillAction = useCallback(async (id) => {
    try {
      const updated = await deleteRecurringBill(id);
      setBillingData(updated);
      eventBus.emit({
        type: "BILL_DELETED",
        entityId: String(id),
        source: "app",
      });
      return updated;
    } catch (err) {
      logger.error("❌ Failed to delete recurring bill:", err);
    }
  }, []);

  const updateBillingDataState = useCallback(async (updater) => {
    setBillingData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveBillingData(next);
      return next;
    });
  }, []);

  const value = {
    billingData,
    setBillingData: updateBillingDataState,
    refreshBillingData,
    addTransactionAction,
    deleteTransactionAction,
    upsertBudgetAction,
    deleteBudgetAction,
    addRecurringBillAction,
    deleteRecurringBillAction,
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  return context;
};

export default BillingContext;
