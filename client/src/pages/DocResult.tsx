import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Gloss = { term: string; meaning: string };
type Explanation = {
  id: string;
  summary: string;
  bullet_points: string[];
  glossary: Gloss[];
  action_items: string[];
  confidence: number;
  created_at: string;
};

async function fetchExplanation(documentId: string, sessionId: string): Promise<Explanation | null> {
  const r = await fetch(`/api/explanations/${documentId}`, {
    headers: {
      'x-session-id': sessionId
    }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error((await r.json()).error || "Failed to fetch explanation");
  return r.json();
}

async function createExplanation(documentId: string, sessionId: string, domain = "general"): Promise<void> {
  const r = await fetch(`/api/explain`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      'x-session-id': sessionId
    },
    body: JSON.stringify({ document_id: documentId, domain })
  });
  if (!r.ok) throw new Error((await r.json()).error || "Explain failed");
}

export default function DocResult() {
  const { id } = useParams<{ id: string }>();
  const documentId = id || "";
  
  const [loading, setLoading] = useState(true);
  const [exp, setExp] = useState<Explanation | null>(null);
  const [error, setError] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  // Get session ID from localStorage (set during upload)
  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      // Fallback: create new session if none found
      fetch("/api/session", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          setSessionId(data.sessionId);
          localStorage.setItem('sessionId', data.sessionId);
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !documentId) return;
    
    (async () => {
      try {
        setLoading(true);
        setError("");
        // 1) try to fetch
        let e = await fetchExplanation(documentId, sessionId);
        // 2) if none, create once then fetch again
        if (!e) {
          await createExplanation(documentId, sessionId, "general");
          e = await fetchExplanation(documentId, sessionId);
        }
        setExp(e);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [documentId, sessionId]);

  if (loading) return <div className="p-6">Analyzing your document…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!exp) return <div className="p-6">No explanation yet.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Plain-Language Explanation</h1>

      <section className="border rounded-xl p-4">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2 leading-relaxed">{exp.summary}</p>
      </section>

      <section className="border rounded-xl p-4">
        <h3 className="font-semibold">Key Points</h3>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          {(exp.bullet_points || []).map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </section>

      <section className="border rounded-xl p-4">
        <h3 className="font-semibold">Glossary</h3>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          {(exp.glossary || []).map((g, i) => (
            <li key={i}><strong>{g.term}:</strong> {g.meaning}</li>
          ))}
        </ul>
      </section>

      <section className="border rounded-xl p-4">
        <h3 className="font-semibold">Action Items</h3>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          {(exp.action_items || []).map((a, i) => <li key={i}>{a}</li>)}
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          Simplidocs provides plain-language explanations and is not legal, medical, or financial advice.
        </p>
      </section>
    </div>
  );
}