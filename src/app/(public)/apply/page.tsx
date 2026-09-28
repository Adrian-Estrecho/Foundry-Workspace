import type { Metadata } from "next";
import { connection } from "next/server";
import { ClockIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react";
import { issueFormToken } from "@/lib/form-token";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Edit with Foundry Media",
  description: "Apply to join the Foundry Media editing team.",
};

export default async function ApplyPage() {
  // The spam token carries a timestamp, so render per request, never at build.
  await connection();
  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Join the team</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-balance">Edit with Foundry Media</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          We work with remote editors on social, YouTube and brand work. Tell us about yours. If it&apos;s a match, we&apos;ll
          email you a short test edit.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <ClockIcon className="size-4 text-primary" /> Takes about 3 minutes
          </li>
          <li className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-primary" /> Fully remote
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-primary" /> Your details stay with us
          </li>
        </ul>
      </div>
      <ApplyForm token={issueFormToken("apply")} timeZones={Intl.supportedValuesOf("timeZone")} />
    </>
  );
}
