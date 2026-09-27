import type { Metadata } from "next";
import { passcodeMatches } from "@/lib/judge-auth";
import { Wall } from "./wall";

export const metadata: Metadata = { title: "Live wall", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WallPage({ searchParams }: PageProps<"/wall">) {
  const { key } = await searchParams;
  if (typeof key !== "string" || !(await passcodeMatches(key))) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center text-xl">
        Add <code className="mx-1 rounded bg-white px-2">?key=…</code> (the judge passcode) to the URL.
      </main>
    );
  }
  return <Wall wallKey={key} />;
}
