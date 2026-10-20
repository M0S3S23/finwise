# Testing

## Automated: end-to-end API smoke test

`scripts/smoke-test.mjs` creates throwaway businesses against a running server and checks 44 behaviours across auth, ledger, inventory, sales, reports, voids, roles and tenant isolation.

```bash
npm run build && npm start          # in one terminal
node scripts/smoke-test.mjs         # in another (BASE_URL defaults to http://localhost:3000)
```

Last run (19 Oct 2026): **44 passed, 0 failed**.

| Group | Checks |
|---|---|
| Auth | signup, duplicate email (409), unauthenticated API (401) |
| Ledger | default categories, create expense, category/type mismatch (400), negative amount (400), **offline replay idempotency**, edit |
| Inventory | opening stock, restock with **weighted-average cost** (10@40 + 10@50 → 45), can't go below zero, write-off |
| Sales | totals with discount, stock decrement, movement logged, **overselling blocked (409)**, income posted, sale-linked income protected |
| Reports | income 510, COGS 180, opex 1600 (stock purchases excluded), net profit −1270, cash expenses incl. purchases 2500, top products, CSV |
| Void | status, stock restored, income reversed |
| Roles | staff blocked from dashboard/reports/team/stock changes (403); staff sells but price override ignored; can't delete; sees only own entries; password change; deactivation cuts session (401) |
| Tenancy | another business gets 404 for our product and sale |

## Automated: browser flow (verified during build)

Using Playwright against a production build: login → POS checkout → receipt → service worker active → go offline → record expense ("Offline · 1 pending") → offline page reload served from cache → back online → entry synced to server. No page errors.

## Static checks

```bash
npm run typecheck   # TypeScript strict mode
npm run lint        # ESLint (next/core-web-vitals)
npm run build       # production build
```

## Manual test plan (for demo / acceptance)

| # | Scenario | Expected |
|---|---|---|
| 1 | Sign up with currency ZMW | Dashboard shows "ZK" amounts; 14 default categories |
| 2 | Add product (cost 40, price 55, opening 10) | Margin hint 27.3%; product listed |
| 3 | Sell 4 with K10 discount via mobile money | Total K210; stock 6; receipt #1; income in ledger |
| 4 | Try to sell 100 | "Not enough stock" error |
| 5 | Receive 10 @ K50 with expense | Stock 16; avg cost updated; expense listed |
| 6 | Record rent expense K1,500 (bank) | Appears in list and dashboard |
| 7 | Reports → This month | P&L excludes stock purchases; cash flow includes them |
| 8 | Void the sale | Stock back; income removed; sale shows VOIDED |
| 9 | Add staff, sign in as staff | Forced to change password; no Dashboard/Reports in menu |
| 10 | Deactivate staff while signed in | Staff is signed out on next action |
| 11 | Turn on airplane mode, record expense | "Saved offline"; badge shows pending; syncs on reconnect |
| 12 | Install app on Android/iOS | Opens standalone with FinWise icon; shortcuts on long-press |
| 13 | Export Sales CSV | Opens in Excel with correct columns |
| 14 | Phone width (390px) | No horizontal scrolling; bottom navigation; cart bar |
