import type { Metadata } from "next";
import Link from "next/link";
import { HazardLink } from "../hazard-link";
import { MineList } from "./mine-list";

export const metadata: Metadata = { title: "My submissions" };

export default function MinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-4 pb-8">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="tap -ml-2 flex items-center rounded-xl px-2 text-lg font-semibold text-grape-700"
          aria-label="Back to submit"
        >
          ← Back
        </Link>
        <h1 className="font-display text-4xl leading-none tracking-wide text-grape-700">My submissions</h1>
      </header>
      <MineList />
      <HazardLink />
    </main>
  );
}
