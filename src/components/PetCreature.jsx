const MOODS = ["happy", "content", "meh", "sad", "sleepy"];

export const PET_SKINS = [
  { id: "classic", name: "Classic Mochi", icon: "🌸", color: "#f472b6" },
  { id: "bunny", name: "Fluffy Bunny", icon: "🐰", color: "#f43f5e" },
  { id: "bear", name: "Honey Bear", icon: "🐻", color: "#d97706" },
  { id: "fox", name: "Sparkle Fox", icon: "🦊", color: "#ea580c" },
  { id: "midnight", name: "Midnight Kitty", icon: "🐱", color: "#6366f1" },
  { id: "matcha", name: "Froggy Matcha", icon: "🐸", color: "#10b981" },
  { id: "unicorn", name: "Starry Unicorn", icon: "🦄", color: "#a855f7" },
   { id: "custom_girl", name: "Kiss hoodie", icon: "❤️", color: "#f472b6", image: "/kiss_hoodie.png" },
   { id: "custom_guy", name: "Black hoodie", icon: "👟", color: "#f472b6", image: "/dark_hoodie.jpg" },
];

export default function PetCreature({ mood, name, skin = "classic" }) {
  const sleeping = mood === "sleepy";
  const eyeY = mood === "sad" ? 3 : 0;

  // Check if skin is an ID in PET_SKINS or a direct image URL / object
  const skinDef = typeof skin === "object" ? skin : PET_SKINS.find((s) => s.id === skin);
  const imageUrl = skinDef?.image || (typeof skin === "string" && (skin.startsWith("http") || skin.startsWith("data:") || skin.startsWith("/") || skin.endsWith(".png") || skin.endsWith(".webp") || skin.endsWith(".jpg")) ? skin : null);

  // If this skin uses a custom PNG image
  if (imageUrl) {
    return (
      <div className="relative size-52 flex items-center justify-center drop-shadow-[0_12px_24px_rgba(244,63,94,0.3)] transition-all duration-300">
        <img
          src={imageUrl}
          alt={`${name} (${skinDef?.name || "Pet"})`}
          className={`size-48 object-contain transition-transform duration-300 ${sleeping ? "opacity-80 grayscale-[20%]" : ""}`}
        />
        {sleeping && (
          <div className="absolute top-2 right-4 text-xl font-bold animate-bounce text-pink-400">
            Zzz...
          </div>
        )}
      </div>
    );
  }

  // Skin theme colors & shapes (Fixed vibrant hex values so dark theme does not alter pet colors)
  let bodyGrad1 = "#fff5f7";
  let bodyGrad2 = "#fbcfe8";
  let bodyGrad3 = "#f472b6";
  let bellyColor = "#fff1f2";
  let cheekColor = "#f43f5e";
  let earColor = "#f472b6";
  let earInner = "#fbe2e8";
  let footColor = "#f43f5e";

  if (skin === "bunny") {
    bodyGrad1 = "#ffffff";
    bodyGrad2 = "#fce7f3";
    bodyGrad3 = "#f472b6";
    bellyColor = "#fff1f2";
    cheekColor = "#f43f5e";
    earColor = "#fbcfe8";
    earInner = "#f43f5e";
    footColor = "#f472b6";
  } else if (skin === "bear") {
    bodyGrad1 = "#fef3c7";
    bodyGrad2 = "#f59e0b";
    bodyGrad3 = "#b45309";
    bellyColor = "#fffbeb";
    cheekColor = "#d97706";
    earColor = "#d97706";
    earInner = "#fef3c7";
    footColor = "#b45309";
  } else if (skin === "fox") {
    bodyGrad1 = "#ffedd5";
    bodyGrad2 = "#f97316";
    bodyGrad3 = "#c2410c";
    bellyColor = "#fff7ed";
    cheekColor = "#ea580c";
    earColor = "#ea580c";
    earInner = "#ffedd5";
    footColor = "#9a3412";
  } else if (skin === "midnight") {
    bodyGrad1 = "#818cf8";
    bodyGrad2 = "#3730a3";
    bodyGrad3 = "#1e1b4b";
    bellyColor = "#312e81";
    cheekColor = "#c084fc";
    earColor = "#4f46e5";
    earInner = "#818cf8";
    footColor = "#312e81";
  } else if (skin === "matcha") {
    bodyGrad1 = "#ecfdf5";
    bodyGrad2 = "#34d399";
    bodyGrad3 = "#047857";
    bellyColor = "#d1fae5";
    cheekColor = "#059669";
    earColor = "#10b981";
    earInner = "#a7f3d0";
    footColor = "#047857";
  } else if (skin === "unicorn") {
    bodyGrad1 = "#fae8ff";
    bodyGrad2 = "#c084fc";
    bodyGrad3 = "#7e22ce";
    bellyColor = "#f3e8ff";
    cheekColor = "#ec4899";
    earColor = "#a855f7";
    earInner = "#f472b6";
    footColor = "#6b21a8";
  }

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${name} looking ${mood}`}
      className="size-52 drop-shadow-[0_12px_24px_rgba(244,63,94,0.3)] transition-all duration-300"
    >
      <defs>
        <radialGradient id={`pet-body-${skin}`} cx="35%" cy="25%">
          <stop offset="0%" stopColor={bodyGrad1} />
          <stop offset="60%" stopColor={bodyGrad2} />
          <stop offset="100%" stopColor={bodyGrad3} />
        </radialGradient>
      </defs>

      {/* EAR SHAPES DEPENDING ON SKIN */}
      {skin === "bunny" ? (
        <>
          {/* Long Bunny Ears */}
          <ellipse cx="60" cy="35" rx="14" ry="42" fill={earColor} transform="rotate(-10 60 35)" />
          <ellipse cx="140" cy="35" rx="14" ry="42" fill={earColor} transform="rotate(10 140 35)" />
          <ellipse cx="60" cy="38" rx="7" ry="28" fill={earInner} opacity="0.6" transform="rotate(-10 60 38)" />
          <ellipse cx="140" cy="38" rx="7" ry="28" fill={earInner} opacity="0.6" transform="rotate(10 140 38)" />
        </>
      ) : skin === "bear" ? (
        <>
          {/* Bear Ears */}
          <circle cx="50" cy="55" r="22" fill={earColor} />
          <circle cx="150" cy="55" r="22" fill={earColor} />
          <circle cx="50" cy="55" r="12" fill={earInner} opacity="0.8" />
          <circle cx="150" cy="55" r="12" fill={earInner} opacity="0.8" />
        </>
      ) : skin === "fox" ? (
        <>
          {/* Pointy Fox Ears */}
          <path d="M35 80 L60 25 L80 75 Z" fill={earColor} />
          <path d="M165 80 L140 25 L120 75 Z" fill={earColor} />
          <path d="M45 75 L60 35 L72 72 Z" fill={earInner} opacity="0.8" />
          <path d="M155 75 L140 35 L128 72 Z" fill={earInner} opacity="0.8" />
        </>
      ) : skin === "midnight" ? (
        <>
          {/* Cat ears */}
          <polygon points="40,75 62,28 85,72" fill={earColor} />
          <polygon points="160,75 138,28 115,72" fill={earColor} />
          <polygon points="48,72 62,38 78,70" fill={earInner} opacity="0.7" />
          <polygon points="152,72 138,38 122,70" fill={earInner} opacity="0.7" />
        </>
      ) : skin === "matcha" ? (
        <>
          {/* Frog Eye Bumps */}
          <circle cx="65" cy="55" r="20" fill={earColor} />
          <circle cx="135" cy="55" r="20" fill={earColor} />
          <circle cx="65" cy="55" r="11" fill="#ffffff" />
          <circle cx="135" cy="55" r="11" fill="#ffffff" />
          <circle cx="65" cy="55" r="5" fill="#047857" />
          <circle cx="135" cy="55" r="5" fill="#047857" />
        </>
      ) : (
        <>
          {/* Classic / Unicorn Ears */}
          <ellipse cx="58" cy="52" rx="20" ry="26" fill={earColor} transform="rotate(-18 58 52)" />
          <ellipse cx="142" cy="52" rx="20" ry="26" fill={earColor} transform="rotate(18 142 52)" />
          <ellipse cx="59" cy="55" rx="10" ry="14" fill={earInner} opacity="0.4" transform="rotate(-18 59 55)" />
          <ellipse cx="141" cy="55" rx="10" ry="14" fill={earInner} opacity="0.4" transform="rotate(18 141 55)" />
        </>
      )}

      {/* UNICORN HORN */}
      {skin === "unicorn" && (
        <path d="M93 55 L100 12 L107 55 Z" fill="#fde047" stroke="#eab308" strokeWidth="2" />
      )}

      {/* FROG LEAF HAT */}
      {skin === "matcha" && (
        <path d="M100 48 C90 32 110 20 100 15 C115 25 105 38 100 48 Z" fill="#15803d" />
      )}

      {/* BODY */}
      <ellipse cx="100" cy="112" rx="72" ry="66" fill={`url(#pet-body-${skin})`} />
      <ellipse cx="100" cy="132" rx="44" ry="34" fill={bellyColor} opacity="0.75" />

      {/* CHEEKS */}
      <ellipse cx="58" cy="118" rx="13" ry="9" fill={cheekColor} opacity="0.45" />
      <ellipse cx="142" cy="118" rx="13" ry="9" fill={cheekColor} opacity="0.45" />

      {/* CAT WHISKERS FOR MIDNIGHT */}
      {skin === "midnight" && (
        <>
          <line x1="32" y1="112" x2="52" y2="114" stroke="#c084fc" strokeWidth="2" opacity="0.8" />
          <line x1="30" y1="122" x2="52" y2="120" stroke="#c084fc" strokeWidth="2" opacity="0.8" />
          <line x1="168" y1="112" x2="148" y2="114" stroke="#c084fc" strokeWidth="2" opacity="0.8" />
          <line x1="170" y1="122" x2="148" y2="120" stroke="#c084fc" strokeWidth="2" opacity="0.8" />
        </>
      )}

      {/* EYES */}
      {sleeping ? (
        <>
          <path d="M64 102 q12 12 24 0" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M112 102 q12 12 24 0" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="76" cy={102 + eyeY} rx="9" ry="11" fill={skin === "midnight" ? "#c084fc" : "#1e293b"} />
          <ellipse cx="124" cy={102 + eyeY} rx="9" ry="11" fill={skin === "midnight" ? "#c084fc" : "#1e293b"} />
          <circle cx="79" cy={98 + eyeY} r="3.4" fill="#ffffff" />
          <circle cx="127" cy={98 + eyeY} r="3.4" fill="#ffffff" />
        </>
      )}

      {/* MOUTH */}
      {mood === "happy" && (
        <path d="M88 124 q12 14 24 0" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      )}
      {mood === "content" && (
        <path d="M90 126 q10 8 20 0" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {mood === "meh" && (
        <path d="M90 127 h20" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="4" strokeLinecap="round" />
      )}
      {mood === "sad" && (
        <path d="M88 130 q12 -12 24 0" stroke={skin === "midnight" ? "#f472b6" : "#1e293b"} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      )}
      {sleeping && (
        <ellipse cx="100" cy="127" rx="7" ry="9" fill={skin === "midnight" ? "#f472b6" : "#1e293b"} opacity="0.85" />
      )}

      {/* FEET */}
      <ellipse cx="76" cy="174" rx="16" ry="9" fill={footColor} />
      <ellipse cx="124" cy="174" rx="16" ry="9" fill={footColor} />

      {/* SPARKLES */}
      <path
        d="M158 62 l3.5 8.5 8.5 3.5 -8.5 3.5 -3.5 8.5 -3.5 -8.5 -8.5 -3.5 8.5 -3.5z"
        fill={skin === "unicorn" ? "#fde047" : bodyGrad2}
        opacity="0.8"
      />
      <path
        d="M32 68 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z"
        fill={skin === "unicorn" ? "#fde047" : bodyGrad3}
        opacity="0.7"
      />
    </svg>
  );
}
