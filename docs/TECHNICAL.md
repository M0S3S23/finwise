# FinWise — Technical Documentation

## 1. Architecture

```
┌──────────────────────────── Client layer (PWA) ────────────────────────────┐
│  Next.js React UI (client components) · Tailwind · Recharts                │
│  Service worker (public/sw.js): shell precache, cache-first static,        │
│  network-first pages & GET /api with cache fallback                        │
│  IndexedDB outbox (lib/client.ts): queues income/expense writes offline    │
└───────────────▲──────────────────────────────────────────────┬─────────────┘
                │ JSON over HTTPS, httpOnly session cookie     │
┌───────────────┴──────────── Application layer ───────────────▼─────────────┐
│  middleware.ts — page auth & role redirects (Edge, verifies JWT)           │
│  app/api/**/route.ts — REST handlers wrapped by lib/api.ts `route()`:      │
│    connect DB → verify session → load user (active?) → check permission    │
│    → Zod-validate body → call service → uniform error mapping              │
│  lib/services — sales, inventory, reports (business rules)                 │
└───────────────▲─────────────────────────────────────────────────────────────┘
                │ Mongoose (pooled, cached across invocations)
┌───────────────┴──────────── Database layer ─────────────────────────────────┐
│  MongoDB Atlas: businesses, users, categories, products, sales,            │
│  transactions, stockmovements — multi-document ACID transactions           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why API routes rather than Server Actions?** A REST surface lets the offline outbox replay requests with plain `fetch`, makes the system testable with any HTTP client, and leaves the door open for a future native app.

## 2. Multi-tenancy & roles

- Every domain document carries `businessId`. Every query in every handler filters by the `businessId` from the **server-verified session**, never from the client — so one business can never read or modify another's data (covered by the smoke test).
- Roles: `owner`, `staff`. Permissions are declared once in `lib/permissions.ts` and enforced in `route(permission, handler)`; the UI uses the same map to hide controls.
- Staff restrictions enforced server-side: list endpoints scope to `userId` for staff; price overrides and back-dating are stripped from staff sales.
- Deactivation takes effect immediately: `route()` reloads the user on each request and rejects inactive accounts.

## 3. Data model

| Collection | Key fields | Indexes |
|---|---|---|
| `businesses` | name, currency, contact, taxNumber, receiptFooter, defaultReorderLevel, **saleSeq** (receipt counter) | – |
| `users` | businessId, name, email (unique), passwordHash (bcrypt, `select:false`), role, active, mustChangePassword, lastLoginAt | email unique |
| `categories` | businessId, name, type (income/expense), color, **system** (`sales` / `inventory` / null), archived | (businessId, type, name) unique |
| `products` | businessId, name, sku, category, unit, costPrice (weighted avg), sellingPrice, quantity, reorderLevel, archived | (businessId, sku) unique partial |
| `sales` | businessId, number, items[{productId, name, quantity, unitPrice, unitCost, total}], subtotal, discount, total, costTotal, paymentMethod, customerName, status (completed/voided), transactionId, userId | (businessId, date), (businessId, number) unique |
| `transactions` | businessId, type, amount, categoryId + categoryName (denormalised), description, paymentMethod, reference, date, **source** (manual/sale/restock), saleId, productId, userId, **clientId** | (businessId, date), (businessId, type, date), (businessId, clientId) unique partial |
| `stockmovements` | businessId, productId, type (initial/restock/sale/adjustment/void), signed quantity, balanceAfter, unitCost, saleId, note, userId, date | (businessId, productId, date) |

Design notes:
- **Snapshotting**: sale items store name, price and *unit cost at the time of sale*, so historical profit stays correct when prices change.
- **Denormalised `categoryName`** keeps lists and reports join-free; renaming a category updates its transactions.
- **Ledger linkage**: sale income and restock expenses are ordinary transactions with `source` + references, so cash flow is one query, while edits are routed to the owning record.
- Money is stored as numbers rounded to 2 dp (`round2`) at every write.

## 4. Core business logic

### Sale (`lib/services/sales.ts › createSale`) — one MongoDB transaction
1. Merge duplicate lines; load products (must be non-archived, same business).
2. For each line: `findOneAndUpdate({ _id, quantity: { $gte: qty } }, { $inc: { quantity: -qty } })` — the conditional update makes overselling impossible even under concurrent sales.
3. Compute subtotal, discount (capped), total, costTotal.
4. Atomically increment `business.saleSeq` for the receipt number.
5. Insert the Sale, StockMovements, and an income Transaction in the system *Sales* category.

Any failure (e.g. insufficient stock on line 3) aborts the whole transaction.

### Void — reverses stock (with `void` movements), deletes the linked income, marks the sale voided (kept for audit).

### Restock (`lib/services/inventory.ts › adjustStock`)
Weighted-average cost: `newCost = (oldQty × oldCost + qty × unitCost) / (oldQty + qty)`. Optionally posts an expense in the system *Inventory purchases* category.

### Reports (`lib/services/reports.ts`)
- **Cash view**: `netCashFlow = income − all expenses`.
- **Profit view** (accrual-style for goods):
  `COGS = Σ sale.costTotal`
  `operatingExpenses = expenses − inventory purchases`
  `netProfit = income − COGS − operatingExpenses`
  This avoids double counting stock (once when bought, again when sold).
- Time series auto-buckets by day (≤45 days), week (≤190) or month, with empty buckets filled.
- Aggregation is done in application code over lean, projected queries. At small-business volumes (thousands of records per period) this is fast, and it runs unchanged on any MongoDB-compatible backend. For very large tenants, move these into `$group` pipelines (straightforward on Atlas).

### Transactions & idempotency
`withTransaction()` (lib/db.ts) probes once whether the deployment supports transactions (Atlas: yes) and wraps multi-document writes; on a standalone dev server it degrades gracefully with a warning.

## 5. Offline & PWA design

| Request | Strategy |
|---|---|
| `/_next/static/*`, `/icons/*` | Cache-first (content-hashed) |
| Page navigations | Network-first (navigation preload) → cached page → `/offline` |
| `GET /api/*` (except auth, exports) | Network-first → last cached JSON → 503 JSON |
| Non-GET | Never cached; handled by outbox |

**Outbox** (`lib/client.ts › postOrQueue / syncOutbox`): when offline or the network fails, income/expense POSTs are stored in IndexedDB with a UUID `clientId`. Sync runs on load, on the `online` event and every 60 s. The server's unique `(businessId, clientId)` index + lookup make replays idempotent. 4xx responses drop the item; 5xx/network keeps it for retry. Logout warns about unsynced items and clears caches + outbox (shared-device safety).

Sales are deliberately **online-only**: offline sales from several devices could oversell stock.

Manifest includes maskable icons, app shortcuts (New sale, Money, Stock) and standalone display.

## 6. Security

- Passwords: bcrypt (cost 12). Hashes are excluded from queries by default.
- Sessions: HS256 JWT (jose) in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie, 7-day expiry. `AUTH_SECRET` required in production.
- CSRF: SameSite=Lax cookies + JSON-only bodies (cross-site forms cannot send `application/json`).
- Validation: every write goes through a Zod schema; ObjectIds are validated before queries; search input is regex-escaped.
- Login throttling: 8 failed attempts / 15 min per IP+email (in-memory; use Redis/Upstash for multi-instance).
- Headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`; `poweredByHeader` off.
- Errors: internal errors are logged server-side and returned as a generic message.

## 7. REST API reference

All endpoints return JSON; errors are `{ error: string }` with an appropriate status. Auth = session cookie.

| Method & path | Permission | Description |
|---|---|---|
| `POST /api/auth/signup` | public | Create business + owner + default categories; sets session |
| `POST /api/auth/login` | public | Sign in; returns `redirect`, `mustChangePassword` |
| `POST /api/auth/logout` · `GET` | – | Clear session (GET redirects to /login) |
| `GET /api/auth/me` | any | Current user + business |
| `GET /api/dashboard?period=` | dashboard:view | Summary, previous-period comparison, series, top products, inventory, recent |
| `GET /api/transactions?type&categoryId&paymentMethod&from&to&q&page&limit` | transactions:view | Paginated list + filtered totals (staff: own only) |
| `POST /api/transactions` | transactions:create | Create (supports `clientId` idempotency) |
| `PATCH/DELETE /api/transactions/:id` | transactions:edit | Manual entries only |
| `GET/POST /api/categories` | view / categories:manage | List (`?all=1` incl. archived) / create |
| `PATCH/DELETE /api/categories/:id` | categories:manage | Rename/recolour/archive; delete archives if used |
| `GET /api/products?q&category&stock=low\|out&archived=1` | inventory:view | List + category names |
| `POST /api/products` | inventory:manage | Create with opening stock |
| `GET/PATCH/DELETE /api/products/:id` | view / manage | Detail + movements / update / delete (archives if sold) |
| `POST /api/products/:id/stock` | inventory:manage | `{type: restock\|adjustment, quantity, unitCost, recordExpense, paymentMethod, note}` |
| `GET /api/sales?from&to&status&page` | sales:view | Paginated list + revenue summary (staff: own only) |
| `POST /api/sales` | sales:create | `{items:[{productId, quantity, unitPrice?}], discount, paymentMethod, customerName, note}` |
| `GET /api/sales/:id` | sales:view | Sale + business details for receipt |
| `POST /api/sales/:id` | sales:void | `{action:'void', reason}` |
| `GET /api/reports/summary?from&to` | reports:view | P&L, cash flow, series, products, inventory |
| `GET /api/reports/export?kind=transactions\|sales\|inventory&from&to` | reports:view | CSV download (UTF-8 BOM for Excel) |
| `GET/PATCH /api/business` | any / business:manage | Business profile |
| `GET/POST /api/team` · `PATCH/DELETE /api/team/:id` | team:manage | Members, roles, activation, password reset |
| `POST /api/account/password` | any | Change own password |

## 8. Roadmap

Ideas beyond the current scope, roughly in order of value:
1. **Customer accounts / debtors** — track credit sales and repayments (the `credit` payment method is the hook).
2. **Suppliers & purchase orders**, supplier balances.
3. **Mobile-money integrations** (MTN MoMo, Airtel Money) for automatic reconciliation.
4. **Barcode scanning** in POS via the camera (BarcodeDetector API).
5. **Multiple branches / stores** per business with stock transfers.
6. **Budgets & alerts** (e.g. "transport spend is 40% above last month") and scheduled email/WhatsApp summaries.
7. **Offline sales** with server-side conflict resolution.
8. Tax/VAT reports, payroll (listed as out of scope in the proposal).
9. Password reset by email, 2FA for owners, audit log viewer.
