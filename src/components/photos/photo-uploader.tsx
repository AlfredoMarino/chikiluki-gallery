"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  InvalidSessionInputError,
  buildLevel4Folder,
  getExtensionFromFile,
  normalizeSlug,
  validateSession,
  type Session,
} from "@/lib/drive/path";

type UploadStatus =
  | "pending"
  | "uploading"
  | "done"
  | "error"
  | "duplicate"
  | "unsupported";

interface UploadingFile {
  file: File;
  progress: UploadStatus;
  preview: string;
  errorMessage?: string;
}

type Medium = "digital" | "film";

interface FormState {
  medium: Medium;
  camera: string;
  date: string; // HTML date input: YYYY-MM-DD
  // digital
  description: string;
  // film
  stock: string;
  stockUnknown: boolean;
  iso: string;
  isoUnknown: boolean;
  descriptors: string;
}

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

export function PhotoUploader({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Derive a validated session (or an error) from the form state. This gates
  // the dropzone and powers the live level4 preview.
  const sessionPreview = useMemo<
    { ok: true; session: Session; level4: string } | { ok: false; error: string }
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

  const ready = sessionPreview.ok;

  // Pure-client slug previews. The server re-normalizes on every upload; this
  // is only so the user sees what will be stored.
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

  const addFiles = useCallback(
    (fileList: FileList) => {
      if (!ready) return;

      const incoming: UploadingFile[] = Array.from(fileList).map((file) => {
        try {
          getExtensionFromFile(file.name);
          return {
            file,
            progress: "pending",
            preview: URL.createObjectURL(file),
          };
        } catch (e) {
          return {
            file,
            progress: "unsupported",
            preview: URL.createObjectURL(file),
            errorMessage:
              e instanceof InvalidSessionInputError ? e.message : "No soportado",
          };
        }
      });

      setFiles((prev) => [...prev, ...incoming]);

      for (const uf of incoming) {
        if (uf.progress === "pending") {
          void uploadFile(uf);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, form]
  );

  const uploadFile = async (uf: UploadingFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.file === uf.file ? { ...f, progress: "uploading" } : f
      )
    );

    const formData = new FormData();
    formData.append("file", uf.file);
    formData.append("medium", form.medium);
    formData.append("camera", form.camera);
    formData.append("date", form.date);
    if (form.medium === "digital") {
      formData.append("description", form.description);
    } else {
      formData.append("stock", form.stockUnknown ? "x" : form.stock);
      formData.append("iso", String(form.isoUnknown ? 0 : form.iso));
      if (form.descriptors.trim()) {
        formData.append("descriptors", form.descriptors);
      }
    }

    try {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (res.status === 409) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uf.file ? { ...f, progress: "duplicate" } : f
          )
        );
        return;
      }

      if (!res.ok) {
        let message = "Error";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore non-JSON body
        }
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uf.file
              ? { ...f, progress: "error", errorMessage: message }
              : f
          )
        );
        return;
      }

      setFiles((prev) =>
        prev.map((f) => (f.file === uf.file ? { ...f, progress: "done" } : f))
      );
      onUploadComplete?.();
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === uf.file
            ? { ...f, progress: "error", errorMessage: "Red" }
            : f
        )
      );
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!ready) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, ready]
  );

  const resetSession = () => {
    // Revoke blob URLs to avoid leaks.
    for (const f of files) URL.revokeObjectURL(f.preview);
    setFiles([]);
    setForm(INITIAL_FORM);
  };

  const completedCount = files.filter((f) => f.progress === "done").length;
  const totalCount = files.length;

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

        {/* Live preview */}
        <div className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-xs">
          {sessionPreview.ok ? (
            <span className="text-neutral-400">
              Carpeta:{" "}
              <span className="font-mono text-neutral-200">
                {sessionPreview.level4}
              </span>
            </span>
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
            if (ready) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
            !ready
              ? "cursor-not-allowed border-neutral-800 bg-neutral-950/50"
              : isDragging
                ? "cursor-pointer border-white bg-neutral-800"
                : "cursor-pointer border-neutral-700 hover:border-neutral-500"
          }`}
          onClick={() => {
            if (!ready) return;
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
            {ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}
          </p>
        </div>

        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl">
            <span className="rounded-md bg-black/80 px-3 py-1.5 text-xs text-neutral-300">
              Rellena los metadatos de la sesión
            </span>
          </div>
        )}
      </div>

      {/* ─── Upload progress ────────────────────────── */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-400">
            {completedCount}/{totalCount} subidas
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {files.map((uf, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg"
                title={uf.errorMessage}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uf.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${
                    uf.progress === "uploading"
                      ? "bg-black/60"
                      : uf.progress === "done"
                        ? "bg-green-900/60"
                        : uf.progress === "error"
                          ? "bg-red-900/70"
                          : uf.progress === "duplicate"
                            ? "bg-yellow-900/60"
                            : uf.progress === "unsupported"
                              ? "bg-neutral-900/80"
                              : "bg-black/40"
                  }`}
                >
                  {uf.progress === "uploading" && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {uf.progress === "done" && "✓"}
                  {uf.progress === "error" && "Error"}
                  {uf.progress === "duplicate" && "Dup"}
                  {uf.progress === "unsupported" && "No soportado"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
      {preview && (
        <p className="font-mono text-[11px] text-neutral-500">
          {preview ? `→ ${preview}` : ""}
        </p>
      )}
      {hint && <p className="text-[11px] text-neutral-600">{hint}</p>}
    </label>
  );
}

/**
 * normalizeSlug-but-swallow-errors for live form previews. Empty input shows
 * nothing rather than an error; the real validation happens in sessionPreview.
 */
function safeSlug(input: string): string {
  try {
    return input.trim() === "" ? "" : normalizeSlug(input);
  } catch {
    return "";
  }
}
