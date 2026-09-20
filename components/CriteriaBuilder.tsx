'use client';

import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  MAX_CRITERIA,
  MIN_CRITERIA,
  nextId,
  validateCriteria,
  type Criterion,
} from '../lib/policy';

function WeightStepper({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) =>
    onChange(Math.min(10, Math.max(1, Math.round(n) || 1)));
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Importance for ${id}, 1 to 10`}>
      <button
        type="button"
        onClick={() => clamp(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease importance"
        className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] border border-[#E8E6E1] bg-white text-lg leading-none transition-colors duration-150 hover:bg-[#F4F3F0] disabled:opacity-40"
      >
        −
      </button>
      <output
        aria-live="polite"
        aria-label="Current importance"
        className="tnum w-8 text-center text-sm font-semibold"
      >
        {value}
      </output>
      <button
        type="button"
        onClick={() => clamp(value + 1)}
        disabled={value >= 10}
        aria-label="Increase importance"
        className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] border border-[#E8E6E1] bg-white text-lg leading-none transition-colors duration-150 hover:bg-[#F4F3F0] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export function CriteriaBuilder({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
}) {
  const problems = validateCriteria(criteria);
  const canRemove = criteria.length > MIN_CRITERIA;

  function setOne(id: string, patch: Partial<Criterion>) {
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function add() {
    if (criteria.length >= MAX_CRITERIA) return;
    onChange([...criteria, { id: nextId(criteria), text: '', weight: 5 }]);
  }

  function remove(id: string) {
    if (!canRemove) return;
    onChange(criteria.filter((c) => c.id !== id));
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        What does successful work look like?
      </legend>
      <div className="mt-3 space-y-3">
        {criteria.map((c, i) => (
          <div
            key={c.id}
            className="rounded-[10px] border border-[#E8E6E1] bg-white px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor={`criterion-${c.id}-text`}
                className="mono text-xs font-semibold text-[#5B6068]"
              >
                {String(i + 1).padStart(2, '0')} · Criterion
              </label>
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label={`Remove criterion ${i + 1}`}
                  className="inline-flex min-h-[44px] items-center text-[13px] text-[#5B6068] hover:text-[#DC2626]"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <Textarea
              id={`criterion-${c.id}-text`}
              rows={2}
              className="mt-1"
              placeholder="e.g. The deliverable must state that the sky is blue."
              value={c.text}
              onChange={(e) => setOne(c.id, { text: e.target.value })}
              aria-describedby={`criterion-${c.id}-error`}
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span id={`criterion-${c.id}-weight-label`} className="text-[13px] text-[#5B6068]">
                Importance (1–10)
              </span>
              <WeightStepper
                id={c.id}
                value={c.weight}
                onChange={(n) => setOne(c.id, { weight: n })}
              />
            </div>
            <p
              id={`criterion-${c.id}-error`}
              role="alert"
              className="min-h-[18px] text-[13px] text-[#DC2626]"
            >
              {!c.text.trim()
                ? `Criterion ${i + 1} needs text before signing.`
                : ''}
            </p>
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={add} disabled={criteria.length >= MAX_CRITERIA} className="mt-3">
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
