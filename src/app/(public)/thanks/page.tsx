import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";

export const metadata: Metadata = { title: "Thank you" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  intake: {
    title: "Thanks, we've got your project details",
    body: "Someone from Foundry Media will review them and reach out, usually within one business day.",
  },
  apply: {
    title: "Thanks for applying",
    body: "We review every application. If it's a match, we'll email you a short test edit.",
  },
  test: {
    title: "Thanks, we've got your test edit",
    body: "We'll watch it and get back to you by email.",
  },
};

export default async function ThanksPage(props: PageProps<"/thanks">) {
  const { form } = await props.searchParams;
  const message = MESSAGES[typeof form === "string" ? form : ""] ?? MESSAGES.intake;

  return (
    <section className="mx-auto max-w-lg rounded-xl border bg-card p-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/15 text-success ring-1 ring-success/30">
        <CheckIcon className="size-7" />
      </span>
      <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-balance">{message.title}</h1>
      <p className="mt-3 text-muted-foreground">{message.body}</p>
    </section>
  );
}
