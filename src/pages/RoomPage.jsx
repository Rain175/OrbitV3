const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Heart, Loader2, LogOut } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { joinRoom } from "@/lib/room";
import PetTab from "@/components/PetTab";
import ScrapbookTab from "@/components/ScrapbookTab";
import MusicTab from "@/components/MusicTab";

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

  // Real-time subscriptions
  useEffect(() => {
    if (!room) return;

    const unsubRoom = db.entities.Room.subscribe((event) => {
      if (event.id === room.id && event.type === "update") {
        setRoom(event.data);
      }
    });

    const unsubMembers = db.entities.RoomMember.subscribe((event) => {
      if (event.type === "delete") {
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
      if (event.type === "delete") {
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
      if (event.type === "delete") {
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

  const partner = members.find((m) => m.user_id !== user?.id) ?? null;
  const tamagotchiName = partner?.display_name || partner?.full_name || room.pet_name || "Your Partner";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="gradient-love flex size-11 items-center justify-center rounded-2xl">
            <Heart className="size-5 text-primary-foreground" fill="currentColor" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold leading-tight">
              Orbit Love
            </span>
            <span className="text-xs text-muted-foreground">
              {partner
                ? `you & ${partner.display_name ?? "your partner"}`
                : "waiting for your partner to join…"}
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {members.map((m) =>
              m.avatar_url ? (
                <img
                  key={m.id}
                  src={m.avatar_url}
                  alt={m.display_name ?? "Member"}
                  title={m.display_name ?? ""}
                  className="size-9 rounded-full border-2 border-background object-cover"
                />
              ) : (
                <span
                  key={m.id}
                  title={m.display_name ?? ""}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-secondary text-sm font-semibold"
                >
                  {(m.display_name ?? "?").charAt(0)}
                </span>
              )
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(code);
              toast.success("Room code copied");
            }}
          >
            <Copy /> Room {code}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/?join=1")}>
            Switch orbit
          </Button>
          <Button variant="outline" onClick={leaveRoom}>
            <LogOut /> Leave
          </Button>
        </div>
      </header>

      <Tabs defaultValue="pet">
        <TabsList className="mb-6 h-auto rounded-2xl p-1.5">
          <TabsTrigger value="pet" className="rounded-xl px-5 py-2">
            🐾 {tamagotchiName}
          </TabsTrigger>
          <TabsTrigger value="scrapbook" className="rounded-xl px-5 py-2">
            Scrapbook
          </TabsTrigger>
          <TabsTrigger value="music" className="rounded-xl px-5 py-2">
            Music
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pet">
          <PetTab
            room={room}
            partner={partner}
            onLocalUpdate={(patch) =>
              setRoom((r) => (r ? { ...r, ...patch } : r))
            }
          />
        </TabsContent>
        <TabsContent value="scrapbook">
          <ScrapbookTab room={room} memories={memories} />
        </TabsContent>
        <TabsContent value="music">
          <MusicTab room={room} music={music} />
        </TabsContent>
      </Tabs>
    </main>
  );
}