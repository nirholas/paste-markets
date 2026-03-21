import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ handle: string }>;
}

/**
 * /caller/[handle] → canonical redirect to /[handle]
 * Allows both URL patterns to work.
 */
export default async function CallerRedirectPage({ params }: PageProps) {
  const { handle } = await params;
  redirect(`/${encodeURIComponent(handle)}`);
}
