import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";

export default function BillingSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Get session_id from URL query params
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    setSessionId(sid);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
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
          </div>

          <Card className="border-green-300 bg-green-50 dark:bg-green-900/20">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-800 dark:text-green-300" data-testid="title-success">
                Payment Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Thank you for subscribing to Simpli-Docs! Your payment has been processed successfully.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                You now have unlimited access to all premium features. Start processing your documents right away!
              </p>
              {sessionId && (
                <p className="text-xs text-slate-500 dark:text-slate-500 font-mono" data-testid="text-session-id">
                  Session ID: {sessionId.slice(0, 20)}...
                </p>
              )}
              <div className="pt-6">
                <Link to="/upload">
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-start-processing"
                  >
                    Start Processing Documents
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
