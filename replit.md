# Rural Support Scheme Portal

## Overview

The Rural Support Scheme Portal is a full-stack web application designed to streamline the process of applying for government grants for farmers and rural communities. It provides a comprehensive digital platform for managing grant applications, handling document uploads, and tracking application progress. The project's vision is to modernize and simplify access to rural support, fostering efficiency and transparency in grant distribution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application employs a modern full-stack architecture with a clear separation of concerns.

**Frontend:**
-   **Framework**: React 18 with TypeScript
-   **Routing**: Wouter
-   **State Management**: TanStack Query (React Query)
-   **UI**: Radix UI primitives with shadcn/ui design system
-   **Styling**: Tailwind CSS
-   **Build Tool**: Vite

**Backend:**
-   **Runtime**: Node.js with Express.js
-   **Language**: TypeScript (ES modules)
-   **Authentication**: Supabase Auth (JWT tokens, email/password, magic link)
-   **Authorization**: JWT-based middleware with role checking (admin vs. user)
-   **File Handling**: Multer for multipart form data uploads

**Database:**
-   **Database**: Supabase PostgreSQL
-   **ORM**: Drizzle ORM
-   **Security**: Row Level Security (RLS) for data access control
-   **Schema Management**: SQL migrations

**Key Features:**
-   **Authentication System**: Secure invitation-only signup, email/password, magic link, JWT-based stateless sessions, role-based access. Includes robust security features like SHA-256 hashed password reset tokens, strong password policy, rate limiting, and sensitive data redaction.
-   **Grant Application Management**: Multi-step forms with progressive completion, status tracking (draft, in_progress, submitted, approved, rejected), and year-based application cycles.
-   **Document Management**: Secure file uploads (images, PDFs, Office docs) with type validation, stored in Supabase Storage. Includes downloadable templates and migration capabilities for legacy files.
-   **Digital Signature System**: HTML5 canvas-based signature capture for consent forms, stored as Base64 encoded data.
-   **Data Flow**: The application workflow includes admin invitations, user registration with enforced tokens, authenticated API requests, progressive application completion, secure document uploads, digital signatures, and final submission. Data persistence covers user profiles, applications, documents, and invitations.
-   **Security**: Invitation-only signup enforced at the database level, RLS, role-based access, JWT authentication, email validation, token expiry, one-time token use, and secure password reset.

## External Dependencies

-   **@supabase/supabase-js**: Supabase client for authentication and database interactions.
-   **drizzle-orm**: Type-safe ORM for PostgreSQL database operations.
-   **@tanstack/react-query**: For server state management and caching.
-   **@radix-ui/react-***: Accessible UI primitives.
-   **express**: Web application framework for the Node.js backend.
-   **multer**: Middleware for handling `multipart/form-data`, used for file uploads.
-   **resend**: Email service for sending invitations and password reset emails.
-   **pdf-lib**: Library for generating and modifying PDF documents.