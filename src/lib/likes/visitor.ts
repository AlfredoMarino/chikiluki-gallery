import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * Identidad anónima de visitante para el sistema de likes.
 *
 * La cookie se setea lazy: solo cuando el visitante da su primer like
 * (POST). Quien nunca interactúa nunca recibe cookie. httpOnly porque el
 * cliente no necesita leer el valor — su estado de likes llega por el GET.
 */

const COOKIE_NAME = "cl_visitor";
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 730;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee el visitorId de la cookie. null si no existe o no es un UUID válido. */
export function getVisitorId(request: NextRequest): string | null {
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!value || !UUID_RE.test(value)) return null;
  return value.toLowerCase();
}

/**
 * Lee el visitorId o genera uno nuevo y lo setea como cookie de respuesta.
 * Solo llamar desde Route Handlers (cookies().set no es legal en render).
 */
export async function ensureVisitorId(request: NextRequest): Promise<string> {
  const existing = getVisitorId(request);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const store = await cookies();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_YEARS_SECONDS,
  });
  return id;
}

/** Valida que un string sea un UUID (para photoId/collectionId de requests). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
