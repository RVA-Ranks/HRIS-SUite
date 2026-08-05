# Credentials and access matrix (Phase 0)

**Rule:** Values and secrets never enter the repository. This file tracks **names and status only**.

| Access item | Needed for | Holder | Status | Notes |
| --- | --- | --- | --- | --- |
| JazzHR API key | Hard gate spike | Daniel | Missing | Non-committed local secret for read-only proof |
| JazzHR plan/API entitlement | Hard gate | Daniel | Unknown | Confirm Integrations area exposes API |
| Google Cloud / OAuth client for Supabase | Auth proof | Daniel | Missing | AITHERAS Workspace constraints |
| Approved Google login allowlist | Auth | Daniel | Partial | Daniel’s account; add second test account |
| Gmail mailbox access | Gmail spike | Daniel | Missing | Minimum read scopes first |
| Google Calendar access | Calendar spike | Daniel | Missing | Read-only first |
| Approved Drive folder IDs | Drive spike | Daniel | Missing | Supply list |
| Performance Review Sheet/Script access | Inventory | Daniel | Missing | Reference only |
| Compensation Sheet/Script/Drive access | Inventory | Daniel | Missing | Highly restricted |
| Compliance 108-item register link | Inventory / Phase 6 | Daniel | Missing | Authoritative location unknown |
| Adobe Sign API entitlement | Stretch | Daniel | Unknown | |
| Supabase project (dev) | Phase 1 | Daniel / Carl | Not created | After Phase 0 architecture approval |
| Vercel project | Phase 1 | Daniel / Carl | Not created | |
| Trigger.dev (or Inngest) account | Phase 1 jobs | Daniel | Pending queue decision | |
| OpenAI org/project/billing | AI enablement | Daniel | Not provisioned | No Phase 0 live calls |

When an item is provided, update Status to `Available (out of band)` and record date in the decision register—not the secret value.
