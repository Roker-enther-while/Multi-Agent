import type { SearchResult } from "../types/api";
import { ResultCard } from "./ResultCard";

type Props = {
  results: SearchResult[];
  selected: SearchResult | null;
  loading: boolean;
  error: string | null;
  onSelect: (result: SearchResult) => void;
};

export function ResultGrid({ results, selected, loading, error, onSelect }: Props) {
  return (
    <section className="border border-ink/10 bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Results</h2>
        <span className="text-xs text-ink/50">{loading ? "running" : `${results.length} hits`}</span>
      </div>
      {error ? <div className="mt-4 border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {!loading && !error && results.length === 0 ? (
        <div className="mt-4 border border-dashed border-ink/20 bg-white p-8 text-sm text-ink/55">
          No results yet. Run a search after uploading and ingesting media.
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => (
          <ResultCard
            key={result.segment_id}
            result={result}
            selected={selected?.segment_id === result.segment_id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
