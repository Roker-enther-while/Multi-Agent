import { useState } from "react";

import { autoSearch } from "../lib/api";
import type { AutoSearchResponse } from "../types/api";

type Props = {
  query: string;
  topK: number;
};

export function AutoModePanel({ query, topK }: Props) {
  const [queryId, setQueryId] = useState("q_001");
  const [speedMode, setSpeedMode] = useState<"fast" | "balanced" | "accurate">("balanced");
  const [response, setResponse] = useState<AutoSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAutoSearch() {
    setLoading(true);
    setError(null);
    try {
      const result = await autoSearch({
        query_id: queryId,
        query,
        top_k: topK,
        return_format: "challenge_json",
        speed_mode: speedMode
      });
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(err instanceof Error ? err.message : "Auto search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-ink/10 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Auto Mode</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <input
          value={queryId}
          onChange={(event) => setQueryId(event.target.value)}
          className="h-11 border border-ink/15 bg-panel px-3 outline-none focus:border-signal"
          aria-label="Query ID"
        />
        <select
          value={speedMode}
          onChange={(event) => setSpeedMode(event.target.value as "fast" | "balanced" | "accurate")}
          className="h-11 border border-ink/15 bg-panel px-3 outline-none focus:border-signal"
          aria-label="Speed mode"
        >
          <option value="fast">fast</option>
          <option value="balanced">balanced</option>
          <option value="accurate">accurate</option>
        </select>
        <button
          type="button"
          onClick={runAutoSearch}
          disabled={loading || !query.trim()}
          className="h-11 bg-ink px-4 font-semibold text-white hover:bg-signal disabled:bg-ink/35"
        >
          {loading ? "Running" : "Run"}
        </button>
      </div>
      {error ? <div className="mt-4 border border-warn/30 bg-warn/10 p-3 text-sm text-warn">{error}</div> : null}
      <pre className="mt-4 max-h-[280px] overflow-auto bg-ink p-4 text-xs leading-5 text-panel">
        {JSON.stringify(response ?? { status: "waiting_for_auto_endpoint" }, null, 2)}
      </pre>
    </section>
  );
}
