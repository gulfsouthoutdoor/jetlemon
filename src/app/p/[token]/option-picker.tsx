"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { money } from "@/lib/format";

type Item = { id: string; description: string; quantity: number; unit_price: number };
const amt = (it: Item) => Number(it.quantity) * Number(it.unit_price);
const fmt = (n: number) => money(n);

/** The live part of the proposal page: tick options, see the total move, accept or decline. */
export function OptionPicker({
  required,
  options,
  depositPercent,
  accept,
  decline,
  error,
}: {
  required: Item[];
  options: Item[];
  depositPercent: number;
  accept: (fd: FormData) => Promise<void>;
  decline: (fd: FormData) => Promise<void>;
  error?: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [declining, setDeclining] = useState(false);
  const total = required.reduce((s, it) => s + amt(it), 0) + options.filter((it) => picked.has(it.id)).reduce((s, it) => s + amt(it), 0);
  const deposit = Math.round(total * depositPercent) / 100;

  return (
    <div>
      <table className="w-full text-sm">
        <tbody>
          {required.map((it) => (
            <tr key={it.id} className="border-t border-slate-100">
              <td className="py-2.5 text-slate-700">
                {it.description}
                {Number(it.quantity) !== 1 && <span className="text-slate-400"> × {Number(it.quantity)}</span>}
              </td>
              <td className="py-2.5 text-right text-slate-900">{fmt(amt(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {options.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-800">Optional add-ons — tick what you&apos;d like</p>
          {options.map((it) => (
            <label key={it.id} className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={picked.has(it.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(it.id);
                    else next.delete(it.id);
                    setPicked(next);
                  }}
                />
                {it.description}
                {Number(it.quantity) !== 1 && <span className="text-slate-400"> × {Number(it.quantity)}</span>}
              </span>
              <span className="text-slate-900">{fmt(amt(it))}</span>
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t-2 border-slate-200 pt-3">
        <span className="font-semibold text-slate-900">Total</span>
        <span className="text-xl font-semibold text-slate-900">{fmt(total)}</span>
      </div>
      {depositPercent > 0 && (
        <p className="mt-1 text-right text-xs text-slate-500">
          {depositPercent}% deposit on acceptance: {fmt(deposit)}
        </p>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!declining ? (
        <form action={accept} className="mt-5 space-y-3">
          {[...picked].map((id) => (
            <input key={id} type="hidden" name="option" value={id} />
          ))}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Type your full name to accept</span>
            <input name="name" required minLength={2} autoComplete="name" className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base" placeholder="Your name" />
          </label>
          <SubmitButton className="w-full py-3 text-base" pendingLabel="Accepting…">
            Accept proposal · {fmt(total)}
          </SubmitButton>
          <p className="text-center text-xs text-slate-500">Typing your name and pressing Accept is your agreement to this proposal.</p>
          <button type="button" onClick={() => setDeclining(true)} className="block w-full text-center text-sm text-slate-500 hover:text-slate-900">
            No thanks
          </button>
        </form>
      ) : (
        <form action={decline} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Anything we should know? (optional)</span>
            <textarea name="reason" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Too expensive, found someone else, timing…" />
          </label>
          <SubmitButton variant="secondary" className="w-full" pendingLabel="…">
            Decline proposal
          </SubmitButton>
          <button type="button" onClick={() => setDeclining(false)} className="block w-full text-center text-sm text-slate-500 hover:text-slate-900">
            Back
          </button>
        </form>
      )}
    </div>
  );
}
