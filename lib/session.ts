import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** For pages: returns the signed-in user or redirects to the login page. */
export async function requirePageUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}
