import { useEffect, useRef } from "react";

import { mediaUrl } from "../lib/api";
import type { SearchResult } from "../types/api";

type Props = {
  result: SearchResult;
};

export function VideoPlayer({ result }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && result.timestamp_start !== null) {
      videoRef.current.currentTime = result.timestamp_start;
    }
  }, [result.asset_id, result.segment_id, result.timestamp_start]);

  return (
    <div>
      <video ref={videoRef} className="aspect-video w-full border border-ink/10 bg-ink" src={mediaUrl(result.asset_id)} controls preload="metadata" />
      <p className="mt-2 text-xs text-ink/55">
        Timestamp: {result.timestamp_start ?? 0}s to {result.timestamp_end ?? result.timestamp_start ?? 0}s
      </p>
    </div>
  );
}
