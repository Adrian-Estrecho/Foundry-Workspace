import type { Metadata } from "next";
import { PublicNotice } from "../public-header";

export const metadata: Metadata = { title: "Start a project" };

/** Old or incomplete link: project forms are per company. */
export default function IntakeIndexPage() {
  return (
    <PublicNotice
      title="Use the studio's project link"
      body="Each company on ReEdit has its own project form, like /intake/their-name. Ask the studio you're working with for theirs."
    />
  );
}
