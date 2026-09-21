/** Shared account-password policy used by admin, staff and auth routes. */

export const MIN_PASSWORD_LENGTH = 8;

export function passwordError(password: string): string {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return "";
}