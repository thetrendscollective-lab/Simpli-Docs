import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, User, Settings } from "lucide-react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Account() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Please log in to view your account.",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate("/auth");
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast, navigate]);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
    retry: false,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const token = await (await import('@/lib/supabase')).getAccessToken();
      
      if (!token) {
        throw new Error('401: Unauthorized');
      }
      
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (res.status === 401) {
        throw new Error('401: Unauthorized');
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/auth");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentPlan = user.currentPlan || 'free';
  const subscriptionStatus = user.subscriptionStatus || 'inactive';
  const nextBillingDate = user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null;

  const planTitles: Record<string, string> = {
    free: 'Free Plan',
    standard: 'Standard Plan',
    pro: 'Pro Plan',
    family: 'Family Plan'
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    trialing: 'bg-blue-500',
    past_due: 'bg-yellow-500',
    canceled: 'bg-red-500',
    inactive: 'bg-gray-500'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/upload" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-upload">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Account & Billing</h1>
            <p className="text-muted-foreground mt-2">Manage your subscription and account settings</p>
          </div>

          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base" data-testid="text-user-email">{user.email || 'Not provided'}</p>
                </div>
              </div>
              {(user.firstName || user.lastName) && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-base" data-testid="text-user-name">
                      {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>View and manage your subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold" data-testid="text-current-plan">{planTitles[currentPlan]}</p>
                    {subscriptionStatus !== 'inactive' && (
                      <Badge className={statusColors[subscriptionStatus]} data-testid="badge-subscription-status">
                        {subscriptionStatus}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {nextBillingDate && subscriptionStatus === 'active' && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Next Billing Date</p>
                    <p className="text-base mt-1" data-testid="text-next-billing-date">{nextBillingDate}</p>
                  </div>
                </>
              )}

              <Separator />

              {currentPlan === 'free' ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You're currently on the free plan with 2 documents per month. Upgrade to unlock unlimited documents and premium features.
                  </p>
                  <Button
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto"
                    data-testid="button-upgrade-plan"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    View Plans
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage your subscription, update payment methods, view invoices, or cancel your plan through the Stripe customer portal.
                  </p>
                  <Button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="w-full sm:w-auto"
                    data-testid="button-manage-subscription"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {portalMutation.isPending ? 'Opening...' : 'Manage Subscription'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you have questions about your subscription or need assistance, please contact our support team at{' '}
                <a href="mailto:support@getsimplidocs.com" className="text-primary hover:underline">
                  support@getsimplidocs.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
