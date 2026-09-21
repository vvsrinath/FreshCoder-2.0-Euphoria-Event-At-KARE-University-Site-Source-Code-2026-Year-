import { describe, expect, it } from 'vitest';
import { formatClock, formatDateTime, titleCase } from './format';

describe('formatClock', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatClock(0)).toBe('00:00:00');
  });

  it('formats plain seconds', () => {
    expect(formatClock(65)).toBe('00:01:05');
  });

  it('formats hours', () => {
    expect(formatClock(3661)).toBe('01:01:01');
  });

  it('never returns negative components', () => {
    expect(formatClock(-10)).toBe('00:00:00');
  });
});

describe('formatDateTime', () => {
  it('returns an em dash for empty input', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('returns the raw string for invalid dates', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});

describe('titleCase', () => {
  it('converts snake_case to Title Case', () => {
    expect(titleCase('IN_PROGRESS')).toBe('In Progress');
  });

  it('handles single words and lowercase', () => {
    expect(titleCase('draft')).toBe('Draft');
  });
});