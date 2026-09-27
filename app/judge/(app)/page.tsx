import { Suspense } from "react";
import { Feed } from "./feed";

export default function JudgeFeedPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}
