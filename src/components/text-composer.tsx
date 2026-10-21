"use client";

import { useState, useTransition } from "react";
import { Button, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

type Props = {
  sendAction: (fd: FormData) => Promise<void>;
  suggestAction: () => Promise<{ suggestions: string[]; error?: string }>;
  disabled: boolean;
  placeholder: string;
  aiOn: boolean;
};

/** Text box with "Suggest replies": three AI drafts the user can tap to fill in, then edit and send. */
export function TextComposer({ sendAction, suggestAction, disabled, placeholder, aiOn }: Props) {
  const [body, setBody] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setBody(s)}
              className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-left text-sm text-indigo-900 hover:bg-indigo-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {note && <p className="text-xs text-slate-500">{note}</p>}
      <form action={sendAction} className="flex gap-2">
        <textarea
          id="text-body"
          name="body"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          required
          disabled={disabled}
          className={inputClass}
        />
        <div className="flex flex-col gap-1.5">
          <SubmitButton disabled={disabled} pendingLabel="Sending…">Send</SubmitButton>
          {aiOn && (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || pending}
              onClick={() =>
                start(async () => {
                  setNote(null);
                  const r = await suggestAction();
                  if (r.error) setNote(r.error);
                  setSuggestions(r.suggestions);
                })
              }
            >
              {pending ? "Thinking…" : "Suggest"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
