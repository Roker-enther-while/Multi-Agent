"use client";

import { useEffect, useState } from "react";

import { AssetPanel } from "../components/AssetPanel";
import { AutoModePanel } from "../components/AutoModePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { FilterSidebar } from "../components/FilterSidebar";
import { QueryPlanViewer } from "../components/QueryPlanViewer";
import { ResultGrid } from "../components/ResultGrid";
import { SearchBox } from "../components/SearchBox";
import { TopBar } from "../components/TopBar";
import { getHealth, listAssets, search } from "../lib/api";
import type { Asset, HealthResponse, QueryPlan, SearchResult } from "../types/api";

export default function SearchPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [query, setQuery] = useState("Tim canh nguoi mac ao do dung gan xe may");
  const [topK, setTopK] = useState(20);
  const [assetType, setAssetType] = useState("all");
  const [modality, setModality] = useState("hybrid");
  const [mode, setMode] = useState<"Interactive" | "Auto">("Interactive");
  const [plan, setPlan] = useState<QueryPlan | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() =>
        setHealth({
          status: "offline",
          services: { backend: "error" }
        })
      );
  }, []);

  useEffect(() => {
    listAssets(assetType === "all" ? undefined : assetType)
      .then((response) => {
        setAssets(response.items);
        setAssetError(null);
      })
      .catch((error: unknown) => {
        setAssets([]);
        setAssetError(error instanceof Error ? error.message : "Asset list failed");
      });
  }, [assetType]);

  async function runSearch() {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setSearchError(null);
    try {
      const response = await search({
        query: modality === "hybrid" ? query : `${query} ${modality}`,
        mode: "interactive",
        top_k: topK,
        filters: assetType === "all" ? undefined : { asset_type: [assetType] }
      });
      setPlan(response.parsed_query);
      setResults(response.results);
      setSelectedResult(response.results[0] ?? null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed");
      setResults([]);
      setSelectedResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-panel text-ink">
      <TopBar health={health} mode={mode} />
      <section className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:grid-cols-[250px_1fr_380px]">
        <div className="space-y-5">
          <FilterSidebar
            assetType={assetType}
            modality={modality}
            onAssetTypeChange={setAssetType}
            onModalityChange={setModality}
          />
          <AssetPanel assets={assets} error={assetError} />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="flex border border-ink/10 bg-white p-1 text-sm">
            {(["Interactive", "Auto"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`h-10 flex-1 font-semibold ${
                  mode === item ? "bg-ink text-white" : "text-ink/60 hover:bg-panel"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <SearchBox
            query={query}
            topK={topK}
            loading={loading}
            onQueryChange={setQuery}
            onTopKChange={setTopK}
            onSubmit={runSearch}
          />
          {mode === "Auto" ? <AutoModePanel query={query} topK={topK} /> : null}
          <ResultGrid
            results={results}
            selected={selectedResult}
            loading={loading}
            error={searchError}
            onSelect={setSelectedResult}
          />
        </div>

        <div className="space-y-5">
          <QueryPlanViewer plan={plan} />
          <EvidencePanel result={selectedResult} />
        </div>
      </section>
    </main>
  );
}
