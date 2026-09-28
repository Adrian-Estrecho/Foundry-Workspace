import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { checkLinkSignature } from "@/lib/form-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstName } from "@/lib/utils";
import { TestEditForm } from "./test-edit-form";

export const metadata: Metadata = {
  title: "Send your test edit",
  robots: { index: false },
};

/** Reached from the signed link in an applicant's test-edit email. */
export default async function TestEditPage(props: PageProps<"/apply/test">) {
  const { a, s } = await props.searchParams;
  const valid = typeof a === "string" && typeof s === "string" && checkLinkSignature("test-edit", a, s);

  const applicant = valid
    ? (
        await createAdminClient()
          .from("applicants")
          .select("full_name, stage, test_submission_url")
          .eq("id", a)
          .maybeSingle()
      ).data
    : null;

  if (!valid || !applicant) {
    return <Message title="This link isn't valid" body="Use the button in your test-edit email, or reply to that email and we'll help." />;
  }
  if (applicant.stage !== "test_edit_sent" && applicant.stage !== "test_submitted") {
    return <Message title="This test edit is closed" body="Thanks for your interest. If you think that's a mistake, reply to our email." />;
  }

  const submitted = applicant.stage === "test_submitted";
  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Test edit</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-balance">
          {submitted ? "We've got your edit" : `Send us your edit, ${firstName(applicant.full_name)}`}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {submitted
            ? "We'll review it soon. Need to swap the link for a newer version? Send it below."
            : "Upload your finished edit anywhere we can watch it, then paste the link here."}
        </p>
      </div>
      <TestEditForm applicantId={a} signature={s} previousUrl={applicant.test_submission_url} />
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto max-w-lg rounded-xl border bg-card p-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <LinkIcon className="size-6" />
      </span>
      <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </section>
  );
}
