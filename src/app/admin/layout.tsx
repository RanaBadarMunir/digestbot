import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/app");
  return <AppShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</AppShell>;
}
