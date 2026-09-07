using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExpenseTrackerApi.Data;
using ExpenseTrackerApi.DTOs;
using ExpenseTrackerApi.Models;

namespace ExpenseTrackerApi.Controllers;

[ApiController]
[Route("api/expenses")]
public class ExpensesController : ControllerBase
{
    private readonly AppDbContext _context;

    public ExpensesController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/expenses?category=Food&month=2026-09
    [HttpGet]
    public async Task<IActionResult> GetExpenses([FromQuery] string? category, [FromQuery] string? month)
    {
        try
        {
            var query = _context.Expenses.AsQueryable();

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(e => e.Category == category);

            if (!string.IsNullOrWhiteSpace(month) &&
                DateTime.TryParseExact(month, "yyyy-MM", null,
                    System.Globalization.DateTimeStyles.None, out var monthStart))
            {
                var monthEnd = monthStart.AddMonths(1);
                query = query.Where(e => e.Date >= monthStart && e.Date < monthEnd);
            }

            var expenses = await query
                .OrderByDescending(e => e.Date)
                .Select(e => new ExpenseResponseDto(e))
                .ToListAsync();

            return Ok(expenses);
        }
        catch (Exception)
        {
            return StatusCode(500, "Could not load expenses. Please try again.");
        }
    }

    // GET /api/expenses/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetExpense(int id)
    {
        try
        {
            var expense = await _context.Expenses.FindAsync(id);

            if (expense == null)
                return NotFound($"Expense with id {id} was not found.");

            return Ok(new ExpenseResponseDto(expense));
        }
        catch (Exception)
        {
            return StatusCode(500, "Could not load the expense. Please try again.");
        }
    }

    // POST /api/expenses
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

    // PUT /api/expenses/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] UpdateExpenseDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var expense = await _context.Expenses.FindAsync(id);

            if (expense == null)
                return NotFound($"Expense with id {id} was not found.");

            expense.Title = dto.Title;
            expense.Amount = dto.Amount;
            expense.Category = dto.Category;
            expense.Date = dto.Date;

            await _context.SaveChangesAsync();

            return Ok(new ExpenseResponseDto(expense));
        }
        catch (Exception)
        {
            return StatusCode(500, "Could not update expense. Please try again.");
        }
    }

    // DELETE /api/expenses/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        try
        {
            var expense = await _context.Expenses.FindAsync(id);

            if (expense == null)
                return NotFound($"Expense with id {id} was not found.");

            _context.Expenses.Remove(expense);
            await _context.SaveChangesAsync();

            return Ok();
        }
        catch (Exception)
        {
            return StatusCode(500, "Could not delete expense. Please try again.");
        }
    }
}
