import { redirect } from "next/navigation";

/**
 * The link in invitation emails, /join?code=…. Signed-out visitors are sent
 * to sign in (or sign up) first and come back here; then the welcome page
 * shows the invitation with the code filled in.
 */
export default async function JoinPage(props: PageProps<"/join">) {
  const { code } = await props.searchParams;
  redirect(typeof code === "string" ? `/welcome?code=${encodeURIComponent(code)}` : "/welcome");
}
