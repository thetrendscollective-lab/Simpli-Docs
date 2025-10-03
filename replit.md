# Overview

Simpli-Docs (formerly Plain-Language Doc Explainer) is a web application that transforms complex legal and medical documents into clear, understandable explanations. Users can upload documents in various formats (PDF, DOCX, TXT, PNG, JPG), and the application provides plain-language summaries, technical term definitions, and an interactive Q&A interface. The system supports multilingual output and features a specialized Insurance Bill Analyzer (EOB) for Pro users. The application emphasizes privacy and safety with clear disclaimers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built as a React single-page application using TypeScript and Vite for development and building. The component structure follows a modular design with shadcn/ui components for consistent styling and Tailwind CSS for utility-first styling.

**Key Design Patterns:**
- Component-based architecture with reusable UI components
- React Query for server state management and caching
- Wouter for lightweight client-side routing
- Context providers for global state (tooltips, toasts)
- Custom hooks for file processing and document management

**UI Framework:**
- Radix UI primitives for accessible components
- Tailwind CSS with custom design tokens
- Dark/light theme support via CSS variables
- Responsive design with mobile-first approach

## Backend Architecture

The backend uses Express.js with TypeScript, following a service-oriented architecture pattern. File processing is handled through dedicated service classes for document parsing, OCR, and AI integration.

**Core Services:**
- **DocumentProcessor**: Handles text extraction from PDF, DOCX, and plain text files
- **OCRService**: Processes scanned images and documents using Tesseract.js
- **OpenAIService**: Manages AI-powered summarization, glossary generation, and Q&A functionality
- **LanguageDetectionService**: Automatically detects document language for multilingual support
- **EOBDetectionService**: Identifies Explanation of Benefits (medical insurance bill) documents
- **EOBExtractionService**: Extracts structured financial data from EOB documents using OpenAI
- **Storage**: Abstracts data persistence with both in-memory and database implementations

**API Design:**
- RESTful endpoints for document upload, processing, and retrieval
- Session-based document management for privacy
- Multer middleware for file upload handling with type validation
- Error handling middleware with structured responses
- Specialized EOB endpoints for CSV export and appeal letter generation (Pro/Family only)
- Authentication middleware with plan-based access control

## Data Storage Solutions

The application uses a hybrid storage approach with Drizzle ORM for type-safe database operations:

**Database Schema:**
- **Users**: Replit Auth integration with Stripe subscription tracking (currentPlan, subscriptionStatus)
- **Documents**: Stores document metadata, processed text, summaries, glossaries, detected language, document type, and EOB data
- **QA Interactions**: Tracks question-answer pairs with citations and confidence scores
- **Subscriptions**: Tracks Stripe subscription details and billing cycles
- **UsageTracking**: Monitors free tier usage limits by IP address

**Storage Strategy:**
- PostgreSQL for production data persistence
- In-memory storage fallback for development and testing
- Session-based cleanup for privacy compliance
- File content processed in-memory without permanent storage

## Authentication and Authorization

The application uses Replit Auth for user authentication with Stripe-based subscription management. Features are tiered based on subscription plans (Free, Standard, Pro, Family).

**Subscription Tiers:**
- **Free**: 2 documents/month, English-only output
- **Standard ($4.99/mo)**: Unlimited docs, 21-language support, reading level selection
- **Pro ($9.99/mo)**: All Standard features + Insurance Bill Analyzer (EOB), deadline tracking, exports
- **Family ($14.99/mo)**: Pro features for multiple family members

**Security Measures:**
- Replit Auth integration with JWT-based session management
- Plan-based feature gating (middleware enforcement)
- Document ownership verification (userId-based access control)
- File type validation and size limits (25MB max)
- Automatic cleanup of processed documents
- Secure storage of sensitive EOB data with ownership tracking
- Privacy-first design with prominent disclaimers

**EOB Security:**
- Pro/Family plan required for EOB detection and processing
- Documents stored with userId as sessionId for ownership tracking
- Export endpoints verify authentication AND document ownership
- Prevents cross-user data access even with UUID guessing attacks

## External Dependencies

### Third-Party Services
- **OpenAI API**: Powers document summarization, glossary generation, Q&A, language detection, and EOB extraction using GPT-4o and GPT-4o-mini models
- **Neon Database**: Serverless PostgreSQL for production data storage
- **Stripe**: Payment processing and subscription management for tiered plans
- **Replit Auth**: User authentication and session management

### Key Libraries
- **PDF Processing**: pdf.js for client-side PDF text extraction
- **Document Parsing**: Mammoth.js for DOCX file processing
- **OCR**: Tesseract.js for image-to-text conversion
- **Database**: Drizzle ORM with PostgreSQL adapter
- **Validation**: Zod for schema validation and type safety

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across frontend and backend
- **React Query**: Server state management and caching
- **Tailwind CSS**: Utility-first styling framework

The architecture prioritizes privacy, accessibility, and user experience while maintaining clear separation of concerns between document processing, AI integration, and user interface components.

## Key Features

### Automatic Language Detection (October 2025)
- Automatically detects document language using OpenAI with 21-language support
- Returns confidence percentage for detection accuracy
- Paid users (Standard+) receive explanations in detected language automatically
- Free users always receive English output with upgrade prompts
- Manual language selection overrides automatic detection

### Insurance Bill Analyzer (EOB) - Pro Feature (October 2025)
Specialized feature for Pro and Family subscribers that transforms complex medical insurance bills (Explanation of Benefits) into clear, actionable insights.

**Detection & Extraction:**
- Automatic EOB detection using keyword analysis with confidence scoring
- Structured data extraction: payer info, member details, claim numbers, service dates
- Line-item parsing: procedure codes (CPT/HCPCS), diagnosis codes (ICD), billed/allowed/paid amounts
- Patient responsibility breakdown: deductible, copay, coinsurance, not covered amounts

**Financial Analysis:**
- Plain-language cost summary (e.g., "You owe $84.12 because $50 applied to deductible + $34.12 coinsurance")
- Visual cost breakdown chart showing insurance paid vs patient responsibility
- Automatic financial calculations and totals

**Issue Detection:**
- Duplicate billing identification
- Denial detection with reasons
- Out-of-network service alerts
- High-cost warnings
- Potential savings calculations for each issue

**Export Features:**
- CSV export of all line items with financial summary
- AI-generated appeal letters for denied or disputed claims
- One-click downloads for record keeping

**Security:**
- Pro/Family plan enforcement at all levels (detection, extraction, storage, export)
- Secure document storage with userId-based ownership tracking
- Export endpoints verify authentication and document ownership
- No cross-user data access possible

**User Experience:**
- Clear "Insurance Bill Analyzer" branding (avoiding technical jargon like "EOB")
- Visual cost breakdown with color-coded charts
- Severity-based issue alerts (high/medium/low)
- Comprehensive service details table
- Export actions clearly labeled

**Technical Implementation:**
- Detection: keyword-based with 40+ EOB-specific terms
- Extraction: OpenAI GPT-4o for structured data extraction
- Storage: JSONB field in documents table for flexible EOB data structure
- API: Dedicated /api/eob endpoints for exports with middleware protection
- UI: EOBAnalyzer component with visual charts and interactive elements