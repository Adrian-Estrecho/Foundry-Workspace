import { AccentStyle } from "@/components/theme/accent-style";
import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";

/** The company a public page belongs to, in its accent colour. */
export function PublicHeader({ name, accent }: { name: string; accent: string }) {
  return (
    <>
      <AccentStyle accent={accent} />
      <header className="mb-10 flex items-center gap-3">
        <WorkspaceTile name={name} className="size-9 text-base" />
        <span className="font-heading text-lg font-semibold tracking-tight">{name}</span>
      </header>
    </>
  );
}

/** For links that don't lead anywhere: an unknown or closed company. */
export function PublicNotice({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto mt-10 max-w-lg rounded-xl border bg-card p-10 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </section>
  );
}
