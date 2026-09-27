import type { Metadata } from "next";
import Link from "next/link";
import { HazardForm } from "./hazard-form";

export const metadata: Metadata = { title: "Report a hazard" };
export const dynamic = "force-dynamic";

export default function HazardPage() {
  const phone = process.env.SAFETY_LEAD_PHONE?.trim() || null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-4 pb-8">
      <Link
        href="/"
        className="tap -ml-2 flex items-center self-start rounded-xl px-2 text-lg font-semibold text-grape-700"
      >
        ← Back
      </Link>
      <section className="outlined rounded-3xl bg-[#fff4d6] p-5">
        <p className="text-5xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-2 font-display text-5xl leading-none tracking-wide text-ink">Don&apos;t touch it.</h1>
        <p className="mt-3 text-xl font-semibold">Needles, chemicals, sharp metal — leave it and flag it.</p>
        <p className="mt-2 text-lg">Step away, keep others back, and text the safety lead where it is.</p>
      </section>
      <HazardForm phone={phone} />
    </main>
  );
}
