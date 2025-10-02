import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";
import { handleUpgrade } from "@/lib/handleUpgrade";

export default function SimpleUpload() {
  const [result, setResult] = useState<{
    summary: string;
    keyPoints: string[];
    glossary: { term: string; definition: string }[];
    actionItems: string[];
    readingLevelUsed?: string;
    usage?: { remaining: number; limit: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<'simple' | 'standard' | 'detailed'>('simple');
  const [usage, setUsage] = useState<{ remaining: number; limit: number; used: number } | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // Fetch usage on component mount
  useEffect(() => {
    async function fetchUsage() {
      try {
        const resp = await fetch('/api/usage');
        if (resp.ok) {
          const data = await resp.json();
          setUsage(data);
          setLimitReached(data.remaining === 0);
        }
      } catch (e) {
        console.error('Failed to fetch usage:', e);
      }
    }
    fetchUsage();
  }, []);

  async function uploadFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("level", level);
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
      
      // Handle limit reached
      if (resp.status === 429) {
        setError(data.message || "You've reached your monthly limit");
        setLimitReached(true);
        setUsage({ remaining: 0, limit: data.limit || 2, used: data.limit || 2 });
        return;
      }
      
      if (!resp.ok) {
        throw new Error(data.error || `Upload failed with status ${resp.status}`);
      }

      setResult({
        summary: data.summary || "",
        keyPoints: data.keyPoints || [],
        glossary: data.glossary || [],
        actionItems: data.actionItems || [],
        readingLevelUsed: data.readingLevelUsed,
        usage: data.usage
      });
      
      // Update usage info
      if (data.usage) {
        setUsage({
          remaining: data.usage.remaining,
          limit: data.usage.limit,
          used: data.usage.limit - data.usage.remaining
        });
        setLimitReached(data.usage.remaining === 0);
      }
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <DisclaimerBanner />
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center items-start mb-4">
              <img 
                src={logoPath} 
                alt="Simpli-Docs" 
                className="h-20 w-auto"
                style={{ filter: 'brightness(0.85) contrast(1.2)' }}
                data-testid="img-logo"
              />
              <sup className="text-[10px] ml-0.5 text-slate-500 dark:text-slate-400">™</sup>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Transform complex documents into clear, understandable language
            </p>
            {usage && (
              <div className="mt-4 inline-block" data-testid="usage-counter">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Free documents: <span className="font-semibold">{usage.remaining}/{usage.limit}</span> remaining this month
                </p>
              </div>
            )}
          </div>

          {limitReached && (
            <Card className="mb-6 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="limit-reached-card">
              <CardContent className="py-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">
                    Free Limit Reached
                  </h3>
                  <p className="text-amber-700 dark:text-amber-400 mb-4">
                    You've used all {usage?.limit || 2} free documents for this month. Upgrade to continue processing documents.
                  </p>
                  <Button 
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-upgrade"
                    onClick={() => handleUpgrade('standard')}
                  >
                    Upgrade Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Your Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label htmlFor="reading-level" className="block text-sm font-medium mb-2">
                Reading Level Dropdown
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Choose from Simple to Professional, with a level in between
              </p>
              <select
                id="reading-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as 'simple' | 'standard' | 'detailed')}
                className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
                data-testid="select-reading-level"
              >
                <option value="simple">Simple (5th grade) - Plain language, short sentences</option>
                <option value="standard">Standard (8th-10th grade) - Clear, general language</option>
                <option value="detailed">Professional - Full context, technical terms allowed</option>
              </select>
            </div>
          </CardContent>
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
            {result.readingLevelUsed && (
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center" data-testid="text-reading-level">
                Reading level: <span className="font-semibold capitalize">{result.readingLevelUsed}</span>
              </div>
            )}
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
    </div>
  );
}
