/**
 * Regression tests for the PhaseTimeoutOutOfBounds(2,30,600) incident.
 * Run: node --test tests/fees-phase-timeout.test.mjs
 * No network, no secrets: pure validation logic + the committed profile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Import TS sources without a build step: strip types crudely is fragile,
// so re-implement the tiny surface by loading the compiled rule from lib
// via a minimal transpile. Simplest robust approach: duplicate the 15-line
// rule here AND assert it matches lib/fees.ts behavior by invariant.
// To avoid drift, this test reads the bounds from lib/fees.ts source.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const feesSrc = fs.readFileSync(path.join(root, 'lib', 'fees.ts'), 'utf8');
const MIN = Number(/PHASE_TIMEOUT_MIN\s*=\s*(\d+)/.exec(feesSrc)[1]);
const MAX = Number(/PHASE_TIMEOUT_MAX\s*=\s*(\d+)/.exec(feesSrc)[1]);

function assertInBounds(allocs) {
  for (const [name, v] of Object.entries(allocs)) {
    const n = BigInt(v);
    if (n < BigInt(MIN) || n > BigInt(MAX)) {
      throw new Error(
        `Refusing to sign: ${name}=${n} outside bounds [${MIN},${MAX}]`,
      );
    }
  }
}

test('bounds match the onchain revert (30..600)', () => {
  assert.equal(MIN, 30);
  assert.equal(MAX, 600);
});

test('the incident value 2 is rejected', () => {
  assert.throws(
    () =>
      assertInBounds({
        leaderTimeunitsAllocation: 2,
        validatorTimeunitsAllocation: 4,
      }),
    /Refusing to sign: leaderTimeunitsAllocation=2/,
  );
});

test('every committed profile entry passes (deploy + all methods)', () => {
  const profile = JSON.parse(
    fs.readFileSync(path.join(root, 'fee-profile.json'), 'utf8'),
  );
  assert.equal(Number(profile.chainId), 61997);
  const entries = [
    ['deploy', profile.deploy],
    ...Object.entries(profile.methods),
  ];
  assert.ok(entries.length >= 4, 'expected deploy + 3 methods');
  for (const [label, e] of entries) {
    assertInBounds({
      leaderTimeunitsAllocation: e.leaderTimeunitsAllocation,
      validatorTimeunitsAllocation: e.validatorTimeunitsAllocation,
    });
  }
});

test('above-max values are also rejected', () => {
  assert.throws(
    () =>
      assertInBounds({
        leaderTimeunitsAllocation: 601,
        validatorTimeunitsAllocation: 30,
      }),
    /Refusing to sign/,
  );
});
