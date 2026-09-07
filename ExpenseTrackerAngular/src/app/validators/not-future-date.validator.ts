import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const notFutureDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) {
    return null; // required validator handles empty values
  }

  const inputDate = new Date(control.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  return inputDate > today ? { futureDate: true } : null;
};
