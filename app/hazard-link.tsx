import Link from "next/link";

/** Persistent "found something dangerous?" link for volunteer pages. */
export function HazardLink() {
  return (
    <Link
      href="/hazard"
      className="tap mt-auto flex items-center justify-center gap-2 self-center rounded-xl px-4 text-lg font-semibold text-[#8a4b00] underline underline-offset-4"
    >
      ⚠️ Found something dangerous?
    </Link>
  );
}
