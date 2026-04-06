"use client";

import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Cuenta</h2>
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

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Google Drive</h2>
        <p className="mt-2 text-xs text-neutral-500">
          Tus fotos se almacenan en la carpeta &quot;Chikiluki Gallery&quot; de
          tu Google Drive. Solo la app puede acceder a esa carpeta.
        </p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
