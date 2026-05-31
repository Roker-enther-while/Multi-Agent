import type { HealthResponse } from "../types/api";
import { HealthStatus } from "./HealthStatus";

type Props = {
  health: HealthResponse | null;
  mode: "Interactive" | "Auto";
};

export function TopBar({ health, mode }: Props) {
  return (
    <header className="border-b border-ink/10 bg-panel/95">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-signal">VietMIRA</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Multimedia Retrieval Console</h1>
        </div>
        <div className="flex flex-wrap items-stretch gap-3 text-sm">
          <div className="border border-ink/15 bg-white px-3 py-2">
            <span className="text-ink/50">Dataset</span>
            <span className="ml-2 font-semibold">local</span>
          </div>
          <div className="border border-ink/15 bg-white px-3 py-2">
            <span className="text-ink/50">Mode</span>
            <span className="ml-2 font-semibold">{mode}</span>
          </div>
          <HealthStatus health={health} />
        </div>
      </div>
    </header>
  );
}
