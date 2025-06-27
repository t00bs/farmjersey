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
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: express-session with PostgreSQL store
- **File Handling**: Multer for multipart form data and file uploads

### Database Architecture
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Authentication System
- **Provider**: Replit Auth using OpenID Connect protocol
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **User Management**: Automatic user creation and profile management
- **Security**: HTTP-only cookies with secure session handling

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
1. **User Authentication**: Users authenticate via Replit Auth
2. **Application Creation**: New grant applications created with draft status
3. **Progressive Completion**: Users complete sections (agricultural returns, land declarations, consent forms, supporting documents)
4. **Progress Tracking**: System tracks completion percentage across all required sections
5. **Document Upload**: Secure file upload with validation and storage
6. **Digital Signatures**: Canvas-based signature capture for consent forms
7. **Submission**: Final application submission with status change to submitted

### Data Persistence
- **User Data**: Stored in users table with profile information
- **Applications**: Grant applications with status and progress tracking
- **Documents**: File metadata and references stored in documents table
- **Sessions**: Authentication sessions persisted in PostgreSQL

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI primitives
- **express**: Web application framework
- **multer**: File upload handling
- **passport**: Authentication middleware

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type safety and tooling
- **tailwindcss**: Utility-first CSS framework
- **eslint**: Code linting and quality

### Authentication Dependencies
- **openid-client**: OpenID Connect implementation
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session management middleware

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
- **Database**: Automatic DATABASE_URL provisioning
- **Sessions**: Secure session secret configuration
- **Authentication**: Replit domains and OIDC configuration
- **File Storage**: Configurable upload directory

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 27, 2025. Initial setup