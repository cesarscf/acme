# Architecture

## Overview

Multi-tenant marketing platform. The agency registers clients (tenants), each with their own subdomain or custom domain. Each tenant has a set of **pages** — created from templates — each reachable via a custom path chosen by the agency.

---

## Pages System

Replaces the old landing pages / bio pages / offer pages model.

### Concept

- **Templates** — hardcoded in the codebase. Each template defines a layout and which content fields are editable (e.g., title, list of links, CTA URL, colors).
- **Pages** — instances of a template stored in the database. The agency picks a template, sets a custom path, and fills in the content fields.
- **Routing** — the public catch-all route resolves the path against the database and renders the matching template.

### Database schema (`pages` table)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `tenantId` | uuid | foreign key → tenants |
| `name` | text | internal label, not shown publicly |
| `path` | text | custom path, e.g. `meus-links/pinheiros`. Unique per tenant. Empty string = tenant root |
| `templateSlug` | text | references a hardcoded template, e.g. `links-1` |
| `content` | jsonb | template-specific content fields |
| `active` | boolean | inactive pages return 404 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

- `path` is unique per tenant (enforced via DB constraint or validated before insert)
- `path` with empty string (`""`) represents the root of the tenant (`tenant.acme.com/`)
- No more than one page with empty path per tenant

### Templates

Templates are defined in code, not in the database. Each template exports:
- `slug` — unique identifier (e.g., `links-1`)
- `label` — display name shown in the UI (e.g., "Links — Modelo 1")
- `contentSchema` — Zod schema describing the editable fields
- `Component` — React component that receives `content` and renders the page

### Public routing

A single catch-all route handles all tenant pages:

```
/t/[tenantSlug]/[...path]   → looks up page by tenantId + path, renders template
/t/[tenantSlug]             → looks up page with path = ""
```

The `tenantSlug` segment may be a subdomain slug or a full custom domain hostname (see Proxy section below).

---

## Multi-tenancy & Proxy

### How it works

Next.js 16 introduced `proxy.ts` as the file convention (replacing the deprecated `middleware.ts`). The proxy intercepts every request and rewrites tenant traffic to internal routes.

The proxy file lives at `src/proxy.ts` and is auto-detected by Next.js (same as `src/middleware.ts` was before). It exports a `proxy` function and a `config` object.

**Rewrite flow:**

```
lojax.acme.com/meus-links/pinheiros
  → proxy detects subdomain "lojax"
  → rewrites to /t/lojax/meus-links/pinheiros

lojax.com/meus-links/pinheiros  (custom domain)
  → proxy detects custom domain "lojax.com"
  → rewrites to /t/lojax.com/meus-links/pinheiros
```

The catch-all route `/t/[tenantSlug]/[...path]` then resolves the tenant (by subdomain slug or custom domain) and looks up the page by path.

### Supported host patterns

| Pattern | Example | Detected as |
|---|---|---|
| Subdomain | `lojax.acme.com` | subdomain `lojax` |
| Custom domain | `lojax.com` | custom domain `lojax.com` |
| Localhost subdomain | `lojax.localhost:3000` | subdomain `lojax` |
| Vercel preview | `lojax---project.vercel.app` | subdomain `lojax` |

### Protected paths

Requests to `/dashboard` or `/login` on tenant domains are redirected to `/`.

### Migration from middleware.ts

The `middleware.ts` file convention is deprecated in Next.js 16. The equivalent is `proxy.ts` at the project root or inside `src/`. The exported function must be named `proxy` (not `middleware`). The current `src/proxy.ts` already follows this convention — no migration needed.

To migrate an existing project:
```bash
npx @next/codemod@canary middleware-to-proxy .
```

---

## Admin Dashboard

Routes under `/dashboard/tenants/[id]/pages`:

- **List** — all pages for a tenant, showing name, path, template, and active status
- **New** — pick a template → set a custom path → fill in content fields → save
- **Edit** — same form as new, pre-filled with existing content

---

## Tenant Resolution in Routes

The catch-all route receives `tenantSlug` which may be either a subdomain slug or a custom domain hostname (set via `_tenantType` query param by the proxy). The route must:

1. Check `_tenantType` query param (`"subdomain"` or `"customDomain"`)
2. Look up tenant by `slug` (if subdomain) or `customDomain` (if custom domain)
3. Look up page by `tenantId` + resolved `path`
4. If not found or inactive → 404
5. Render the template component with `content`

---

## Routing Summary

```
Public:
  tenant.acme.com/                    → page with path ""
  tenant.acme.com/qualquer/path       → page with path "qualquer/path"
  tenant.com/qualquer/path            → same, via custom domain

Internal (never visible to visitors):
  /t/[tenantSlug]/                    → root page handler
  /t/[tenantSlug]/[...path]           → catch-all page handler

Dashboard:
  /dashboard/tenants/[id]/pages       → page list
  /dashboard/tenants/[id]/pages/new   → create page
  /dashboard/tenants/[id]/pages/[id]  → edit page
```
