# Quick Vercel Setup Guide

This is a simplified guide to get you deployed quickly. For complete details, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Step-by-Step Setup

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

Choose your preferred login method (GitHub, Email, etc.)

### 3. Prepare Your Supabase Credentials

You'll need these from your Supabase project:

- Project ID (e.g., `abc123xyz`)
- Project URL (e.g., `https://abc123xyz.supabase.co`)
- Anon/Public Key (starts with `eyJhbG...`)

**Get them here**: Supabase Dashboard → Project Settings → API

---

## Deploy Development Environment

### Step 1: Deploy to Vercel

```bash
npm run deploy:dev
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Your Vercel account
- **Link to existing project?** → No
- **Project name?** → `crt-po-dev`
- **Which directory?** → `./` (just press Enter)
- **Override settings?** → No

### Step 2: Add Environment Variables

After deployment, you need to add your Supabase credentials:

```bash
# Add Supabase Project ID
vercel env add VITE_SUPABASE_PROJECT_ID

# When prompted:
# - What's the value? → your-dev-project-id
# - Add to which environment? → Development
# - Add to which environment? → Preview (press Space to select)
# - Add to which environment? → Press Enter to confirm

# Add Supabase URL
vercel env add VITE_SUPABASE_URL
# Value: https://your-dev-project-id.supabase.co
# Environments: Development, Preview

# Add Supabase Key
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
# Value: your-anon-key-here
# Environments: Development, Preview

# Add App Environment
vercel env add VITE_APP_ENV
# Value: development
# Environments: Development, Preview

# Add App Name
vercel env add VITE_APP_NAME
# Value: CRT PO System (Dev)
# Environments: Development, Preview
```

### Step 3: Redeploy with Environment Variables

```bash
npm run deploy:dev
```

Your dev environment is now live! 🎉

---

## Deploy Production Environment

### Step 1: Deploy to Vercel

```bash
npm run deploy:prod
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Your Vercel account
- **Link to existing project?** → No
- **Project name?** → `crt-po-prod`
- **Which directory?** → `./` (just press Enter)
- **Override settings?** → No

### Step 2: Add Production Environment Variables

```bash
# Add Supabase Project ID
vercel env add VITE_SUPABASE_PROJECT_ID
# Value: your-prod-project-id
# Environment: Production

# Add Supabase URL
vercel env add VITE_SUPABASE_URL
# Value: https://your-prod-project-id.supabase.co
# Environment: Production

# Add Supabase Key
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
# Value: your-prod-anon-key
# Environment: Production

# Add App Environment
vercel env add VITE_APP_ENV
# Value: production
# Environment: Production

# Add App Name
vercel env add VITE_APP_NAME
# Value: CRT PO System
# Environment: Production
```

### Step 3: Redeploy Production

```bash
npm run deploy:prod
```

Your production environment is now live! 🚀

---

## Alternative: Deploy via Vercel Dashboard

If you prefer a GUI approach:

### 1. Go to Vercel Dashboard

Visit: https://vercel.com/new

### 2. Import Repository

- Click "Import Git Repository"
- Select your GitHub repository
- Click "Import"

### 3. Configure Development Project

- **Project Name**: `crt-po-dev`
- **Framework Preset**: Vite (auto-detected)
- **Root Directory**: `./`
- **Build Command**: `npm run build` (auto-filled)
- **Output Directory**: `dist` (auto-filled)

### 4. Add Environment Variables

Click "Environment Variables" and add:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_PROJECT_ID` | your-dev-project-id | Development, Preview |
| `VITE_SUPABASE_URL` | https://your-dev-project-id.supabase.co | Development, Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your-dev-anon-key | Development, Preview |
| `VITE_APP_ENV` | development | Development, Preview |
| `VITE_APP_NAME` | CRT PO System (Dev) | Development, Preview |

### 5. Deploy

Click "Deploy" and wait for build to complete.

### 6. Repeat for Production

- Import the same repository again
- Name it `crt-po-prod`
- Add production environment variables (only select "Production" environment)

---

## Access Your Deployments

After deployment, you'll get URLs like:

- **Development**: https://crt-po-dev.vercel.app
- **Production**: https://crt-po-prod.vercel.app

---

## Configure Automatic Deployments

### For Development (crt-po-dev):

1. Go to: https://vercel.com/your-username/crt-po-dev
2. Click "Settings" → "Git"
3. Set **Production Branch**: `develop`
4. Save

Now every push to `develop` branch auto-deploys to dev!

### For Production (crt-po-prod):

1. Go to: https://vercel.com/your-username/crt-po-prod
2. Click "Settings" → "Git"
3. Set **Production Branch**: `main`
4. Save

Now every push to `main` branch auto-deploys to production!

---

## Troubleshooting

### "Project not found" Error

Run this to link your local project:

```bash
vercel link
```

### Build Fails

Check if it builds locally first:

```bash
npm run build
```

If local build works but Vercel fails, check:
1. Environment variables are set correctly
2. Build logs in Vercel dashboard for specific errors

### Environment Variables Not Loading

Remember to redeploy after adding environment variables:

```bash
npm run deploy:dev  # for dev
npm run deploy:prod # for production
```

---

## Next Steps

✅ Set up custom domains (optional)
✅ Configure GitHub integration for auto-deployments
✅ Set up monitoring and analytics
✅ Configure database backups

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete guide.

---

**Need Help?**

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Supabase Docs: https://supabase.com/docs
