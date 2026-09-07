import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Expense } from '../../models/expense.model';

@Component({
  selector: 'app-expense-summary',
  imports: [CommonModule],
  templateUrl: './expense-summary.html',
  styleUrl: './expense-summary.css',
})
export class ExpenseSummary {
  @Input() expenses: Expense[] = [];

  get monthlyTotal(): number {
    const now = new Date();
    return this.expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }

  get monthlyCount(): number {
    const now = new Date();
    return this.expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }

  get monthLabel(): string {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
