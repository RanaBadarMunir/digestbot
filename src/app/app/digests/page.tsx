import type { Metadata } from "next";
import { DigestList } from "@/components/DigestList";

export const metadata: Metadata = { title: "Digests" };

export default function DigestsPage() {
  return <DigestList />;
}
