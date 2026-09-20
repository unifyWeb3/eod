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
  for (const c of list) {
    if (!c.id) problems.push('Every criterion needs an id.');
    if (ids.has(c.id)) problems.push(`Duplicate id "${c.id}".`);
    ids.add(c.id);
    if (!c.text.trim()) problems.push(`Criterion ${c.id || '?'} needs text.`);
    if (c.text.length > 500)
      problems.push(`Criterion ${c.id} text exceeds 500 characters.`);
    if (!Number.isInteger(c.weight) || c.weight < 1 || c.weight > 10)
      problems.push(`Criterion ${c.id} weight must be 1–10.`);
  }
  return problems;
}

export function buildPolicy(list: Criterion[]): Policy {
  const problems = validateCriteria(list);
  if (problems.length > 0) throw new Error(problems.join(' '));
  return {
    version: POLICY_VERSION,
    criteria: list.map((c) => ({
      id: c.id,
      text: c.text,
      weight: c.weight,
    })),
  };
}
