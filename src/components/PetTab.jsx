const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useRef, useState } from "react";
import { Drumstick, Gamepad2, Moon, Sparkles, Shirt, Heart, Bell, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { clamp, isPetSleeping, wakeUpPet, sleepPet, calculateDecayedStats } from "@/lib/room";
import PetCreature, { PET_SKINS } from "@/components/PetCreature";
import {
  requestNotificationPermission,
  isNotificationGranted,
  checkAndNotifyPetStatus,
} from "@/lib/notifications";

const MOODS = [
  { min: 75, mood: "happy", label: "over the moon" },
  { min: 50, mood: "content", label: "content" },
  { min: 25, mood: "meh", label: "needs attention" },
  { min: 0, mood: "sad", label: "not doing great" },
];

const HEART_EMOJIS = ["💖", "💗", "💕", "🥰", "💞", "❤️"];

function Meter({ label, value, tint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="text-muted-foreground font-mono">{value}%</span>
      </div>
      <Progress value={value} className={`mt-1.5 h-3 ${tint}`} />
    </div>
  );
}

export default function PetTab({ room, partner, myMember, onLocalUpdate }) {
  const tamagotchiName = partner?.display_name || partner?.full_name || room.pet_name || "Your Partner";
  const [burst, setBurst] = useState([]);
  const [skin, setSkin] = useState(() => {
    return myMember?.skin || localStorage.getItem("orbit_my_pet_skin") || "classic";
  });
  const [customSkinInput, setCustomSkinInput] = useState("");
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => isNotificationGranted());
  const [sleeping, setSleeping] = useState(() => isPetSleeping(room.id));

  useEffect(() => {
    if (myMember?.skin) {
      setSkin(myMember.skin);
    }
  }, [myMember?.skin]);

  const petRef = useRef(null);

  const hungerVal = room.hunger ?? 50;
  const happinessVal = room.happiness ?? 50;
  const sleepVal = room.sleep ?? 50;
  const loveVal = room.love ?? 50;

  const avg = Math.round((hungerVal + happinessVal + sleepVal + loveVal) / 4);
  const mood = MOODS.find((m) => avg >= m.min) || MOODS[1];

  // Auto-update sleep mode status (from 9 PM to 9 AM)
  useEffect(() => {
    setSleeping(isPetSleeping(room.id));
    const interval = setInterval(() => {
      setSleeping(isPetSleeping(room.id));
    }, 10000);
    return () => clearInterval(interval);
  }, [room.id]);

  function handleWakeUp() {
    wakeUpPet(room.id);
    setSleeping(false);
    toast.success(`☀️ Woke up ${tamagotchiName}! Care controls active.`);
  }

  function handleSleep() {
    sleepPet(room.id);
    setSleeping(true);
    toast.info(`💤 Put ${tamagotchiName} to sleep. Stats frozen!`);
  }

  // Auto-check for push notifications whenever room state changes
  useEffect(() => {
    if (notifEnabled) {
      checkAndNotifyPetStatus(room, tamagotchiName);
    }
  }, [room, tamagotchiName, notifEnabled]);

  // Periodic and on-load automatic stat decay / sleep recovery
  useEffect(() => {
    if (!room?.id) return;

    const runDecayCheck = async () => {
      const patch = calculateDecayedStats(room);
      if (patch) {
        onLocalUpdate(patch);
        await db.entities.Room.update(room.id, patch);
      }
    };

    runDecayCheck();
    const timer = setInterval(runDecayCheck, 15000);
    return () => clearInterval(timer);
  }, [room]);

  async function act(patch, emoji) {
    if (sleeping) {
      toast.info(`Zzz... ${tamagotchiName} is fast asleep! Tap 'Wake Up' to interact. ☀️`);
      return;
    }
    const id = Date.now();
    setBurst((b) => [...b, { id, emoji }]);
    setTimeout(() => setBurst((b) => b.filter((x) => x.id !== id)), 1400);
    petRef.current?.classList.remove("animate-pop");
    void petRef.current?.offsetWidth;
    petRef.current?.classList.add("animate-pop");

    const fullPatch = {
      ...patch,
      last_decay: Date.now(),
    };
    onLocalUpdate(fullPatch);
    await db.entities.Room.update(room.id, fullPatch);
  }

  async function cuddle() {
    if (sleeping) {
      toast.info(`Zzz... ${tamagotchiName} is fast asleep! Tap 'Wake Up' to interact. ☀️`);
      return;
    }
    const now = Date.now();
    const CUDDLE_KEY = `orbit_cuddles_${room?.id || "global"}`;
    let history = [];
    try {
      const raw = localStorage.getItem(CUDDLE_KEY);
      if (raw) history = JSON.parse(raw);
    } catch (e) {
      history = [];
    }

    const ONE_HOUR = 60 * 60 * 1000;
    const recent = history.filter((ts) => typeof ts === "number" && now - ts < ONE_HOUR);

    if (recent.length >= 5) {
      const oldest = Math.min(...recent);
      const remainingMs = ONE_HOUR - (now - oldest);
      const remainingMins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      toast.warning(
        `Your pet is all cuddled out for now! 😴 (Max 5 cuddles/hr). Try again in ${remainingMins} min${remainingMins > 1 ? "s" : ""}.`
      );
      return;
    }

    recent.push(now);
    try {
      localStorage.setItem(CUDDLE_KEY, JSON.stringify(recent));
    } catch (e) {
      console.warn("Could not save cuddle history", e);
    }

    const randomEmoji = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
    const patch = {
      love: clamp(loveVal + 5),
      happiness: clamp(happinessVal + 1), // Harder to gain happiness
    };
    await act(patch, randomEmoji);

    const countLeft = 5 - recent.length;
    if (countLeft > 0) {
      toast.success(`Cuddled! 💕 +5% Love (${countLeft} cuddle${countLeft > 1 ? "s" : ""} left this hour)`);
    } else {
      toast.success("Cuddled! 💕 +5% Love (Max cuddles reached for this hour!)");
    }
  }

  async function handleToggleNotifications() {
    if (isNotificationGranted()) {
      toast.info("Notifications are already active for Orbit Love! 🔔");
      setNotifEnabled(true);
      return;
    }

    const res = await requestNotificationPermission();
    if (res.granted) {
      setNotifEnabled(true);
      toast.success("Notifications enabled! You'll be alerted when your pet needs care. 🔔");
      checkAndNotifyPetStatus(room, tamagotchiName);
    } else {
      toast.error(
        "Notification permission was denied or not supported in this browser. Please enable notifications in site settings!"
      );
    }
  }

  async function handleSelectSkin(sId) {
    setSkin(sId);
    localStorage.setItem("orbit_my_pet_skin", sId);
    if (myMember?.id) {
      await db.entities.RoomMember.update(myMember.id, { skin: sId });
    }
    toast.success("Partner skin updated");
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      {/* Pet Card */}
      <div className="card-cute relative flex flex-col items-center justify-center overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_20%,hsl(var(--secondary)),transparent_65%)]" />

        {/* Top Controls: Notifications + Skin Picker */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant={notifEnabled ? "secondary" : "outline"}
            className="rounded-full gap-1.5 text-xs shadow-sm bg-background/80 backdrop-blur-sm"
            onClick={handleToggleNotifications}
            title={notifEnabled ? "Push notifications active" : "Enable push notifications"}
          >
            <Bell className={`size-3.5 ${notifEnabled ? "text-emerald-500 fill-emerald-500/20" : "text-amber-500"}`} />
            <span className="hidden sm:inline">{notifEnabled ? "Alerts On" : "Push Alerts"}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="rounded-full gap-1.5 text-xs shadow-sm bg-background/80 backdrop-blur-sm ml-auto"
            onClick={() => setShowSkinPicker(!showSkinPicker)}
          >
            <Shirt className="size-3.5 text-primary" />
            <span>Skins</span>
          </Button>
        </div>

        <div className="relative mt-6 flex flex-col items-center">
          {sleeping && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 text-amber-300 border border-amber-500/30 px-3.5 py-1 text-xs font-semibold shadow-md backdrop-blur-sm animate-pulse z-10">
              <Moon className="size-3.5 fill-amber-300 text-amber-300 shrink-0" />
              <span>Night Sleep Mode • Stats Frozen (9 PM - 9 AM) 💤</span>
            </div>
          )}

          {burst.map((b, i) => (
            <span
              key={b.id}
              className="animate-float-up absolute left-1/2 top-0 text-3xl pointer-events-none z-20"
              style={{ marginLeft: `${(i % 3) * 26 - 26}px` }}
            >
              {b.emoji}
            </span>
          ))}
          <div
            ref={petRef}
            onClick={cuddle}
            className="animate-bob select-none text-center cursor-pointer group hover:scale-105 active:scale-95 transition-transform"
            title={sleeping ? "Pet is asleep (Tap Wake Up)" : "Click or tap to cuddle! 💕"}
          >
            <div className="mx-auto flex items-center justify-center">
              <PetCreature
                mood={sleeping ? "sleepy" : (sleepVal < 20 ? "sleepy" : mood.mood)}
                name={tamagotchiName}
                skin={partner?.skin || myMember?.skin || skin}
              />
            </div>
            {!sleeping && (
              <p className="mt-2 text-[11px] font-semibold text-rose-500 opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Heart className="size-3 fill-rose-500" /> Tap pet to cuddle!
              </p>
            )}
          </div>

          {/* Wake Up Button - ONLY visible when pet is in sleep mode */}
          {sleeping && (
            <div className="mt-4 z-10 w-full flex justify-center">
              <Button
                size="lg"
                className="rounded-2xl px-6 py-3 font-bold shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all transform hover:scale-105 active:scale-95 gap-2 border border-amber-300/40 text-sm"
                onClick={handleWakeUp}
              >
                <Sun className="size-5 fill-amber-200 text-amber-100 animate-spin-slow shrink-0" />
                Wake Up {tamagotchiName}
              </Button>
            </div>
          )}
        </div>

        <div className="relative mt-4 text-center w-full">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {tamagotchiName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {sleeping
              ? `${tamagotchiName} is sleeping peacefully 💤`
              : partner
              ? `(Your orbit partner) is feeling ${mood.label}`
              : `is feeling ${mood.label}`}
          </p>
        </div>

        {/* Skin Selector Modal / Panel */}
        {showSkinPicker && (
          <div className="mt-6 w-full rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Personal Pet Outfit
              </span>
              <button
                onClick={() => setShowSkinPicker(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PET_SKINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSkin(s.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-all text-xs ${
                    skin === s.id
                      ? "border-primary bg-primary/10 font-bold ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-secondary/60"
                  }`}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1 border-t border-border/60">
              <Input
                value={customSkinInput}
                onChange={(e) => setCustomSkinInput(e.target.value)}
                placeholder="Paste custom PNG image URL..."
                className="rounded-xl text-xs h-9"
              />
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl h-9 text-xs shrink-0"
                onClick={() => {
                  if (!customSkinInput.trim()) return;
                  handleSelectSkin(customSkinInput.trim());
                  setCustomSkinInput("");
                }}
              >
                Apply PNG
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Care & Stats */}
      <div className="card-cute flex flex-col gap-5 p-6">
        <div className="space-y-3.5">
          <Meter label="Hunger" value={hungerVal} tint="[&>div]:bg-amber-500" />
          <Meter label="Happiness" value={happinessVal} tint="[&>div]:bg-purple-500" />
          <Meter label="Sleep" value={sleepVal} tint="[&>div]:bg-sky-500" />
          <Meter label="Love 💕" value={loveVal} tint="[&>div]:bg-rose-500" />
        </div>

        <div className="mt-auto grid gap-2.5 grid-cols-2 sm:grid-cols-4">
          <Button
            size="lg"
            className="min-h-[48px] rounded-2xl font-semibold shadow-sm active:scale-95 transition-transform text-xs sm:text-sm px-2.5"
            onClick={() =>
              act(
                { hunger: clamp(hungerVal + 18), happiness: clamp(happinessVal + 1) },
                "🍓"
              )
            }
          >
            <Drumstick className="size-4 mr-1 shrink-0" /> Feed
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="min-h-[48px] rounded-2xl font-semibold shadow-sm active:scale-95 transition-transform text-xs sm:text-sm px-2.5"
            onClick={() => {
              if (sleepVal <= 0 || hungerVal <= 0) {
                toast.error(
                  `Too tired or hungry to play! ${tamagotchiName} needs ${
                    hungerVal <= 0 ? "food 🍓" : ""
                  }${hungerVal <= 0 && sleepVal <= 0 ? " and " : ""}${
                    sleepVal <= 0 ? "sleep 💤" : ""
                  } first.`
                );
                return;
              }
              act(
                {
                  happiness: clamp(happinessVal + 6),
                  hunger: clamp(hungerVal - 7),
                  sleep: clamp(sleepVal - 1),
                },
                "💜"
              );
            }}
          >
            <Gamepad2 className="size-4 mr-1 shrink-0" /> Play
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="min-h-[48px] rounded-2xl font-semibold shadow-sm active:scale-95 transition-transform text-xs sm:text-sm px-2.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20"
            onClick={cuddle}
          >
            <Heart className="size-4 mr-1 fill-rose-500 text-rose-500 shrink-0" /> Cuddle
          </Button>
          <Button
            size="lg"
            variant={sleeping ? "secondary" : "outline"}
            className="min-h-[48px] rounded-2xl font-semibold shadow-sm active:scale-95 transition-transform text-xs sm:text-sm px-2.5"
            onClick={() => {
              if (sleeping) {
                handleWakeUp();
              } else {
                act({ sleep: clamp(sleepVal + 22), hunger: clamp(hungerVal - 4) }, "💤");
                handleSleep();
              }
            }}
          >
            {sleeping ? (
              <>
                <Sun className="size-4 mr-1 text-amber-500 fill-amber-500/20 shrink-0" /> Wake Up
              </>
            ) : (
              <>
                <Moon className="size-4 mr-1 shrink-0" /> Sleep
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Every tap updates instantly on your partner's screen too.
        </p>
      </div>
    </div>
  );
}
