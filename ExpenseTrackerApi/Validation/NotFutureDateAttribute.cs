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

        // This app runs entirely on one machine (browser, API, and DB share a
        // timezone), so "today" should match the local clock the user's date
        // picker uses -- not UTC, which drifts from local "today" for part of
        // every day and would reject a date the client just accepted.
        return date <= DateOnly.FromDateTime(DateTime.Now);
    }
}
