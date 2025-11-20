# Rural Support Scheme Portal

## Overview

The Rural Support Scheme Portal is a full-stack web application designed to streamline the process of applying for government grants for farmers and rural communities. The application provides a comprehensive digital platform for managing grant applications, handling document uploads, and tracking application progress through various stages.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: JWT-based middleware with role checking
- **File Handling**: Multer for multipart form data and file uploads

### Database Architecture
- **Database**: Supabase PostgreSQL (fully managed)
- **ORM**: Drizzle ORM for type-safe database operations
- **Row Level Security**: Database-level access control policies
- **Schema Management**: SQL migrations executed in Supabase

## Key Components

### Authentication System
- **Provider**: Supabase Auth
- **Authentication Methods**: 
  - Email/password authentication
  - Magic link (passwordless) authentication
- **Session Management**: JWT-based stateless authentication
- **User Management**: Automatic profile creation via database triggers
- **Security**: JWT tokens, Row Level Security policies, invitation-only signup
- **Authorization**: Role-based access control (admin vs user) stored in database

### Grant Application Management
- **Multi-step Forms**: Progressive application completion with status tracking
- **Progress Tracking**: Percentage-based completion indicators
- **Status Management**: Draft, in_progress, submitted, approved, rejected states
- **Deadline Management**: Year-based application cycles

### Document Management
- **File Upload**: Secure file handling with type validation (images, PDFs, Office docs)
- **Document Types**: Land declarations, supporting documents, agricultural returns
- **Storage**: Local file system with configurable upload limits (10MB)
- **Templates**: Downloadable document templates for users

### Digital Signature System
- **Canvas-based Signatures**: HTML5 canvas for signature capture
- **Signature Storage**: Base64 encoded signature data
- **Consent Management**: Digital consent form completion tracking

## Data Flow

### Application Workflow
1. **Invitation**: Admin sends email invitation with unique token (7-day expiry)
2. **User Registration**: Users sign up with invitation token (enforced at database level)
3. **Authentication**: Users sign in via email/password or magic link
4. **Authorization**: JWT token validated on every API request, role checked for admin routes
5. **Application Creation**: New grant applications created with draft status
6. **Progressive Completion**: Users complete sections (agricultural returns, land declarations, consent forms, supporting documents)
7. **Progress Tracking**: System tracks completion percentage across all required sections
8. **Document Upload**: Secure file upload with validation and storage
9. **Digital Signatures**: Canvas-based signature capture for consent forms
10. **Submission**: Final application submission with status change to submitted

### Data Persistence
- **User Data**: Stored in users table (references Supabase auth.users via UUID)
- **Applications**: Grant applications with status and progress tracking
- **Documents**: File metadata and references stored in documents table
- **Invitations**: Invitation tokens with email, expiry, and usage tracking
- **Sessions**: Stateless JWT tokens (no server-side session storage)

## External Dependencies

### Core Dependencies
- **@supabase/supabase-js**: Supabase client for auth and database
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI primitives
- **express**: Web application framework
- **multer**: File upload handling
- **resend**: Email service for invitations

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type safety and tooling
- **tailwindcss**: Utility-first CSS framework
- **drizzle-kit**: Database schema management

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with npm package management
- **Database**: PostgreSQL 16 with automatic provisioning
- **Development Server**: Vite dev server with hot module replacement
- **Port Configuration**: Application runs on port 5000

### Production Build
- **Frontend**: Vite builds React application to static assets
- **Backend**: esbuild bundles server code for Node.js runtime
- **Database**: Automatic database migrations with Drizzle Kit
- **Deployment**: Replit autoscale deployment with health checks

### Environment Configuration
- **Database**: DATABASE_URL pointing to Supabase PostgreSQL
- **Authentication**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Frontend**: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- **Email**: RESEND_API_KEY for sending invitations
- **File Storage**: Configurable upload directory

## User Preferences

Preferred communication style: Simple, everyday language.

### Security Features
- **Invitation-Only Signup**: Pre-signup validation enforced at database level via SQL trigger
- **Row Level Security (RLS)**: Database policies ensure users only access their own data
- **Role-Based Access**: Admin vs user roles with different permissions
- **JWT Authentication**: Stateless token-based auth with automatic refresh
- **Email Validation**: Invitation emails must match signup emails
- **Token Expiry**: Invitations expire after 7 days
- **One-Time Use**: Invitation tokens can only be used once

## Known Issues

### Profile Fetch Performance
- **Issue**: User profile queries from Supabase sometimes take longer than expected (>10 seconds)
- **Mitigation**: Implemented 10-second timeout wrapper in `useAuth` hook to prevent infinite loading states
- **Impact**: Users may see login page after timeout with console warning, but app remains functional
- **Potential Causes**: RLS policy complexity, missing indexes, network latency with Supabase pooler
- **Status**: Timeout protection deployed, root cause investigation pending

## Changelog

Changelog:
- November 20, 2025. Fixed infinite loading state after page refresh
  - Added timeout wrapper function to prevent Supabase queries from hanging
  - Implemented try-finally blocks to ensure loading state always completes
  - Added console warnings for timeout debugging
  - Documented known profile fetch performance issue
- October 29, 2025. **MAJOR MIGRATION**: Migrated from Replit Auth to Supabase Auth
  - Replaced OIDC authentication with Supabase email/password + magic link
  - Migrated from Neon to Supabase PostgreSQL
  - Implemented Row Level Security policies for all tables
  - Added invitation-only signup with database-level enforcement
  - Removed session-based auth in favor of JWT tokens
  - Added role-based access control via database column
- June 27, 2025. Initial setup