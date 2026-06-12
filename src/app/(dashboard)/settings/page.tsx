"use client";

import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light tracking-tight">Ajustes</h1>

      <div className="rounded-sm border border-white/10 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Cuenta</h2>
        <div className="mt-3 flex items-center gap-3">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt=""
              className="h-10 w-10 rounded-full"
            />
          )}
          <div>
            <p className="text-sm text-white">{session?.user?.name}</p>
            <p className="text-xs text-neutral-500">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-white/10 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Google Drive</h2>
        <p className="mt-2 text-xs text-neutral-500">
          Tus fotos se almacenan en la carpeta &quot;Chikiluki Gallery&quot; de
          tu Google Drive. Solo la app puede acceder a esa carpeta.
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-sm border border-red-900/60 px-4 py-2 text-sm text-red-400/90 transition hover:border-red-700 hover:text-red-300"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
