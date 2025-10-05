import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, 
  Zap, 
  Shield, 
  Globe, 
  Clock, 
  Heart,
  CheckCircle,
  Star,
  Users,
  Download,
  Eye,
  Calendar,
  MessageCircle,
  BarChart3,
  Lock,
  Accessibility,
  ArrowRight,
  Sparkles,
  Target,
  BookOpen,
  Play,
  X
} from "lucide-react";
import logoPath from "@assets/Simpli-Docs Logo Design_1759342904379.png";
import { handleUpgrade } from "@/lib/handleUpgrade";

export default function LandingPage() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const handleSubscribe = async (tier: string | null) => {
    if (!tier) {
      // Free tier - just go to upload page
      window.location.href = '/upload';
      return;
    }

    setIsCheckoutLoading(true);
    try {
      await handleUpgrade(tier as 'standard' | 'pro' | 'family');
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsCheckoutLoading(false);
    }
  };

  const features = [
    {
      category: "Understand at a Glance",
      icon: <Eye className="h-6 w-6" />,
      color: "bg-blue-500",
      items: [
        "Highlight-to-Explain: instant plain-language popovers", 
        "Reading level dropdown: Simple / Standard / Professional",
        "Confidence & source chips with document quotes",
        "Clear explanations of complex terms"
      ]
    },
    {
      category: "Actionable Guidance", 
      icon: <Target className="h-6 w-6" />,
      color: "bg-green-500",
      items: [
        "Deadline detector with countdown & calendar integration",
        "Smart Q&A with grounded citations",
        "One-click templates: appeals, emails, record requests",
        "Automated checklist generation from deadlines"
      ]
    },
    {
      category: "Medical & Insurance Bills",
      icon: <Heart className="h-6 w-6" />,
      color: "bg-red-500", 
      items: [
        "Insurance Bill Analyzer - see what you owe & why (EOB)",
        "Plain-language medical code definitions (ICD/CPT)",
        "Duplicate billing alerts & appeal deadline tracking",
        "Doctor visit prep: smart questions to ask"
      ]
    },
    {
      category: "Legal Document Clarity",
      icon: <BookOpen className="h-6 w-6" />,
      color: "bg-purple-500",
      items: [
        "Parties, jurisdiction & deadlines panel",
        "Clause snapshots: compress & expand details", 
        "Form finder: official forms matching your document",
        "Response clocks for legal deadlines"
      ]
    },
    {
      category: "Trust & Privacy",
      icon: <Shield className="h-6 w-6" />,
      color: "bg-orange-500",
      items: [
        "Ephemeral Mode: auto-delete after 24 hours",
        "Share-safe links: time-limited & revocable",
        "PII-gentle previews with smart blurring",
        "SOC 2, HIPAA & GDPR compliant processing"
      ]
    },
    {
      category: "Accessibility & Language",
      icon: <Accessibility className="h-6 w-6" />,
      color: "bg-indigo-500",
      items: [
        "Read-aloud for summaries (Web Speech API)",
        "Dyslexia-friendly mode with font/spacing",
        "Translate + explain (21 languages supported)",
        "High-contrast mode for visual accessibility"
      ]
    },
    {
      category: "Workflow & Export",
      icon: <Download className="h-6 w-6" />,
      color: "bg-teal-500", 
      items: [
        "Case Binder: group docs into timeline",
        "One-click branded PDF exports",
        "CSV export of action items & deadlines",
        "Notes & bookmarks with personal annotations"
      ]
    },
    {
      category: "Smart Processing",
      icon: <Sparkles className="h-6 w-6" />,
      color: "bg-pink-500",
      items: [
        "AI-powered document analysis with GPT-4o",
        "OCR for scanned documents & images", 
        "Multi-format support: PDF, DOCX, TXT, images",
        "Intelligent glossary generation"
      ]
    }
  ];

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
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
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
                <div className="h-9 w-20 bg-muted animate-pulse rounded"></div>
              ) : isAuthenticated ? (
                <>
                  <Link to="/account">
                    <Button variant="ghost" data-testid="button-account">
                      Account
                    </Button>
                  </Link>
                  <Link to="/upload">
                    <Button variant="outline" data-testid="button-dashboard">
                      Dashboard
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => window.location.href = '/api/logout'}
                    data-testid="button-logout-header"
                  >
                    Log Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => window.location.href = '/api/login'}
                    data-testid="button-login"
                  >
                    Log In
                  </Button>
                  <Link to="/upload">
                    <Button variant="outline" data-testid="button-try-now">
                      Try Now
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4" data-testid="badge-ai-powered">
            <Sparkles className="h-4 w-4 mr-2" />
            AI-Powered Document Intelligence
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Transform Complex Documents
            <span className="text-primary block">Into Plain Language</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            From medical reports to legal contracts, insurance claims to technical manuals – 
            understand any document instantly with AI-powered explanations, smart summaries, 
            and actionable guidance.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link to="/upload">
              <Button size="lg" className="text-lg px-8 py-6" data-testid="button-start-free">
                Start Free - No Credit Card Required
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="text-lg px-8 py-6" data-testid="button-watch-demo">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-2xl">
                    <Play className="h-6 w-6 text-primary" />
                    Simpli-Docs Demo
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    See how Simpli-Docs transforms complex documents into clear, understandable language
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 mt-6">
                  {/* Demo Video Placeholder */}
                  <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-8 border-2 border-dashed border-primary/30">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
                        <Play className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Interactive Demo Coming Soon!</h3>
                      <p className="text-muted-foreground mb-4">
                        We're preparing an interactive demo to show you exactly how Simpli-Docs works.
                        For now, try uploading a document to see the magic happen!
                      </p>
                      <Link to="/upload">
                        <Button size="lg" className="text-lg px-6" onClick={() => setIsDemoOpen(false)}>
                          Try It Now - Upload Your Document
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Key Features Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Eye className="h-5 w-5 text-green-600" />
                          Instant Understanding
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Upload any legal or medical document and get a plain-language summary in seconds.
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <MessageCircle className="h-5 w-5 text-blue-600" />
                          Smart Q&A
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Ask questions about your document and get accurate answers with citations.
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <BookOpen className="h-5 w-5 text-purple-600" />
                          Key Terms Glossary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Complex jargon automatically explained in simple terms you can understand.
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-2 border-orange-200 bg-orange-50/50 dark:bg-orange-900/10 dark:border-orange-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Globe className="h-5 w-5 text-orange-600" />
                          21 Languages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Get explanations in your preferred language for maximum understanding.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Call to Action */}
                  <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                    <h4 className="text-lg font-semibold mb-2">Ready to Try It Yourself?</h4>
                    <p className="text-muted-foreground mb-4">
                      Upload your document and experience the power of AI-driven document understanding
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link to="/upload">
                        <Button size="lg" className="w-full sm:w-auto" onClick={() => setIsDemoOpen(false)}>
                          Start Free Trial
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => setIsDemoOpen(false)}>
                        Close Demo
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground mb-16">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              SOC 2 Compliant
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              HIPAA Secure
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              GDPR Compliant
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              99.9% Uptime
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Features That Feel Magical
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature designed to make complex documents instantly understandable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300" data-testid={`feature-card-${index}`}>
                <CardHeader className="pb-3">
                  <div className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center text-white mb-4`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-16">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center" data-testid="step-upload">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Any Document</h3>
              <p className="text-muted-foreground">
                PDF, DOCX, images, or plain text. Our OCR handles scanned documents too.
              </p>
            </div>
            
            <div className="text-center" data-testid="step-process">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
              <p className="text-muted-foreground">
                Advanced AI processes your document and creates plain-language explanations.
              </p>
            </div>
            
            <div className="text-center" data-testid="step-understand">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Understand & Act</h3>
              <p className="text-muted-foreground">
                Get summaries, glossaries, deadlines, and actionable next steps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pricing That Feels Fair
            </h2>
            <p className="text-lg text-muted-foreground mb-2">
              Start free, upgrade when you need more features
            </p>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <strong>Subscription Note:</strong> Paid plans are monthly subscriptions. Your card will be charged automatically each month. Cancel anytime from your account settings - no questions asked.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                className={`relative border-none shadow-lg ${tier.popular ? 'ring-2 ring-primary scale-105' : ''}`}
                data-testid={`pricing-tier-${index}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full" 
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-${tier.cta.toLowerCase().replace(' ', '-')}`}
                    onClick={() => handleSubscribe(tier.tier)}
                    disabled={isCheckoutLoading}
                  >
                    {isCheckoutLoading ? 'Loading...' : tier.cta}
                  </Button>
                  
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

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Understand Your Documents?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands who've made complex documents simple with Simpli-Docs
          </p>
          
          <Link to="/upload">
            <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • 2 free documents monthly • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-foreground">Simpli-Docs</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© 2024 Simpli-Docs - Made for understanding complex documents - A Trends Collective Company</p>
          </div>
        </div>
      </footer>
    </div>
  );
}