import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#e0e7ff_0%,#f7f7fb_60%)] px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="card w-full max-w-sm p-6 sm:p-8">{children}</div>
    </div>
  );
}
