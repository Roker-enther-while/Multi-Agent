import type {
  AssetListResponse,
  AutoSearchRequest,
  AutoSearchResponse,
  HealthResponse,
  SearchRequest,
  SearchResponse
} from "../types/api";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export function search(payload: SearchRequest): Promise<SearchResponse> {
  return requestJson<SearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function autoSearch(payload: AutoSearchRequest): Promise<AutoSearchResponse> {
  return requestJson<AutoSearchResponse>("/auto/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listAssets(assetType?: string): Promise<AssetListResponse> {
  const query = assetType ? `?asset_type=${encodeURIComponent(assetType)}` : "";
  return requestJson<AssetListResponse>(`/assets${query}`);
}

export function mediaUrl(assetId: string): string {
  return `${apiBaseUrl}/assets/${encodeURIComponent(assetId)}/media`;
}
