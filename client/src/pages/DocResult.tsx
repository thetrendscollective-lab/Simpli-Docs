import { useParams } from "react-router-dom";
import DocResultInner from "./DocResultInner";

export default function DocResultPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div className="p-6">No document id provided.</div>;
  return <DocResultInner documentId={id} />;
}