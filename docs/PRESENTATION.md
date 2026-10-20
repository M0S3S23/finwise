# FinWise — Presentation Outline & Live Demo Script

**Length:** 15–20 minutes (10 slides + 8-minute demo). Seed demo data first: `npm run seed -- --reset`.

## Slides

1. **Title** — FinWise: smart financial management for small businesses. Name, date.
2. **The problem** — Small businesses run on notebooks and spreadsheets; poor financial management is a leading cause of failure. Enterprise tools are complex, costly, and disconnected from stock and sales.
3. **Who it's for** — Shop owners, salons, hardware stores, food vendors: limited accounting skills, phone-first, unreliable connectivity, often one owner + a few staff.
4. **Objectives** — (1) record & categorise income, expenses, inventory; (2) visual analytics; (3) PWA across devices. ✅ all delivered, plus roles and offline entry.
5. **Solution overview** — screenshot of dashboard + phone POS. Three pillars: *Record → Track → Understand*.
6. **Architecture** — 3 layers (PWA client · Next.js API · MongoDB Atlas). Diagram from TECHNICAL.md §1.
7. **Key engineering decisions**
   - Atomic sales: stock + receipt + ledger in one MongoDB transaction; conditional update prevents overselling.
   - True profit: COGS vs operating expenses (no double counting of stock).
   - Offline-first entry: IndexedDB outbox with idempotent replay.
   - Tenant isolation + role-based permissions enforced server-side.
8. **Data model** — 7 collections; snapshotting of prices/costs on sales.
9. **Testing & quality** — 44/44 automated API checks, browser offline flow, strict TypeScript, lint, Lighthouse PWA.
10. **Future work & conclusion** — debtors/credit, mobile-money integration, barcode scanning, multi-branch, tax & payroll.

## Live demo (≈8 minutes)

| Time | Action | Talking point |
|---|---|---|
| 0:00 | Open on phone/desktop, sign in as `demo@finwise.app` | Installed PWA, full-screen |
| 0:30 | Dashboard: switch period This month → Last month | KPIs with trend vs previous period; low-stock banner |
| 1:30 | Tap **Sell**, add 2–3 products, discount, mobile money, complete | One tap updates stock, ledger and receipt |
| 2:30 | **Share** receipt | WhatsApp-ready receipt |
| 3:00 | Inventory → product → stock history | Every movement audited, with balances |
| 3:30 | Receive stock with cost | Weighted-average costing, purchase expense |
| 4:15 | Turn on airplane mode, record an expense, show "Offline · 1 pending", reconnect | Works with poor connectivity |
| 5:15 | Reports: P&L vs Cash flow | Why profit ≠ cash; export CSV, print to PDF |
| 6:30 | Settings → Team; sign in as `staff@finwise.app` in another window | Staff sees only selling & recording — no profits |
| 7:30 | Wrap-up | Back to slide 10 |

**Backup plan:** keep screenshots in `docs/screenshots/` ready in case of network problems.
