import "server-only";
import { env } from "@/lib/env";
import { signLink } from "@/lib/form-token";

/** The applicant's personal link for sending back their test edit. */
export const testSubmissionLink = (applicantId: string) =>
  `${env.siteUrl}/apply/test?a=${applicantId}&s=${signLink("test-edit", applicantId)}`;
