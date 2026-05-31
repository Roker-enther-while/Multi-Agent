type Props = {
  assetType: string;
  modality: string;
  onAssetTypeChange: (value: string) => void;
  onModalityChange: (value: string) => void;
};

const assetTypes = ["all", "image", "video", "audio", "text"];
const modalities = ["hybrid", "visual", "ocr", "audio", "text", "temporal"];

export function FilterSidebar({ assetType, modality, onAssetTypeChange, onModalityChange }: Props) {
  return (
    <aside className="border border-ink/10 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">Filters</h2>
      <div className="mt-5 space-y-5 text-sm">
        <label className="block">
          <span className="mb-2 block text-ink/65">Asset type</span>
          <select
            value={assetType}
            onChange={(event) => onAssetTypeChange(event.target.value)}
            className="h-11 w-full border border-ink/15 bg-panel px-3 outline-none focus:border-signal"
          >
            {assetTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-ink/65">Modality focus</span>
          <select
            value={modality}
            onChange={(event) => onModalityChange(event.target.value)}
            className="h-11 w-full border border-ink/15 bg-panel px-3 outline-none focus:border-signal"
          >
            {modalities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="border-t border-ink/10 pt-4 text-xs leading-5 text-ink/60">
          Planner tu dong chon retrievers theo query. Filter nay chi gioi han asset_type va hien thi focus UI.
        </div>
      </div>
    </aside>
  );
}
