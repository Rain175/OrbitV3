const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { formatTime } from "@/lib/room";
import { getQueueSuggestions, getSuggestions, searchTracks } from "@/lib/music";

function parseTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }
  if (typeof ts === "object") {
    if (typeof ts.toDate === "function") return ts.toDate().getTime();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
  }
  return Date.now();
}

function expectedPosition(state) {
  if (!state || typeof state.position_seconds !== "number") return 0;
  if (!state.is_playing) return state.position_seconds;
  const lastUpdated = parseTimestamp(state.updated_date);
  const drift = (Date.now() - lastUpdated) / 1000;
  return Math.max(0, state.position_seconds + Math.max(0, drift));
}

export default function MusicTab({ room, music }) {
  const musicRef = useRef(music);
  const musicIdRef = useRef(music?.id ?? null);
  const searchContainerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState([]);
  const [queueSuggestions, setQueueSuggestions] = useState([]);
  const [loadingQueueSuggestions, setLoadingQueueSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const videoId = music?.video_id ?? null;
  const playing = music?.is_playing ?? false;
  const duration = music?.duration ?? 0;
  const queue = music?.queue ?? [];
  const queueIndex = music?.queue_index ?? 0;
  const repeatMode = music?.repeat_mode ?? "off";
  const shuffle = music?.shuffle ?? false;

  musicRef.current = music;
  useEffect(() => {
    musicIdRef.current = music?.id ?? null;
  }, [music]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Sync position slider
  useEffect(() => {
    if (!scrubbing && music) {
      setPosition(expectedPosition(music));
    }
  }, [music, scrubbing]);

  // Continuously advance position while playing
  useEffect(() => {
    if (!playing || scrubbing) return;
    const interval = setInterval(() => {
      setPosition(expectedPosition(musicRef.current));
    }, 400);
    return () => clearInterval(interval);
  }, [playing, scrubbing]);

  const push = useCallback(
    async (patch) => {
      const current = musicRef.current;
      const curPos = expectedPosition(current);
      const patchWithPos = { ...patch };
      if (patchWithPos.position_seconds === undefined) {
        patchWithPos.position_seconds = curPos;
      }

      if (musicIdRef.current) {
        await db.entities.MusicState.update(musicIdRef.current, patchWithPos);
      } else {
        const fullData = {
          room_id: room.id,
          video_id: current?.video_id ?? null,
          title: current?.title ?? null,
          artist: current?.artist ?? null,
          thumbnail: current?.thumbnail ?? null,
          duration: current?.duration ?? null,
          is_playing: current?.is_playing ?? false,
          position_seconds: current?.position_seconds ?? 0,
          queue: current?.queue ?? [],
          queue_index: current?.queue_index ?? 0,
          repeat_mode: current?.repeat_mode ?? "off",
          shuffle: current?.shuffle ?? false,
          ...patchWithPos,
        };
        const created = await db.entities.MusicState.create(fullData);
        musicIdRef.current = created.id;
      }
    },
    [room.id]
  );

  function trackPatch(track) {
    return {
      video_id: track.videoId,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      duration: track.duration,
    };
  }

  const playAt = useCallback(
    async (index, list = queue) => {
      const track = list[index];
      if (!track) return;
      await push({
        ...trackPatch(track),
        queue: list,
        queue_index: index,
        is_playing: true,
        position_seconds: 0,
      });
    },
    [push, queue]
  );

  const playNow = useCallback(
    async (track) => {
      setShowSuggestions(false);
      setSuggestions([]);
      const current = musicRef.current;
      const currentQueue = current?.queue ?? [];
      const queueTrack = {
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
      };

      // Add to queue and play immediately
      const nextQueue = [...currentQueue, queueTrack];
      const newIndex = nextQueue.length - 1;

      await push({
        ...trackPatch(queueTrack),
        queue: nextQueue,
        queue_index: newIndex,
        is_playing: true,
        position_seconds: 0,
      });

      toast.success(`Playing ${track.title}`);

      // Remove from queue suggestions if present
      setQueueSuggestions((prev) => prev.filter((s) => s.videoId !== track.videoId));
    },
    [push]
  );

  const nextIndex = useCallback((manual) => {
    const list = musicRef.current?.queue ?? [];
    const idx = musicRef.current?.queue_index ?? 0;
    const mode = musicRef.current?.repeat_mode ?? "off";
    if (!list.length) return -1;
    if (!manual && mode === "one") return idx;
    if (musicRef.current?.shuffle && list.length > 1) {
      let pick = idx;
      while (pick === idx) pick = Math.floor(Math.random() * list.length);
      return pick;
    }
    if (idx + 1 < list.length) return idx + 1;
    return mode === "all" || manual ? 0 : -1;
  }, []);

  const skipNext = useCallback(
    async (manual = true) => {
      const list = musicRef.current?.queue ?? [];
      const idx = nextIndex(manual);
      if (idx < 0) {
        await push({ is_playing: false, position_seconds: 0 });
        return;
      }
      await playAt(idx, list);
    },
    [nextIndex, playAt, push]
  );

  const skipPrev = useCallback(async () => {
    const list = musicRef.current?.queue ?? [];
    const idx = musicRef.current?.queue_index ?? 0;
    if (position > 4 || idx === 0) {
      await push({ position_seconds: 0, is_playing: true });
      return;
    }
    await playAt(idx - 1, list);
  }, [playAt, position, push]);

  const togglePlay = useCallback(async () => {
    const curPos = expectedPosition(musicRef.current);
    await push({
      is_playing: !(musicRef.current?.is_playing ?? false),
      position_seconds: curPos,
    });
  }, [push]);

  // Autocomplete debounced search predictions
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const list = await getSuggestions(query);
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch (e) {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch queue suggestions based on currently playing track
  useEffect(() => {
    if (!videoId && !music?.artist) {
      setQueueSuggestions([]);
      return;
    }
    let active = true;
    setLoadingQueueSuggestions(true);
    getQueueSuggestions(videoId, music?.artist)
      .then((recs) => {
        if (!active) return;
        // Filter out items already in queue
        const existingIds = new Set((queue || []).map((t) => t.videoId));
        const fresh = recs.filter((r) => !existingIds.has(r.videoId));
        setQueueSuggestions(fresh);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingQueueSuggestions(false);
      });
    return () => {
      active = false;
    };
  }, [videoId, music?.artist, queue.length]);

  async function runSearch(qToRun) {
    const searchTerm = qToRun || query;
    if (!searchTerm.trim()) return;
    setSearching(true);
    setShowSuggestions(false);
    setSuggestions([]);
    try {
      const list = await searchTracks(searchTerm);
      setResults(list);
      if (list.length === 0) toast.error("No tracks found.");
    } catch {
      toast.error("Couldn't search right now.");
    } finally {
      setSearching(false);
    }
  }

  async function addToQueue(e, track) {
    e.stopPropagation();
    const current = musicRef.current;
    const currentQueue = current?.queue ?? [];
    const queueTrack = {
      videoId: track.videoId,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      duration: track.duration,
    };
    const nextQueue = [...currentQueue, queueTrack];

    if (!current?.video_id) {
      await push({
        ...trackPatch(queueTrack),
        queue: nextQueue,
        queue_index: nextQueue.length - 1,
        is_playing: true,
        position_seconds: 0,
      });
    } else {
      await push({ queue: nextQueue });
      toast.success("Added to queue");
    }

    setQueueSuggestions((prev) => prev.filter((s) => s.videoId !== track.videoId));
  }

  async function removeFromQueue(index) {
    const current = musicRef.current;
    const currentQueue = current?.queue ?? [];
    const nextQueue = currentQueue.filter((_, i) => i !== index);
    let nextIndex = current?.queue_index ?? 0;
    if (index < nextIndex) nextIndex = Math.max(0, nextIndex - 1);
    if (nextQueue.length === 0) {
      await push({
        queue: [],
        queue_index: 0,
        is_playing: false,
        video_id: null,
        title: null,
        artist: null,
        thumbnail: null,
        duration: null,
        position_seconds: 0,
      });
    } else {
      await push({ queue: nextQueue, queue_index: nextIndex });
    }
  }

  function cycleRepeat() {
    const order = ["off", "all", "one"];
    const current = musicRef.current?.repeat_mode ?? "off";
    const next = order[(order.indexOf(current) + 1) % order.length];
    push({ repeat_mode: next });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] w-full max-w-full min-w-0 overflow-hidden">
      <div className="space-y-6 min-w-0">
        {/* Now Playing */}
        <div className="card-cute p-4 sm:p-6 min-w-0 overflow-hidden">
          {videoId ? (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start min-w-0">
              {music?.thumbnail ? (
                <img
                  src={music.thumbnail}
                  alt={music.title}
                  className="size-24 sm:size-32 rounded-2xl object-cover shadow-md shrink-0"
                />
              ) : (
                <div className="flex size-24 sm:size-32 items-center justify-center rounded-2xl bg-secondary text-primary shrink-0">
                  <Music2 className="size-8 sm:size-10" />
                </div>
              )}
              <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                <p className="font-display text-base sm:text-lg font-bold truncate">{music?.title ?? "Unknown"}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{music?.artist}</p>

                <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                  <span className="text-[11px] sm:text-xs font-mono text-muted-foreground w-8 sm:w-10 text-right shrink-0">
                    {formatTime(position)}
                  </span>
                  <Slider
                    value={[Math.min(position, duration || position)]}
                    max={duration || 1}
                    onValueChange={(v) => {
                      setScrubbing(true);
                      setPosition(v[0]);
                    }}
                    onValueCommit={(v) => {
                      setScrubbing(false);
                      push({ position_seconds: v[0] });
                    }}
                    className="flex-1 min-w-0"
                  />
                  <span className="text-[11px] sm:text-xs font-mono text-muted-foreground w-8 sm:w-10 shrink-0">
                    {formatTime(duration)}
                  </span>
                </div>

                <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center justify-center gap-0.5 sm:gap-1 mx-auto sm:mx-0 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 rounded-xl"
                      onClick={() => push({ shuffle: !shuffle })}
                      title="Shuffle"
                    >
                      <Shuffle className={shuffle ? "size-4 text-primary font-bold" : "size-4"} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl" onClick={skipPrev} title="Previous">
                      <SkipBack className="size-4" />
                    </Button>
                    <Button size="icon" className="size-12 rounded-2xl shadow-md active:scale-95 transition-transform" onClick={togglePlay}>
                      {playing ? (
                        <Pause className="size-6" />
                      ) : (
                        <Play className="size-6 ml-0.5" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl" onClick={() => skipNext(true)} title="Next">
                      <SkipForward className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl" onClick={cycleRepeat} title={`Repeat: ${repeatMode}`}>
                      {repeatMode === "one" ? (
                        <Repeat1 className="size-4 text-primary font-bold" />
                      ) : (
                        <Repeat
                          className={
                            repeatMode === "all" ? "size-4 text-primary font-bold" : "size-4"
                          }
                        />
                      )}
                    </Button>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => setMuted(!muted)}
                    >
                      {muted ? (
                        <VolumeX className="size-4" />
                      ) : (
                        <Volume2 className="size-4" />
                      )}
                    </Button>
                    <Slider
                      value={[muted ? 0 : volume * 100]}
                      max={100}
                      onValueChange={(v) => {
                        setMuted(false);
                        setVolume(v[0] / 100);
                      }}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-3xl bg-secondary/80 text-primary mb-3">
                <Music2 className="size-7" />
              </div>
              <p className="font-semibold text-foreground">No track currently playing</p>
              <p className="text-xs mt-1 max-w-sm">
                Search for any song below and tap it to start playing together immediately!
              </p>
            </div>
          )}
        </div>

        {/* Search & Autocomplete */}
        <div ref={searchContainerRef} className="card-cute p-5 sm:p-6 relative">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm sm:text-base">
            <Search className="size-4 text-primary" /> Search Songs
          </h3>
          <div className="relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  placeholder="Search artist, song, or video title..."
                  className="rounded-xl pr-8 h-11 text-sm"
                />
              </div>
              <Button type="submit" disabled={searching} className="rounded-xl px-5 h-11 min-w-[50px]">
                {searching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </form>

            {/* Autocomplete Predictions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-14 top-13 z-40 overflow-hidden rounded-xl border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-top-1">
                {suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(item);
                      setShowSuggestions(false);
                      setSuggestions([]);
                      runSearch(item);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm hover:bg-secondary/70 transition-colors border-b border-border/40 last:border-0"
                  >
                    <Search className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="mt-4 space-y-1.5 max-h-80 overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                Search Results ({results.length}) — Tap song to play immediately
              </p>
              {results.map((track) => (
                <div
                  key={track.videoId}
                  onClick={() => playNow(track)}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all cursor-pointer group"
                >
                  {track.thumbnail ? (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="size-11 rounded-lg object-cover shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="size-11 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Music2 className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <Play className="size-3 fill-primary text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span>{track.title}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.artist}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-lg gap-1 px-2.5 h-8 text-xs shrink-0"
                    onClick={(e) => addToQueue(e, track)}
                    title="Add to queue without interrupting current track"
                  >
                    <Plus className="size-3.5" /> Queue
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Queue Suggestions */}
        {(queueSuggestions.length > 0 || loadingQueueSuggestions) && (
          <div className="card-cute p-4 sm:p-6 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3 min-w-0">
              <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Sparkles className="size-4 text-amber-500 fill-amber-500/20 shrink-0" /> Recommended For You
              </h3>
              <span className="text-[11px] sm:text-xs text-muted-foreground truncate ml-2">Based on current track</span>
            </div>

            {loadingQueueSuggestions ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <Loader2 className="size-4 animate-spin text-primary" /> Finding recommendations...
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 min-w-0 w-full">
                {queueSuggestions.map((track) => (
                  <div
                    key={track.videoId}
                    onClick={() => playNow(track)}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-border/50 p-2 sm:p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group min-w-0 w-full overflow-hidden"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                      {track.thumbnail && (
                        <img
                          src={track.thumbnail}
                          alt=""
                          className="size-9 sm:size-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="truncate text-xs font-semibold group-hover:text-primary transition-colors">
                          {track.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-lg shrink-0 hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue(e, track);
                      }}
                      title="Add to queue"
                    >
                      <Plus className="size-4 text-primary" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="card-cute h-fit p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-sm sm:text-base">
            <ListMusic className="size-4 text-primary" /> Shared Queue ({queue.length})
          </h3>
        </div>
        {queue.length === 0 ? (
          <p className="py-10 text-center text-xs sm:text-sm text-muted-foreground">
            No tracks in queue yet. Search for a song above to get started!
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {queue.map((track, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${
                  i === queueIndex
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-secondary/60"
                }`}
              >
                <button
                  onClick={() => playAt(i)}
                  className="flex flex-1 items-center gap-3 text-left min-w-0 group"
                >
                  {track.thumbnail ? (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="size-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Music2 className="size-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-xs font-semibold ${i === queueIndex ? "text-primary font-bold" : "group-hover:text-foreground"}`}>
                      {i === queueIndex && "▶ "} {track.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {track.artist}
                    </p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg shrink-0"
                  onClick={() => removeFromQueue(i)}
                  title="Remove from queue"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
