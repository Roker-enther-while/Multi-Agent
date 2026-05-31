import type { Asset } from "../types/api";

type Props = {
  assets: Asset[];
  error: string | null;
};

export function AssetPanel({ assets, error }: Props) {
  return (
    <section className="border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Assets</h2>
        <span className="text-xs text-ink/50">{assets.length}</span>
      </div>
      {error ? <p className="mt-3 text-xs text-warn">{error}</p> : null}
      <div className="mt-3 max-h-[220px] space-y-2 overflow-auto text-xs">
        {assets.length === 0 ? <p className="text-ink/45">No assets loaded.</p> : null}
        {assets.map((asset) => (
          <div key={asset.asset_id} className="border border-ink/10 bg-panel p-2">
            <div className="truncate font-semibold text-ink">{asset.asset_id}</div>
            <div className="mt-1 flex justify-between gap-3 text-ink/55">
              <span>{asset.asset_type}</span>
              <span>{asset.source ?? "local"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
