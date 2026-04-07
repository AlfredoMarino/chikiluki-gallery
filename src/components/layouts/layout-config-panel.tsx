"use client";

import { useState } from "react";
import type { LayoutConfig } from "@/types";

interface LayoutConfigPanelProps {
  config: LayoutConfig;
  onSave: (config: Partial<LayoutConfig>) => void;
}

const layoutOptions = [
  { value: "grid", label: "Grid", desc: "Cuadr\u00edcula uniforme" },
  { value: "masonry", label: "Masonry", desc: "Alturas variables" },
  { value: "list", label: "Lista", desc: "Una foto por fila" },
  { value: "collage", label: "Collage", desc: "Tama\u00f1os variables" },
];

const mobileBehaviorOptions = [
  { value: "stack", label: "Apilar verticalmente" },
  { value: "scroll-horizontal", label: "Scroll horizontal" },
  { value: "rotate-hint", label: "Sugerir rotar dispositivo" },
];

export function LayoutConfigPanel({ config, onSave }: LayoutConfigPanelProps) {
  const [form, setForm] = useState({
    layoutType: config.layoutType,
    columnsMobile: config.columnsMobile,
    columnsTablet: config.columnsTablet,
    columnsDesktop: config.columnsDesktop,
    gap: config.gap,
    forceOrientation: config.forceOrientation,
    mobileBehavior: config.mobileBehavior,
  });

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
  };

  return (
    <div className="space-y-6">
      {/* Layout type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-300">
          Tipo de layout
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {layoutOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("layoutType", opt.value)}
              className={`rounded-lg border p-3 text-left transition ${
                form.layoutType === opt.value
                  ? "border-blue-500 bg-blue-950/50"
                  : "border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <span className="text-sm font-medium text-white">
                {opt.label}
              </span>
              <p className="mt-0.5 text-xs text-neutral-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-400">
            Columnas (m\u00f3vil)
          </label>
          <input
            type="number"
            min={1}
            max={4}
            value={form.columnsMobile}
            onChange={(e) => update("columnsMobile", parseInt(e.target.value))}
            className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-neutral-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">
            Columnas (tablet)
          </label>
          <input
            type="number"
            min={1}
            max={6}
            value={form.columnsTablet}
            onChange={(e) => update("columnsTablet", parseInt(e.target.value))}
            className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-neutral-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">
            Columnas (desktop)
          </label>
          <input
            type="number"
            min={1}
            max={8}
            value={form.columnsDesktop}
            onChange={(e) => update("columnsDesktop", parseInt(e.target.value))}
            className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-neutral-600"
          />
        </div>
      </div>

      {/* Gap */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          Espacio entre fotos: {form.gap}px
        </label>
        <input
          type="range"
          min={0}
          max={24}
          step={2}
          value={form.gap}
          onChange={(e) => update("gap", parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Force orientation */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">Forzar orientaci\u00f3n</p>
          <p className="text-xs text-neutral-400">
            Las fotos horizontales se muestran mejor en landscape
          </p>
        </div>
        <button
          onClick={() => update("forceOrientation", !form.forceOrientation)}
          className={`relative h-6 w-11 rounded-full transition ${
            form.forceOrientation ? "bg-blue-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
              form.forceOrientation ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile behavior for landscape photos */}
      <div>
        <label className="mb-2 block text-xs text-neutral-400">
          Fotos landscape en m\u00f3vil portrait
        </label>
        <div className="flex flex-wrap gap-2">
          {mobileBehaviorOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                update("mobileBehavior", {
                  ...form.mobileBehavior,
                  landscapeInPortrait: opt.value,
                })
              }
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                form.mobileBehavior?.landscapeInPortrait === opt.value
                  ? "border-blue-500 bg-blue-950/50 text-white"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 active:scale-[0.98]"
      >
        Guardar configuraci\u00f3n
      </button>
    </div>
  );
}
