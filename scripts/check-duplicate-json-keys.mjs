import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { printParseErrorCode, visit } from 'jsonc-parser';

const contentRoot = path.resolve('src/content');

function jsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return jsonFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.json')) return [fullPath];
    return [];
  });
}

function checkSource(filePath, source) {
  const duplicates = [];
  const syntaxErrors = [];
  const objects = [];
  const relativePath = path.relative(process.cwd(), filePath);

  visit(
    source,
    {
      onObjectBegin: () => objects.push(new Map()),
      onObjectProperty: (
        property,
        _offset,
        _length,
        startLine,
        startColumn,
      ) => {
        const keys = objects.at(-1);
        if (!keys) return;

        const here = { line: startLine + 1, column: startColumn + 1 };
        const first = keys.get(property);

        if (first) {
          duplicates.push(
            `${relativePath}:${here.line}:${here.column} repeats key "${property}" first used at ${first.line}:${first.column}`,
          );
        } else {
          keys.set(property, here);
        }
      },
      onObjectEnd: () => objects.pop(),
      onError: (error, _offset, _length, startLine, startColumn) =>
        syntaxErrors.push(
          `${relativePath}:${startLine + 1}:${startColumn + 1} is invalid JSON: ${printParseErrorCode(error)}`,
        ),
    },
    { disallowComments: true },
  );

  return syntaxErrors.length > 0 ? syntaxErrors : duplicates;
}

if (process.argv.includes('--self-test')) {
  selfTest();
  console.log('Duplicate JSON key check passed.');
} else {
  const errors = jsonFiles(contentRoot).flatMap((filePath) =>
    checkSource(
      filePath,
      fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''),
    ),
  );

  if (errors.length > 0) {
    throw new Error(
      `JSON content check failed:\n${errors.join('\n')}\nJSON object keys must be unique; otherwise the last value silently wins.`,
    );
  }
}
