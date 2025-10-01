import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, FileText } from "lucide-react";

export default function Success() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session_id');
    setSessionId(session);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-none shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">
            Subscription Successful!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Welcome to Simpli-Docs Premium
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3">What's Next?</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>You now have unlimited document processing</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Access to all premium features including advanced analysis and translations</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Priority support for any questions or issues</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>A confirmation email has been sent to your inbox</span>
              </li>
            </ul>
          </div>

          {sessionId && (
            <div className="text-sm text-muted-foreground bg-muted/30 rounded p-3">
              <p className="font-mono break-all">Session ID: {sessionId}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link to="/upload" className="flex-1">
              <Button size="lg" className="w-full" data-testid="button-start-using">
                <FileText className="mr-2 h-5 w-5" />
                Start Using Simpli-Docs
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/" className="flex-1">
              <Button size="lg" variant="outline" className="w-full" data-testid="button-back-home">
                Back to Home
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Need help? Contact us at support@simpli-docs.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
