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
- **Storage**: Supabase Storage with 10MB upload limit (same geographic region as database)
- **Templates**: Downloadable document templates for users
- **Migration**: Scripts available to migrate legacy local files to Supabase Storage

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
- **resend**: Email service for invitations and password reset

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
- **File Storage**: Supabase Storage (uses same credentials as database)

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
- **Password Reset Security**: SHA-256 hashed tokens stored in database, single-use with 1-hour expiry
- **Password Policy**: Minimum 8 characters with at least one letter and one number (enforced frontend + backend)
- **Rate Limiting**: Authentication endpoints protected (forgot-password: 5/hour, reset-password: 10/15min)
- **Log Redaction**: Sensitive fields (passwords, tokens, JWTs, Authorization headers) automatically redacted from server logs

## Known Issues

### Profile Fetch Performance
- **Issue**: User profile queries from Supabase sometimes take longer than expected (>10 seconds)
- **Mitigation**: Implemented 10-second timeout wrapper in `useAuth` hook to prevent infinite loading states
- **Impact**: Users may see login page after timeout with console warning, but app remains functional
- **Potential Causes**: RLS policy complexity, missing indexes, network latency with Supabase pooler
- **Status**: Timeout protection deployed, root cause investigation pending

## Changelog

Changelog:
- January 8, 2026. **SECTION H TERMS AND CONDITIONS UPDATE**:
  - Replaced placeholder consent information with full RSS Declaration and Consent
  - Added 19 Declaration Notes covering accounts, audits, inspections, and compliance requirements
  - Added Safeguarding section with child/vulnerable adult protection acknowledgments
  - Added comprehensive Consent Information referencing Agricultural Returns Laws
  - Declaration section now includes scrollable content area for lengthy terms
  - Added links to gov.je, safeguarding.je, and ruraleconomy@gov.je for further information
- January 8, 2026. **SECURE APPLICATION URLS**:
  - Application URLs now use random 8-character publicId instead of sequential numeric IDs
  - Prevents enumeration attacks where someone could guess application IDs
  - Added viewWithAuth function for authenticated document viewing in admin dashboard
- January 7, 2026. **AGRICULTURAL RETURN FORM RESTRUCTURING**:
  - Added new Section B (Accreditation) with LEAF membership options, Organic certification options, and other certifications (BRC, GlobalGAP, Red Tractor, SALSA, KIWA, British Horse Society)
  - Reorganized sections: A (Farm Details), B (Accreditation - NEW), C (Integrated Farm Management), D (Land and Facilities), E (Farm Livestock), F (Tier 3), G (Financial Declaration), H (Declaration)
  - Updated Land and Facilities intro text to mention field list and employee details requirement
  - Added accreditation_data JSONB column to agricultural_returns table
  - Updated CSV/Excel export to include new accreditation fields
  - Database migration script updated with new column additions
- December 4, 2025. **PDF PREVIEW FIX**:
  - Replaced browser-native `<object>` tag with react-pdf library for universal PDF rendering
  - PDFs now render as canvas images that work in all browsers including mobile
  - Added pagination controls for multi-page PDF documents
  - Added loading spinner and fallback download button for error cases
  - Uses PDF.js worker from unpkg CDN for efficient PDF parsing
- December 4, 2025. **NAVIGATION PERFORMANCE FIX**:
  - Changed delete redirect from window.location.href to wouter's navigate() for instant client-side navigation
  - Optimized useAuth to skip Supabase profile fetches when session storage cache is fresh
  - Auth state changes for TOKEN_REFRESHED and INITIAL_SESSION now use cached profile data
  - Eliminates full page reload and auth re-initialization delays after deleting applications
- December 3, 2025. **PERFORMANCE OPTIMIZATIONS**:
  - Added auth token caching in memory to avoid repeated Supabase authentication calls
  - Implemented pagination for admin applications endpoint (20 items per page with proper COUNT(*) aggregate)
  - Added user profile caching in session storage with 5-minute TTL
  - Fixed query invalidation using predicate pattern for proper cache updates after mutations
  - Changed support link to mailto:help@farmjersey.je
  - Added 5-second timeout protection for auth header fetches to prevent long waits
  - Added in-memory response caching with 1-minute TTL on client side
  - Configured React Query with 30-second stale time and 5-minute garbage collection
  - Added Cache-Control headers to server responses (15-30s for data, 5min for templates)
  - Fixed delete application redirect to go to root (/) instead of /dashboard
- December 2, 2025. **ADMIN USER MANAGEMENT**:
  - Added Users tab in admin dashboard for role management
  - Created API endpoints GET /api/admin/users and PATCH /api/admin/users/:id/role
  - Admins can promote users to admin role or demote back to regular users
  - Self-demotion protection on both backend and frontend (admins cannot demote themselves)
- December 2, 2025. **USER EXPERIENCE & ADMIN ACCESS CONTROL**:
  - Added post-signup confirmation screen with success message and next steps guidance
  - Hidden admin dashboard navigation from sidebar for non-admin users
  - Added frontend route protection for admin pages with redirect and notification for unauthorized users
  - Implemented wrapper component pattern in admin dashboard for proper React hooks compliance
- December 2, 2025. **SECURITY HARDENING**: Enhanced authentication security
  - SHA-256 token hashing for password reset tokens before database storage
  - Strengthened password policy requiring 8+ characters with letters and numbers
  - Added rate limiting: forgot-password (5 requests/hour), reset-password (10/15min)
  - Implemented secure logging with automatic redaction of sensitive data (passwords, tokens, JWTs, Authorization headers)
  - Log sanitization handles embedded tokens in error messages and nested objects
- December 1, 2025. **CUSTOM PASSWORD RESET**: Implemented custom password reset flow via Resend
  - Added password_reset_tokens table for secure token storage
  - Created /api/forgot-password endpoint that generates tokens and sends branded emails via Resend
  - Created /api/validate-reset-token and /api/reset-password endpoints for secure password updates
  - Tokens expire after 1 hour and are single-use
  - Uses x-forwarded headers for correct production URL generation
  - Professional HTML email template with Farm Jersey branding
- December 1, 2025. **FILE STORAGE MIGRATION**: Migrated document storage from local filesystem to Supabase Storage
  - All uploaded documents now stored in Supabase Storage bucket for geographic consistency
  - Documents stored in same region as database for data residency compliance
  - Added backward compatibility for legacy local files
  - Created migration script (scripts/migrate-to-supabase-storage.ts) for existing files
  - Updated upload, download, and delete routes to use Supabase Storage
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