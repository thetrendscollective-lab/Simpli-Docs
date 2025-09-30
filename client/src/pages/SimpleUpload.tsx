import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";

export default function SimpleUpload() {
  const [result, setResult] = useState<{
    summary: string;
    keyPoints: string[];
    glossary: { term: string; definition: string }[];
    actionItems: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function uploadFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch("/api/process", {
        method: "POST",
        body: form
      });

      // Check content type
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await resp.text();
        throw new Error(`Expected JSON, got: ${contentType}. Response: ${text.slice(0, 200)}`);
      }

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Upload failed with status ${resp.status}`);
      }

      setResult({
        summary: data.summary || "",
        keyPoints: data.keyPoints || [],
        glossary: data.glossary || [],
        actionItems: data.actionItems || []
      });
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Simpli-Docs</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Transform complex documents into clear, understandable language
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Your Document</CardTitle>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              data-testid="upload-area"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {loading ? (
                  <Loader2 className="w-10 h-10 mb-3 text-slate-400 animate-spin" />
                ) : (
                  <Upload className="w-10 h-10 mb-3 text-slate-400" />
                )}
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PDF, DOCX, or TXT (MAX. 50MB)
                </p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                disabled={loading}
                data-testid="input-file"
              />
            </label>
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span data-testid="text-processing">Processing your document...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-6">
              <div className="text-red-600 dark:text-red-400" data-testid="text-error">
                Error: {error}
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300" data-testid="text-summary">
                  {result.summary || "No summary generated."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Points</CardTitle>
              </CardHeader>
              <CardContent>
                {result.keyPoints.length > 0 ? (
                  <ul className="list-disc pl-6 space-y-2" data-testid="list-keypoints">
                    {result.keyPoints.map((kp, i) => (
                      <li key={i} className="text-slate-700 dark:text-slate-300">
                        {kp}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">No key points extracted.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Glossary</CardTitle>
              </CardHeader>
              <CardContent>
                {result.glossary.length > 0 ? (
                  <ul className="space-y-3" data-testid="list-glossary">
                    {result.glossary.map((g, i) => (
                      <li key={i} className="text-slate-700 dark:text-slate-300">
                        <strong>{g.term}:</strong> {g.definition}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">No glossary terms found.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                {result.actionItems.length > 0 ? (
                  <ul className="list-disc pl-6 space-y-2" data-testid="list-actionitems">
                    {result.actionItems.map((a, i) => (
                      <li key={i} className="text-slate-700 dark:text-slate-300">
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">No action items.</p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                  Simpli-Docs provides plain-language explanations and is not legal, medical, or financial advice.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
