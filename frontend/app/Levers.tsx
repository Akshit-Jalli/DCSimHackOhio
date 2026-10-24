"use client";
import {
  LEVER_KEYS,
  LEVER_LABELS,
  PROFILE_LABELS,
  formatLeverValue,
  type LeverKey,
  type Overrides,
  type SweepIndex,
} from "../lib/engine";

type Props = {
  index: SweepIndex;
  value: Overrides;
  onChange: (next: Overrides) => void;
};

export default function Levers({ index, value, onChange }: Props) {
  const set = <K extends LeverKey>(k: K, raw: string) => {
    const options = index.options[k] as Overrides[K][];
    // Coerce back to the option's real type so the lookup key matches.
    const v = options.find((o) => String(o) === raw) ?? options[0];
    onChange({ ...value, [k]: v });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Deal terms
      </h2>

      {LEVER_KEYS.map((k) => (
        <label key={k} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-300">{LEVER_LABELS[k]}</span>
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={String(value[k])}
            onChange={(e) => set(k, e.target.value)}
          >
            {(index.options[k] as Overrides[LeverKey][]).map((o) => (
              <option key={String(o)} value={String(o)}>
                {formatLeverValue(k, o)}
              </option>
            ))}
          </select>
        </label>
      ))}

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Best deal if the town puts…
      </h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(index.sweep.best_by_profile).map(([name, ranked]) => {
          const top = ranked[0];
          const tied = top.tied_at_top && top.tied_at_top > 1 ? ` (${top.tied_at_top} tied)` : "";
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(top.overrides)}
              title={`${top.levers_changed} of 6 levers changed from the proposed deal${tied}`}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:border-sky-500 hover:text-white"
            >
              {PROFILE_LABELS[name] ?? name}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-neutral-500">
        {index.sweep.profiles_note}
      </p>
    </section>
  );
}
