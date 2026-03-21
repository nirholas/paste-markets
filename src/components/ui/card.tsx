import Link from "next/link";

interface CardProps {
  title: string;
  description: string;
  href: string;
}

export function Card({ title, description, href }: CardProps) {
  return (
    <Link
      href={href}
      className="block bg-surface border border-border rounded-lg p-6 hover:border-accent transition-colors group"
    >
      <h3 className="text-xs uppercase tracking-widest text-text-muted mb-2 group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-sm text-text-secondary">{description}</p>
      <span className="block mt-3 text-text-muted group-hover:text-accent transition-colors">
        &rarr;
      </span>
    </Link>
  );
}
