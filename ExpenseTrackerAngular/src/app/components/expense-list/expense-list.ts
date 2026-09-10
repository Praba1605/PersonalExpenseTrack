import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../services/expense.service';
import { Expense } from '../../models/expense.model';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

@Component({
  selector: 'app-expense-list',
  imports: [CommonModule],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.css',
})
export class ExpenseList implements OnInit {
  @Output() edit = new EventEmitter<Expense>();
  @Output() expensesLoaded = new EventEmitter<Expense[]>();

  expenses: Expense[] = [];
  loading = false;
  error = '';
  deletingId: number | null = null;

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';

    this.expenseService.getExpenses().subscribe({
      next: (data) => {
        this.expenses = data;
        this.loading = false;
        this.expensesLoaded.emit(this.expenses);
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load expenses. Please try again.';
      },
    });
  }

  formatDate(dateStr: string): string {
    // Format the "yyyy-MM-dd" string directly instead of going through Date/
    // DatePipe — Angular's DatePipe mishandles date-only ISO strings even
    // with an explicit UTC timezone, shifting the day back by the viewer's
    // local UTC offset. Parsing the string ourselves sidesteps that entirely.
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
  }

  onEdit(expense: Expense): void {
    this.edit.emit(expense);
  }

  onDelete(expense: Expense): void {
    this.deletingId = expense.id;

    this.expenseService.deleteExpense(expense.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.refresh();
      },
      error: () => {
        this.deletingId = null;
        this.error = 'Could not delete expense. Please try again.';
      },
    });
  }
}
