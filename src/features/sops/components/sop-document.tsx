import { WorkspaceTile } from "@/features/workspaces/components/workspace-switcher";
import { cn } from "@/lib/utils";
import type { Enums, Json } from "@/types/database";
import { outlineOf, readingMinutes } from "../blocks";
import { SOP_CATEGORY_LABEL } from "../constants";
import { SopContent } from "./sop-content";

export type SopWorkspace = { name: string; logoUrl: string | null };

/**
 * An SOP laid out like a printed handbook page: white paper (whatever the
 * app theme), a title block, contents, and a book serif for the text. It's
 * what editors read and what admins preview. Sized by its container, so a
 * phone-width preview looks like a phone.
 */
export function SopDocument({
  title,
  category,
  content,
  required,
  draft,
  updatedAt,
  workspace,
  className,
}: {
  title: string;
  category: Enums<"sop_category">;
  content: Json;
  required?: boolean;
  draft?: boolean;
  updatedAt?: string | null;
  workspace: SopWorkspace;
  className?: string;
}) {
  const outline = outlineOf(content);
  const sections = outline.filter((entry) => entry.level === 2);
  // Number the sections like chapters, unless the writer already numbered them.
  const numbers =
    sections.length >= 2 && !sections.some((entry) => /^\d+[.):]?\s/.test(entry.text))
      ? new Map(sections.map((entry, index) => [entry.id, String(index + 1)]))
      : undefined;
  const meta = [
    updatedAt && `Updated ${new Date(updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    `${readingMinutes(content)} min read`,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "sop-paper @container mx-auto w-full max-w-[52rem] rounded-sm bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08),0_16px_40px_-16px_rgb(0_0_0/0.35)] ring-1 ring-black/5",
        className,
      )}
    >
      <div className="px-6 py-8 @lg:px-12 @lg:py-12 @3xl:px-20 @3xl:py-16">
        <header>
          <div className="flex items-center justify-between gap-4 border-b pb-4 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-2">
              <WorkspaceTile name={workspace.name} logoUrl={workspace.logoUrl} className="size-6 text-xs" />
              <span className="truncate font-medium text-foreground">{workspace.name}</span>
            </span>
            <span className="shrink-0 tracking-[0.14em] uppercase">
              <span className="@lg:hidden">SOP</span>
              <span className="hidden @lg:inline">Standard operating procedure</span>
            </span>
          </div>

          <p className="mt-10 text-xs font-semibold tracking-[0.16em] text-primary uppercase @lg:mt-14">{SOP_CATEGORY_LABEL[category]}</p>
          <h1 className="mt-3 font-serif text-[1.875rem] leading-[1.15] font-semibold tracking-tight text-balance @lg:text-[2.5rem]">
            {title.trim() || "Untitled SOP"}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {draft && <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Draft</span>}
            {required && <span className="rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary">Required reading</span>}
            {meta.map((item, index) => (
              <span key={index} className="flex items-center gap-3">
                {(index > 0 || draft || required) && <span aria-hidden="true">·</span>}
                {item}
              </span>
            ))}
          </div>
        </header>

        {outline.length >= 2 && (
          <nav aria-label="Contents" className="mt-10 rounded-lg bg-surface px-5 py-4 ring-1 ring-border">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Contents</p>
            <ol className="mt-3 grid gap-1.5 text-sm">
              {outline.map((entry) => (
                <li key={entry.id} className={cn(entry.level === 3 && (numbers ? "pl-7" : "pl-4"), entry.level === 3 && "text-muted-foreground")}>
                  <a href={`#${entry.id}`} className="inline-flex gap-3 transition-colors hover:text-primary">
                    {numbers?.has(entry.id) && <span className="tabular w-4 shrink-0 text-primary">{numbers.get(entry.id)}</span>}
                    {entry.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="sop-prose mt-10">
          <SopContent content={content} numbers={numbers} />
        </div>

        <footer className="mt-16 flex items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span className="truncate">
            {workspace.name} · {title.trim() || "Untitled SOP"}
          </span>
          <span className="shrink-0">End of SOP</span>
        </footer>
      </div>
    </article>
  );
}
