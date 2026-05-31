import type { SearchResult } from "../types/api";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  result: SearchResult | null;
};

export function EvidencePanel({ result }: Props) {
  if (!result) {
    return (
      <section className="border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Evidence</h2>
        <p className="mt-4 text-sm leading-6 text-ink/60">Select a result to inspect evidence, validation checks, and media playback.</p>
      </section>
    );
  }

  const evidence = result.matched_evidence;
  const checks = result.validation.checks;

  return (
    <section className="border border-ink/10 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Evidence</h2>
      <div className="mt-4 space-y-4">
        {result.source_type === "video" ? <VideoPlayer result={result} /> : null}
        <EvidenceBlock label="caption" value={evidence.caption} />
        <EvidenceBlock label="OCR" value={evidence.ocr} />
        <EvidenceBlock label="transcript" value={evidence.transcript} />
        <EvidenceBlock label="text" value={evidence.text} />
        <EvidenceBlock label="objects" value={formatArray(evidence.objects)} />
        <EvidenceBlock label="audio events" value={formatArray(evidence.audio_events)} />
        <div className="border-t border-ink/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Validation</span>
            <span className="font-semibold text-signal">{Math.round(result.validation.validation_score * 100)}%</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(checks).map(([key, value]) => (
              <span key={key} className={value ? "border border-signal/20 bg-signal/10 px-2 py-1 text-signal" : "border border-warn/20 bg-warn/10 px-2 py-1 text-warn"}>
                {key.replace("_condition_met", "")}: {value ? "ok" : "missing"}
              </span>
            ))}
          </div>
          {result.validation.missing.length ? (
            <p className="mt-3 text-xs text-warn">Missing: {result.validation.missing.join(", ")}</p>
          ) : null}
        </div>
        <div className="border-t border-ink/10 pt-4 text-sm leading-6 text-ink/75">{result.explanation}</div>
      </div>
    </section>
  );
}

function EvidenceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</div>
      <div className="min-h-10 border border-ink/10 bg-panel p-3 text-sm leading-6 text-ink/75">
        {value || <span className="text-ink/35">empty</span>}
      </div>
    </div>
  );
}

function formatArray(values: unknown[]): string {
  return values.length ? values.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ") : "";
}
