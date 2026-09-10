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

  private today = new Date();
  selectedYear = this.today.getFullYear();
  selectedMonth = this.today.getMonth(); // 0-11

  get isCurrentMonth(): boolean {
    return this.selectedYear === this.today.getFullYear() && this.selectedMonth === this.today.getMonth();
  }

  get filteredExpenses(): Expense[] {
    // Compare the "yyyy-MM-dd" string directly rather than parsing it into a
    // Date — a date-only string parses as UTC midnight, which getFullYear()/
    // getMonth() would then read back in the viewer's local timezone and can
    // shift the day by one for anyone behind UTC.
    return this.expenses.filter((e) => {
      const [year, month] = e.date.split('-').map(Number);
      return year === this.selectedYear && month - 1 === this.selectedMonth;
    });
  }

  get monthlyTotal(): number {
    return this.filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }

  get monthlyCount(): number {
    return this.filteredExpenses.length;
  }

  get monthLabel(): string {
    return new Date(this.selectedYear, this.selectedMonth, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }

  previousMonth(): void {
    this.selectedMonth--;
    if (this.selectedMonth < 0) {
      this.selectedMonth = 11;
      this.selectedYear--;
    }
  }

  nextMonth(): void {
    this.selectedMonth++;
    if (this.selectedMonth > 11) {
      this.selectedMonth = 0;
      this.selectedYear++;
    }
  }

  resetToCurrentMonth(): void {
    this.selectedYear = this.today.getFullYear();
    this.selectedMonth = this.today.getMonth();
  }
}
