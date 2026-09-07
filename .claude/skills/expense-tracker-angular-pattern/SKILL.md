---
name: expense-tracker-angular-pattern
description: Use this whenever creating or editing an Angular component, service, model, HTML template, or CSS in the Expense Tracker project. Ensures every frontend piece follows the same consistent structure for API calls, error handling, and loading states. Trigger this any time the user asks to add, change, or fix a component, page, form, or UI element in this project, even if they don't explicitly mention the pattern.
---

# Expense Tracker Angular Pattern

This skill defines the consistent rules to follow whenever building or modifying frontend code in the Expense Tracker project (Angular).

## File structure per component

Every component must have three separate files, never inline templates/styles for anything beyond a few lines:
- `component-name.ts` — logic
- `component-name.html` — layout
- `component-name.css` — styles

## Rules to follow for every component

1. **All API calls go through a Service, never directly in a component.**
   - `ExpenseService` (in `services/expense.service.ts`) handles all HTTP calls to the .NET API.
   - Components call the service, never `HttpClient` directly.

2. **Every API call must handle three states:**
   - **Loading** — show a simple loading indicator while waiting for the response
   - **Success** — display the data
   - **Error** — show a user-friendly error message (never show raw HTTP error objects to the user)

3. **Use a shared TypeScript interface for Expense**, matching the backend DTO exactly:
   ```typescript
   export interface Expense {
     id: number;
     title: string;
     amount: number;
     category: string;
     date: string;
   }
   ```
   Never use `any` for expense data.

4. **Form validation must mirror backend validation**, so errors are caught before the API call:
   - Title required, max 100 characters
   - Amount required, must be greater than 0
   - Category required
   - Date required, cannot be in the future

5. **No hardcoded API URLs inside components or services.** Use a single shared config value (e.g. `environment.ts` or a constant) for the base API URL, so it only needs to change in one place.

6. **Keep components focused.** A component should handle one page/feature (e.g. Expense List, Add Expense Form) — don't mix unrelated features into the same file.

## Example: what a correct service call looks like

```typescript
getExpenses(): Observable<Expense[]> {
  return this.http.get<Expense[]>(`${this.apiUrl}/expenses`);
}
```

```typescript
loading = true;
error = '';
expenses: Expense[] = [];

ngOnInit() {
  this.expenseService.getExpenses().subscribe({
    next: (data) => {
      this.expenses = data;
      this.loading = false;
    },
    error: () => {
      this.error = 'Could not load expenses. Please try again.';
      this.loading = false;
    }
  });
}
```

## When NOT to apply this skill

- Backend/.NET API or database work (use `expense-tracker-api-pattern` instead)
- Pure config file changes unrelated to component structure
