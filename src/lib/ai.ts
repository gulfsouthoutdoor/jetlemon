// Thin wrapper over the Claude API. Every AI feature in JetLemon goes through askJson() so
// the model, key handling, and "no key configured" behavior live in one place.

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export async function ask(system: string, user: string, maxTokens = 1500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI assist is not set up on this server.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const json = (await res.json()) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `AI error ${res.status}`);
  return (json.content ?? []).map((c) => c.text ?? "").join("");
}

/** Asks for JSON only and parses it, tolerating a stray code fence. */
export async function askJson<T>(system: string, user: string, maxTokens = 1500): Promise<T> {
  const text = await ask(system + "\n\nRespond with JSON only — no prose, no code fences.", user, maxTokens);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI did not return JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** The business facts every prompt should know. */
export function businessContext(org: {
  name: string;
  services?: string | null;
  service_area?: string | null;
  hours?: string | null;
  phone?: string | null;
  timezone: string;
}) {
  return [
    `Business: ${org.name}`,
    org.services ? `What they do: ${org.services}` : null,
    org.service_area ? `Service area: ${org.service_area}` : null,
    org.hours ? `Hours: ${org.hours}` : null,
    org.phone ? `Phone: ${org.phone}` : null,
    `Time zone: ${org.timezone}`,
  ]
    .filter(Boolean)
    .join("\n");
}
