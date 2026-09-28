import { HammerIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/panel";

/**
 * Placeholder for modules delivered in later build phases, so navigation
 * never dead-ends. Each one lists what the module will do.
 */
export function ComingSoon({
  title,
  description,
  phase,
  features,
}: {
  title: string;
  description: string;
  phase: number;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="grid gap-6 rounded-xl border bg-card p-6 sm:p-8 md:grid-cols-[auto_1fr]">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <HammerIcon className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-primary">Arrives in Phase {phase}</p>
          <h2 className="mt-1 font-heading text-xl font-medium">What you&apos;ll be able to do here</h2>
          <ul className="mt-4 grid gap-2.5 text-muted-foreground sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
