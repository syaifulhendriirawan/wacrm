# Plan 004: Setup GitHub Actions CI/CD Pipeline to Google Cloud Run

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c26ddf9..HEAD -- .github/workflows/deploy.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-cloud-run-deployment.md
- **Category**: dx
- **Planned at**: commit `c26ddf9`, 2026-06-29

## Why this matters

Automating builds and deployments ensures that any change merged into the `main` branch is instantly validated (linted, typechecked, and tested) and deployed to Cloud Run. Using Workload Identity Federation (WIF) eliminates the need to store long-lived, highly sensitive Google Cloud Service Account JSON keys in GitHub Secrets, adhering to security best practices.

## Current state

- We have a functioning Dockerfile and standalone configuration (implemented in Plan 003).
- The project has a CI lint/test workflow in `.github/workflows/ci.yml`.
- There is no deploy workflow `.github/workflows/deploy.yml`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Lint      | `npm run lint`           | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify or create):
- `.github/workflows/deploy.yml` (create)
- `plans/README.md` (modify)

**Out of scope**:
- Changing existing build config.
- Storing JSON credential keys in the repository.

---

## Steps

### Step 1: Create GitHub Actions Workflow File

Create `.github/workflows/deploy.yml` with the following configuration:

```yaml
name: CI/CD Pipeline to Cloud Run

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  PROJECT_ID: waflow-app
  REGION: asia-southeast2
  GAR_REPOSITORY: cloud-run-source-deploy
  SERVICE_NAME: waflow-service

jobs:
  lint-test:
    name: Lint & Test
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://ci.example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-dummy-anon-key
      ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000'
      META_APP_SECRET: 'ci-dummy-meta-secret'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install Dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Run Tests
        run: npm test

  build-deploy:
    name: Build & Deploy
    needs: lint-test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud via WIF
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Prepare build environment env vars
        run: |
          echo "NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}" > .env
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" >> .env
          echo "NEXT_PUBLIC_SITE_URL=${{ secrets.NEXT_PUBLIC_SITE_URL }}" >> .env

      - name: Build and Push Container Image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.GAR_REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
            ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.GAR_REPOSITORY }}/${{ env.SERVICE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.REGION }}
          image: ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.GAR_REPOSITORY }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          env_vars: |
            SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
            ENCRYPTION_KEY=${{ secrets.ENCRYPTION_KEY }}
            META_APP_SECRET=${{ secrets.META_APP_SECRET }}
          flags: '--allow-unauthenticated'
```

**Verify**:
Check syntax using a YAML validator or check action step definition correctness.

---

### Step 2: Configure Workload Identity Federation (WIF) in GCP

Run the following gcloud commands in the CLI to set up WIF (replace placeholders as appropriate):

```bash
# 1. Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="waflow-app" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Create OIDC Provider for GitHub in that Pool
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="waflow-app" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository"

# 3. Create Deployer Service Account
gcloud iam service-accounts create "github-deployer" \
  --project="waflow-app" \
  --display-name="GitHub Actions Deployer"

# 4. Authorize OIDC Provider to assume the Service Account
gcloud iam service-accounts add-iam-policy-binding "github-deployer@waflow-app.iam.gserviceaccount.com" \
  --project="waflow-app" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/298283593698/locations/global/workloadIdentityPools/github-pool/attribute.repository/ArnasDon/wacrm" # Replace with actual repo path if different

# 5. Grant Roles to the Service Account
# Artifact Registry Writer to push images
gcloud projects add-iam-policy-binding "waflow-app" \
  --member="serviceAccount:github-deployer@waflow-app.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Cloud Run Admin to deploy service
gcloud projects add-iam-policy-binding "waflow-app" \
  --member="serviceAccount:github-deployer@waflow-app.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Service Account User to assign service runtime credentials
gcloud iam service-accounts add-iam-policy-binding "298283593698-compute@developer.gserviceaccount.com" \
  --project="waflow-app" \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:github-deployer@waflow-app.iam.gserviceaccount.com"
```

---

### Step 3: Configure GitHub Repo Secrets

Configure the following secrets in your GitHub Repository under **Settings** -> **Secrets and variables** -> **Actions**:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/298283593698/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `GCP_SERVICE_ACCOUNT`: `github-deployer@waflow-app.iam.gserviceaccount.com`
- `NEXT_PUBLIC_SUPABASE_URL`: (Supabase URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Supabase Anon Key)
- `NEXT_PUBLIC_SITE_URL`: (Production site URL)
- `SUPABASE_SERVICE_ROLE_KEY`: (Supabase Service Role Key)
- `ENCRYPTION_KEY`: (Encryption Key)
- `META_APP_SECRET`: (Meta App Secret)

---

## Done criteria

- [ ] `.github/workflows/deploy.yml` is created and committed to the repository.
- [ ] Gcloud Workload Identity Pool and Provider are created in GCP project.
- [ ] Service Account is authorized via WIF role bindings.
- [ ] All specified secrets are added to GitHub Repository Secrets.
- [ ] A run on `main` branch completes successfully, building and deploying the container to Cloud Run.

## STOP conditions

- If OIDC provider cannot assume the Service Account (shows 403 Forbidden in GitHub Actions log).
- If the build step fails due to missing environment variables.
