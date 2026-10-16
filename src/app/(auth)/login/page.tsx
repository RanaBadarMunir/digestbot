import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Log in to your reading queue and digests.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
