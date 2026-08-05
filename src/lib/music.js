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