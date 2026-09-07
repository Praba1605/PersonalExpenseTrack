---
name: expense-tracker-api-pattern
description: Use this whenever creating or editing an API endpoint, model, or database interaction in the Expense Tracker project. Ensures every endpoint follows the same consistent pattern for validation, DTOs, and error handling. Trigger this any time the user asks to add, change, or fix an endpoint, model, or database call in this project, even if they don't explicitly mention the pattern.
---

# Expense Tracker API Pattern

This skill defines the consistent rules to follow whenever building or modifying backend code in the Expense Tracker project (.NET API + database).

## Data model

An **Expense** has:
- Id (auto-generated)
- Title (required, max 100 characters)
- Amount (required, must be greater than 0)
- Category (required, one of: Food, Travel, Bills, Shopping, Other)
- Date (required, cannot be a future date)

## Rules to follow for every endpoint

1. **Always validate input using DataAnnotations** on the model or DTO:
   - `[Required]` on Title, Amount, Category, Date
   - `[StringLength(100)]` on Title
   - `[Range(0.01, double.MaxValue)]` on Amount
   - Custom validation to reject future dates

2. **Never expose the raw database model directly.** Always create and use a DTO for:
   - Incoming requests (`CreateExpenseDto`, `UpdateExpenseDto`)
   - Outgoing responses (`ExpenseResponseDto`)
   - Map between DTO and entity explicitly — do not pass the EF Core entity straight to/from the controller.

3. **Wrap every database call in try/catch.** On failure:
   - Return a clear, non-technical error message to the client (e.g. "Could not save expense. Please try again.")
   - Never leak raw exception details or stack traces in the API response.

4. **Use consistent HTTP status codes:**
   - `200 OK` — successful GET/PUT
   - `201 Created` — successful POST, with the created resource in the response
   - `400 Bad Request` — validation failure
   - `404 Not Found` — resource doesn't exist
   - `500 Internal Server Error` — unexpected failure (caught by try/catch)

5. **Keep routes RESTful and consistent:**
   - `GET /api/expenses` — list all (supports optional `category` and `month` query filters)
   - `GET /api/expenses/{id}` — get one
   - `POST /api/expenses` — create
   - `PUT /api/expenses/{id}` — update
   - `DELETE /api/expenses/{id}` — delete

6. **Every new endpoint must include this pattern automatically** — don't wait to be asked for validation, DTOs, or error handling separately. Apply all of the above by default.

## Example: what a correct endpoint looks like

```csharp
[HttpPost]
public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseDto dto)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);

    try
    {
        var expense = new Expense
        {
            Title = dto.Title,
            Amount = dto.Amount,
            Category = dto.Category,
            Date = dto.Date
        };

        _context.Expenses.Add(expense);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetExpense), new { id = expense.Id },
            new ExpenseResponseDto(expense));
    }
    catch (Exception)
    {
        return StatusCode(500, "Could not save expense. Please try again.");
    }
}
```

## When NOT to apply this skill

- Frontend-only Angular styling/UI work (no API or database involved)
- One-off scripts or migrations unrelated to the API endpoints themselves
