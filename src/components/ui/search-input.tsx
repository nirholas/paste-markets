"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SearchInput({ size = "lg" }: { size?: "sm" | "lg" }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const handle = value.trim().replace(/^@/, "");
    if (handle) {
      router.push(`/${encodeURIComponent(handle)}`);
    }
  }

  const isLarge = size === "lg";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex items-center bg-surface border border-border rounded-lg ${
          isLarge ? "px-4 py-3" : "px-3 py-1.5"
        } focus-within:border-accent transition-colors`}
      >
        <span
          className={`text-text-muted ${isLarge ? "text-lg" : "text-sm"} mr-1 select-none`}
        >
          @
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search any CT handle..."
          className={`flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono ${
            isLarge ? "text-lg" : "text-sm"
          }`}
        />
      </div>
    </form>
  );
}
