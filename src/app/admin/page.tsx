import type { Metadata } from "next";
import { AdminView } from "@/components/AdminView";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  return <AdminView selfId={admin.id} />;
}
