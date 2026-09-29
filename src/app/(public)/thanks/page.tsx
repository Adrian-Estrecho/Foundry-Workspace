import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";
import { getBranding } from "@/lib/branding";
import { PublicHeader } from "../public-header";

export const metadata: Metadata = { title: "Thank you" };

const messages = (company: string): Record<string, { title: string; body: string }> => ({
  intake: {
    title: "Thanks, we've got your project details",
    body: `Someone from ${company} will review them and reach out, usually within one business day.`,
  },
  apply: {
    title: "Thanks for applying",
    body: `${company} reviews every application. If it's a match, you'll get an email inviting you to join the team.`,
  },
  test: {
    title: "Thanks, we've got your test edit",
    body: "We'll watch it and get back to you by email.",
  },
});

/** After a public form. `w` is the workspace slug, for its name and accent. */
export default async function ThanksPage(props: PageProps<"/thanks">) {
  const { form, w } = await props.searchParams;
  const branding = typeof w === "string" ? await getBranding(w) : null;
  const all = messages(branding?.name ?? "the team");
  const message = all[typeof form === "string" ? form : ""] ?? all.intake;

  return (
    <>
      {branding && <PublicHeader name={branding.name} accent={branding.defaultAccent} logoUrl={branding.logoUrl} />}
      <section className="mx-auto max-w-lg rounded-xl border bg-card p-10 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/15 text-success ring-1 ring-success/30">
          <CheckIcon className="size-7" />
        </span>
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-balance">{message.title}</h1>
        <p className="mt-3 text-muted-foreground">{message.body}</p>
      </section>
    </>
  );
}
