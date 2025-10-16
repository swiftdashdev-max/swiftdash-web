# Deployment Guide

This guide will help you deploy SwiftDash Admin to Netlify or other hosting platforms.

## Prerequisites

- Supabase project set up
- Mapbox account with access token
- Git repository ready

## Environment Variables

Before deploying, you need to configure the following environment variables:

### Required Variables

| Variable Name | Description | Where to Get It |
|--------------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | [Supabase Dashboard](https://app.supabase.com) → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (KEEP SECRET!) | Same as above |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox access token | [Mapbox Account](https://account.mapbox.com/access-tokens/) |

### Optional Variables

| Variable Name | Description | When to Use |
|--------------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Client-side service role (NOT RECOMMENDED) | Only if absolutely necessary for client operations |

## Deploying to Netlify

### Step 1: Connect Your Repository

1. Log in to [Netlify](https://www.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git provider (GitHub, GitLab, etc.)
4. Select your repository

### Step 2: Configure Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Node version**: 18.x or higher

### Step 3: Add Environment Variables

1. Go to Site settings → Environment variables
2. Add each of the required environment variables listed above
3. Click "Save"

### Step 4: Deploy

1. Click "Deploy site"
2. Wait for the build to complete
3. Your site will be live at the provided Netlify URL

## Deploying to Vercel

### Step 1: Connect Your Repository

1. Log in to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your Git repository

### Step 2: Configure Environment Variables

1. During import, expand "Environment Variables"
2. Add each required variable
3. Or add them later in Project Settings → Environment Variables

### Step 3: Deploy

1. Click "Deploy"
2. Vercel will automatically detect Next.js and configure build settings
3. Your site will be live at the provided Vercel URL

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd swiftdash-admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

4. Edit `.env.local` and add your actual keys (see `.env.local.example` for reference)

5. Run development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Security Checklist

Before deploying to production:

- [ ] All hardcoded API keys removed from source code
- [ ] `.env.local` is in `.gitignore` (already configured)
- [ ] Service role key is NEVER exposed to client (use only in server-side code)
- [ ] Environment variables configured in hosting platform
- [ ] All sensitive data properly secured

## Troubleshooting

### Map Not Loading

- Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is set correctly
- Check browser console for Mapbox errors
- Ensure your Mapbox token has the correct permissions

### Supabase Connection Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check Supabase project status
- Review CORS settings in Supabase dashboard

### Build Failures

- Ensure Node.js version is 18.x or higher
- Clear build cache and try again
- Check build logs for specific errors

## Support

For issues or questions, please check the [project documentation](./README.md) or open an issue in the repository.
