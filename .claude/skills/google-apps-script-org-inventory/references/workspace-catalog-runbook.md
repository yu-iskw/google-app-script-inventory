# Workspace catalog runbook (IAM and Admin)

This runbook supports the [`google-apps-script-org-inventory`](../SKILL.md) skill. Product behavior and CLI examples stay in [README.md](../../../../README.md) and [CONTRIBUTING.md](../../../../CONTRIBUTING.md).

## Trust model

- **Application Default Credentials (ADC)** identify who is running the tool (a user or workload identity).
- The catalog **does not** use a downloaded service account key file for Workspace access. It **impersonates** one delegated service account using the IAM Credentials API.
- The **impersonated** service account is the principal Google Admin ties to **domain-wide delegation** (client ID + OAuth scopes).

## GCP checklist

1. **Enable** the **IAM Credentials API** on the project that owns the delegated service account (or wherever your org enables it).
2. **Grant** the ADC principal (user or service account running the CLI) **`roles/iam.serviceAccountTokenCreator`** on the **target** service account resource (the one you pass to `--impersonate-service-account` / `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`).
3. Confirm the service account has any additional roles your org requires for Drive/Directory/Script API access policies (project-specific).

## Google Admin checklist (domain-wide delegation)

1. In **Google Admin** → Security → API controls → Domain-wide delegation, **authorize** the **OAuth client ID** of the service account you impersonate (numeric client ID from Google Cloud Console for that service account).
2. **Authorize OAuth scopes** required by this catalog. The single source of truth in code is `GOOGLE_SCOPES` in [`packages/common/src/index.ts`](../../../../packages/common/src/index.ts):
   - `https://www.googleapis.com/auth/admin.directory.user.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/script.projects.readonly`

3. Choose an admin mailbox for **`GOOGLE_ADMIN_SUBJECT` / `--admin-subject`** that is allowed to act as the delegated admin subject for your environment (per your org’s policy).

## Local ADC

For developer machines:

```bash
gcloud auth application-default login
```

Runtime environments (CI, VMs) should use a workload identity or service account attached to the job, still with **Token Creator** on the delegated SA—never commit keys.

## Operational safety

- Do not commit service account JSON keys, refresh tokens, or production `catalog.sqlite` files.
- Treat exports (JSON/CSV) as potentially sensitive; store them according to your data classification policy.
