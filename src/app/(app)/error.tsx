"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border bg-card p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger/12 text-danger ring-1 ring-danger/25">
        <TriangleAlertIcon className="size-5" />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page couldn&apos;t load. Try again; if it keeps happening, share this code with your admin:{" "}
        <span className="font-mono">{error.digest ?? "n/a"}</span>
      </p>
      <Button onClick={reset} className="mt-6">
        <RotateCcwIcon /> Try again
      </Button>
    </div>
  );
}
