import type { HealthResponse } from "../types/api";

type Props = {
  health: HealthResponse | null;
};

export function HealthStatus({ health }: Props) {
  const status = health?.status ?? "checking";
  const ok = status === "ok";
  const degraded = status === "degraded";

  return (
    <div className="min-w-[190px] border border-ink/15 bg-white px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold uppercase tracking-[0.16em] text-ink/55">Backend</span>
        <span className={ok ? "text-signal" : degraded ? "text-warn" : "text-danger"}>{status}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink/60">
        {Object.entries(health?.services ?? { api: "pending" }).map(([name, value]) => (
          <span key={name} className="truncate" title={`${name}: ${value}`}>
            {name}: {value}
          </span>
        ))}
      </div>
    </div>
  );
}
