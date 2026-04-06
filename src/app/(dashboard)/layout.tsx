import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { DashboardShell } from "@/components/ui/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
