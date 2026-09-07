import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { Expense, EXPENSE_CATEGORIES } from '../../models/expense.model';
import { notFutureDateValidator } from '../../validators/not-future-date.validator';

@Component({
  selector: 'app-expense-form',
  imports: [ReactiveFormsModule],
  templateUrl: './expense-form.html',
  styleUrl: './expense-form.css',
})
export class ExpenseForm implements OnChanges {
  @Input() expenseToEdit: Expense | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly categories = EXPENSE_CATEGORIES;

  loading = false;
  error = '';

  form: FormGroup;

  constructor(private fb: FormBuilder, private expenseService: ExpenseService) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      category: ['', [Validators.required]],
      date: [this.today(), [Validators.required, notFutureDateValidator]],
    });
  }

  get isEditMode(): boolean {
    return this.expenseToEdit !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expenseToEdit']) {
      this.error = '';
      if (this.expenseToEdit) {
        this.form.patchValue({
          title: this.expenseToEdit.title,
          amount: this.expenseToEdit.amount,
          category: this.expenseToEdit.category,
          date: this.expenseToEdit.date.substring(0, 10),
        });
      } else {
        this.form.reset({ title: '', amount: null, category: '', date: this.today() });
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';

    const payload = this.form.value;
    const request = this.isEditMode
      ? this.expenseService.updateExpense(this.expenseToEdit!.id, payload)
      : this.expenseService.createExpense(payload);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.form.reset({ title: '', amount: null, category: '', date: this.today() });
        this.saved.emit();
      },
      error: () => {
        this.loading = false;
        this.error = this.isEditMode
          ? 'Could not update expense. Please try again.'
          : 'Could not save expense. Please try again.';
      },
    });
  }

  onCancel(): void {
    this.form.reset({ title: '', amount: null, category: '', date: this.today() });
    this.error = '';
    this.cancelled.emit();
  }

  private today(): string {
    return new Date().toISOString().substring(0, 10);
  }
}
