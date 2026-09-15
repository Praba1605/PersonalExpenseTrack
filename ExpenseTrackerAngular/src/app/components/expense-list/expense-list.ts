import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../services/expense.service';
import { Expense } from '../../models/expense.model';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-expense-list',
  imports: [CommonModule],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.css',
})
export class ExpenseList implements OnInit, OnDestroy {
  @Output() edit = new EventEmitter<Expense>();
  @Output() expensesLoaded = new EventEmitter<Expense[]>();

  expenses: Expense[] = [];
  loading = false;
  error = '';
  deletingId: number | null = null;

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.refresh();

    // Picks up changes made from elsewhere (e.g. the phone, via the same
    // backend) without needing a manual reload. Runs quietly in the
    // background -- see poll() for why it doesn't touch loading/error.
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
    }
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

  private poll(): void {
    // Deliberately does not set `loading` (would blank the table every few
    // seconds) or `error` on failure (a single missed background poll isn't
    // worth interrupting the view for -- the next successful poll, or any
    // user-triggered refresh, recovers on its own).
    this.expenseService.getExpenses().subscribe({
      next: (data) => {
        this.expenses = data;
        this.expensesLoaded.emit(this.expenses);
      },
      error: () => {
        // Silently skip; see comment above.
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
