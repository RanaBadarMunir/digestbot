import type { Metadata } from "next";
import { ExtensionView } from "@/components/ExtensionView";

export const metadata: Metadata = { title: "Browser extension" };

export default async function ExtensionPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <ExtensionView fromExtension={from === "extension"} />;
}
