import { Component, ViewChild } from '@angular/core';
import { ExpenseForm } from './components/expense-form/expense-form';
import { ExpenseList } from './components/expense-list/expense-list';
import { ExpenseSummary } from './components/expense-summary/expense-summary';
import { Expense } from './models/expense.model';

@Component({
  selector: 'app-root',
  imports: [ExpenseForm, ExpenseList, ExpenseSummary],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild(ExpenseList) expenseList!: ExpenseList;

  editingExpense: Expense | null = null;
  allExpenses: Expense[] = [];

  onExpensesLoaded(expenses: Expense[]): void {
    this.allExpenses = expenses;
  }

  onEdit(expense: Expense): void {
    this.editingExpense = expense;
  }

  onSaved(): void {
    this.editingExpense = null;
    this.expenseList.refresh();
  }

  onCancelled(): void {
    this.editingExpense = null;
  }
}
