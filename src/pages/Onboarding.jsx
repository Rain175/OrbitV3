const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Heart, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateCode, joinRoom } from "@/lib/room";

export default function Onboarding() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [newCode, setNewCode] = useState(null);
  const [petName, setPetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    db.auth
      .me()
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-resume: redirect to user's most recent room
  useEffect(() => {
    if (loading) return;
    const wantsSwitch =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("join");
    if (!user || wantsSwitch) {
      setChecking(false);
      return;
    }

    // Fast path: check localStorage first (for PWA resume)
    const savedRoomCode = localStorage.getItem("orbit_last_room_code");
    if (savedRoomCode) {
      navigate(`/room/${savedRoomCode}`, { replace: true });
      return;
    }

    // Slower fallback: query database for latest room
    let active = true;
    (async () => {
      const members = await db.entities.RoomMember.filter({ user_id: user.id });
      if (!active) return;
      if (members.length > 0) {
        members.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date)
        );
        const latest = members[0];
        const room = await db.entities.Room.get(latest.room_id);
        if (room?.code && active) {
          localStorage.setItem("orbit_last_room_code", room.code);
          navigate(`/room/${room.code}`, { replace: true });
          return;
        }
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, loading]);

  async function createRoom() {
    setBusy(true);
    try {
      let code = generateCode();
      for (let i = 0; i < 5; i++) {
        const existing = await db.entities.Room.filter({ code });
        if (!existing.length) break;
        code = generateCode();
      }
      const room = await db.entities.Room.create({
        code,
        pet_name: petName.trim() || "Mochi",
        hunger: 50,
        happiness: 50,
        sleep: 50,
        love: 50,
      });
      await db.entities.MusicState.create({
        room_id: room.id,
        video_id: null,
        title: null,
        artist: null,
        thumbnail: null,
        duration: null,
        is_playing: false,
        position_seconds: 0,
        queue: [],
        queue_index: 0,
        repeat_mode: "off",
        shuffle: false,
      });
      if (user) {
        await db.entities.RoomMember.create({
          room_id: room.id,
          user_id: user.id,
          display_name: user.full_name || user.email || "Someone",
          avatar_url: null,
        });
      }
      setNewCode(code);
      toast.success("Your orbit is ready!");
    } catch {
      toast.error("Couldn't create a room. Try again?");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoomHandler(code) {
    const clean = code.trim();
    if (!/^\d{6}$/.test(clean)) {
      toast.error("Room codes are 6 digits.");
      return;
    }
    setBusy(true);
    try {
      const room = await joinRoom(clean, user);
      if (!room) {
        toast.error("No orbit found with that code.");
        return;
      }
      navigate(`/room/${clean}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Couldn't join: ${error.message}`
          : "Couldn't join that room."
      );
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="text-center">
      <div className="gradient-love mx-auto flex size-16 items-center justify-center rounded-3xl shadow-[var(--shadow-soft)]">
        <Heart className="size-8 text-primary-foreground" fill="currentColor" />
      </div>
      <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Orbit Love</h1>
      <p className="mt-3 text-base text-muted-foreground">
        A tiny shared world for two — a pet you raise together, a scrapbook of your favourite
        days, and music you hear at the exact same second.
      </p>
    </header>
  );

  if (loading || checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
        {header}
        <Loader2 className="size-7 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-5 py-14">
      {header}
      <p className="-mt-4 text-sm text-muted-foreground">
        Signed in as {user?.full_name || user?.email}
      </p>

      <section className="card-cute w-full p-6">
        <h2 className="text-xl font-semibold">Start a new orbit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a code and send it to your partner.
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="pet">Tamagotchi Name (Your Partner)</Label>
          <p className="text-xs text-muted-foreground">
            Your Tamagotchi is named after your partner in this orbit! When your partner joins, their name will be used automatically.
          </p>
          <Input
            id="pet"
            placeholder="e.g. Partner's name or nickname"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            maxLength={24}
          />
        </div>

        {newCode ? (
          <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-secondary/40 p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Your code
            </p>
            <p className="font-display text-4xl font-bold tracking-[0.3em] text-primary">
              {newCode}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(newCode);
                  toast.success("Code copied");
                }}
              >
                <Copy /> Copy code
              </Button>
              <Button onClick={() => navigate(`/room/${newCode}`)}>Enter orbit</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-5 w-full" size="lg" disabled={busy} onClick={createRoom}>
            <Sparkles /> Generate 6-digit code
          </Button>
        )}
      </section>

      <section className="card-cute w-full p-6">
        <h2 className="text-xl font-semibold">Join your partner</h2>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            joinRoomHandler(joinCode);
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="123456"
            className="text-center text-2xl tracking-[0.4em]"
            value={joinCode}
            maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
          />
          <Button type="submit" size="lg" variant="secondary" disabled={busy}>
            Join
          </Button>
        </form>
      </section>
    </main>
  );
}
