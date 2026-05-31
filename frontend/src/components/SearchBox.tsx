type Props = {
  query: string;
  topK: number;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onTopKChange: (topK: number) => void;
  onSubmit: () => void;
};

export function SearchBox({ query, topK, loading, onQueryChange, onTopKChange, onSubmit }: Props) {
  return (
    <section className="border border-ink/10 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_120px_120px]">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
          }}
          className="min-h-12 border border-ink/15 bg-panel px-4 py-3 text-base outline-none focus:border-signal"
          aria-label="Search query"
          placeholder="Tim canh nguoi mac ao do dung gan xe may"
        />
        <label className="block">
          <span className="sr-only">Top K</span>
          <input
            type="number"
            min={1}
            max={100}
            value={topK}
            onChange={(event) => onTopKChange(Number(event.target.value))}
            className="h-12 w-full border border-ink/15 bg-panel px-3 outline-none focus:border-signal"
            aria-label="Top K"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !query.trim()}
          className="h-12 bg-ink px-5 font-semibold text-white transition hover:bg-signal disabled:cursor-not-allowed disabled:bg-ink/35"
        >
          {loading ? "Searching" : "Search"}
        </button>
      </div>
    </section>
  );
}
