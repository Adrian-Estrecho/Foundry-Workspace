import type { Metadata } from "next";
import { connection } from "next/server";
import { ClockIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react";
import { PublicForm } from "@/features/forms/components/public-form";
import { getPublicForm } from "@/features/forms/queries";
import { getBranding } from "@/lib/branding";
import { issueFormToken } from "@/lib/form-token";
import { PublicHeader, PublicNotice } from "../../public-header";
import { submitApplication } from "../actions";

export async function generateMetadata(props: PageProps<"/apply/[slug]">): Promise<Metadata> {
  const branding = await getBranding((await props.params).slug);
  if (!branding) return { title: "Application" };
  return { title: `Edit with ${branding.name}`, description: `Apply to join the ${branding.name} editing team.` };
}

export default async function ApplyPage(props: PageProps<"/apply/[slug]">) {
  // The spam token carries a timestamp, so render per request, never at build.
  await connection();
  const { slug } = await props.params;
  const branding = await getBranding(slug);

  if (!branding) {
    return (
      <PublicNotice
        title="We couldn't find that team"
        body="Check the application link you were sent. Each company on ReEdit has its own."
      />
    );
  }

  return (
    <>
      <PublicHeader name={branding.name} accent={branding.defaultAccent} logoUrl={branding.logoUrl} />
      {branding.acceptingApplications ? (
        <>
          <div className="mb-8">
            <p className="text-sm font-medium text-primary">Join the team</p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-balance">Edit with {branding.name}</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Tell us about your editing. If it&apos;s a match, we&apos;ll email you an invitation to join the team. Onboarding,
              a short test edit and a quick call follow from there.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ClockIcon className="size-4 text-primary" /> Takes about 3 minutes
              </li>
              <li className="flex items-center gap-2">
                <GlobeIcon className="size-4 text-primary" /> Fully remote
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-primary" /> Your details stay with {branding.name}
              </li>
            </ul>
          </div>
          <PublicForm
            kind="apply"
            slug={slug}
            token={issueFormToken(`apply:${slug}`)}
            fields={await getPublicForm(branding.workspaceId, "apply")}
            timeZones={Intl.supportedValuesOf("timeZone")}
            submitLabel="Send application"
            action={submitApplication}
          />
        </>
      ) : (
        <PublicNotice
          title={`${branding.name} isn't hiring right now`}
          body="They aren't taking applications at the moment. Check back later, or ask them when they're next hiring."
        />
      )}
    </>
  );
}
