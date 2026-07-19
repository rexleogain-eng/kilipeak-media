import { redirect } from "next/navigation";
import MediaManager from "@/components/MediaManager";
import { hasSession } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await hasSession())) {
    redirect("/login");
  }

  return (
    <MediaManager mainSiteUrl={env.mainSiteUrl()} />
  );
}
