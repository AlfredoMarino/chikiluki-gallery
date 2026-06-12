"use client";

interface LikeButtonProps {
  liked: boolean;
  onToggle: () => void;
  /** Tamaño del área clicable. El icono escala proporcionalmente. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Corazón de like para visitantes. Nunca muestra conteos — solo el estado
 * propio (outline → relleno). stopPropagation porque vive sobre tiles que
 * abren el lightbox al click.
 */
export function LikeButton({
  liked,
  onToggle,
  size = "md",
  className = "",
}: LikeButtonProps) {
  const box = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "Quitar me gusta" : "Me gusta"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex ${box} items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition hover:bg-black/70 ${className}`}
    >
      <svg
        key={liked ? "filled" : "outline"}
        className={`${icon} ${liked ? "animate-like-pop text-white" : "text-white/80"}`}
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.6c0 5.1-7.3 9.6-9 10.6-1.7-1-9-5.5-9-10.6C3 6 5 4 7.6 4c1.8 0 3.5 1 4.4 2.6C12.9 5 14.6 4 16.4 4 19 4 21 6 21 8.6Z"
        />
      </svg>
    </button>
  );
}
