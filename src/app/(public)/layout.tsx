import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

/**
 * Public pages (client intake, editor application): no login. Each page
 * shows the company it belongs to and sets that company's accent.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6">
      <main className="flex-1">{children}</main>
      <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <LogoMark className="size-4" />
        Runs on ReEdit · <Link href="/login" className="hover:text-foreground">Sign in</Link>
      </footer>
    </div>
  );
}
