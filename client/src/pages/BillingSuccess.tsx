import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";
import { getCurrentUser } from "@/lib/supabase";

export default function BillingSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    setSessionId(sid);

    verifySubscription();
  }, []);

  async function verifySubscription() {
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        setError("Please sign in to access your subscription");
        setVerifying(false);
        setTimeout(() => {
          setLocation('/auth?redirect=/billing/success' + window.location.search);
        }, 2000);
        return;
      }

      let attempts = 0;
      const maxAttempts = 10;
      
      const checkSubscription = async () => {
        try {
          const token = await (await import('@/lib/supabase')).getAccessToken();
          const response = await fetch('/api/stripe/user/profile', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            
            if (userData.currentPlan && userData.currentPlan !== 'free') {
              setSubscriptionActive(true);
              setVerifying(false);
              return true;
            }
          }
          
          attempts++;
          if (attempts >= maxAttempts) {
            setError("Subscription verification taking longer than expected. Please check your account page.");
            setVerifying(false);
            return false;
          }
          
          setTimeout(checkSubscription, 2000);
          return false;
        } catch (err) {
          console.error('Error checking subscription:', err);
          attempts++;
          if (attempts >= maxAttempts) {
            setError("Unable to verify subscription. Please check your account page.");
            setVerifying(false);
            return false;
          }
          setTimeout(checkSubscription, 2000);
          return false;
        }
      };

      await checkSubscription();
    } catch (err) {
      console.error('Verification error:', err);
      setError("An error occurred. Please check your account page.");
      setVerifying(false);
    }
  }

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

          <Card className={`border-green-300 ${error ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {verifying ? (
                  <Loader2 className="w-16 h-16 text-green-600 dark:text-green-400 animate-spin" />
                ) : error ? (
                  <AlertCircle className="w-16 h-16 text-orange-600 dark:text-orange-400" />
                ) : (
                  <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
                )}
              </div>
              <CardTitle className="text-2xl text-green-800 dark:text-green-300" data-testid="title-success">
                {verifying ? "Activating Your Subscription..." : error ? "Almost There!" : "Payment Successful!"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {verifying ? (
                <>
                  <p className="text-slate-700 dark:text-slate-300">
                    Your payment was successful! We're now activating your premium features.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    This usually takes just a few seconds...
                  </p>
                </>
              ) : error ? (
                <>
                  <p className="text-orange-700 dark:text-orange-300">
                    {error}
                  </p>
                  <Button 
                    onClick={() => setLocation('/account')}
                    variant="outline"
                    data-testid="button-check-account"
                  >
                    Go to Account Page
                  </Button>
                </>
              ) : (
                <>
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
                    <Button 
                      size="lg" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setLocation('/upload')}
                      data-testid="button-start-processing"
                    >
                      Start Processing Documents
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
