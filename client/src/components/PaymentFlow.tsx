// Payment flow component for document processing
// Referenced from javascript_stripe integration

import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateDocumentPrice, formatPrice, getPricingBreakdown } from "@shared/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, CreditCard, FileText } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
let stripePromise: Promise<any> | null = null;
if (import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
}

interface PaymentFlowProps {
  documentId: string;
  filename: string;
  pageCount: number;
  sessionId: string;
  onPaymentSuccess: () => void;
}

const CheckoutForm = ({ documentId, sessionId, onPaymentSuccess }: { documentId: string; sessionId: string; onPaymentSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/?payment=success&documentId=${documentId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Verify payment with server
        const response = await fetch(`/api/documents/${documentId}/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          }
        });
        const verificationResult = await response.json();
        
        if (verificationResult.paymentStatus === "paid") {
          toast({
            title: "Payment Successful",
            description: "Your document is being processed!",
          });
          onPaymentSuccess();
        } else {
          toast({
            title: "Payment Processing",
            description: "Payment is being processed. Please wait a moment.",
          });
          // Retry verification after a short delay
          setTimeout(async () => {
            try {
              const retryResponse = await fetch(`/api/documents/${documentId}/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-session-id': sessionId
                }
              });
              const retryResult = await retryResponse.json();
              if (retryResult.paymentStatus === "paid") {
                onPaymentSuccess();
              }
            } catch (error) {
              console.error("Payment verification retry failed:", error);
            }
          }, 3000);
        }
      }
    } catch (err) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement />
      </div>
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || !elements || isProcessing}
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            <span>Processing Payment...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4" />
            <span>Complete Payment</span>
          </div>
        )}
      </Button>
    </form>
  );
};

export default function PaymentFlow({ documentId, filename, pageCount, sessionId, onPaymentSuccess }: PaymentFlowProps) {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const pricing = calculateDocumentPrice(pageCount);

  // Check if Stripe is configured
  if (!stripePromise) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="text-destructive">Payment system not configured</div>
            <p className="text-sm text-muted-foreground">
              Payment processing is currently unavailable. Please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    // Create PaymentIntent when component loads
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          },
          body: JSON.stringify({ documentId })
        });
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        toast({
          title: "Payment Setup Failed",
          description: "Unable to initialize payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [documentId, sessionId, toast]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-muted-foreground">Setting up payment...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="text-destructive">Failed to setup payment</div>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Document Processing</span>
          </CardTitle>
          <CardDescription>
            Complete payment to process your document with AI-powered explanations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm">Plain-language summary</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm">Technical glossary</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm">Q&A assistance</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm">Multi-language support</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Document:</span>
              <span className="font-medium truncate ml-2" title={filename}>
                {filename}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pages:</span>
              <span className="font-medium">{pageCount}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pricing:</span>
              <span>{getPricingBreakdown(pageCount)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span data-testid="text-total-price">{formatPrice(pricing.totalPrice)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>
            Your payment is secure and encrypted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm documentId={documentId} sessionId={sessionId} onPaymentSuccess={onPaymentSuccess} />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}