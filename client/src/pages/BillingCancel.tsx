import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";

export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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

          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-2xl text-amber-800 dark:text-amber-300" data-testid="title-cancelled">
                Payment Cancelled
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Your payment was cancelled. No charges have been made to your account.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                You can try again whenever you're ready, or continue using Simpli-Docs with the free plan.
              </p>
              <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button 
                    variant="outline"
                    size="lg"
                    data-testid="button-back-home"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Back to Home
                  </Button>
                </Link>
                <Link href="/upload">
                  <Button 
                    size="lg"
                    data-testid="button-continue-free"
                  >
                    Continue with Free Plan
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
