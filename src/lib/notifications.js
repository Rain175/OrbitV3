// Push Notifications Helper for Orbit Love Pet Status

const LAST_NOTIFIED_KEY = "orbit_last_notified_timestamps";

function getLastNotifiedMap() {
  try {
    const raw = localStorage.getItem(LAST_NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setLastNotifiedMap(map) {
  try {
    localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Could not save notification timestamp map", e);
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return { granted: false, reason: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      try {
        new Notification("Orbit Love Alerts Active! 🔔", {
          body: "You will now receive real-time alerts when your pet is hungry, sleepy, sad, or needs love!",
          icon: "/favicon.ico",
        });
      } catch (e) {
        console.warn("Test notification failed:", e);
      }
      return { granted: true };
    }
    return { granted: false, reason: permission };
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return { granted: false, reason: "error" };
  }
}

export function isNotificationGranted() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

export function sendPetNotification(title, body, tag, cooldownMinutes = 10) {
  if (!isNotificationGranted()) return false;

  const now = Date.now();
  const map = getLastNotifiedMap();
  const lastTime = map[tag] || 0;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  if (now - lastTime < cooldownMs) {
    return false; // Skip due to cooldown
  }

  try {
    const notif = new Notification(title, {
      body,
      tag,
      renotify: true,
      requireInteraction: false,
    });

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }

    map[tag] = now;
    setLastNotifiedMap(map);
    return true;
  } catch (e) {
    console.warn("Failed to create system notification:", e);
    return false;
  }
}

export function checkAndNotifyPetStatus(room, petName) {
  if (!room || !isNotificationGranted()) return;

  const name = petName || room.pet_name || "Your Pet";
  const hunger = room.hunger ?? 50;
  const happiness = room.happiness ?? 50;
  const sleep = room.sleep ?? 50;
  const love = room.love ?? 50;

  // 1. Hunger Alert
  if (hunger <= 25) {
    sendPetNotification(
      `🍎 ${name} is Super Hungry!`,
      `${name}'s hunger dropped to ${hunger}%. Open Orbit Love and feed them some treats!`,
      "pet_hunger_alert",
      10
    );
  }

  // 2. Sleep Alert
  if (sleep <= 25) {
    sendPetNotification(
      `💤 ${name} is Exhausted!`,
      `${name}'s energy is down to ${sleep}%. Time for a cozy nap!`,
      "pet_sleep_alert",
      10
    );
  }

  // 3. Happiness Alert
  if (happiness <= 25) {
    sendPetNotification(
      `😢 ${name} feels Lonely & Sad!`,
      `${name}'s happiness is at ${happiness}%. Play a game with them to cheer them up!`,
      "pet_sad_alert",
      10
    );
  }

  // 4. Love Alert
  if (love <= 25) {
    sendPetNotification(
      `💖 ${name} Needs Cuddles!`,
      `${name}'s love meter is at ${love}%. Tap on ${name} to give them lots of love!`,
      "pet_love_alert",
      10
    );
  }
}
