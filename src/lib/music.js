const INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.drgns.space",
];

async function tryInstances(path) {
  let lastError = null;
  for (const base of INSTANCES) {
    try {
      const res = await fetch(base + path, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        lastError = new Error(`${base} responded ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json && typeof json === "object" && json.error) {
        lastError = new Error(`${base}: ${json.error}`);
        continue;
      }
      return json;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Music service unavailable: ${String(lastError)}`);
}

export async function searchTracks(query) {
  if (!query.trim()) return [];
  const json = await tryInstances(
    `/search?q=${encodeURIComponent(query)}&filter=music_songs`
  );
  return (json.items ?? [])
    .map((item) => ({
      videoId: (item.url ?? "").split("v=")[1] ?? "",
      title: item.title ?? "Unknown track",
      artist: item.uploaderName ?? "Unknown artist",
      thumbnail: item.thumbnail ?? null,
      duration: item.duration ?? 0,
    }))
    .filter((t) => t.videoId.length === 11)
    .slice(0, 20);
}

export async function getSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  
  // Try YouTube suggestion API
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1].slice(0, 6);
      }
    }
  } catch (e) {}

  // Fallback Piped suggestions
  try {
    const json = await tryInstances(`/suggestions?query=${encodeURIComponent(q)}`);
    if (Array.isArray(json)) return json.slice(0, 6);
  } catch (e) {}

  return [];
}

export async function getQueueSuggestions(videoId, artist) {
  if (!videoId && !artist) return [];

  // Try related streams from currently playing videoId
  if (videoId) {
    try {
      const json = await tryInstances(`/streams/${encodeURIComponent(videoId)}`);
      if (Array.isArray(json?.relatedStreams)) {
        const related = json.relatedStreams
          .map((item) => {
            const vid = (item.url ?? "").includes("v=")
              ? (item.url ?? "").split("v=")[1]
              : (item.url ?? "").replace("/watch?v=", "");
            return {
              videoId: vid ?? "",
              title: item.title ?? "Suggested Track",
              artist: item.uploaderName ?? artist ?? "Recommended",
              thumbnail: item.thumbnail ?? null,
              duration: item.duration ?? 0,
            };
          })
          .filter((t) => t.videoId && t.videoId.length === 11)
          .slice(0, 6);

        if (related.length > 0) return related;
      }
    } catch (e) {}
  }

  // Fallback search by artist
  if (artist) {
    try {
      const list = await searchTracks(artist);
      return list.filter((t) => t.videoId !== videoId).slice(0, 6);
    } catch (e) {}
  }

  return [];
}

export async function getAudioStream(videoId) {
  const json = await tryInstances(`/streams/${encodeURIComponent(videoId)}`);
  const streams = (json.audioStreams ?? [])
    .filter((s) => (s.mimeType ?? "").includes("audio"))
    .sort((a, b) => b.bitrate - a.bitrate);
  const best = streams[0] ?? json.audioStreams?.[0];
  if (!best?.url) throw new Error("No audio stream found for this track");
  return {
    url: best.url,
    title: json.title ?? "Unknown track",
    artist: json.uploader ?? "Unknown artist",
    thumbnail: json.thumbnailUrl ?? null,
    duration: json.duration ?? 0,
  };
}
