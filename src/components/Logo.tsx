import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#4f46e5" />
      <path d="M9 8h9.5a6.5 6.5 0 0 1 0 13H13v3.5L9 21V8Z" fill="#fff" />
      <path d="M13 12h5.2a2.5 2.5 0 0 1 0 5H13v-5Z" fill="#4f46e5" />
      <circle cx="23.5" cy="24" r="2.5" fill="#a5b4fc" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
      <LogoMark />
      <span className="text-lg">DigestBot</span>
    </Link>
  );
}
