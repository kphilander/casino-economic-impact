/**
 * The browser engine must reproduce the R pipeline's multipliers from the same
 * StateIO tables. Tolerances equal the rounding of each CSV field, widened
 * where the R script derives a field from already-rounded parent values.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { identityMinus, invert, matrix, multiply } from './linalg';
import { multipliers, type Multipliers } from './io';
import { STATES, loadModel } from './data';
import { activityResponse, type ActivityKey } from './activities';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

function readCsv(file: string): Record<string, string>[] {
  const lines = readFileSync(repo + file, 'utf8').trim().split(/\r?\n/);
  const split = (line: string) => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (ch === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += ch;
    }
    cells.push(cell);
    return cells;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const v = split(l);
    return Object.fromEntries(head.map((h, i) => [h, v[i]]));
  });
}

const FOUR_DP: (keyof Multipliers)[] = [
  'Type_I_Output', 'Type_II_Output', 'Type_I_VA', 'Type_II_VA',
  'Type_I_Wage', 'Type_II_Wage', 'Type_I_Tax', 'Type_II_Tax',
];
const SIX_DP: (keyof Multipliers)[] = [
  'Direct_VA_Coef', 'Direct_Wage_Coef', 'Direct_Tax_Coef',
  'Direct_Jobs_Per_1M_Output', 'Type_I_Jobs_Per_1M_Output', 'Type_II_Jobs_Per_1M_Output',
  'Direct_FTE_Per_1M_Output', 'Type_I_FTE_Per_1M_Output', 'Type_II_FTE_Per_1M_Output',
];

type Tolerances = Partial<Record<keyof Multipliers, number>>;

async function maxDiffs(file: string, activityFor: (sector: string) => ActivityKey | string, tol: Tolerances) {
  const rows = readCsv(file);
  const worst: Record<string, number> = {};
  for (const row of rows) {
    const st = STATES.find((s) => s.name === row.State)!;
    const model = await loadModel(st.abbrev);
    const key = activityFor(row.Sector);
    const resp = ['gambling', 'online'].includes(key)
      ? activityResponse(model, key as ActivityKey)
      : model.respond(key);
    const m = multipliers(resp);
    for (const field of Object.keys(tol) as (keyof Multipliers)[]) {
      const d = Math.abs(m[field] - Number(row[field]));
      worst[field] = Math.max(worst[field] ?? 0, d);
      if (d > tol[field]!) {
        throw new Error(`${file} ${row.State} ${row.Sector} ${field}: engine ${m[field]} vs R ${row[field]}`);
      }
    }
  }
  return { rows: rows.length, worst };
}

const rounding = (four: number, six: number): Tolerances => ({
  ...Object.fromEntries(FOUR_DP.map((f) => [f, four])),
  ...Object.fromEntries(SIX_DP.map((f) => [f, six])),
});

describe('linear algebra', () => {
  test('inverse of a diagonally dominant matrix', () => {
    const n = 12;
    const a = matrix(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a.data[i * n + j] = i === j ? 0 : ((i * 7 + j * 3) % 11) / 200;
    const inv = invert(identityMinus(a));
    const prod = multiply(identityMinus(a), inv);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) expect(prod.data[i * n + j]).toBeCloseTo(i === j ? 1 : 0, 12);
  });
});

describe('engine reproduces the R pipeline multipliers', () => {
  test('StateIO summary sectors 711AS, 713, 721, 722 (employment_multipliers_2023.csv)', async () => {
    const r = await maxDiffs('employment_multipliers_2023.csv', (s) => s, rounding(5.0001e-5, 5.0001e-7));
    expect(r.rows).toBe(200);
  });

  test('construction (construction_multipliers_2023.csv)', async () => {
    const r = await maxDiffs('construction_multipliers_2023.csv', (s) => s, rounding(5.0001e-5, 5.0001e-7));
    expect(r.rows).toBe(50);
  });

  test('gambling 7132 from 713 and USEEIO ratios (gambling_multipliers_2023.csv)', async () => {
    // R scales already-rounded 713 multipliers; ratios are at most ~1.05.
    const r = await maxDiffs('gambling_multipliers_2023.csv', () => 'gambling', {
      ...rounding(5.5e-5, 6e-7),
      Type_I_Jobs_Per_1M_Output: 3e-6, Type_II_Jobs_Per_1M_Output: 3e-6,
      Type_I_FTE_Per_1M_Output: 3e-6, Type_II_FTE_Per_1M_Output: 3e-6,
    });
    expect(r.rows).toBe(50);
  });

  test('online gambling (online_gambling_multipliers_2023.csv)', async () => {
    const r = await maxDiffs('online_gambling_multipliers_2023.csv', () => 'online', {
      ...rounding(5.5e-5, 6e-7),
      Type_I_Jobs_Per_1M_Output: 3e-6, Type_II_Jobs_Per_1M_Output: 3e-6,
      Type_I_FTE_Per_1M_Output: 3e-6, Type_II_FTE_Per_1M_Output: 3e-6,
    });
    expect(r.rows).toBe(50);
  });
});
