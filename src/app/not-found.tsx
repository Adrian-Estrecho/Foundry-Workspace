import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md rounded-xl border bg-card p-10 text-center">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
