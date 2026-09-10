using System.ComponentModel.DataAnnotations;
using ExpenseTrackerApi.Validation;

namespace ExpenseTrackerApi.DTOs;

public class UpdateExpenseDto
{
    [Required]
    [StringLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }

    [Required]
    [AllowedCategories]
    public string Category { get; set; } = string.Empty;

    [Required]
    [NotFutureDate]
    public DateOnly Date { get; set; }
}
