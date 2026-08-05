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