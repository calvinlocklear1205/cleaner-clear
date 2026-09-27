import { isTestMode } from "@/config/event";

/** Server component. Visible on every page while SUBMISSIONS_OPEN=always. */
export function TestModeBanner() {
  if (!isTestMode()) return null;
  return (
    <div
      role="status"
      className="bg-[repeating-linear-gradient(45deg,#f28c1e_0_14px,#111_14px_28px)] px-2 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-1 text-center"
    >
      <span className="inline-block rounded-md bg-white px-3 py-0.5 text-sm font-bold">
        TEST MODE · entries get wiped before the event
      </span>
    </div>
  );
}
