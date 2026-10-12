// Public amounts remain JSON numbers; calculate balances in integer minor units.
export const toCents = (value) => Math.round(value * 100);
export const fromCents = (value) => value / 100;
export const validMoney = (value) => Number.isFinite(value) && Math.abs(value) <= 1e12 && value === Number(value.toFixed(2));
export const moneyValidator = { validator: validMoney, message: 'Use a finite amount up to 1 trillion with at most two decimal places.' };
export const centsExpression = (field) => ({ $round: [{ $multiply: [field, 100] }, 0] });
