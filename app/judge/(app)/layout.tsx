import type { Metadata } from "next";
import { JudgeHeader } from "./judge-header";

export const metadata: Metadata = { title: "Judges" };

export default function JudgeLayout({ children }: LayoutProps<"/judge">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <JudgeHeader />
      <div className="flex flex-1 flex-col gap-4 px-3 pt-3 pb-10">{children}</div>
    </div>
  );
}
