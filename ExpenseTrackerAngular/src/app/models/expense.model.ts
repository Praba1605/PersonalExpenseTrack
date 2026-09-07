export const EXPENSE_CATEGORIES = ['Food', 'Travel', 'Bills', 'Shopping', 'Other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  date: string;
}
