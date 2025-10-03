import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { handleUpgrade } from "@/lib/handleUpgrade";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";

export default function Pricing() {
  const navigate = useNavigate();

  const { data: user, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const supabase = await getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch("/api/auth/user", {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        return response.json();
      }
      return null;
    }
  });

  const pricingTiers = [
    {
      name: "Free",
      tier: null,
      price: "Free",
      description: "Perfect for trying out Simpli-Docs",
      features: [
        "2 documents per month",
        "Basic explanations", 
        "Standard glossary",
        "Email support"
      ],
      cta: "Start Free",
      popular: false
    },
    {
      name: "Standard", 
      tier: "standard",
      price: "$4.99",
      period: "/month",
      description: "For individuals and small teams",
      features: [
        "Unlimited explanations",
        "Deadline → calendar integration", 
        "Read-aloud functionality",
        "21-language translation",
        "Priority support"
      ],
      cta: "Start Standard",
      popular: true
    },
    {
      name: "Pro",
      tier: "pro",
      price: "$9.99", 
      period: "/month",
      description: "For power users and professionals",
      features: [
        "Everything in Standard",
        "Medical bill analyzer with cost breakdown",
        "Legal deadline clocks",
        "Case binder & timeline",
        "Share-safe links",
        "Branded PDF exports"
      ],
      cta: "Start Pro", 
      popular: false
    },
    {
      name: "Family",
      tier: "family",
      price: "$14.99",
      period: "/month", 
      description: "For families and caregivers",
      features: [
        "Everything in Pro",
        "3-5 user seats",
        "Shared case binder",
        "Family member access",
        "Caregiver dashboard"
      ],
      cta: "Start Family",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src={logoPath} 
                alt="Simpli-Docs" 
                className="h-12 w-auto"
                style={{ filter: 'brightness(0.85) contrast(1.2)' }}
                data-testid="img-logo"
              />
              <sup className="text-[8px] ml-0.5 text-muted-foreground">™</sup>
            </div>
            <div className="flex items-center space-x-4">
              {authLoading ? (
                <div className="h-10 w-24 animate-pulse bg-muted rounded" />
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/account')}
                    data-testid="button-account"
                  >
                    Account
                  </Button>
                  <Button
                    onClick={() => navigate('/upload')}
                    data-testid="button-upload"
                  >
                    Upload Document
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/auth')}
                    data-testid="button-signin"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => navigate('/auth')}
                    data-testid="button-getstarted"
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" data-testid="text-pricing-title">
              Choose Your Plan
            </h2>
            <p className="text-xl text-muted-foreground">
              Start with our free tier or unlock premium features
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier) => (
              <Card 
                key={tier.name} 
                className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    POPULAR
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl" data-testid={`text-tier-name-${tier.name.toLowerCase()}`}>
                    {tier.name}
                  </CardTitle>
                  <CardDescription data-testid={`text-tier-description-${tier.name.toLowerCase()}`}>
                    {tier.description}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold" data-testid={`text-tier-price-${tier.name.toLowerCase()}`}>
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full mb-4"
                    variant={tier.popular ? "default" : "outline"}
                    onClick={() => {
                      if (!tier.tier) {
                        navigate('/upload');
                      } else if (user) {
                        handleUpgrade(tier.tier as 'standard' | 'pro' | 'family');
                      } else {
                        sessionStorage.setItem('pendingUpgrade', tier.tier);
                        navigate('/auth');
                      }
                    }}
                    data-testid={`button-cta-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                  </Button>
                  <ul className="space-y-2">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle2 className="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm" data-testid={`text-feature-${tier.name.toLowerCase()}-${idx}`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tier.tier && (
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      Billed monthly • Cancel anytime
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
