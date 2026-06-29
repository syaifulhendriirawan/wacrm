# Plan 003: Setup Google Cloud Run Deployment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c26ddf9..HEAD -- next.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c26ddf9`, 2026-06-29

## Why this matters

This plan adds support for containerizing the application and deploying it to Google Cloud Run. We will:
1. Configure Next.js to use `standalone` output mode to optimize container size (reduces image size from ~1GB to ~150MB by copying only necessary files and node_modules).
2. Create an optimized multi-stage `Dockerfile` and a `.dockerignore` file.
3. Configure the deployment pipeline so that the executor can build and push the container image to Google Artifact Registry, and then deploy it using the `cloudrun` MCP server.

## Current state

The project is a Next.js 16 app with Supabase.
- `next.config.ts` currently does not specify `output: 'standalone'`.
- There is no `Dockerfile` or `.dockerignore` in the root of the project.
- Excerpt of `next.config.ts` (lines 55-65):
```typescript
const nextConfig: NextConfig = {
  /**
   * Cache-Control policy.
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm ci`                 | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0, generates `.next/standalone` |

## Scope

**In scope** (the only files you should modify or create):
- `next.config.ts` (modify)
- `Dockerfile` (create)
- `.dockerignore` (create)

**Out of scope**:
- Direct modification of client files or business logic.
- Hardcoding secrets into the Dockerfile or repository code.

## Git workflow

- Branch: `advisor/003-cloud-run-deployment`
- Commit message style: `feat: add dockerfile and configure standalone next.js build for cloud run`

---

## Steps

### Step 1: Enable Standalone Output in Next.js

Add `output: 'standalone'` to the `nextConfig` object in `next.config.ts` to tell Next.js to automatically trace dependencies and bundle only the required files in `.next/standalone`.

Modify `next.config.ts` to include:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * Cache-Control policy.
```

**Verify**:
Run `npm run build` locally. Check that a `.next/standalone/` folder has been generated:
```powershell
Test-Path .next/standalone
```
Expected: `True`

---

### Step 2: Create .dockerignore

Create a `.dockerignore` file in the project root to ensure local builds, logs, and sensitive `.env` files are not copied into the Docker build context.

Create `c:\wacrm\.dockerignore` with the following content:
```
node_modules
.next
.git
.github
*.local
.env
.env*.local
README.md
docs
plans
```

**Verify**:
Ensure the `.dockerignore` file exists:
```powershell
Test-Path .dockerignore
```
Expected: `True`

---

### Step 3: Create Dockerfile

Create a `Dockerfile` optimized for Next.js standalone mode.
Because Next.js compiles public environment variables (`NEXT_PUBLIC_*`) into the client bundles at build time, the Dockerfile must accept them as build arguments. Private environment variables (like `SUPABASE_SERVICE_ROLE_KEY`) are accessed at runtime and should not be baked into the image.

Create `c:\wacrm\Dockerfile` with the following content:
```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the package-lock.json
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables for Next.js public variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prune and cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Verify**:
Build the docker image locally to verify it builds successfully (requires docker daemon running):
```powershell
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy -t wacrm:test .
```
Expected: Local docker build succeeds.

---

### Step 4: Deploy Using Cloud Run MCP Server

Once the container image is built, it must be pushed to Google Artifact Registry (or Google Container Registry) and deployed using the `cloudrun` MCP server.

1. **Tag and Push the Image**:
   First, tag the local image and push it to Google Artifact Registry:
   ```powershell
   # Replace GCP_PROJECT_ID, REGISTRY_NAME, and REGION with your actual GCP values
   docker tag wacrm:test REGION-docker.pkg.dev/GCP_PROJECT_ID/REGISTRY_NAME/wacrm:latest
   docker push REGION-docker.pkg.dev/GCP_PROJECT_ID/REGISTRY_NAME/wacrm:latest
   ```

2. **Deploy via MCP**:
   Invoke the `deploy_service_from_image` tool of the `cloudrun` MCP server with the following arguments:
   - `service`:
     - `name`: `wacrm-service`
     - `project`: `GCP_PROJECT_ID` (your Google Cloud project ID)
     - `region`: `us-central1` (or your preferred region)
     - `invokerIamDisabled`: `true` (to allow public, unauthenticated access so external WhatsApp webhook requests can reach it)
     - `template`:
       - `containers`:
         - `image`: `REGION-docker.pkg.dev/GCP_PROJECT_ID/REGISTRY_NAME/wacrm:latest`
         - `ports`:
           - `containerPort`: 8080
         - `env`:
           - `name`: `SUPABASE_SERVICE_ROLE_KEY`, `value`: `YOUR_SUPABASE_SERVICE_ROLE_KEY`
           - `name`: `ENCRYPTION_KEY`, `value`: `YOUR_ENCRYPTION_KEY`
           - `name`: `META_APP_SECRET`, `value`: `YOUR_META_APP_SECRET`

**Verify**:
Invoke `get_service` or `list_services` on the `cloudrun` MCP server to check the deployment status and obtain the service URL.

---

## Done criteria

- [ ] `next.config.ts` includes `output: "standalone"`.
- [ ] `Dockerfile` and `.dockerignore` exist in the root directory.
- [ ] Local build (`npm run build`) works and produces a standalone folder.
- [ ] The service is successfully deployed to Cloud Run, and is publicly accessible.
- [ ] `plans/README.md` is updated to show `DONE` status.

## STOP conditions

- If `npm run build` fails when standalone output is enabled.
- If the target GCP environment doesn't support Google Artifact Registry or Secret Manager.
- If the Cloud Run service fails to start due to missing environment variables.

## Maintenance notes

- Any new public environment variables added to the app in the future must be added as `ARG` and `ENV` in the `Dockerfile` build step.
- Secrets (`ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`) should ideally be mounted using Google Cloud Secret Manager instead of literal environment variables for enhanced production security.
