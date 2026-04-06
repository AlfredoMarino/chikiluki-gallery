/**
 * Generate a URL-friendly slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Return a JSON Response with the given status code.
 */
export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/**
 * Return an error JSON Response.
 */
export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
