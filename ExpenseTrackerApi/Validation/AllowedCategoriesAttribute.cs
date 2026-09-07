using System.ComponentModel.DataAnnotations;

namespace ExpenseTrackerApi.Validation;

public class AllowedCategoriesAttribute : ValidationAttribute
{
    public static readonly string[] Categories = { "Food", "Travel", "Bills", "Shopping", "Other" };

    public AllowedCategoriesAttribute()
    {
        ErrorMessage = $"Category must be one of: {string.Join(", ", Categories)}.";
    }

    public override bool IsValid(object? value)
    {
        if (value is not string category)
            return true; // let [Required] handle missing values

        return Categories.Contains(category);
    }
}
