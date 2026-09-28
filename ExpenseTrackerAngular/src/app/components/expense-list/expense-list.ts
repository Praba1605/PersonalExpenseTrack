import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { Expense, MonthFilter, EXPENSE_CATEGORIES } from '../../models/expense.model';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-expense-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-list.html',
  styleUrl: './expense-list.css',
})
export class ExpenseList implements OnInit, OnDestroy {
  /** The period to show. null shows every month. */
  @Input() monthFilter: MonthFilter | null = null;

  @Output() edit = new EventEmitter<Expense>();
  @Output() expensesLoaded = new EventEmitter<Expense[]>();

  expenses: Expense[] = [];
  loading = false;
  error = '';
  deletingId: number | null = null;
  /** The row currently asking "delete this?" -- nothing is removed until confirmed. */
  confirmingId: number | null = null;

  /** Column filters. Empty means the column is not filtering. */
  dateFilter = '';
  categoryFilter = '';

  /** Filter inputs stay out of the way until their funnel is clicked. */
  dateFilterOpen = false;
  categoryFilterOpen = false;
  readonly categories = EXPENSE_CATEGORIES;

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

  /**
   * Filtered for display only: `expenses` stays the full set so the summary
   * above keeps totalling correctly and polling is unaffected.
   */
  get visibleExpenses(): Expense[] {
    const period = this.monthFilter;

    return this.expenses.filter((expense) => {
      // Compare the "yyyy-MM-dd" parts directly. Parsing to Date would read a
      // date-only string as UTC midnight and shift the day for anyone behind UTC.
      if (period) {
        const [year, month] = expense.date.split('-').map(Number);
        if (year !== period.year || month - 1 !== period.month) {
          return false;
        }
      }

      if (this.dateFilter && expense.date.substring(0, 10) !== this.dateFilter) {
        return false;
      }

      if (this.categoryFilter && expense.category !== this.categoryFilter) {
        return false;
      }

      return true;
    });
  }

  get hasColumnFilters(): boolean {
    return Boolean(this.dateFilter || this.categoryFilter);
  }

  /** The row of inputs is present while a panel is open or a filter is set,
   *  so an active filter can always be reached and cleared. */
  get filterRowVisible(): boolean {
    return this.dateFilterOpen || this.categoryFilterOpen || this.hasColumnFilters;
  }

  toggleDateFilter(): void {
    this.dateFilterOpen = !this.dateFilterOpen;
  }

  toggleCategoryFilter(): void {
    this.categoryFilterOpen = !this.categoryFilterOpen;
  }

  clearColumnFilters(): void {
    this.dateFilter = '';
    this.categoryFilter = '';
    this.dateFilterOpen = false;
    this.categoryFilterOpen = false;
  }

  /** Lowercased so the template can map it to a badge colour class. */
  categoryClass(category: string): string {
    return `cat-${category.toLowerCase()}`;
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

  askDelete(expense: Expense): void {
    this.confirmingId = expense.id;
  }

  cancelDelete(): void {
    this.confirmingId = null;
  }

  onDelete(expense: Expense): void {
    this.confirmingId = null;
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
