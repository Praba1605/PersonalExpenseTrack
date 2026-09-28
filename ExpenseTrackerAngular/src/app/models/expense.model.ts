export const EXPENSE_CATEGORIES = ['Food', 'Travel', 'Bills', 'Shopping', 'Other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

/** The period the Expenses page is showing; null elsewhere means "all". */
export interface MonthFilter {
  year: number;
  /** 0-11, matching Date.getMonth(). */
  month: number;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  date: string;
}
