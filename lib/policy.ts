/**
 * Criteria builder model: human-readable criteria compiled to the exact
 * policy representation the Acceptance contract accepts.
 * No new semantics: id/text/weight only (contract schema).
 */

export type Criterion = { id: string; text: string; weight: number };

export const MIN_CRITERIA = 2;
export const MAX_CRITERIA = 4;
export const POLICY_VERSION = 1;

export const DEFAULT_CRITERIA: Criterion[] = [
  {
    id: 'c1',
    text: 'The deliverable must state that the sky is blue.',
    weight: 5,
  },
  { id: 'c2', text: 'The deliverable must include the number 42.', weight: 5 },
];

export type Policy = {
  version: number;
  criteria: Criterion[];
};

export function nextId(list: Criterion[]): string {
  return `c${list.length + 1}`;
}

export function validateCriteria(list: Criterion[]): string[] {
  const problems: string[] = [];
  if (list.length < MIN_CRITERIA)
    problems.push(`Need at least ${MIN_CRITERIA} criteria.`);
  if (list.length > MAX_CRITERIA)
    problems.push(`At most ${MAX_CRITERIA} criteria are supported.`);
  const ids = new Set<string>();
  let totalTextBytes = 0;
  for (const c of list) {
    if (!c.id || !/^[A-Za-z0-9_-]{1,32}$/.test(c.id))
      problems.push(`Criterion id "${c.id || '?'}" must use 1–32 ASCII letters, digits, underscores, or hyphens.`);
    if (ids.has(c.id)) problems.push(`Duplicate id "${c.id}".`);
    ids.add(c.id);
    if (!c.text.trim()) problems.push(`Criterion ${c.id || '?'} needs text.`);
    const textBytes = new TextEncoder().encode(c.text).byteLength;
    if (textBytes > 500)
      problems.push(`Criterion ${c.id} text exceeds 500 UTF-8 bytes.`);
    totalTextBytes += textBytes;
    if (!Number.isInteger(c.weight) || c.weight < 1 || c.weight > 10)
      problems.push(`Criterion ${c.id} weight must be 1–10.`);
  }
  if (totalTextBytes > 1200) problems.push('Combined criterion text exceeds 1200 UTF-8 bytes.');
  return problems;
}

export function buildPolicy(list: Criterion[]): Policy {
  const problems = validateCriteria(list);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const policy = {
    version: POLICY_VERSION,
    criteria: list.map((c) => ({
      id: c.id,
      text: c.text,
      weight: c.weight,
    })),
  };
  if (new TextEncoder().encode(JSON.stringify(policy)).byteLength > 6000)
    throw new Error('Policy JSON exceeds 6000 UTF-8 bytes.');
  return policy;
}
