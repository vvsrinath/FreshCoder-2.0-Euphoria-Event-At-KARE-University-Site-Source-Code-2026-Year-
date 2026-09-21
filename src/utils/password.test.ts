import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, validatePassword } from './password';

describe('validatePassword', () => {
  it('rejects empty and short passwords', () => {
    expect(validatePassword('')).not.toBeNull();
    expect(validatePassword('abc1234')).not.toBeNull();
  });

  it('rejects missing letters or digits', () => {
    expect(validatePassword('aaaaaaaa')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
  });

  it('accepts a valid 8+ character alphanumeric password', () => {
    expect(validatePassword('kare2026!')).toBeNull();
    expect(validatePassword('student@2026')).toBeNull();
  });

  it('exposes the minimum length constant', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});