# Deployment Guide - Vercel (Dev & Production)

This guide will help you deploy the CRT PO System to Vercel with separate dev and production environments.

## Prerequisites

- [Vercel Account](https://vercel.com/signup) (Free Hobby plan)
- [Vercel CLI](https://vercel.com/docs/cli) installed (optional but recommended)
- GitHub repository with your code
- Supabase projects (1 for dev, 1 for production recommended)

## Table of Contents

1. [Supabase Setup](#supabase-setup)
2. [Local Environment Setup](#local-environment-setup)
3. [Vercel Account Setup](#vercel-account-setup)
4. [Deploy Development Environment](#deploy-development-environment)
5. [Deploy Production Environment](#deploy-production-environment)
6. [Managing Deployments](#managing-deployments)
7. [Troubleshooting](#troubleshooting)

---

## Supabase Setup

You'll need two Supabase projects - one for development and one for production.

### Option 1: Create Separate Projects (Recommended)

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project for **Development**:
   - Name: `crt-po-dev`
   - Database Password: (save this securely)
   - Region: Choose closest to your users
3. Create another project for **Production**:
   - Name: `crt-po-prod`
   - Database Password: (save this securely)
   - Region: Same as dev for consistency

4. For each project, get the credentials:
   - Go to Project Settings → API
   - Copy `Project URL`
   - Copy `anon public` key
   - Note the `Project ID` (from the URL)

### Option 2: Use Same Project for Both (Budget-Friendly)

If you want to save on Supabase projects, you can use the same project for both environments. Just be careful with data!

---

## Local Environment Setup

### Step 1: Create Local Environment File

Copy the example environment file:

```bash
cp .env.example .env.local
```

### Step 2: Update .env.local

Edit `.env.local` with your development Supabase credentials:

```env
# Development Supabase Project
VITE_SUPABASE_PROJECT_ID="your-dev-project-id"
VITE_SUPABASE_URL="https://your-dev-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-dev-anon-key"

# App Configuration
VITE_APP_ENV="development"
VITE_APP_NAME="CRT PO System (Dev)"
```

### Step 3: Test Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:8080` to verify everything works.

---

## Vercel Account Setup

### Step 1: Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

---

## Deploy Development Environment

### Method 1: Using Vercel CLI (Recommended)

#### Step 1: Link Your Project

```bash
vercel link
```

- Select your Vercel account
- Choose "Create a new project" or select existing
- Name it: `crt-po-dev`

#### Step 2: Set Environment Variables

```bash
# Set dev environment variables
vercel env add VITE_SUPABASE_PROJECT_ID development
# Enter your dev project ID when prompted

vercel env add VITE_SUPABASE_URL development
# Enter your dev URL: https://your-dev-project-id.supabase.co

vercel env add VITE_SUPABASE_PUBLISHABLE_KEY development
# Enter your dev anon key

vercel env add VITE_APP_ENV development
# Enter: development

vercel env add VITE_APP_NAME development
# Enter: CRT PO System (Dev)
```

#### Step 3: Deploy

```bash
vercel --prod
```

Your dev environment will be deployed!

### Method 2: Using Vercel Dashboard

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Project Name**: `crt-po-dev`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variables:
   - Click "Environment Variables"
   - Add each variable for **Development** environment:
     - `VITE_SUPABASE_PROJECT_ID`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_PUBLISHABLE_KEY`
     - `VITE_APP_ENV` = `development`
     - `VITE_APP_NAME` = `CRT PO System (Dev)`

5. Click "Deploy"

---

## Deploy Production Environment

### Method 1: Using Vercel CLI

#### Step 1: Create Production Project

```bash
# Create a new production project
vercel --name crt-po-prod
```

#### Step 2: Set Production Environment Variables

```bash
# Set production environment variables
vercel env add VITE_SUPABASE_PROJECT_ID production
# Enter your prod project ID

vercel env add VITE_SUPABASE_URL production
# Enter your prod URL: https://your-prod-project-id.supabase.co

vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# Enter your prod anon key

vercel env add VITE_APP_ENV production
# Enter: production

vercel env add VITE_APP_NAME production
# Enter: CRT PO System
```

#### Step 3: Deploy

```bash
vercel --prod
```

### Method 2: Using Vercel Dashboard

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import the **same** GitHub repository again
3. Configure project:
   - **Project Name**: `crt-po-prod`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variables for **Production**:
   - `VITE_SUPABASE_PROJECT_ID` (your prod project ID)
   - `VITE_SUPABASE_URL` (your prod URL)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (your prod key)
   - `VITE_APP_ENV` = `production`
   - `VITE_APP_NAME` = `CRT PO System`

5. Click "Deploy"

---

## Deployment Workflow

### Branch Strategy

**Recommended Setup:**

- `main` branch → Production deployment (auto-deploy)
- `develop` branch → Development deployment (auto-deploy)
- Feature branches → Preview deployments

### Configure Git Integration in Vercel

#### For Development Project (`crt-po-dev`):

1. Go to Project Settings → Git
2. Set **Production Branch**: `develop`
3. Enable "Automatic Deployments"

#### For Production Project (`crt-po-prod`):

1. Go to Project Settings → Git
2. Set **Production Branch**: `main`
3. Enable "Automatic Deployments"

### Deployment Flow

```bash
# Development workflow
git checkout develop
git add .
git commit -m "feat: add new feature"
git push origin develop
# → Auto-deploys to crt-po-dev.vercel.app

# Production workflow
git checkout main
git merge develop
git push origin main
# → Auto-deploys to crt-po-prod.vercel.app
```

---

## Managing Deployments

### View Your Deployments

**Vercel Dashboard:**
- Dev: https://vercel.com/your-username/crt-po-dev
- Prod: https://vercel.com/your-username/crt-po-prod

**CLI:**
```bash
vercel ls
```

### Rollback a Deployment

**Dashboard:**
1. Go to your project
2. Click "Deployments"
3. Find the working deployment
4. Click "..." → "Promote to Production"

**CLI:**
```bash
vercel rollback
```

### View Deployment Logs

**Dashboard:**
1. Go to Deployments
2. Click on a deployment
3. View "Build Logs" or "Runtime Logs"

**CLI:**
```bash
vercel logs
```

### Custom Domains

#### Development Environment

1. Go to `crt-po-dev` project → Settings → Domains
2. Add: `dev.yourapp.com` or `staging.yourapp.com`

#### Production Environment

1. Go to `crt-po-prod` project → Settings → Domains
2. Add: `yourapp.com` and `www.yourapp.com`

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | `abc123xyz` |
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123xyz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | `eyJhbGci...` |
| `VITE_APP_ENV` | Environment name | `development` or `production` |
| `VITE_APP_NAME` | App display name | `CRT PO System` |

### Updating Environment Variables

**Via Dashboard:**
1. Go to Project Settings → Environment Variables
2. Edit or add variables
3. Redeploy for changes to take effect

**Via CLI:**
```bash
# Update a variable
vercel env rm VITE_APP_NAME production
vercel env add VITE_APP_NAME production
# Enter new value

# Trigger new deployment
vercel --prod
```

---

## Troubleshooting

### Build Fails

**Check build logs:**
1. Go to Vercel dashboard
2. Click on failed deployment
3. View "Build Logs"

**Common issues:**
- Missing environment variables → Add them in Settings
- TypeScript errors → Run `npm run build` locally first
- Dependency issues → Delete `node_modules` and reinstall

### Environment Variables Not Working

- Ensure variables start with `VITE_` prefix
- Redeploy after adding/changing variables
- Check they're set for correct environment (dev/prod/preview)

### White Screen / 404 Errors

**Check `vercel.json` configuration:**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures React Router works correctly.

### Supabase Connection Issues

1. Verify environment variables are correct
2. Check Supabase project is running
3. Verify API keys haven't expired
4. Check CORS settings in Supabase dashboard

### Performance Issues

1. Enable caching in `vercel.json` (already configured)
2. Use Vercel Analytics to identify bottlenecks
3. Consider code splitting for large bundles

---

## Cost Optimization (Free Tier Limits)

### Vercel Free Tier Includes:

- Unlimited deployments
- Unlimited preview deployments
- 100 GB bandwidth/month
- Serverless Function Execution: 100 GB-Hours
- 6,000 build minutes/month

### Tips to Stay Within Free Tier:

1. **Limit preview deployments**: Configure to only deploy from specific branches
2. **Use deployment protection**: Prevent accidental deployments
3. **Monitor usage**: Check Vercel dashboard regularly
4. **Optimize builds**: Faster builds = fewer minutes used

---

## Security Best Practices

### Environment Variables

- ✅ Never commit `.env` files to git
- ✅ Use different keys for dev and prod
- ✅ Rotate keys regularly
- ✅ Use Vercel's encrypted storage

### Supabase

- ✅ Enable Row Level Security (RLS)
- ✅ Use anon key only (never service role key in frontend)
- ✅ Set up proper database policies
- ✅ Enable 2FA on Supabase account

### Vercel

- ✅ Enable Vercel Authentication for preview deployments
- ✅ Use deployment protection for production
- ✅ Enable 2FA on Vercel account
- ✅ Review deployment logs regularly

---

## Quick Reference Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Vercel (production)
vercel --prod

# Deploy to Vercel (preview)
vercel

# View deployments
vercel ls

# View logs
vercel logs

# Remove deployment
vercel remove [deployment-url]

# Open project in dashboard
vercel open
```

---

## Getting Help

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev
- **Vercel Support**: https://vercel.com/support

---

## Next Steps After Deployment

1. ✅ Set up custom domain
2. ✅ Configure Vercel Analytics
3. ✅ Set up error monitoring (Sentry)
4. ✅ Configure CI/CD with GitHub Actions
5. ✅ Set up automated testing before deployment
6. ✅ Configure staging environment protection
7. ✅ Set up database backups in Supabase
8. ✅ Configure monitoring and alerts

---

**Congratulations! Your app is now deployed to Vercel!** 🎉

Your deployments:
- **Development**: https://crt-po-dev.vercel.app
- **Production**: https://crt-po-prod.vercel.app
