"use client";

/**
 * Panel derecho (patrón inspector) de la configuración de colecciones.
 * Componente controlado puro: todo el estado vive en la página.
 *
 * El tab de dispositivo controla DOS cosas a la vez: el ancho simulado del
 * lienzo y qué campo de columnas edita el slider contextual único.
 */

export type Device = "mobile" | "tablet" | "desktop";
export type SaveStatus = "idle" | "saving" | "saved";

export interface LayoutForm {
  layoutType: string;
  columnsMobile: number;
  columnsTablet: number;
  columnsDesktop: number;
  gap: number;
  forceOrientation: boolean;
  mobileBehavior: {
    landscapeInPortrait: "stack" | "scroll-horizontal" | "rotate-hint";
    maxPhotosPerRow: number;
  };
  photoOverrides: Record<string, { span: number; aspect?: string }>;
}

const layoutOptions = [
  { value: "grid", label: "Grid", icon: "▦" },
  { value: "masonry", label: "Masonry", icon: "▥" },
  { value: "list", label: "Lista", icon: "▤" },
  { value: "collage", label: "Collage", icon: "▧" },
];

const devices: { value: Device; label: string; maxColumns: number }[] = [
  { value: "mobile", label: "Móvil", maxColumns: 4 },
  { value: "tablet", label: "Tablet", maxColumns: 6 },
  { value: "desktop", label: "Desktop", maxColumns: 8 },
];

const mobileBehaviorOptions = [
  { value: "stack", label: "Apilar verticalmente" },
  { value: "scroll-horizontal", label: "Scroll horizontal" },
  { value: "rotate-hint", label: "Sugerir rotar" },
] as const;

const columnsKeyByDevice: Record<Device, keyof LayoutForm> = {
  mobile: "columnsMobile",
  tablet: "columnsTablet",
  desktop: "columnsDesktop",
};

interface LayoutInspectorProps {
  form: LayoutForm;
  device: Device;
  onDeviceChange: (device: Device) => void;
  update: (key: string, value: unknown) => void;
  saveStatus: SaveStatus;
  photoCount: number;
}

export function LayoutInspector({
  form,
  device,
  onDeviceChange,
  update,
  saveStatus,
  photoCount,
}: LayoutInspectorProps) {
  const activeDevice = devices.find((d) => d.value === device)!;
  const columnsKey = columnsKeyByDevice[device];
  const columnsValue = form[columnsKey] as number;

  return (
    <div className="space-y-6">
      {/* Header del inspector: contexto + estado de guardado */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">
          {photoCount} fotos · {form.layoutType}
        </p>
        <p
          className={`text-[11px] transition-opacity ${
            saveStatus === "saving"
              ? "text-neutral-400"
              : saveStatus === "saved"
                ? "text-neutral-300"
                : "opacity-0"
          }`}
          aria-live="polite"
        >
          {saveStatus === "saving" ? "Guardando…" : "Guardado ✓"}
        </p>
      </div>

      {/* Tipo de layout */}
      <section className="rounded-sm border border-white/10 p-4">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
          Tipo
        </h2>
        <div className="grid grid-cols-4 gap-1.5">
          {layoutOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("layoutType", opt.value)}
              className={`flex flex-col items-center gap-1 rounded-sm border py-2.5 transition ${
                form.layoutType === opt.value
                  ? "border-white bg-white/10"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              <span className="text-base leading-none">{opt.icon}</span>
              <span className="text-[10px] text-neutral-300">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Dispositivo + columnas contextuales */}
      <section className="rounded-sm border border-white/10 p-4">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
          Dispositivo
        </h2>
        <div className="flex rounded-sm border border-white/10">
          {devices.map((d) => (
            <button
              key={d.value}
              onClick={() => onDeviceChange(d.value)}
              className={`flex-1 py-1.5 text-[11px] transition ${
                device === d.value
                  ? "bg-white/10 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Slider contextual — list ignora columnas */}
        {form.layoutType !== "list" && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs text-neutral-400">
                Columnas en {activeDevice.label.toLowerCase()}
              </label>
              <span className="text-xs text-neutral-500">{columnsValue}</span>
            </div>
            <input
              type="range"
              min={1}
              max={activeDevice.maxColumns}
              value={columnsValue}
              onChange={(e) => update(columnsKey, parseInt(e.target.value))}
              className="mt-1 w-full"
            />
            {/* Valores fantasma: el estado de los otros dispositivos no se oculta */}
            <p className="mt-1 text-right text-[10px] text-neutral-600">
              móvil {form.columnsMobile} · tablet {form.columnsTablet} · desktop{" "}
              {form.columnsDesktop}
            </p>
          </div>
        )}
      </section>

      {/* Gap */}
      <section className="rounded-sm border border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
            Espacio
          </h2>
          <span className="text-xs text-neutral-500">{form.gap}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={32}
          step={2}
          value={form.gap}
          onChange={(e) => update("gap", parseInt(e.target.value))}
          className="mt-2 w-full"
        />
      </section>

      {/* Comportamiento */}
      <section className="rounded-sm border border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">
              Forzar orientacion
            </h2>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              Fotos landscape se ven mejor en horizontal
            </p>
          </div>
          <button
            onClick={() => update("forceOrientation", !form.forceOrientation)}
            className={`relative h-6 w-11 rounded-full transition ${
              form.forceOrientation ? "bg-white" : "bg-neutral-800"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition ${
                form.forceOrientation ? "translate-x-5 bg-black" : "bg-white"
              }`}
            />
          </button>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-neutral-400">
            Landscape en movil portrait
          </label>
          <div className="flex flex-wrap gap-1.5">
            {mobileBehaviorOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  update("mobileBehavior", {
                    ...form.mobileBehavior,
                    landscapeInPortrait: opt.value,
                  })
                }
                className={`rounded-sm border px-2 py-1 text-[10px] transition ${
                  form.mobileBehavior?.landscapeInPortrait === opt.value
                    ? "border-white bg-white/10 text-white"
                    : "border-white/10 text-neutral-500 hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Ayuda contextual */}
      <p className="text-[10px] leading-relaxed text-neutral-600">
        Arrastra las fotos en el lienzo para reordenar.
        {form.layoutType === "collage" &&
          " Toca una foto para cambiar su tamaño."}{" "}
        Los cambios se guardan automáticamente.
      </p>
    </div>
  );
}
