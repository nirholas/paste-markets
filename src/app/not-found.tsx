import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
        <p className="text-text-muted mb-6">Page not found.</p>
        <Link href="/" className="border border-border hover:border-accent px-4 py-2 rounded transition">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
