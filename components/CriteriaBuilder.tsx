'use client';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  MAX_CRITERIA,
  MIN_CRITERIA,
  nextId,
  validateCriteria,
  type Criterion,
} from '../lib/policy';

export function CriteriaBuilder({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
}) {
  const problems = validateCriteria(criteria);

  function setOne(id: string, patch: Partial<Criterion>) {
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function add() {
    if (criteria.length >= MAX_CRITERIA) return;
    onChange([
      ...criteria,
      { id: nextId(criteria), text: '', weight: 5 },
    ]);
  }

  function remove(id: string) {
    if (criteria.length <= MIN_CRITERIA) return;
    onChange(criteria.filter((c) => c.id !== id));
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        What does successful work look like?
      </legend>
      <div className="mt-3 space-y-4">
        {criteria.map((c, i) => (
          <div
            key={c.id}
            className="rounded-[10px] border border-[#E8E6E1] bg-white p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`criterion-${c.id}-text`}
                className="text-sm font-semibold"
              >
                Criterion {i + 1}
              </label>
              <Button
                variant="ghost"
                onClick={() => remove(c.id)}
                disabled={criteria.length <= MIN_CRITERIA}
                aria-label={`Remove criterion ${i + 1}`}
                className="min-h-[44px] px-3 text-sm text-[#5B6068]"
              >
                Remove
              </Button>
            </div>
            <Textarea
              id={`criterion-${c.id}-text`}
              rows={2}
              className="mt-2"
              placeholder="e.g. The deliverable must state that the sky is blue."
              value={c.text}
              onChange={(e) => setOne(c.id, { text: e.target.value })}
              aria-describedby={`criterion-${c.id}-error`}
            />
            <div className="mt-2 flex items-center gap-2">
              <label
                htmlFor={`criterion-${c.id}-weight`}
                className="text-[13px] text-[#5B6068]"
              >
                Weight (1–10)
              </label>
              <Input
                id={`criterion-${c.id}-weight`}
                type="number"
                min={1}
                max={10}
                className="w-20"
                value={c.weight}
                onChange={(e) =>
                  setOne(c.id, { weight: Number(e.target.value) })
                }
              />
            </div>
            <p
              id={`criterion-${c.id}-error`}
              role="alert"
              className="mt-1 min-h-[18px] text-[13px] text-[#DC2626]"
            >
              {!c.text.trim()
                ? `Criterion ${i + 1} needs text before signing.`
                : ''}
            </p>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        onClick={add}
        disabled={criteria.length >= MAX_CRITERIA}
        className="mt-3"
      >
        + Add criterion ({criteria.length}/{MAX_CRITERIA})
      </Button>
      {problems.length > 0 ? (
        <div role="alert" className="mt-3 text-[13px] text-[#DC2626]">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
