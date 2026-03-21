/**
 * GET /api/assets/[ticker]
 *
 * Canonical plural route per spec. Re-exports handler from /api/asset/[ticker].
 */
export const dynamic = "force-dynamic";
export { GET } from "@/app/api/asset/[ticker]/route";
