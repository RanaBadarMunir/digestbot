import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Free. Your first digest is minutes away.</p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}
