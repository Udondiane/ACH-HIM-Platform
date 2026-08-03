import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl">
        <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
          Holistic Impact Metric · Azure-native
        </div>
        <h1 className="font-serif text-[38px] tracking-[-0.01em] leading-[1.05] text-ach-navy font-medium mb-4">
          ACH's impact platform, in the Microsoft environment.
        </h1>
        <p className="text-[15px] text-ach-navy/75 leading-relaxed mb-8">
          Single sign-on with your ACH Microsoft account. No per-user licence fees.
          All data stays in the ACH Azure tenant.
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-[8px] bg-ach-navy text-ach-cream text-[13px] hover:bg-ach-navy/90"
          >
            Open dashboard
          </Link>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center px-4 py-2 rounded-[8px] border border-ach-border text-ach-navy text-[13px] hover:bg-ach-page"
          >
            Sign in with Microsoft
          </Link>
        </div>
        <div className="mt-10 text-[11px] font-mono uppercase tracking-[1.4px] text-ach-navy/45">
          Runtime · Azure Static Web Apps · PostgreSQL Flexible Server · Blob Storage · Entra ID
        </div>
      </div>
    </div>
  );
}
