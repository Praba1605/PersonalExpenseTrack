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
        if (value is not DateTime date)
            return true; // let [Required] handle missing values

        return date.Date <= DateTime.UtcNow.Date;
    }
}
