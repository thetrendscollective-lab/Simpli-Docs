import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  BookOpen
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      category: "Understand at a Glance",
      icon: <Eye className="h-6 w-6" />,
      color: "bg-blue-500",
      items: [
        "Side-by-side Original ↔ Plain English toggle",
        "Highlight-to-Explain: instant plain-language popovers", 
        "Reading level slider: Simple / Standard / Detailed",
        "Confidence & source chips with document quotes"
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
      category: "Medical & Insurance Superpowers",
      icon: <Heart className="h-6 w-6" />,
      color: "bg-red-500", 
      items: [
        "EOB explainer with visual breakdown charts",
        "ICD/CPT plain-language definitions inline",
        "Duplicate billing detection & appeal windows",
        "Visit prep cards: questions for your doctor"
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
      price: "$9.99",
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
      price: "$24.99", 
      period: "/month",
      description: "For power users and professionals",
      features: [
        "Everything in Standard",
        "EOB analyzer & charts",
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
      price: "$39.99",
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
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">Simpli-Docs</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/upload">
                <Button variant="outline" data-testid="button-try-now">
                  Try Now
                </Button>
              </Link>
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
            <span className="text-primary block">Into Plain English</span>
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
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" data-testid="button-watch-demo">
              <Users className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
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
            <p className="text-lg text-muted-foreground">
              Start free, upgrade when you need more features
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
                  
                  <Link to="/upload">
                    <Button 
                      className="w-full" 
                      variant={tier.popular ? "default" : "outline"}
                      data-testid={`button-${tier.cta.toLowerCase().replace(' ', '-')}`}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
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