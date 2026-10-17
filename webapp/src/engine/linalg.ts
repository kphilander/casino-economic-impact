/**
 * Dense linear algebra for the input-output model. Matrices are row-major
 * Float64Arrays; a 72 x 72 inverse takes well under a millisecond.
 */

export interface Matrix {
  rows: number;
  cols: number;
  data: Float64Array;
}

export function matrix(rows: number, cols: number, values?: ArrayLike<number>): Matrix {
  const data = new Float64Array(rows * cols);
  if (values) data.set(values);
  return { rows, cols, data };
}

export function fromRows(rows: number[][]): Matrix {
  const m = matrix(rows.length, rows[0]?.length ?? 0);
  rows.forEach((r, i) => {
    if (r.length !== m.cols) throw new Error('Ragged matrix');
    m.data.set(r, i * m.cols);
  });
  return m;
}

export const at = (m: Matrix, i: number, j: number): number => m.data[i * m.cols + j];

export function identity(n: number): Matrix {
  const m = matrix(n, n);
  for (let i = 0; i < n; i++) m.data[i * n + i] = 1;
  return m;
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) throw new Error('Dimension mismatch');
  const out = matrix(a.rows, b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      const aik = a.data[i * a.cols + k];
      if (aik === 0) continue;
      const bRow = k * b.cols;
      const oRow = i * b.cols;
      for (let j = 0; j < b.cols; j++) out.data[oRow + j] += aik * b.data[bRow + j];
    }
  }
  return out;
}

/** Row vector times matrix: v (length m.rows) x m. */
export function rowTimes(v: ArrayLike<number>, m: Matrix): Float64Array {
  if (v.length !== m.rows) throw new Error('Dimension mismatch');
  const out = new Float64Array(m.cols);
  for (let i = 0; i < m.rows; i++) {
    const vi = v[i];
    if (vi === 0) continue;
    const row = i * m.cols;
    for (let j = 0; j < m.cols; j++) out[j] += vi * m.data[row + j];
  }
  return out;
}

/** Matrix times column vector. */
export function timesColumn(m: Matrix, v: ArrayLike<number>): Float64Array {
  if (v.length !== m.cols) throw new Error('Dimension mismatch');
  const out = new Float64Array(m.rows);
  for (let i = 0; i < m.rows; i++) {
    let s = 0;
    const row = i * m.cols;
    for (let j = 0; j < m.cols; j++) s += m.data[row + j] * v[j];
    out[i] = s;
  }
  return out;
}

export function column(m: Matrix, j: number): Float64Array {
  const out = new Float64Array(m.rows);
  for (let i = 0; i < m.rows; i++) out[i] = m.data[i * m.cols + j];
  return out;
}

/** I - A for a square matrix. */
export function identityMinus(a: Matrix): Matrix {
  if (a.rows !== a.cols) throw new Error('Matrix must be square');
  const out = matrix(a.rows, a.cols);
  for (let k = 0; k < a.data.length; k++) out.data[k] = -a.data[k];
  for (let i = 0; i < a.rows; i++) out.data[i * a.cols + i] += 1;
  return out;
}

/** Inverse by Gauss-Jordan elimination with partial pivoting. */
export function invert(a: Matrix): Matrix {
  const n = a.rows;
  if (n !== a.cols) throw new Error('Matrix must be square');
  const w = 2 * n;
  const aug = new Float64Array(n * w);
  for (let i = 0; i < n; i++) {
    aug.set(a.data.subarray(i * n, i * n + n), i * w);
    aug[i * w + n + i] = 1;
  }
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = Math.abs(aug[c * w + c]);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(aug[r * w + c]);
      if (v > best) { best = v; p = r; }
    }
    if (best < 1e-14) throw new Error('Matrix is singular');
    if (p !== c) {
      for (let j = 0; j < w; j++) {
        const t = aug[c * w + j]; aug[c * w + j] = aug[p * w + j]; aug[p * w + j] = t;
      }
    }
    const pivot = aug[c * w + c];
    for (let j = 0; j < w; j++) aug[c * w + j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = aug[r * w + c];
      if (f === 0) continue;
      for (let j = 0; j < w; j++) aug[r * w + j] -= f * aug[c * w + j];
    }
  }
  const out = matrix(n, n);
  for (let i = 0; i < n; i++) out.data.set(aug.subarray(i * w + n, i * w + w), i * n);
  return out;
}

export const sum = (v: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s;
};

export const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
