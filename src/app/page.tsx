import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/photos");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Chikiluki Gallery
        </h1>
        <p className="mx-auto max-w-md text-lg text-neutral-400">
          Gestiona, organiza y comparte tus fotografías analógicas y digitales.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
