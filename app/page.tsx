import Image from "next/image";
import Link from "next/link";
import { event, isSubmissionsOpen } from "@/config/event";
import { MineLink } from "./mine-link";
import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default function Home() {
  const open = isSubmissionsOpen();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-4 pb-8">
      <header className="flex items-center gap-3">
        <Image
          src="/brand/badge-2026.webp"
          alt={`${event.cleanup} ${event.year}`}
          width={open ? 72 : 288}
          height={open ? 72 : 288}
          priority
          className={open ? "size-18 shrink-0" : "mx-auto h-auto w-72"}
        />
        {open && (
          <div>
            <h1 className="font-display text-3xl leading-none tracking-wide text-balance text-grape-700">
              Grab it. Snap it. Send it.
            </h1>
            <p className="text-base text-river-900">{event.name}</p>
          </div>
        )}
        {open && <MineLink />}
      </header>

      {open ? <SubmitForm /> : <Closed />}
    </main>
  );
}

function Closed() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none tracking-wide text-balance text-grape-700">
        Submissions are closed
      </h1>
      <p className="outlined rounded-2xl bg-mint-100 px-5 py-4 text-xl font-semibold">Thanks for hauling! 🗑️💚</p>
      <p className="text-lg text-river-900">{event.name}</p>
      <Link href="/mine" className="tap flex items-center font-semibold text-grape-700 underline underline-offset-4">
        See my submissions and codes
      </Link>
    </section>
  );
}
