const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import {
  BookOpen,
  Check,
  Copy,
  Heart,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Music2,
  Settings,
  Sun,
  User,
  X,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { joinRoom } from "@/lib/room";
import PetTab from "@/components/PetTab";
import ScrapbookTab from "@/components/ScrapbookTab";
import MusicTab from "@/components/MusicTab";
import GlobalMusicPlayer from "@/components/GlobalMusicPlayer";
import { checkAndNotifyPetStatus } from "@/lib/notifications";

export default function RoomPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [memories, setMemories] = useState([]);
  const [music, setMusic] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("pet");
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("orbit_theme") || "system");
  const [myMemberName, setMyMemberName] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
    localStorage.setItem("orbit_theme", theme);
  }, [theme]);

  useEffect(() => {
    db.auth
      .me()
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Join room + load data
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const joined = await joinRoom(code, user);
      if (!active) return;
      if (!joined) {
        setNotFound(true);
        return;
      }
      setRoom(joined);

      const [mem, mus, people] = await Promise.all([
        db.entities.Memory.filter({ room_id: joined.id }),
        db.entities.MusicState.filter({ room_id: joined.id }),
        db.entities.RoomMember.filter({ room_id: joined.id }),
      ]);
      if (!active) return;

      const sortedMemories = [...mem].sort((a, b) =>
        b.memory_date.localeCompare(a.memory_date)
      );
      setMemories(sortedMemories);
      setMusic(mus[0] ?? null);
      setMembers(people);
    })();
    return () => {
      active = false;
    };
  }, [code, user?.id]);

  // Real-time subscriptions via Firebase Firestore onSnapshot!
  useEffect(() => {
    if (!room) return;

    const unsubRoom = db.entities.Room.subscribe((event) => {
      if (event.id === room.id && (event.type === "update" || event.type === "added" || event.type === "modified")) {
        setRoom(event.data);
      }
    });

    const unsubMembers = db.entities.RoomMember.subscribe((event) => {
      if (event.type === "removed" || event.type === "delete") {
        setMembers((prev) => prev.filter((m) => m.id !== event.id));
        return;
      }
      if (event.data?.room_id !== room.id) return;
      setMembers((prev) => {
        const next = event.data;
        return [...prev.filter((m) => m.id !== next.id), next];
      });
    });

    const unsubMemories = db.entities.Memory.subscribe((event) => {
      if (event.type === "removed" || event.type === "delete") {
        setMemories((prev) => prev.filter((m) => m.id !== event.id));
        return;
      }
      if (event.data?.room_id !== room.id) return;
      setMemories((prev) => {
        const next = event.data;
        const rest = prev.filter((m) => m.id !== next.id);
        return [...rest, next].sort((a, b) =>
          b.memory_date.localeCompare(a.memory_date)
        );
      });
    });

    const unsubMusic = db.entities.MusicState.subscribe((event) => {
      if (event.type === "removed" || event.type === "delete") {
        setMusic(null);
        return;
      }
      if (event.data?.room_id !== room.id) return;
      setMusic(event.data);
    });

    return () => {
      if (typeof unsubRoom === 'function') unsubRoom();
      if (typeof unsubMembers === 'function') unsubMembers();
      if (typeof unsubMemories === 'function') unsubMemories();
      if (typeof unsubMusic === 'function') unsubMusic();
    };
  }, [room?.id]);

  // Refetch on visibility change (phones drop connections while locked)
  useEffect(() => {
    if (!room) return;
    async function refresh() {
      if (document.visibilityState !== "visible" || !room) return;
      const rooms = await db.entities.Room.filter({ id: room.id });
      if (rooms[0]) setRoom(rooms[0]);
      const mus = await db.entities.MusicState.filter({ room_id: room.id });
      setMusic(mus[0] ?? null);
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [room?.id]);

  // Periodic & state-driven pet status check for system notifications
  useEffect(() => {
    if (!room) return;
    checkAndNotifyPetStatus(room, room.pet_name);
    const timer = setInterval(() => {
      checkAndNotifyPetStatus(room, room.pet_name);
    }, 60000);
    return () => clearInterval(timer);
  }, [room]);

  const partner = members.find((m) => m.user_id !== user?.id) ?? null;
  const myMember = members.find((m) => m.user_id === user?.id) ?? null;

  useEffect(() => {
    if (myMember) {
      setMyMemberName(myMember.display_name || myMember.full_name || "");
    }
  }, [myMember?.display_name, myMember?.full_name]);

  async function leaveRoom() {
    if (!room || !user) return;
    const myMemberships = await db.entities.RoomMember.filter({
      room_id: room.id,
      user_id: user.id,
    });
    for (const m of myMemberships) {
      await db.entities.RoomMember.delete(m.id);
    }
    toast.success("You left this orbit");
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">That orbit doesn't exist</h1>
        <p className="text-muted-foreground">
          Double-check the 6-digit code with your partner.
        </p>
        <Button onClick={() => navigate("/")}>Back to start</Button>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  const tamagotchiName = partner?.display_name || partner?.full_name || room.pet_name || "Your Partner";

  async function updateMyName() {
    if (!myMember?.id) return;
    const name = myMemberName.trim();
    if (!name) return;
    await db.entities.RoomMember.update(myMember.id, { display_name: name });
    toast.success("Updated your display name!");
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8 pb-32">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <RouterLink to="/" className="flex items-center gap-2.5">
          <span className="gradient-love flex size-10 sm:size-11 items-center justify-center rounded-2xl shadow-sm">
            <Heart className="size-5 text-primary-foreground" fill="currentColor" />
          </span>
          <span>
            <span className="block font-display text-lg sm:text-xl font-bold leading-tight">
              Orbit Love
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-none block">
              {partner
                ? `you & ${partner.display_name ?? "your partner"}`
                : "waiting for partner…"}
            </span>
          </span>
        </RouterLink>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl h-9 px-2.5 text-xs font-semibold gap-1"
            onClick={() => {
              navigator.clipboard?.writeText(code);
              toast.success("Room code copied");
            }}
          >
            <Copy className="size-3.5" /> <span className="hidden sm:inline">Room</span> {code}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl h-9 w-9"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl h-9 px-2.5 text-xs" onClick={() => navigate("/?join=1")}>
            Switch
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-9 px-2.5 text-xs" onClick={leaveRoom}>
            <LogOut className="size-3.5" /> <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Desktop / Tablet Tab Header */}
        <TabsList className="mb-6 hidden sm:flex h-auto rounded-2xl p-1.5 bg-secondary/80 border border-border/80 text-foreground shadow-lg max-w-lg mx-auto justify-between gap-2">
          <TabsTrigger
            value="scrapbook"
            className="flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
          >
            📖 Scrapbook
          </TabsTrigger>
          <TabsTrigger
            value="pet"
            className="flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            <User className="size-3.5 inline mr-1" /> {tamagotchiName}
          </TabsTrigger>
          <TabsTrigger
            value="music"
            className="flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
          >
            🎵 Music
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scrapbook">
          <ScrapbookTab room={room} memories={memories} />
        </TabsContent>
        <TabsContent value="pet">
          <PetTab
            room={room}
            partner={partner}
            onLocalUpdate={(patch) =>
              setRoom((r) => (r ? { ...r, ...patch } : r))
            }
          />
        </TabsContent>
        <TabsContent value="music">
          <MusicTab room={room} music={music} />
        </TabsContent>
      </Tabs>

      {/* Floating Mini Player for background music */}
      <GlobalMusicPlayer
        room={room}
        music={music}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Mobile Bottom Dock Menu - Softer, smaller floating glass design with user pictogram */}
      <nav className="fixed bottom-3 left-3 right-3 z-50 sm:hidden max-w-sm mx-auto rounded-3xl border border-border/80 bg-background/90 backdrop-blur-2xl p-1 shadow-[0_8px_25px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-1 h-12">
          {/* LEFT: Scrapbook */}
          <button
            onClick={() => setActiveTab("scrapbook")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
              activeTab === "scrapbook"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <BookOpen className="size-4 mb-0.5" />
            <span className="text-[10px] font-bold tracking-tight truncate max-w-[80px]">
              Scrapbook
            </span>
          </button>

          {/* CENTER: Partner Pet (User Pictogram) */}
          <button
            onClick={() => setActiveTab("pet")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
              activeTab === "pet"
                ? "bg-gradient-to-b from-rose-500 to-amber-500 text-white font-bold shadow-md scale-105"
                : "bg-secondary/80 text-foreground border border-border/60 hover:bg-secondary"
            }`}
          >
            <User className="size-4 mb-0.5" />
            <span className="text-[10px] font-bold tracking-tight truncate max-w-[85px]">
              {tamagotchiName}
            </span>
          </button>

          {/* RIGHT: Music Player */}
          <button
            onClick={() => setActiveTab("music")}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
              activeTab === "music"
                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <Music2 className="size-4 mb-0.5" />
            <span className="text-[10px] font-bold tracking-tight truncate max-w-[80px]">
              Music
            </span>
          </button>
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card text-card-foreground p-6 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="size-5 text-primary" /> Settings & Preferences
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                onClick={() => setShowSettings(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                App Theme & Dark Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border p-2.5 text-xs font-bold transition-all ${
                    theme === "light"
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <Sun className="size-4" /> Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border p-2.5 text-xs font-bold transition-all ${
                    theme === "dark"
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <Moon className="size-4" /> Dark
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border p-2.5 text-xs font-bold transition-all ${
                    theme === "system"
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <Monitor className="size-4" /> System
                </button>
              </div>
            </div>

            {/* User Display Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Name (Shown as Pet Name to Partner)
              </label>
              <div className="flex gap-2">
                <Input
                  value={myMemberName}
                  onChange={(e) => setMyMemberName(e.target.value)}
                  placeholder="Your display name"
                  className="rounded-2xl"
                />
                <Button onClick={updateMyName} className="rounded-2xl shrink-0">
                  <Check className="size-4 mr-1" /> Save
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your partner sees this name for your pet avatar in their Orbit.
              </p>
            </div>

            {/* Room details */}
            <div className="rounded-2xl bg-secondary/50 p-4 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Room Code:</span>
                <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded-lg border">
                  {code}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Partner Status:</span>
                <span className="text-foreground font-semibold">
                  {partner ? `Connected with ${partner.display_name || partner.full_name}` : "Waiting for partner..."}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl text-xs"
                onClick={() => {
                  setShowSettings(false);
                  leaveRoom();
                }}
              >
                <LogOut className="size-3.5 mr-1" /> Leave Room
              </Button>
              <Button
                size="sm"
                className="rounded-2xl text-xs"
                onClick={() => setShowSettings(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
