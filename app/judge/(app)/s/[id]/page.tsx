import { Detail } from "./detail";

export default async function SubmissionPage({ params }: PageProps<"/judge/s/[id]">) {
  const { id } = await params;
  return <Detail id={id} />;
}
