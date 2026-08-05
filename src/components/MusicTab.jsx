const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { getAudioStream, searchTracks } from "@/lib/music";

let ytApi = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApi) {
    ytApi = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return ytApi;
}

function expectedPosition(state) {
  if (!state.is_playing) return state.position_seconds;
  const drift = (Date.now() - new Date(state.updated_date).getTime()) / 1000;
  return state.position_seconds + Math.max(0, drift);
}

export default function MusicTab({ room, music }) {
  const audioRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytRef = useRef(null);
  const engine = useRef("html5");
  const loadedFor = useRef(null);
  const musicRef = useRef(music);
  const musicIdRef = useRef(music?.id ?? null);
  const [readyId, setReadyId] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [buffering, setBuffering] = useState(false);
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

  const push = useCallback(
    async (patch) => {
      const current = musicRef.current;
      if (musicIdRef.current) {
        await db.entities.MusicState.update(musicIdRef.current, patch);
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
          ...patch,
        };
        const created = await db.entities.MusicState.create(fullData);
        musicIdRef.current = created.id;
      }
    },
    [room.id]
  );

  function currentTime() {
    if (engine.current === "yt") return ytRef.current?.getCurrentTime?.() ?? 0;
    return audioRef.current?.currentTime ?? 0;
  }

  function engineSeek(seconds) {
    if (engine.current === "yt") ytRef.current?.seekTo?.(seconds, true);
    else if (audioRef.current) audioRef.current.currentTime = seconds;
  }

  function enginePlay() {
    if (engine.current === "yt") ytRef.current?.playVideo?.();
    else void audioRef.current?.play().catch(() => undefined);
  }

  function enginePause() {
    if (engine.current === "yt") ytRef.current?.pauseVideo?.();
    else audioRef.current?.pause();
  }

  async function playViaYouTube(id, startAt, autoplay) {
    engine.current = "yt";
    audioRef.current?.pause();
    const YT = await loadYouTubeApi();
    if (!ytRef.current && ytHostRef.current) {
      ytRef.current = new YT.Player(ytHostRef.current, {
        height: "1",
        width: "1",
        playerVars: { playsinline: 1, controls: 0 },
      });
      await new Promise((done) => {
        const check = setInterval(() => {
          if (ytRef.current?.loadVideoById) {
            clearInterval(check);
            done();
          }
        }, 120);
      });
    }
    ytRef.current?.setVolume?.(muted ? 0 : Math.round(volume * 100));
    if (autoplay) ytRef.current?.loadVideoById?.(id, startAt);
    else ytRef.current?.cueVideoById?.(id, startAt);
  }

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
    if (currentTime() > 4 || idx === 0) {
      await push({ position_seconds: 0, is_playing: true });
      return;
    }
    await playAt(idx - 1, list);
  }, [playAt, push]);

  const togglePlay = useCallback(async () => {
    await push({
      is_playing: !(musicRef.current?.is_playing ?? false),
      position_seconds: currentTime(),
    });
  }, [push]);

  // load the shared track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (loadedFor.current === videoId) return;

    setReadyId(null);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    ytRef.current?.stopVideo?.();
    ytRef.current?.pauseVideo?.();
    setPosition(0);

    if (!videoId) {
      loadedFor.current = null;
      setBuffering(false);
      return;
    }

    loadedFor.current = videoId;
    const requestedFor = videoId;
    const startAt = music ? expectedPosition(music) : 0;
    setBuffering(true);
    getAudioStream(requestedFor)
      .then((stream) => {
        if (loadedFor.current !== requestedFor) return;
        engine.current = "html5";
        ytRef.current?.stopVideo?.();
        audio.src = stream.url;
        audio.currentTime = startAt;
        setReadyId(requestedFor);
        if (playing) void audio.play().catch(() => undefined);
      })
      .catch(async () => {
        if (loadedFor.current !== requestedFor) return;
        await playViaYouTube(requestedFor, startAt, playing);
        if (loadedFor.current === requestedFor) setReadyId(requestedFor);
      })
      .finally(() => {
        if (loadedFor.current === requestedFor) setBuffering(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // follow shared play/pause + timestamp
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !videoId || readyId !== videoId || !music) return;
    const target = expectedPosition(music);
    if (Math.abs(currentTime() - target) > 1) engineSeek(target);
    if (music.is_playing) enginePlay();
    else enginePause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music?.is_playing, music?.position_seconds, music?.updated_date, videoId, readyId]);

  // re-sync after the phone wakes from lock / tab returns
  useEffect(() => {
    async function resync() {
      if (document.visibilityState !== "visible") return;
      const results = await db.entities.MusicState.filter({ room_id: room.id });
      const fresh = results[0] ?? null;
      if (!fresh || !fresh.video_id || readyId !== fresh.video_id) return;
      const target = expectedPosition(fresh);
      if (Math.abs(currentTime() - target) > 1) engineSeek(target);
      if (fresh.is_playing) enginePlay();
      else enginePause();
    }
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, readyId]);

  // volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
    ytRef.current?.setVolume?.(muted ? 0 : Math.round(volume * 100));
  }, [volume, muted]);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const list = await searchTracks(query);
      setResults(list);
      if (list.length === 0) toast.error("No tracks found.");
    } catch {
      toast.error("Couldn't search right now.");
    } finally {
      setSearching(false);
    }
  }

  async function addToQueue(track) {
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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Now Playing */}
        <div className="card-cute p-6">
          {videoId ? (
            <div className="flex gap-4">
              {music?.thumbnail && (
                <img
                  src={music.thumbnail}
                  alt={music.title}
                  className="size-20 rounded-xl object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{music?.title ?? "Unknown"}</p>
                <p className="text-sm text-muted-foreground truncate">{music?.artist}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatTime(position)}</span>
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
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => push({ shuffle: !shuffle })}
                  >
                    <Shuffle className={shuffle ? "size-4 text-primary" : "size-4"} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={skipPrev}>
                    <SkipBack className="size-4" />
                  </Button>
                  <Button size="icon" onClick={togglePlay} disabled={buffering}>
                    {buffering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : playing ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => skipNext(true)}>
                    <SkipForward className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={cycleRepeat}>
                    {repeatMode === "one" ? (
                      <Repeat1 className="size-4 text-primary" />
                    ) : (
                      <Repeat
                        className={
                          repeatMode === "all" ? "size-4 text-primary" : "size-4"
                        }
                      />
                    )}
                  </Button>
                  <div className="ml-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
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
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Music2 className="mb-3 size-12" />
              <p>Search for a song to start playing together</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="card-cute p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a song..."
            />
            <Button type="submit" disabled={searching}>
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </form>
          {results.length > 0 && (
            <div className="mt-4 space-y-1">
              {results.map((track) => (
                <button
                  key={track.videoId}
                  onClick={() => addToQueue(track)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary/50"
                >
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.artist}
                    </p>
                  </div>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        <audio
          ref={audioRef}
          onTimeUpdate={() => {
            if (!scrubbing) setPosition(audioRef.current?.currentTime ?? 0);
          }}
          onEnded={() => skipNext(true)}
        />
        <div ref={ytHostRef} className="hidden" />
      </div>

      {/* Queue */}
      <div className="card-cute h-fit p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <ListMusic className="size-4" /> Queue ({queue.length})
        </h3>
        {queue.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tracks queued yet.
          </p>
        ) : (
          <div className="mt-4 space-y-1">
            {queue.map((track, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg p-2 ${
                  i === queueIndex ? "bg-secondary" : ""
                }`}
              >
                <button
                  onClick={() => playAt(i)}
                  className="flex flex-1 items-center gap-3 text-left min-w-0"
                >
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.artist}
                    </p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFromQueue(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}