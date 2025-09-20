# Overview

Plain-Language Doc Explainer is a web application that transforms complex legal and medical documents into clear, understandable explanations. Users can upload documents in various formats (PDF, DOCX, TXT, PNG, JPG), and the application provides plain-language summaries, technical term definitions, and an interactive Q&A interface. The system supports multilingual output and emphasizes privacy and safety disclaimers.

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
- **Storage**: Abstracts data persistence with both in-memory and database implementations

**API Design:**
- RESTful endpoints for document upload, processing, and retrieval
- Session-based document management for privacy
- Multer middleware for file upload handling with type validation
- Error handling middleware with structured responses

## Data Storage Solutions

The application uses a hybrid storage approach with Drizzle ORM for type-safe database operations:

**Database Schema:**
- **Users**: Basic authentication (currently unused in main flow)
- **Documents**: Stores document metadata, processed text, summaries, and glossaries
- **QA Interactions**: Tracks question-answer pairs with citations and confidence scores

**Storage Strategy:**
- PostgreSQL for production data persistence
- In-memory storage fallback for development and testing
- Session-based cleanup for privacy compliance
- File content processed in-memory without permanent storage

## Authentication and Authorization

Currently implements a session-based approach without user authentication for the main document processing flow. The system generates temporary session IDs for document association and cleanup.

**Security Measures:**
- File type validation and size limits
- Temporary session management
- Automatic cleanup of processed documents
- Privacy-first design with prominent disclaimers

## External Dependencies

### Third-Party Services
- **OpenAI API**: Powers document summarization, glossary generation, and Q&A functionality using GPT models
- **Neon Database**: Serverless PostgreSQL for production data storage

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