// Mirrors the server's rules (Django password validators) so people see what's needed before submitting
export const passwordChecks = (password) => [
  { label: 'At least 8 characters', ok: password.length >= 8 },
  { label: 'Not only numbers', ok: password.length > 0 && !/^\d+$/.test(password) },
];

export const meetsPasswordRules = (password) => passwordChecks(password).every((check) => check.ok);
