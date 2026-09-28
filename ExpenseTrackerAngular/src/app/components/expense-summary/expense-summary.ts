import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Expense, MonthFilter } from '../../models/expense.model';

const ALL_MONTHS = 'all';

interface MonthOption {
  /** "all", or "YYYY-MM". */
  value: string;
  label: string;
}

@Component({
  selector: 'app-expense-summary',
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-summary.html',
  styleUrl: './expense-summary.css',
})
export class ExpenseSummary {
  @Input() expenses: Expense[] = [];

  /** Emitted whenever the chosen period changes; null means every month. */
  @Output() filterChange = new EventEmitter<MonthFilter | null>();

  private today = new Date();
  selected = this.monthValue(this.today.getFullYear(), this.today.getMonth());

  /**
   * The months that actually have expenses, newest first, plus the current
   * month so a fresh tracker still offers something to pick.
   */
  get monthOptions(): MonthOption[] {
    const values = new Set<string>([
      this.monthValue(this.today.getFullYear(), this.today.getMonth()),
    ]);

    for (const expense of this.expenses) {
      const [year, month] = expense.date.split('-').map(Number);
      values.add(this.monthValue(year, month - 1));
    }

    const months = [...values]
      .sort()
      .reverse()
      .map((value) => ({ value, label: this.monthLabelFor(value) }));

    return [{ value: ALL_MONTHS, label: 'All months' }, ...months];
  }

  get filteredExpenses(): Expense[] {
    if (this.selected === ALL_MONTHS) {
      return this.expenses;
    }

    // Compare the "yyyy-MM" prefix directly rather than parsing into a Date --
    // a date-only string parses as UTC midnight, which then reads back in the
    // viewer's local timezone and can shift the month for anyone behind UTC.
    return this.expenses.filter((expense) => expense.date.substring(0, 7) === this.selected);
  }

  get monthlyTotal(): number {
    return this.filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  get monthlyCount(): number {
    return this.filteredExpenses.length;
  }

  onSelectionChange(): void {
    if (this.selected === ALL_MONTHS) {
      this.filterChange.emit(null);
      return;
    }

    const [year, month] = this.selected.split('-').map(Number);
    this.filterChange.emit({ year, month: month - 1 });
  }

  private monthValue(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private monthLabelFor(value: string): string {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }
}
