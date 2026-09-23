/**
 * Regression: the criteria builder must serialize to the exact policy
 * representation the existing workflow accepts (byte-identical JSON shape).
 * Run: node --test tests/policy-builder.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Load lib/policy.ts without a TS toolchain: strip types via a tiny,
// well-scoped transform (interfaces + annotations only; logic untouched).
function loadPolicyLib() {
  let src = fs.readFileSync(path.join(root, 'lib', 'policy.ts'), 'utf8');
  src = src
    .replace(/export (type|interface) .*?\n\n/gs, '')
    .replace(/: (Criterion\[\]|Criterion|Policy|string\[\]|string|number|boolean)(\[\])?(?=[,)=;\] ])/g, '')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/new Set<string>\(\)/g, 'new Set()');
  const fn = new Function(
    `${src}; return { DEFAULT_CRITERIA, MIN_CRITERIA, MAX_CRITERIA, POLICY_VERSION, nextId, validateCriteria, buildPolicy };`,
  );
  return fn();
}

const P = loadPolicyLib();

const demoJson = {
  version: 1,
  criteria: [
    { id: 'c1', text: 'The deliverable must state that the sky is blue.', weight: 5 },
    { id: 'c2', text: 'The deliverable must include the number 42.', weight: 5 },
  ],
};

test('default builder state matches the proven demo policy', () => {
  assert.deepEqual(P.buildPolicy(P.DEFAULT_CRITERIA), demoJson);
});

test('generated JSON is byte-stable', () => {
  const a = JSON.stringify(P.buildPolicy(P.DEFAULT_CRITERIA));
  const b = JSON.stringify(P.buildPolicy(P.DEFAULT_CRITERIA));
  assert.equal(a, b);
});

test('add criterion appends c3 with valid defaults', () => {
  const list = [...P.DEFAULT_CRITERIA];
  list.push({ id: P.nextId(list), text: 'Third check.', weight: 5 });
  assert.deepEqual(P.validateCriteria(list), []);
  assert.equal(P.buildPolicy(list).criteria.length, 3);
});

test('remove below minimum is rejected', () => {
  const problems = P.validateCriteria([P.DEFAULT_CRITERIA[0]]);
  assert.ok(problems.some((m) => m.includes('at least 2')));
});

test('empty criterion text is rejected', () => {
  const list = P.DEFAULT_CRITERIA.map((c) => ({ ...c }));
  list[0].text = '   ';
  assert.ok(
    P.validateCriteria(list).some((m) => m.includes('needs text')),
  );
  assert.throws(() => P.buildPolicy(list), /needs text/);
});

test('weight out of range is rejected', () => {
  const list = P.DEFAULT_CRITERIA.map((c) => ({ ...c }));
  list[1].weight = 11;
  assert.ok(
    P.validateCriteria(list).some((m) => m.includes('1–10')),
  );
});

test('duplicate ids are rejected', () => {
  const list = [...P.DEFAULT_CRITERIA, { ...P.DEFAULT_CRITERIA[0] }];
  assert.ok(
    P.validateCriteria(list).some((m) => m.includes('Duplicate')),
  );
});

test('more than 4 criteria are rejected', () => {
  const list = [...P.DEFAULT_CRITERIA];
  while (list.length < 5)
    list.push({ id: P.nextId(list), text: `Extra ${list.length}.`, weight: 5 });
  assert.ok(
    P.validateCriteria(list).some((m) => m.includes('At most 4')),
  );
});

test('criterion text is limited by UTF-8 bytes rather than JavaScript characters', () => {
  const unicode = 'é'.repeat(251);
  assert.equal(unicode.length, 251);
  assert.equal(new TextEncoder().encode(unicode).byteLength, 502);
  assert.ok(P.validateCriteria([
    { id: 'c1', text: unicode, weight: 5 },
    { id: 'c2', text: 'Another criterion.', weight: 5 },
  ]).some((problem) => problem.includes('500 UTF-8 bytes')));
});

test('criterion IDs follow the contract ASCII grammar and total policy text is byte bounded', () => {
  assert.ok(P.validateCriteria([
    { id: 'bad id', text: 'first', weight: 5 },
    { id: 'c2', text: 'second', weight: 5 },
  ]).some((problem) => problem.includes('ASCII letters')));
  const long = 'x'.repeat(601);
  assert.ok(P.validateCriteria([
    { id: 'c1', text: long, weight: 5 },
    { id: 'c2', text: long, weight: 5 },
  ]).some((problem) => problem.includes('1200 UTF-8 bytes')));
});
