const MOODS = ["happy", "content", "meh", "sad", "sleepy"];

export default function PetCreature({ mood, name }) {
  const sleeping = mood === "sleepy";
  const eyeY = mood === "sad" ? 3 : 0;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${name} looking ${mood}`}
      className="size-52 drop-shadow-[0_12px_24px_hsl(var(--primary)_/_25%)]"
    >
      <defs>
        <radialGradient id="pet-body" cx="35%" cy="25%">
          <stop offset="0%" stopColor="hsl(var(--card))" />
          <stop offset="60%" stopColor="hsl(var(--secondary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </radialGradient>
      </defs>

      {/* ears */}
      <ellipse cx="58" cy="52" rx="20" ry="26" fill="hsl(var(--accent))" transform="rotate(-18 58 52)" />
      <ellipse cx="142" cy="52" rx="20" ry="26" fill="hsl(var(--accent))" transform="rotate(18 142 52)" />
      <ellipse cx="59" cy="55" rx="10" ry="14" fill="hsl(var(--primary))" opacity="0.35" transform="rotate(-18 59 55)" />
      <ellipse cx="141" cy="55" rx="10" ry="14" fill="hsl(var(--primary))" opacity="0.35" transform="rotate(18 141 55)" />

      {/* body */}
      <ellipse cx="100" cy="112" rx="72" ry="66" fill="url(#pet-body)" />
      <ellipse cx="100" cy="132" rx="44" ry="34" fill="hsl(var(--card))" opacity="0.65" />

      {/* cheeks */}
      <ellipse cx="58" cy="118" rx="13" ry="9" fill="hsl(var(--primary))" opacity="0.35" />
      <ellipse cx="142" cy="118" rx="13" ry="9" fill="hsl(var(--primary))" opacity="0.35" />

      {/* eyes */}
      {sleeping ? (
        <>
          <path d="M64 102 q12 12 24 0" stroke="hsl(var(--foreground))" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M112 102 q12 12 24 0" stroke="hsl(var(--foreground))" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="76" cy={102 + eyeY} rx="9" ry="11" fill="hsl(var(--foreground))" />
          <ellipse cx="124" cy={102 + eyeY} rx="9" ry="11" fill="hsl(var(--foreground))" />
          <circle cx="79" cy={98 + eyeY} r="3.4" fill="hsl(var(--card))" />
          <circle cx="127" cy={98 + eyeY} r="3.4" fill="hsl(var(--card))" />
        </>
      )}

      {/* mouth */}
      {mood === "happy" && (
        <path d="M88 124 q12 14 24 0" stroke="hsl(var(--foreground))" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      )}
      {mood === "content" && (
        <path d="M90 126 q10 8 20 0" stroke="hsl(var(--foreground))" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {mood === "meh" && (
        <path d="M90 127 h20" stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" />
      )}
      {mood === "sad" && (
        <path d="M88 130 q12 -12 24 0" stroke="hsl(var(--foreground))" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      )}
      {sleeping && (
        <ellipse cx="100" cy="127" rx="7" ry="9" fill="hsl(var(--foreground))" opacity="0.85" />
      )}

      {/* little feet */}
      <ellipse cx="76" cy="174" rx="16" ry="9" fill="hsl(var(--accent))" />
      <ellipse cx="124" cy="174" rx="16" ry="9" fill="hsl(var(--accent))" />

      {/* sparkle */}
      <path
        d="M158 62 l3.5 8.5 8.5 3.5 -8.5 3.5 -3.5 8.5 -3.5 -8.5 -8.5 -3.5 8.5 -3.5z"
        fill="hsl(var(--primary))"
        opacity="0.6"
      />
    </svg>
  );
}