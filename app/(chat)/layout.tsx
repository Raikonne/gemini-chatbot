import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;

  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
