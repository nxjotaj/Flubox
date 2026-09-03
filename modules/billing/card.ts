export function onlyCardDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCardNumber(value: string) {
  const digits = onlyCardDigits(value);
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits))
    return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(value: string) {
  const digits = onlyCardDigits(value);
  if (digits.startsWith('4')) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^(636368|438935|504175|451416|636297)/.test(digits)) return 'Elo';
  return 'Cartão';
}
