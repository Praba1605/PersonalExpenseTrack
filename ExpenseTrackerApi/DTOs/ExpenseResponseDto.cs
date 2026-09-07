using ExpenseTrackerApi.Models;

namespace ExpenseTrackerApi.DTOs;

public class ExpenseResponseDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateTime Date { get; set; }

    public ExpenseResponseDto() { }

    public ExpenseResponseDto(Expense expense)
    {
        Id = expense.Id;
        Title = expense.Title;
        Amount = expense.Amount;
        Category = expense.Category;
        Date = expense.Date;
    }
}
