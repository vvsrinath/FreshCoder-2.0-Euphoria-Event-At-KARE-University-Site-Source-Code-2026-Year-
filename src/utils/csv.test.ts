import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('toCsv', () => {
  it('writes headers and rows', () => {
    const out = toCsv(['id', 'name'], [['1', 'Ada'], ['2', 'Linus']]);
    expect(out).toBe('id,name\n1,Ada\n2,Linus');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    const out = toCsv(['note'], [['a "quoted", value']]);
    expect(out).toBe('note\n"a ""quoted"", value"');
  });

  it('defends against spreadsheet formula injection', () => {
    const out = toCsv(['value'], [['=HYPERLINK()']]);
    expect(out).toBe("value\n'=HYPERLINK()");
  });
});

describe('parseCsv', () => {
  it('round-trips quoted cells back to their original values', () => {
    const original = toCsv(['name', 'note'], [['Ada', 'said "hi"' ]]);
    const rows = parseCsv(original);
    expect(rows[0].name).toBe('Ada');
    expect(rows[0].note).toBe('said "hi"');
  });

  it('drops a header-only sheet', () => {
    expect(parseCsv('a,b\n')).toEqual([]);
  });
});