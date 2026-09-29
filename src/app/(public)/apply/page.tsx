import type { Metadata } from "next";
import { PublicNotice } from "../public-header";

export const metadata: Metadata = { title: "Apply" };

/** Old or incomplete link: applications are per company. */
export default function ApplyIndexPage() {
  return (
    <PublicNotice
      title="Use your team's application link"
      body="Each company on ReEdit has its own application link, like /apply/their-name. Ask the team you want to work with for theirs."
    />
  );
}
