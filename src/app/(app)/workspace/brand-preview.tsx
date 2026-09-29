import type { CSSProperties } from "react";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";
import { brandTokens } from "@/lib/theme";

/**
 * A small copy of the public application page in the brand being edited.
 * The accent is scoped to this box, so the rest of the app keeps the
 * viewer's own colour while they try one out.
 */
export function BrandPreview({
  name,
  accent,
  logoUrl,
  address,
  accepting,
}: {
  name: string;
  accent: string;
  logoUrl: string | null;
  address: string;
  accepting: boolean;
}) {
  const shownName = name.trim() || "Your workspace";

  return (
    <figure className="grid content-start gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview · your application page</figcaption>
      <div
        aria-hidden="true"
        style={brandTokens(accent) as CSSProperties}
        className="overflow-hidden rounded-xl border bg-background select-none [--primary-foreground:var(--brand-fg-light)] [--primary:var(--brand-light)] dark:[--primary-foreground:var(--brand-fg-dark)] dark:[--primary:var(--brand-dark)]"
      >
        <div className="flex items-center gap-2 border-b bg-surface px-3 py-2">
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-2 rounded-full bg-border" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-0.5 text-center text-[10px] text-muted-foreground">
            {address}
          </span>
        </div>

        <div className="grid gap-4 p-4">
          <div className="flex items-center gap-2">
            <WorkspaceTile name={shownName} logoUrl={logoUrl} className="size-6 text-xs" />
            <span className="truncate font-heading text-sm font-semibold tracking-tight">{shownName}</span>
          </div>

          {accepting ? (
            <>
              <div>
                <p className="text-[10px] font-medium text-primary">Join the team</p>
                <p className="mt-1 font-heading text-base leading-tight font-semibold tracking-tight">Edit with {shownName}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Tell us about your editing. If it&apos;s a match, we&apos;ll invite you.</p>
              </div>
              <div className="grid gap-2">
                {["Full name", "Portfolio link"].map((label) => (
                  <div key={label} className="grid gap-1">
                    <span className="text-[10px] font-medium">{label}</span>
                    <span className="h-6 rounded-md border bg-input/30" />
                  </div>
                ))}
              </div>
              <span className="inline-flex h-7 w-fit items-center rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground">
                Send application
              </span>
            </>
          ) : (
            <div className="rounded-lg border bg-card px-3 py-5 text-center">
              <p className="font-heading text-sm font-semibold">{shownName} isn&apos;t hiring right now</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Applicants see this while applications are off.</p>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
