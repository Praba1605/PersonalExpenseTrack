using System.ComponentModel.DataAnnotations;

namespace ExpenseTrackerApi.Validation;

public class NotFutureDateAttribute : ValidationAttribute
{
    public NotFutureDateAttribute()
    {
        ErrorMessage = "Date cannot be in the future.";
    }

    public override bool IsValid(object? value)
    {
        if (value is not DateOnly date)
            return true; // let [Required] handle missing values

        return date <= DateOnly.FromDateTime(DateTime.UtcNow);
    }
}
