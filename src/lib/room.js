const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function joinRoom(code, user) {
  const rooms = await db.entities.Room.filter({ code });
  if (!rooms.length) return null;
  const room = rooms[0];

  const existing = await db.entities.RoomMember.filter({
    room_id: room.id,
    user_id: user.id,
  });
  if (!existing.length) {
    await db.entities.RoomMember.create({
      room_id: room.id,
      user_id: user.id,
      display_name: user.full_name || user.email || "Someone",
      avatar_url: null,
    });
  }
  return room;
}

export function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 9; // 9 PM (21:00) to 8:59 AM
}

export function getNightSessionKey() {
  const now = new Date();
  if (now.getHours() < 9) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}-night`;
}

export function isPetSleeping(roomId) {
  if (!roomId) return false;
  const night = isNightTime();
  const nightKey = getNightSessionKey();
  const wokenKey = localStorage.getItem(`orbit_woken_${roomId}`);
  const manualSleep = localStorage.getItem(`orbit_manual_sleep_${roomId}`);

  if (manualSleep === "true") return true;
  if (night && wokenKey !== nightKey) return true;
  return false;
}

export function wakeUpPet(roomId) {
  if (!roomId) return;
  const nightKey = getNightSessionKey();
  localStorage.setItem(`orbit_woken_${roomId}`, nightKey);
  localStorage.removeItem(`orbit_manual_sleep_${roomId}`);
}

export function sleepPet(roomId) {
  if (!roomId) return;
  localStorage.setItem(`orbit_manual_sleep_${roomId}`, "true");
  localStorage.removeItem(`orbit_woken_${roomId}`);
}

export function calculateDecayedStats(room) {
  if (!room || !room.id) return null;
  if (isPetSleeping(room.id)) return null;

  const now = Date.now();
  const lastDecay = room.last_decay ? Number(room.last_decay) : now;
  const elapsedMs = now - lastDecay;

  if (elapsedMs < 20000) return null;

  const elapsedMins = Math.min(elapsedMs / (60 * 1000), 720);

  // Happiness drops fast (~1.8% / min)
  // Hunger drops gradually (~0.8% / min)
  // Sleep drops gradually (~0.5% / min)
  // Love drops gradually (~0.4% / min)
  const happinessLoss = elapsedMins * 1.8;
  const hungerLoss = elapsedMins * 0.8;
  const sleepLoss = elapsedMins * 0.5;
  const loveLoss = elapsedMins * 0.4;

  if (happinessLoss < 1 && hungerLoss < 1 && sleepLoss < 1 && loveLoss < 1) {
    return null;
  }

  return {
    happiness: clamp((room.happiness ?? 50) - happinessLoss),
    hunger: clamp((room.hunger ?? 50) - hungerLoss),
    sleep: clamp((room.sleep ?? 50) - sleepLoss),
    love: clamp((room.love ?? 50) - loveLoss),
    last_decay: now,
  };
}