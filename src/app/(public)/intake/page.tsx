import type { Metadata } from "next";
import { connection } from "next/server";
import { ClockIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { issueFormToken } from "@/lib/form-token";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = {
  title: "Start a project",
  description: "Tell Foundry Media about your video project.",
};

export default async function IntakePage() {
  // The spam token carries a timestamp, so render per request, never at build.
  await connection();
  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Work with Foundry Media</p>
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
            <ShieldCheckIcon className="size-4 text-primary" /> Your details stay with us
          </li>
        </ul>
      </div>
      <IntakeForm token={issueFormToken("intake")} />
    </>
  );
}
