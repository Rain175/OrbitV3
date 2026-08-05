const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useRef, useState } from "react";
import { Drumstick, Gamepad2, Moon, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { clamp } from "@/lib/room";
import PetCreature from "@/components/PetCreature";

const MOODS = [
  { min: 75, mood: "happy", label: "over the moon" },
  { min: 50, mood: "content", label: "content" },
  { min: 25, mood: "meh", label: "needs attention" },
  { min: 0, mood: "sad", label: "not doing great" },
];

function Meter({ label, value, tint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} className={`mt-1.5 h-3 ${tint}`} />
    </div>
  );
}

export default function PetTab({ room, partner, onLocalUpdate }) {
  const tamagotchiName = partner?.display_name || partner?.full_name || room.pet_name || "Your Partner";
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(tamagotchiName);
  const [burst, setBurst] = useState([]);
  const petRef = useRef(null);

  useEffect(() => {
    setDraftName(partner?.display_name || partner?.full_name || room.pet_name || "Your Partner");
  }, [partner?.display_name, partner?.full_name, room.pet_name]);

  const avg = Math.round((room.hunger + room.happiness + room.sleep) / 3);
  const mood = MOODS.find((m) => avg >= m.min);

  async function act(patch, emoji) {
    const id = Date.now();
    setBurst((b) => [...b, { id, emoji }]);
    setTimeout(() => setBurst((b) => b.filter((x) => x.id !== id)), 1400);
    petRef.current?.classList.remove("animate-pop");
    void petRef.current?.offsetWidth;
    petRef.current?.classList.add("animate-pop");
    onLocalUpdate(patch);
    await db.entities.Room.update(room.id, patch);
  }

  async function saveName() {
    setRenaming(false);
    const name = draftName.trim();
    if (!name || name === tamagotchiName) return;
    if (partner?.id) {
      await db.entities.RoomMember.update(partner.id, { display_name: name });
    } else {
      onLocalUpdate({ pet_name: name });
      await db.entities.Room.update(room.id, { pet_name: name });
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <div className="card-cute relative flex flex-col items-center justify-center overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_20%,hsl(var(--secondary)),transparent_65%)]" />
        <div className="relative">
          {burst.map((b, i) => (
            <span
              key={b.id}
              className="animate-float-up absolute left-1/2 top-0 text-3xl"
              style={{ marginLeft: `${(i % 3) * 26 - 26}px` }}
            >
              {b.emoji}
            </span>
          ))}
          <div ref={petRef} className="animate-bob select-none text-center">
            <div className="mx-auto flex items-center justify-center">
              <PetCreature
                mood={room.sleep > 88 ? "sleepy" : mood.mood}
                name={tamagotchiName}
              />
            </div>
          </div>
        </div>

        <div className="relative mt-6 text-center">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draftName}
                maxLength={24}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <Button size="sm" onClick={saveName}>
                Save
              </Button>
            </div>
          ) : (
            <button
              className="inline-flex items-center gap-2 text-2xl font-bold"
              onClick={() => setRenaming(true)}
            >
              {tamagotchiName}
              <Pencil className="size-4 text-muted-foreground" />
            </button>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {partner ? `(Your orbit partner) is feeling ${mood.label}` : `is feeling ${mood.label}`}
          </p>
        </div>
      </div>

      <div className="card-cute flex flex-col gap-5 p-6">
        <div className="space-y-4">
          <Meter label="Hunger" value={room.hunger} tint="[&>div]:bg-chart-1" />
          <Meter label="Happiness" value={room.happiness} tint="[&>div]:bg-chart-2" />
          <Meter label="Sleep" value={room.sleep} tint="[&>div]:bg-chart-3" />
        </div>

        <div className="mt-auto grid gap-3 sm:grid-cols-3">
          <Button
            size="lg"
            onClick={() =>
              act(
                { hunger: clamp(room.hunger + 18), happiness: clamp(room.happiness + 4) },
                "🍓"
              )
            }
          >
            <Drumstick /> Feed
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              act(
                {
                  happiness: clamp(room.happiness + 16),
                  hunger: clamp(room.hunger - 6),
                  sleep: clamp(room.sleep - 5),
                },
                "💜"
              )
            }
          >
            <Gamepad2 /> Play
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              act({ sleep: clamp(room.sleep + 22), hunger: clamp(room.hunger - 4) }, "💤")
            }
          >
            <Moon /> Sleep
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Every tap updates instantly on your partner's screen too.
        </p>
      </div>
    </div>
  );
}