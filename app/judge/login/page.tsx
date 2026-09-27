import type { Metadata } from "next";
import { event } from "@/config/event";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Judges" };

export default async function JudgeLoginPage({ searchParams }: PageProps<"/judge/login">) {
  const { next } = await searchParams;
  // Only allow same-site judge paths as a post-login destination.
  const dest = typeof next === "string" && next.startsWith("/judge") && !next.startsWith("//") ? next : "/judge";
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="font-display text-5xl leading-none tracking-wide text-grape-700">Judges only</h1>
        <p className="mt-1 text-lg text-river-900">{event.name}</p>
      </div>
      <LoginForm next={dest} />
    </main>
  );
}
