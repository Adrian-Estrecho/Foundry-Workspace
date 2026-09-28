import Link from "next/link";
import { FoundryLogo } from "@/components/brand/logo";
import { AccentStyle } from "@/components/theme/accent-style";
import { getBranding } from "@/lib/branding";

/** Public pages (client intake, editor application): no login, company accent. */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const { defaultAccent, companyName } = await getBranding();

  return (
    <>
      <AccentStyle accent={defaultAccent} />
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-10 flex items-center justify-between">
          <FoundryLogo />
          <span className="text-sm text-muted-foreground">{companyName}</span>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          © {companyName} · <Link href="/login" className="hover:text-foreground">Team sign in</Link>
        </footer>
      </div>
    </>
  );
}
