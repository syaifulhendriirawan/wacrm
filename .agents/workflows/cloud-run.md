---
name: cloud-run
description: Verify local code, perform manual Cloud Run deployments, and check GitHub Actions CI/CD status
---

# Workflow: Waflow Cloud Run & CI/CD Operations

Use this workflow to assist the user with common deployment, verification, and pipeline status tasks.

## Tasks Supported

### 1. Verify Local Code Quality (`/cloud-run verify`)
Before pushing changes or deploying, run these verification steps to ensure no build or test regressions:
1. Run Lint: `npm run lint`
2. Run Typecheck: `npm run typecheck`
3. Run Tests: `npm test`
4. Test Standalone Build: `npm run build`

### 2. Manual Deployment to Cloud Run (`/cloud-run deploy`)
If the user wants to manually deploy local changes to the Jakarta region on Google Cloud Run:
1. **Load Secrets**: Read `.env.local` to extract build and runtime variables:
   - Public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
   - Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `META_APP_SECRET`
2. **Write Temp .env**: Write only the public build variables to `.env` in the root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<val>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<val>
   NEXT_PUBLIC_SITE_URL=<val>
   ```
3. **Execute gcloud Deploy**: Run:
   ```powershell
   gcloud run deploy waflow-service --source . --project waflow-app --region asia-southeast2 --allow-unauthenticated --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKey,ENCRYPTION_KEY=$encryptionKey,META_APP_SECRET=$metaAppSecret"
   ```
4. **Cleanup**: Automatically delete `.env` when the build finishes or fails.
5. **Report**: Output the Service URL on success.

### 3. Check GitHub Actions CI/CD Status (`/cloud-run status`)
To monitor the automated pipeline runs:
1. Run `gh run list --limit 5 --workflow "CI/CD Pipeline to Cloud Run"` to see recent runs.
2. If a run is in progress or recently failed, run `gh run view <run-id>` to check status or `gh run view <run-id> --log-failed` to fetch error logs.

---

## Agent Guidelines

- Never output or leak credentials (secrets) retrieved from `.env.local` to the terminal/user.
- Always ensure `.env` cleanup runs in a `finally` block or clean-up step.
