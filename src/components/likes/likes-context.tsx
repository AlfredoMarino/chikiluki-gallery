"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface LikesContextValue {
  /** Ids de fotos liked por este visitante. */
  liked: Set<string>;
  /** true cuando el estado inicial ya se hidrató desde el servidor. */
  ready: boolean;
  /** Toggle optimista con rollback si la red falla. */
  toggle: (photoId: string) => void;
}

const LikesContext = createContext<LikesContextValue | null>(null);

/**
 * Provider de likes para vistas públicas. Hace un único GET batch por
 * colección al montar. Los componentes compartidos con el dashboard
 * (PhotoItem, PhotoLightbox) usan useLikesOptional(): fuera de este
 * provider reciben null y no renderizan corazón.
 */
export function LikesProvider({
  collectionId,
  children,
}: {
  collectionId: string;
  children: React.ReactNode;
}) {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // Evita que respuestas tardías de un toggle pisen un toggle más nuevo.
  const pending = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/likes?collectionId=${collectionId}`)
      .then((r) => (r.ok ? r.json() : { liked: [] }))
      .then((data: { liked: string[] }) => {
        if (cancelled) return;
        setLiked(new Set(data.liked));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  const toggle = useCallback((photoId: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      const willLike = !next.has(photoId);
      if (willLike) next.add(photoId);
      else next.delete(photoId);

      const seq = (pending.current.get(photoId) ?? 0) + 1;
      pending.current.set(photoId, seq);

      fetch("/api/public/likes", {
        method: willLike ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        })
        .catch(() => {
          // Rollback solo si este sigue siendo el toggle más reciente.
          if (pending.current.get(photoId) !== seq) return;
          setLiked((curr) => {
            const rolled = new Set(curr);
            if (willLike) rolled.delete(photoId);
            else rolled.add(photoId);
            return rolled;
          });
        });

      return next;
    });
  }, []);

  return (
    <LikesContext.Provider value={{ liked, ready, toggle }}>
      {children}
    </LikesContext.Provider>
  );
}

/** Versión estricta: lanza si no hay provider. */
export function useLikes(): LikesContextValue {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes debe usarse dentro de <LikesProvider>");
  return ctx;
}

/** Versión opcional: null fuera del provider (vistas del dashboard). */
export function useLikesOptional(): LikesContextValue | null {
  return useContext(LikesContext);
}
