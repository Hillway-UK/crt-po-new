# CRT Property Approvals Hub

Purchase Order and Invoice management system for CRT Property Investments Ltd.

## Overview

This application streamlines the approval workflow for purchase orders and invoices, providing role-based access and automated notifications.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn-ui with Radix UI
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database & Edge Functions)
- **Deployment**: Vercel

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development environment
- `npm run build:prod` - Build for production environment
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

### Development Environment

```sh
npm run deploy:dev
```

### Production Environment

```sh
npm run deploy:prod
```

The application is configured for deployment to Vercel with separate development and production environments.

## Project Structure

- `/src` - Application source code
  - `/components` - React components
  - `/pages` - Page components
  - `/hooks` - Custom React hooks
  - `/lib` - Utility functions and configurations
- `/supabase` - Supabase configuration and edge functions
- `/public` - Static assets

## License

Copyright © 2025 CRT Property Investments Ltd. All rights reserved.
