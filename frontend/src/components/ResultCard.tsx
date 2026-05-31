import { mediaUrl } from "../lib/api";
import type { ReactNode } from "react";
import type { SearchResult } from "../types/api";

type Props = {
  result: SearchResult;
  selected: boolean;
  onSelect: (result: SearchResult) => void;
};

export function ResultCard({ result, selected, onSelect }: Props) {
  const missing = result.validation.missing;
  const timestamp = formatTimestamp(result.timestamp_start, result.timestamp_end);

  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className={`block w-full border bg-white p-3 text-left transition hover:border-signal ${
        selected ? "border-signal shadow-[0_0_0_2px_rgba(0,132,95,0.14)]" : "border-ink/10"
      }`}
    >
      <div className="aspect-video overflow-hidden border border-ink/10 bg-panel">
        {result.preview_image ? (
          <div
            aria-label="preview media"
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${mediaUrl(result.asset_id)})` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-ink/35">
            {result.source_type}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{result.asset_id}</p>
          <p className="mt-1 truncate text-xs text-ink/55">{result.segment_id}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-signal">{formatScore(result.score)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Badge>{result.source_type}</Badge>
        {timestamp ? <Badge>{timestamp}</Badge> : null}
        <Badge>v {Math.round(result.validation.validation_score * 100)}%</Badge>
        {missing.map((item) => (
          <Badge key={item} tone="warn">
            missing {item.replace("_condition", "")}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" }) {
  return (
    <span className={tone === "warn" ? "border border-warn/30 bg-warn/10 px-2 py-1 text-warn" : "border border-ink/10 bg-panel px-2 py-1 text-ink/65"}>
      {children}
    </span>
  );
}

function formatScore(score: number): string {
  return score.toFixed(score < 1 ? 4 : 2);
}

function formatTimestamp(start: number | null, end: number | null): string {
  if (start === null && end === null) {
    return "";
  }
  const startText = start === null ? "?" : `${start.toFixed(1)}s`;
  const endText = end === null ? "?" : `${end.toFixed(1)}s`;
  return `${startText}-${endText}`;
}
