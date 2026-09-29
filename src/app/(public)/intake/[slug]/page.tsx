import type { Metadata } from "next";
import { connection } from "next/server";
import { ClockIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { getBranding } from "@/lib/branding";
import { issueFormToken } from "@/lib/form-token";
import { PublicHeader, PublicNotice } from "../../public-header";
import { IntakeForm } from "../intake-form";

export async function generateMetadata(props: PageProps<"/intake/[slug]">): Promise<Metadata> {
  const branding = await getBranding((await props.params).slug);
  if (!branding) return { title: "Start a project" };
  return { title: "Start a project", description: `Tell ${branding.name} about your video project.` };
}

export default async function IntakePage(props: PageProps<"/intake/[slug]">) {
  // The spam token carries a timestamp, so render per request, never at build.
  await connection();
  const { slug } = await props.params;
  const branding = await getBranding(slug);

  if (!branding) {
    return (
      <PublicNotice
        title="We couldn't find that studio"
        body="Check the link you were sent. Each company on ReEdit has its own project form."
      />
    );
  }

  return (
    <>
      <PublicHeader name={branding.name} accent={branding.defaultAccent} />
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Work with {branding.name}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-balance">Start a project</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Tell us what you&apos;re making. We&apos;ll review it and get back to you, usually within one business day.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <ClockIcon className="size-4 text-primary" /> Takes about 2 minutes
          </li>
          <li className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" /> No commitment
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-primary" /> Your details stay with {branding.name}
          </li>
        </ul>
      </div>
      <IntakeForm slug={slug} token={issueFormToken(`intake:${slug}`)} />
    </>
  );
}
