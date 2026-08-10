import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webappDir = path.resolve(scriptDir, '..');
const repoDir = path.resolve(webappDir, '..');
const csvPath = path.join(repoDir, 'online_gambling_multipliers_2023.csv');
const jsonPath = path.join(webappDir, 'src', 'data', 'multipliers.json');

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
const headers = parseCsvLine(lines.shift());
const rows = lines.map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
});
const byState = new Map(rows.map((row) => [row.State, row]));

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceCoefficient(objectText, field, value) {
  const fieldPattern = new RegExp(`("${field}"\\s*:\\s*)[-+0-9.eE]+`);
  if (!fieldPattern.test(objectText)) {
    throw new Error(`Missing ${field} in online multiplier object`);
  }
  return objectText.replace(fieldPattern, `$1${Number(value)}`);
}

function updateSection(jsonText, startMarker, endMarker) {
  const start = jsonText.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing section marker: ${startMarker}`);
  const end = jsonText.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`Missing section end marker: ${endMarker}`);

  let section = jsonText.slice(start, end);
  for (const [state, source] of byState) {
    const statePattern = new RegExp(
      `(\\{\\s*"State"\\s*:\\s*"${escapeRegex(state)}"[\\s\\S]*?\\n\\s*\\})`,
    );
    const match = section.match(statePattern);
    if (!match) throw new Error(`No ${state} row in ${startMarker}`);

    let updated = replaceCoefficient(
      match[1],
      'Indirect_Emp_Coef',
      source.Indirect_Emp_Coef,
    );
    updated = replaceCoefficient(
      updated,
      'Induced_Emp_Coef',
      source.Induced_Emp_Coef,
    );
    section = section.replace(match[1], updated);
  }

  return `${jsonText.slice(0, start)}${section}${jsonText.slice(end)}`;
}

let jsonText = fs.readFileSync(jsonPath, 'utf8');
jsonText = updateSection(jsonText, '"ONLINE_CASINO": [', '"ONLINE_SPORTSBOOK": [');
jsonText = updateSection(jsonText, '"ONLINE_SPORTSBOOK": [', '"propertyTypeMetadata": {');
jsonText = updateSection(jsonText, '"onlineGaming": [', '\n  ]\n}');

JSON.parse(jsonText);
fs.writeFileSync(jsonPath, jsonText);
console.log(`Updated online supplier and induced employment coefficients in ${jsonPath}`);
