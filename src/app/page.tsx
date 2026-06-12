import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/photos");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="space-y-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
          Galería fotográfica
        </p>
        <h1 className="text-5xl font-extralight tracking-tight text-white sm:text-6xl">
          Chikiluki Gallery
        </h1>
        <p className="mx-auto max-w-md text-base font-light text-neutral-400">
          Gestiona, organiza y comparte tus fotografías analógicas y digitales.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-sm border border-white/20 px-8 py-3 text-[13px] uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-black"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
