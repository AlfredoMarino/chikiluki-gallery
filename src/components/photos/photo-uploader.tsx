"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  InvalidSessionInputError,
  buildLevel4Folder,
  getExtensionFromFile,
  normalizeSlug,
  validateSession,
  type Session,
} from "@/lib/drive/path";

// ─── Types ───────────────────────────────────────────────

type TileStatus =
  | "staged" // in the UI, hash pending
  | "hashing" // computing sha256
  | "queued" // hash done, waiting for Guardar / init response
  | "initializing" // in flight to /init
  | "uploading" // PUTting to Drive
  | "processing" // /finalize in flight
  | "done"
  | "duplicate"
  | "unsupported"
  | "error"
  | "cancelled";

type Medium = "digital" | "film";

interface Tile {
  id: string; // stable key per drop
  file: File;
  preview: string | null; // blob URL for JPG/PNG; null for TIFF (can't render)
  hash: string | null;
  status: TileStatus;
  progress: number; // 0..1 for uploading
  error?: string;
  // Populated after /init:
  uploadUrl?: string;
  token?: string;
  storedFilename?: string;
  sessionSeq?: number;
  driveFileId?: string;
  abort?: AbortController;
}

interface FormState {
  medium: Medium;
  camera: string;
  date: string; // YYYY-MM-DD from <input type="date">
  description: string;
  stock: string;
  stockUnknown: boolean;
  iso: string;
  isoUnknown: boolean;
  descriptors: string;
}

interface SessionInfo {
  exists: boolean;
  uploadedCount?: number;
  nextSeq?: number;
}

type InitFileResult =
  | {
      status: "ready";
      uploadUrl: string;
      token: string;
      storedFilename: string;
      sessionSeq: number;
    }
  | { status: "duplicate"; error: string; existingPhotoId: string }
  | { status: "unsupported"; error: string }
  | { status: "error"; error: string };

// ─── Constants ───────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10);

const INITIAL_FORM: FormState = {
  medium: "digital",
  camera: "",
  date: todayIso(),
  description: "",
  stock: "",
  stockUnknown: false,
  iso: "",
  isoUnknown: false,
  descriptors: "",
};

const ACCEPT_ATTR = ".jpg,.jpeg,.png,.tiff,image/jpeg,image/png,image/tiff";
const UPLOAD_CONCURRENCY = 3;

// ─── Component ───────────────────────────────────────────

export function PhotoUploader({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [saving, setSaving] = useState(false);

  // Validated session (or error) — drives the live level4 preview + gating.
  const sessionPreview = useMemo<
    | { ok: true; session: Session; level4: string }
    | { ok: false; error: string }
  >(() => {
    try {
      const raw: Record<string, unknown> = {
        medium: form.medium,
        camera: form.camera,
        date: form.date,
      };
      if (form.medium === "digital") {
        raw.description = form.description;
      } else {
        raw.stock = form.stockUnknown ? "x" : form.stock;
        raw.iso = form.isoUnknown ? 0 : form.iso;
        raw.descriptors = form.descriptors;
      }
      const session = validateSession(raw);
      return { ok: true, session, level4: buildLevel4Folder(session) };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof InvalidSessionInputError
            ? e.message
            : "Rellena los metadatos de la sesión",
      };
    }
  }, [form]);

  const canStage = sessionPreview.ok;

  // Slug previews (pure client-side, not authoritative).
  const cameraPreview = useMemo(() => safeSlug(form.camera), [form.camera]);
  const descriptionPreview = useMemo(
    () => safeSlug(form.description),
    [form.description]
  );
  const stockPreview = useMemo(
    () => (form.stockUnknown ? "x" : safeSlug(form.stock)),
    [form.stock, form.stockUnknown]
  );
  const descriptorsPreview = useMemo(
    () => safeSlug(form.descriptors),
    [form.descriptors]
  );

  // ─── Session-info lookup (debounced) ───────────────────
  useEffect(() => {
    if (!sessionPreview.ok) {
      setSessionInfo(null);
      return;
    }
    const folder = sessionPreview.level4;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/photos/session-info?folder=${encodeURIComponent(folder)}`
        );
        if (res.ok) {
          setSessionInfo(await res.json());
        }
      } catch {
        // non-fatal; just skip the hint
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sessionPreview]);

  // ─── beforeunload guard during uploads ─────────────────
  useEffect(() => {
    const inFlight = tiles.some((t) =>
      ["initializing", "uploading", "processing"].includes(t.status)
    );
    if (!inFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tiles]);

  // Revoke blob URLs on unmount.
  useEffect(() => {
    return () => {
      setTiles((prev) => {
        for (const t of prev) if (t.preview) URL.revokeObjectURL(t.preview);
        return prev;
      });
    };
  }, []);

  // ─── Tile helpers ──────────────────────────────────────

  const patchTile = useCallback(
    (id: string, patch: Partial<Tile> | ((t: Tile) => Partial<Tile>)) => {
      setTiles((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) }
            : t
        )
      );
    },
    []
  );

  const addFiles = useCallback((fileList: FileList) => {
    const incoming: Tile[] = Array.from(fileList).map((file) => {
      const id = crypto.randomUUID();
      const mime = (file.type || "").toLowerCase();
      const canPreview =
        mime === "image/jpeg" || mime === "image/png";
      let status: TileStatus = "staged";
      let error: string | undefined;
      try {
        getExtensionFromFile(file.name);
      } catch (e) {
        status = "unsupported";
        error =
          e instanceof InvalidSessionInputError ? e.message : "No soportado";
      }
      return {
        id,
        file,
        preview: canPreview ? URL.createObjectURL(file) : null,
        hash: null,
        status,
        progress: 0,
        error,
      };
    });
    setTiles((prev) => [...prev, ...incoming]);
  }, []);

  const removeTile = useCallback((id: string) => {
    setTiles((prev) => {
      const tile = prev.find((t) => t.id === id);
      if (tile?.preview) URL.revokeObjectURL(tile.preview);
      if (tile?.abort) tile.abort.abort();
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const cancelTile = useCallback(
    (id: string) => {
      setTiles((prev) => {
        const t = prev.find((x) => x.id === id);
        if (t?.abort) t.abort.abort();
        return prev;
      });
      patchTile(id, { status: "cancelled", progress: 0 });
    },
    [patchTile]
  );

  // ─── Guardar ───────────────────────────────────────────

  const saveAll = useCallback(async () => {
    if (!sessionPreview.ok || saving) return;

    // Snapshot the tiles that need saving (staged, error, cancelled).
    const candidates = tiles.filter(
      (t) =>
        t.status === "staged" ||
        t.status === "error" ||
        t.status === "cancelled"
    );
    if (candidates.length === 0) return;

    setSaving(true);
    try {
      // 1. Hash everything client-side in parallel (fire a few at a time).
      await runWithConcurrency(candidates, 4, async (tile) => {
        patchTile(tile.id, { status: "hashing", error: undefined });
        try {
          const hash = await sha256Hex(tile.file);
          patchTile(tile.id, { hash, status: "queued" });
          tile.hash = hash; // keep local snapshot in sync
        } catch (e) {
          patchTile(tile.id, {
            status: "error",
            error: e instanceof Error ? e.message : "Hash failed",
          });
        }
      });

      // 2. Re-read the tiles (state is the source of truth) and build init payload.
      const snapshot = await new Promise<Tile[]>((resolve) => {
        setTiles((prev) => {
          resolve(prev);
          return prev;
        });
      });
      const toInit = snapshot.filter(
        (t) =>
          candidates.some((c) => c.id === t.id) &&
          t.status === "queued" &&
          t.hash
      );
      if (toInit.length === 0) {
        setSaving(false);
        return;
      }

      // 3. POST /init with the batch.
      for (const t of toInit) patchTile(t.id, { status: "initializing" });

      const initPayload = {
        session: {
          medium: sessionPreview.session.medium,
          year: sessionPreview.session.year,
          camera: sessionPreview.session.camera,
          date: sessionPreview.session.date,
          description:
            sessionPreview.session.medium === "digital"
              ? sessionPreview.session.description
              : undefined,
          stock:
            sessionPreview.session.medium === "film"
              ? sessionPreview.session.stock
              : undefined,
          iso:
            sessionPreview.session.medium === "film"
              ? sessionPreview.session.iso
              : undefined,
          descriptors:
            sessionPreview.session.medium === "film"
              ? sessionPreview.session.descriptors
              : undefined,
        },
        files: toInit.map((t) => ({
          name: t.file.name,
          size: t.file.size,
          mimeType: t.file.type || "application/octet-stream",
          hash: t.hash,
        })),
      };

      let initRes: Response;
      try {
        initRes = await fetch("/api/photos/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initPayload),
        });
      } catch (e) {
        for (const t of toInit)
          patchTile(t.id, {
            status: "error",
            error: e instanceof Error ? e.message : "Network error",
          });
        return;
      }

      if (!initRes.ok) {
        const msg = await safeErrorMessage(initRes);
        for (const t of toInit)
          patchTile(t.id, { status: "error", error: msg });
        return;
      }

      const initBody = (await initRes.json()) as {
        sessionFolder: string;
        files: InitFileResult[];
      };

      // 4. Dispatch each file's pipeline based on init result.
      const uploadTasks: Array<{ tile: Tile; result: Extract<InitFileResult, { status: "ready" }> }> = [];

      toInit.forEach((tile, i) => {
        const r = initBody.files[i];
        if (!r) {
          patchTile(tile.id, {
            status: "error",
            error: "init returned no result for this file",
          });
          return;
        }
        if (r.status === "ready") {
          patchTile(tile.id, {
            status: "uploading",
            uploadUrl: r.uploadUrl,
            token: r.token,
            storedFilename: r.storedFilename,
            sessionSeq: r.sessionSeq,
            progress: 0,
          });
          uploadTasks.push({ tile, result: r });
        } else if (r.status === "duplicate") {
          patchTile(tile.id, { status: "duplicate", error: r.error });
        } else if (r.status === "unsupported") {
          patchTile(tile.id, { status: "unsupported", error: r.error });
        } else {
          patchTile(tile.id, { status: "error", error: r.error });
        }
      });

      // 5. Upload each file to Drive (concurrency-limited), then finalize.
      await runWithConcurrency(uploadTasks, UPLOAD_CONCURRENCY, async (task) => {
        const abort = new AbortController();
        patchTile(task.tile.id, { abort });
        try {
          const driveFileId = await uploadToDriveResumable({
            url: task.result.uploadUrl,
            file: task.tile.file,
            signal: abort.signal,
            onProgress: (p) => patchTile(task.tile.id, { progress: p }),
          });
          patchTile(task.tile.id, {
            status: "processing",
            progress: 1,
            driveFileId,
          });

          const finRes = await fetch("/api/photos/upload/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: task.result.token,
              driveFileId,
            }),
          });
          if (finRes.status === 409) {
            patchTile(task.tile.id, {
              status: "duplicate",
              error: "photo already exists",
            });
            return;
          }
          if (!finRes.ok) {
            const msg = await safeErrorMessage(finRes);
            patchTile(task.tile.id, { status: "error", error: msg });
            return;
          }
          patchTile(task.tile.id, { status: "done", abort: undefined });
          onUploadComplete?.();
        } catch (e) {
          if (abort.signal.aborted) {
            patchTile(task.tile.id, { status: "cancelled", progress: 0 });
            return;
          }
          patchTile(task.tile.id, {
            status: "error",
            error: e instanceof Error ? e.message : "Upload failed",
          });
        }
      });

      // After saving, refresh session info (nextSeq will have moved).
      try {
        const res = await fetch(
          `/api/photos/session-info?folder=${encodeURIComponent(initBody.sessionFolder)}`
        );
        if (res.ok) setSessionInfo(await res.json());
      } catch {
        // non-fatal
      }
    } finally {
      setSaving(false);
    }
  }, [sessionPreview, tiles, saving, patchTile, onUploadComplete]);

  // ─── Nueva sesión ──────────────────────────────────────

  const resetSession = useCallback(() => {
    const pending = tiles.some((t) =>
      ["hashing", "initializing", "uploading", "processing"].includes(t.status)
    );
    if (pending) {
      if (
        !confirm(
          "Hay fotos subiéndose. ¿Seguro que querés cancelar todo y empezar una nueva sesión?"
        )
      )
        return;
    }
    for (const t of tiles) {
      if (t.preview) URL.revokeObjectURL(t.preview);
      if (t.abort) t.abort.abort();
    }
    setTiles([]);
    setForm(INITIAL_FORM);
    setSessionInfo(null);
  }, [tiles]);

  // ─── Drop handlers ─────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canStage) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, canStage]
  );

  // ─── Derived counts ────────────────────────────────────

  const counts = useMemo(() => {
    const c = {
      total: tiles.length,
      savable: 0,
      done: 0,
      failed: 0,
      inFlight: 0,
    };
    for (const t of tiles) {
      if (t.status === "done") c.done++;
      else if (t.status === "error" || t.status === "cancelled") c.failed++;
      else if (
        t.status === "staged" ||
        t.status === "queued" ||
        t.status === "hashing"
      )
        c.savable++;
      else if (
        t.status === "initializing" ||
        t.status === "uploading" ||
        t.status === "processing"
      )
        c.inFlight++;
    }
    // Errored/cancelled tiles are re-savable via the same button.
    c.savable += c.failed;
    return c;
  }, [tiles]);

  const canSave = canStage && counts.savable > 0 && !saving;

  return (
    <div className="space-y-6">
      {/* ─── Metadata form ──────────────────────────── */}
      <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">
            Metadatos de la sesión
          </h2>
          <button
            type="button"
            onClick={resetSession}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Nueva sesión
          </button>
        </div>

        {/* Medium toggle */}
        <div className="flex gap-2">
          {(["digital", "film"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setForm((f) => ({ ...f, medium: m }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                form.medium === m
                  ? "border-white bg-white text-black"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
              }`}
            >
              {m === "digital" ? "Digital" : "Film"}
            </button>
          ))}
        </div>

        {/* Camera + Date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cámara" preview={cameraPreview}>
            <input
              type="text"
              value={form.camera}
              onChange={(e) =>
                setForm((f) => ({ ...f, camera: e.target.value }))
              }
              placeholder="Canon 500D"
              className={inputClasses}
            />
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClasses}
            />
          </Field>
        </div>

        {/* Digital / Film fields */}
        {form.medium === "digital" ? (
          <Field label="Descripción" preview={descriptionPreview}>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="cumpleaños maite"
              className={inputClasses}
            />
          </Field>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Stock"
                preview={stockPreview}
                toggle={{
                  label: "Desconocido",
                  value: form.stockUnknown,
                  onChange: (v) =>
                    setForm((f) => ({ ...f, stockUnknown: v })),
                }}
              >
                <input
                  type="text"
                  value={form.stock}
                  disabled={form.stockUnknown}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock: e.target.value }))
                  }
                  placeholder="Ilford HP5"
                  className={inputClasses}
                />
              </Field>
              <Field
                label="ISO"
                toggle={{
                  label: "Desconocido",
                  value: form.isoUnknown,
                  onChange: (v) => setForm((f) => ({ ...f, isoUnknown: v })),
                }}
              >
                <input
                  type="number"
                  min={0}
                  max={6400}
                  value={form.iso}
                  disabled={form.isoUnknown}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, iso: e.target.value }))
                  }
                  placeholder="400"
                  className={inputClasses}
                />
              </Field>
            </div>
            <Field
              label="Descriptores (opcional)"
              preview={descriptorsPreview}
              hint="Útil para distinguir dos rollos del mismo stock/iso/fecha"
            >
              <input
                type="text"
                value={form.descriptors}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptors: e.target.value }))
                }
                placeholder="street madrid"
                className={inputClasses}
              />
            </Field>
          </div>
        )}

        {/* Live preview + existing-session hint */}
        <div className="space-y-2 rounded-lg border border-neutral-800 bg-black px-3 py-2 text-xs">
          {sessionPreview.ok ? (
            <>
              <div>
                <span className="text-neutral-500">Carpeta: </span>
                <span className="font-mono text-neutral-200">
                  {sessionPreview.level4}
                </span>
              </div>
              {sessionInfo?.exists && (
                <div className="text-amber-400">
                  Sesión existente — {sessionInfo.uploadedCount} fotos
                  subidas. Las nuevas seguirán en{" "}
                  <span className="font-mono">
                    _{String(sessionInfo.nextSeq).padStart(4, "0")}
                  </span>
                  …
                </div>
              )}
            </>
          ) : (
            <span className="text-amber-400">{sessionPreview.error}</span>
          )}
        </div>
      </div>

      {/* ─── Dropzone ───────────────────────────────── */}
      <div className="relative">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (canStage) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
            !canStage
              ? "cursor-not-allowed border-neutral-800 bg-neutral-950/50"
              : isDragging
                ? "cursor-pointer border-white bg-neutral-800"
                : "cursor-pointer border-neutral-700 hover:border-neutral-500"
          }`}
          onClick={() => {
            if (!canStage) return;
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ACCEPT_ATTR;
            input.onchange = () => {
              if (input.files) addFiles(input.files);
            };
            input.click();
          }}
        >
          <svg
            className="mb-3 h-10 w-10 text-neutral-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-neutral-400">
            Arrastra fotos aquí o haz click para seleccionar
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} — hasta
            500 MB
          </p>
        </div>

        {!canStage && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl">
            <span className="rounded-md bg-black/80 px-3 py-1.5 text-xs text-neutral-300">
              Rellena los metadatos de la sesión
            </span>
          </div>
        )}
      </div>

      {/* ─── Staging area + per-tile state ──────────── */}
      {tiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>
              {counts.total} foto{counts.total === 1 ? "" : "s"} —{" "}
              {counts.done} subida{counts.done === 1 ? "" : "s"}
              {counts.failed > 0 ? `, ${counts.failed} con error` : ""}
              {counts.inFlight > 0 ? `, ${counts.inFlight} en curso` : ""}
            </span>
            <button
              type="button"
              disabled={!canSave}
              onClick={saveAll}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                canSave
                  ? "bg-white text-black hover:bg-neutral-200 active:scale-[0.98]"
                  : "cursor-not-allowed bg-neutral-800 text-neutral-500"
              }`}
            >
              {saving
                ? "Guardando…"
                : counts.failed > 0
                  ? `Reintentar ${counts.savable}`
                  : `Guardar ${counts.savable}`}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {tiles.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                onRemove={() => removeTile(tile.id)}
                onCancel={() => cancelTile(tile.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tile view ───────────────────────────────────────────

function TileView({
  tile,
  onRemove,
  onCancel,
}: {
  tile: Tile;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const { status, progress, preview, file, error, storedFilename } = tile;

  const bgClass =
    status === "done"
      ? "bg-green-900/50"
      : status === "error" || status === "cancelled"
        ? "bg-red-900/60"
        : status === "duplicate"
          ? "bg-yellow-900/50"
          : status === "unsupported"
            ? "bg-neutral-900/80"
            : status === "uploading" || status === "processing"
              ? "bg-black/50"
              : "bg-black/30";

  const inFlight =
    status === "hashing" ||
    status === "initializing" ||
    status === "uploading" ||
    status === "processing";

  const canRemove = !inFlight;
  const canCancel = status === "uploading";

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-800"
      title={error ?? storedFilename ?? file.name}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={file.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-[10px] text-neutral-500">
          <span className="font-mono">{file.name.slice(-20)}</span>
        </div>
      )}

      {/* Progress bar for upload */}
      {status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
          <div
            className="h-full bg-white transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* Overlay */}
      <div
        className={`absolute inset-0 flex items-center justify-center text-xs font-medium text-white ${bgClass}`}
      >
        {status === "staged" && (
          <span className="text-neutral-300">En cola</span>
        )}
        {status === "queued" && (
          <span className="text-neutral-300">Listo</span>
        )}
        {status === "hashing" && (
          <Spinner label={`${humanSize(file.size)}…`} />
        )}
        {status === "initializing" && <Spinner label="Prep." />}
        {status === "uploading" && (
          <span className="font-mono">{Math.round(progress * 100)}%</span>
        )}
        {status === "processing" && <Spinner label="Proc." />}
        {status === "done" && <span>✓</span>}
        {status === "duplicate" && <span>Duplicada</span>}
        {status === "unsupported" && <span>No soportado</span>}
        {status === "cancelled" && <span>Cancelado</span>}
        {status === "error" && (
          <span className="px-1 text-center text-[10px]">
            {truncate(error ?? "Error", 40)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:bg-black"
            title="Cancelar"
          >
            Cancelar
          </button>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded bg-black/70 px-1.5 text-[10px] text-white hover:bg-black"
            title="Quitar"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────

const inputClasses =
  "w-full rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 disabled:opacity-50";

function Field({
  label,
  children,
  preview,
  hint,
  toggle,
}: {
  label: string;
  children: React.ReactNode;
  preview?: string;
  hint?: string;
  toggle?: { label: string; value: boolean; onChange: (v: boolean) => void };
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        {toggle && (
          <button
            type="button"
            onClick={() => toggle.onChange(!toggle.value)}
            className={`rounded border px-2 py-0.5 text-[10px] ${
              toggle.value
                ? "border-white bg-white text-black"
                : "border-neutral-700 text-neutral-300"
            }`}
          >
            {toggle.label}
          </button>
        )}
      </div>
      {children}
      {preview !== undefined && (
        <p className="font-mono text-[11px] text-neutral-500">
          {preview ? `→ ${preview}` : ""}
        </p>
      )}
      {hint && <p className="text-[11px] text-neutral-600">{hint}</p>}
    </label>
  );
}

function Spinner({ label }: { label?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
      {label && <span className="text-[10px]">{label}</span>}
    </span>
  );
}

function safeSlug(input: string): string {
  try {
    return input.trim() === "" ? "" : normalizeSlug(input);
  } catch {
    return "";
  }
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ─── SHA-256 client-side ────────────────────────────────

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

// ─── Drive resumable PUT with progress ──────────────────

function uploadToDriveResumable({
  url,
  file,
  signal,
  onProgress,
}: {
  url: string;
  file: File;
  signal: AbortSignal;
  onProgress: (p: number) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          if (body && typeof body.id === "string") {
            resolve(body.id);
            return;
          }
          reject(new Error("Drive response missing file id"));
        } catch {
          reject(new Error("Drive response not JSON"));
        }
      } else {
        reject(new Error(`Drive upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error uploading to Drive"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });
}

// ─── Simple concurrency limiter ─────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(limit, queue.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) return;
        try {
          await task(item);
        } catch (e) {
          console.error("worker task failed:", e);
        }
      }
    }
  );
  await Promise.all(workers);
}
