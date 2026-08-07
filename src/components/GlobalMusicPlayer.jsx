const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/room";
import { getAudioStream } from "@/lib/music";

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

export default function GlobalMusicPlayer({ room, music, activeTab, setActiveTab }) {
  const audioRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytRef = useRef(null);
  const engine = useRef("html5");
  const loadedFor = useRef(null);
  const musicRef = useRef(music);
  const musicIdRef = useRef(music?.id ?? null);
  const [readyId, setReadyId] = useState(null);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const videoId = music?.video_id ?? null;
  const playing = music?.is_playing ?? false;
  const duration = music?.duration ?? 0;
  const queue = music?.queue ?? [];

  musicRef.current = music;
  useEffect(() => {
    musicIdRef.current = music?.id ?? null;
  }, [music]);

  function currentTime() {
    if (engine.current === "yt" && ytRef.current?.getCurrentTime) {
      const t = ytRef.current.getCurrentTime();
      return typeof t === "number" && !isNaN(t) ? t : 0;
    }
    return audioRef.current?.currentTime ?? 0;
  }

  const push = useCallback(
    async (patch) => {
      const current = musicRef.current;
      const curPos = currentTime();
      const livePos = curPos > 0 ? curPos : expectedPosition(current);

      const patchWithPos = { ...patch };
      if (patchWithPos.position_seconds === undefined) {
        patchWithPos.position_seconds = livePos;
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

  function engineSeek(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds)) return;
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
      const track = list[idx];
      if (!track) return;
      await push({
        video_id: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
        queue: list,
        queue_index: idx,
        is_playing: true,
        position_seconds: 0,
      });
    },
    [nextIndex, push]
  );

  const skipPrev = useCallback(async () => {
    const list = musicRef.current?.queue ?? [];
    const idx = musicRef.current?.queue_index ?? 0;
    const curPos = currentTime() > 0 ? currentTime() : expectedPosition(musicRef.current);

    // Scrubbed in more than 4s? Restart the current track instead of going back.
    if (curPos > 4 || idx === 0) {
      engineSeek(0);
      await push({ position_seconds: 0, is_playing: true });
      return;
    }

    const track = list[idx - 1];
    if (!track) return;
    await push({
      video_id: track.videoId,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      duration: track.duration,
      queue: list,
      queue_index: idx - 1,
      is_playing: true,
      position_seconds: 0,
    });
  }, [push]);

  async function playViaYouTube(id, startAt, autoplay) {
    engine.current = "yt";
    audioRef.current?.pause();
    const YT = await loadYouTubeApi();
    if (!ytRef.current && ytHostRef.current) {
      ytRef.current = new YT.Player(ytHostRef.current, {
        height: "1",
        width: "1",
        playerVars: { playsinline: 1, controls: 0, autoplay: autoplay ? 1 : 0 },
        events: {
          onStateChange: (event) => {
            if (event.data === 0) {
              skipNext(false);
            }
          },
        },
      });
      await new Promise((done) => {
        const check = setInterval(() => {
          if (ytRef.current?.loadVideoById) {
            clearInterval(check);
            done();
          }
        }, 100);
      });
    }
    ytRef.current?.setVolume?.(muted ? 0 : Math.round(volume * 100));
    if (autoplay) ytRef.current?.loadVideoById?.({ videoId: id, startSeconds: startAt });
    else ytRef.current?.cueVideoById?.({ videoId: id, startSeconds: startAt });
  }

  const togglePlay = useCallback(async () => {
    const curPos = currentTime();
    await push({
      is_playing: !(musicRef.current?.is_playing ?? false),
      position_seconds: curPos > 0 ? curPos : expectedPosition(musicRef.current),
    });
  }, [push]);

  // Continuously update position while playing
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const cur = currentTime();
      if (cur > 0) setPosition(cur);
      else setPosition(expectedPosition(musicRef.current));
    }, 400);
    return () => clearInterval(timer);
  }, [playing, videoId]);

  // Load the track
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
  }, [videoId]);

  // Sync play state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !videoId || readyId !== videoId || !music) return;
    const target = expectedPosition(music);
    if (Math.abs(currentTime() - target) > 1.5) engineSeek(target);
    if (music.is_playing) enginePlay();
    else enginePause();
  }, [music?.is_playing, music?.position_seconds, music?.updated_date, videoId, readyId]);

  // MediaSession API integration for OS/Background audio controls.
  // This is what tells the OS "a real media session is active", which is the
  // main thing that keeps iOS/Android from suspending audio once the
  // app/tab is minimized, and what powers the lock-screen / notification
  // controls while it's backgrounded.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !music?.title) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: music.title,
        artist: music.artist || "Orbit Music",
        artwork: music.thumbnail
          ? [
              { src: music.thumbnail, sizes: "96x96", type: "image/jpeg" },
              { src: music.thumbnail, sizes: "256x256", type: "image/jpeg" },
              { src: music.thumbnail, sizes: "512x512", type: "image/jpeg" },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("nexttrack", () => skipNext(true));
      navigator.mediaSession.setActionHandler("previoustrack", () => skipPrev());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          engineSeek(details.seekTime);
          push({ position_seconds: details.seekTime });
          try {
            if (duration > 0) {
              navigator.mediaSession.setPositionState({
                duration,
                position: Math.min(details.seekTime, duration),
                playbackRate: 1,
              });
            }
          } catch (e) {}
        }
      });
    } catch (e) {}
  }, [music?.title, music?.artist, music?.thumbnail, duration, togglePlay, skipNext, skipPrev, push]);

  // Keep playbackState + the lock-screen scrubber in sync. playbackState in
  // particular matters: browsers use it to decide whether to keep showing
  // (and keep alive) the background "Now Playing" session.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      if (duration > 0 && "setPositionState" in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(position, duration),
          playbackRate: 1,
        });
      }
    } catch (e) {}
  }, [playing, duration, position]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
    ytRef.current?.setVolume?.(muted ? 0 : Math.round(volume * 100));
  }, [volume, muted]);

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (!scrubbing && engine.current === "html5") {
            setPosition(audioRef.current?.currentTime ?? 0);
          }
        }}
        onEnded={() => skipNext(false)}
      />
      <div
        ref={ytHostRef}
        className="fixed -top-[9999px] -left-[9999px] w-1 h-1 opacity-0 pointer-events-none overflow-hidden z-[-100]"
      />

      {/* Floating Mini Player when not on the music tab and a track is loaded */}
      {videoId && activeTab !== "music" && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 z-40 flex w-[92%] sm:w-[94%] max-w-xl -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card/95 text-card-foreground p-2 shadow-xl backdrop-blur-xl transition-all dark:border-primary/40 dark:shadow-[0_8px_30px_rgba(147,51,234,0.25)] min-w-0 overflow-hidden">
          <button
            onClick={() => setActiveTab("music")}
            className="flex flex-1 items-center gap-2 sm:gap-2.5 text-left min-w-0 group overflow-hidden"
          >
            {music?.thumbnail ? (
              <img
                src={music.thumbnail}
                alt=""
                className="size-9 sm:size-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform shrink-0"
              />
            ) : (
              <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Music2 className="size-4 sm:size-5" />
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="truncate text-xs sm:text-sm font-bold group-hover:text-primary transition-colors">
                {music?.title ?? "Playing in Background"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {music?.artist ?? "Orbit Love"}
              </p>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-primary/90 font-mono">
                <span>{formatTime(position)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl text-foreground hover:bg-secondary shrink-0"
              onClick={togglePlay}
              disabled={buffering}
            >
              {buffering ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl text-foreground hover:bg-secondary shrink-0"
              onClick={() => skipNext(true)}
            >
              <SkipForward className="size-4" />
            </Button>
            <Button
              size="sm"
              className="ml-0.5 h-8 rounded-xl px-2 text-xs font-bold shrink-0"
              onClick={() => setActiveTab("music")}
            >
              Open <ListMusic className="ml-1 size-3.5 hidden xs:inline" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
