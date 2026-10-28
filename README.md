# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Inventory, sales, and purchasing rules

## Optional Supabase accounts and cloud workspaces

Kosthagara can run as its existing browser-local demo or use Supabase for email/password accounts and private, per-account workspaces. To enable accounts:

1. Create a Supabase project and run `supabase/migrations/202610240001_business_workspaces.sql` in its SQL Editor.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and its public publishable/anon key. Never put a Supabase service-role key in this frontend.
3. Configure Supabase Auth email confirmation and allowed redirect URLs for your local and deployed app URLs.
4. Restart the Vite server. The account screen appears when both environment variables are present. Choose **Continue with the browser-only demo** to use local demo mode instead.

Each authenticated account owns one private workspace row. Row-level security restricts database access to that account, and cloud saves use revisions so a stale browser session is rejected rather than silently overwriting newer data. A first account starts with the sample workspaces and then sets its business profile. Existing local data can be exported with Data Backup & Recovery and imported after signing in.

The current cloud implementation stores the versioned application workspace as one JSON document. It does not yet support multiple users collaborating in one business, normalized per-record database tables, realtime updates, or a backend-driven audit trail. If a save reports that another session changed the workspace, reload before continuing. Test the migration and account flows in a non-production Supabase project before deploying to real businesses.

---

In browser-only demo mode, Kosthagara starts with sample inventory marked **Demo example**. Items added in the app are marked **User-entered**. Workspaces, organisation settings, currency settings, sales, purchases, expenses, and inventory movements are saved in browser local storage when the browser allows it. This local demo/session storage is not a secure database, account, or synced backup. Corrupt application data is left untouched until the user explicitly chooses to replace it.

**Data Backup & Recovery** is available from Business settings. Export creates a versioned JSON file containing the supported application workspaces, activity history, and currency settings. Import validates the complete backup and presents a summary before the user confirms replacement. Import is limited to 10 MB, replaces the current workspace (browser-local in demo mode, account-owned in cloud mode), and preserves supported unknown application/workspace fields except credential-like fields, which are excluded from exports and cause imports to be rejected. Currency amounts and inventory quantities are restored as recorded with no conversion. Backups contain private business and organisation information; keep them secure. This manual file export is not cloud storage or a secure backup service. Passwords, authentication secrets, tokens, credentials, and OTP values are not included.

**Activity History** is available in the workspace navigation. Successful inventory, sales, purchase, production, recipe, planner scenario, settings, and backup actions are recorded separately in the active category workspace and persist with normal workspace saves. Malformed history entries in older local data are ignored without discarding valid business data. Activity CSV exports honor the current search, category, and date filters. History is browser-local in demo mode and is included in supported JSON backups; it is not a tamper-proof or server-side audit log.

**Business Insights** provides read-only, deterministic metrics from the selected workspace. Inventory value is quantity × recorded unit cost and is grouped by recorded currency without conversion. Sales analysis counts only valid, dated Completed orders; cancelled, pending, and confirmed orders are excluded. Demand averages and no-sales findings require coverage of the selected observation period and at least 28 days of dated completed sales history. Relative fast/slow rankings require at least four products with sales in that period. Gross profit is only available when all valid sales in the period have current item costs recorded in the same currency as the order; it is an estimate, not a historical cost ledger. Excess stock is assessed only when an explicit target or maximum stock field exists; current reorder levels are minimums and are not treated as targets. Reorder recommendations check remaining quantities on matching-unit Draft, Ordered, and Partially Received purchase orders, but never create purchases. Insights never update inventory. CSV export includes summary metrics and recommendation findings.

Inventory fields adapt to the selected business category. Food items can record ingredients and production/expiry dates; artwork can record size and medium; handicrafts can record material and production status; supermarkets can record SKUs and expiry dates; and All Businesses items can keep extra details. Unit cost is optional when unknown, and stock quantity remains separate from all monetary values. Zero stock is reported separately from positive stock at or below its reorder threshold.

- **Sales orders:** Pending and Confirmed orders do not reserve or deduct stock. Marking an order Completed deducts its listed product quantities once. Editing a completed order adjusts stock only by the quantity difference. Changing a completed order to another status restores the deducted quantities; cancelling an order that was never completed does not change stock. Re-completing a cancelled order deducts stock again after checking availability.
- **Purchase orders:** Draft and Ordered records do not change stock. Recording a delivery adds only the increase in cumulative received quantity. Later receipts add only the newly received remainder. Editing received quantities reconciles the difference; cancelling an order removes its received quantities only if doing so does not take inventory below reserved stock or zero.
- **Money and reports:** Prices, costs, and expenses are stored as numeric amounts with their recorded currency. Displays do not apply exchange rates; mixed-currency totals remain separated by currency. Sales revenue counts completed sales only. Purchase cost counts received quantities and is not a payment ledger. Users can separately record other business expenses (for example transport or fees). Estimated profit is shown only when every completed sale has an available item cost in the same currency as the sale; the estimate is sales revenue minus sold quantities at the item's currently recorded unit cost minus recorded other expenses. It is not a historical cost ledger, and received purchase costs are shown separately rather than subtracted again. Missing or mismatched costs make the estimate unavailable.
- **Quick sales:** Recording a quick sale creates a completed sales order for a walk-in customer, so revenue, stock movements, and reports use the same records as regular customer orders. Stock is checked against available inventory and reservations before the sale is saved.
- **Part-Time Business Planner:** Up to three browser-local scenarios can be compared for different products, quantities, materials, prices, packaging, and other planned expenses. Estimated profit is projected revenue minus listed material cost, packaging, and entered expenses; margin is estimated profit divided by projected revenue. Break-even quantity uses entered variable costs per product and other expenses as fixed costs, and is omitted when those values do not support a meaningful result. These are planning estimates, not guaranteed earnings. Optional inventory links only compare quantities and available stock; the planner does not create orders, record sales, or change inventory. Scenario amounts retain their entered currency and are never exchange-converted.
- **Existing production orders:** Recipe-based production reservations and material usage remain separate from Sales orders. Confirming a production order reserves materials; recording production deducts actual materials and adds finished goods; dispatch deducts finished products.

## Browser-only account and organisation onboarding demo

In browser-only demo mode, the welcome, sign-in, sign-up, OTP-style screen, and organisation onboarding are frontend demonstrations only. There is no authentication provider, no code is sent or verified, and the six-digit screen only checks its input format. Passwords are used briefly for form validation and are discarded; never use a real password in this demo. Profile and organisation details are stored only in this browser when local storage is available and are not synced or backed up. Completing onboarding selects one of the existing category workspaces; separate organisation isolation per organisation is not implemented.
