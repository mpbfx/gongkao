import { redirect } from "next/navigation";

type PaperDetailPageProps = {
  params: Promise<{
    paperId: string;
  }>;
};

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const { paperId } = await params;
  redirect(`/question-bank/papers#paper-${paperId}`);
}
