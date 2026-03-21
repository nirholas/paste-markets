/**
 * GET /api/assets/[ticker]
 *
 * Canonical plural route per spec. Re-exports handler from /api/asset/[ticker].
 */
export { GET, dynamic } from "@/app/api/asset/[ticker]/route";
