# LIMS frontend design system (v1)

Enterprise clinical UI rules for every module (Patients, Orders, Sampling,
Reception, MLT, Supervisor, Pathology, Dispatch, Branch, Admin). Built first
for Patient Management; every other module adopts the same primitives.

## Principles

1. **Neutral chrome, colour = status.** Navigation, cards, tables and forms are
   grey-scale. Colour appears only where it carries meaning (pending = amber,
   verified = emerald, danger = red, primary action = brand blue).
2. **Worklist first.** The thing the user must act on is at the top-left; charts
   and summaries are secondary.
3. **One anatomy per component.** Every KPI tile, card header, table, form field
   and button looks and behaves the same.
4. **Sentence case everywhere.** No ALL CAPS labels, no Title Case buttons.
5. **Dense but legible.** 13px table text, 12px meta, 11px only for badges.
   `tabular-nums` on every number column.
6. **States are designed.** Loading = skeleton (never a spinner in content),
   empty = invitation + action, error = what happened + retry.
7. **Dark mode is free** if you use the tokens below — never raw `slate-*`,
   `bg-white`, `text-black` in module code.

## Colour tokens (Tailwind classes, defined in `app/globals.css`)

| Use                    | Class                                   |
| ---------------------- | --------------------------------------- |
| Page background        | `bg-canvas`                             |
| Card / panel           | `bg-surface`                            |
| Toolbar, zebra, chip   | `bg-surface-muted`                      |
| Hover row / item       | `hover:bg-surface-hover`                |
| Skeleton bars          | `bg-skeleton`                           |
| Borders                | `border-edge`, `border-edge-strong`, `divide-edge` |
| Text                   | `text-fg` · `text-fg-secondary` · `text-fg-muted` · `text-fg-faint` (icons/placeholders only) |
| Brand (large / fills)  | `bg-primary`, `text-primary`            |
| Brand small text/links | `text-primary-strong` (AA on both themes) |
| Brand tint             | `bg-primary-soft`                       |
| Pending                | `bg-status-pending-bg text-status-pending-fg ring-status-pending-edge`, dot `bg-status-pending` |
| Verified               | `bg-status-verified-bg text-status-verified-fg ring-status-verified-edge`, dot `bg-status-verified` |
| Danger                 | `bg-status-danger-bg text-status-danger-fg ring-status-danger-edge`, solid `bg-status-danger` |

Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`
(+ `focus-visible:ring-offset-1 focus-visible:ring-offset-surface` when the
element sits on a card). Never `ring-primary/40`.

Charts (recharts): `stroke="var(--edge)"`, ticks `fill: "var(--fg-muted)"`,
bars `fill="var(--color-primary)"`, tooltip `background: var(--surface)`.

**Where literal colours are still allowed** (everything else must use tokens):

- chart *series* colours, where the palette encodes categories rather than state;
- specimen tube cap colours (`TubeIndicator`) — they mirror a physical object;
- printable / exported documents (labels, barcodes, receipts, printed reports),
  which are rendered on paper and must not follow the screen theme;
- `text-white` on a solid brand/danger fill, and `bg-black/40` scrims or
  `shadow-black/…` on floating chrome, where the colour is the effect.

## Primitives

| Component                                  | Use for                                   |
| ------------------------------------------ | ----------------------------------------- |
| `components/ui/PageHeader`                 | Every page: crumbs → title → meta → actions (one primary) |
| `components/ui/Button`                     | All buttons/links-as-buttons. `variant` primary · secondary (default) · ghost · danger; `size` sm · md; `icon`, `loading`, `href` |
| `components/ui/Field` (`InputField`, `SelectField`, `TextareaField`, `FormSection`) | All forms. Label above, hint or error below, `aria-invalid` wired |
| `components/ui/SectionCard`                | Every panel: title + count + actions, `flush` for tables/lists |
| `components/ui/EmptyState`                 | Empty / error bodies                      |
| `components/ui/SegmentedControl`           | Tabs-as-filter, time ranges (radio-group keyboard built in) |
| `components/ui/KpiTile`                    | Dashboard numbers (label → value → context). `components/shared/StatCard` is a thin legacy wrapper over it |
| `components/ui/StatusChip` (+ `toneForStatus`, `humanizeStatus`, `STATUS_TONE`) | Every status / priority / category chip. `components/shared/StatusBadge` and `PriorityBadge` wrap it |
| `components/ui/Modal`                      | Every dialog (forms, confirms): focus trap, Esc, backdrop, `footer` for actions |
| `components/ui/Pagination`                 | Table footers (1-based; `components/shared/Pagination` re-exports it) |
| `components/ui/ModuleSidebar`              | Every module's left nav — config only, no per-module markup |
| `components/patient-dashboard/PatientStatusBadge` | Patient pending / verified chip      |

Domain status → tone lives in ONE place: `STATUS_TONE` in `StatusChip.tsx`.
Add new statuses there rather than inventing colours in a page.

Icons: **lucide-react only** (16px in rows/buttons, 20px in headers), always
`aria-hidden="true"` unless the icon is the only content (then `aria-label`).
Do not use Material Icons in module pages.

## Layout recipes

- Page: `PageHeader` then content; max width `max-w-[1400px] mx-auto` for
  dashboards, `max-w-5xl` for forms/detail.
- Table: inside `SectionCard flush`; `<table className="w-full min-w-[640px] table-fixed text-left text-[13px]">`,
  header row `text-xs font-medium text-fg-muted border-b border-edge`, body
  `divide-y divide-edge whitespace-nowrap`, cell padding `px-3 py-2`, first cell
  `pl-4`. Row hover `hover:bg-surface-hover`. Put empty / loading states
  **outside** the table so they centre on small screens. Wrap in
  `overflow-x-auto`.
- Form: `FormSection` cards (2-col grid on sm+), sticky footer bar with
  Cancel (secondary) + Save (primary) on the right.
- Module sidebar: `ModuleSidebar` with groups `[{ label, items: [{ name, icon, href, external?, isActive?, badge? }] }]`.
  Sentence-case names, lucide icons, no colours per item.
- Modals: `Modal` with `title`, optional `description`, body, `footer` = Cancel (secondary) + action (primary/danger). Keep the
  existing open/close state and submit logic; only the shell changes.
- Detail / profile: sticky patient context banner (name · MRN · age/sex · NIC
  masked · status) above tabs; tabs are links with `aria-current="page"`.
- Responsive: never rely on a horizontal page scroll; tables may scroll inside
  their card. Hide low-value columns below `lg`, not the important ones.

## Two ways layouts actually break

Both of these have shipped here before. Check them whenever you add a table or
render a value you did not author.

**The container is ~320px narrower than the viewport.** `<main>` sits beside a
`fixed w-64` sidebar (at `lg`+) inside `lg:p-8`, so a 1280px viewport gives a
content box of only ~960px — but Tailwind's `lg:`/`xl:` prefixes measure the
*viewport*. A column you reveal at `lg:table-cell` appears when its card is just
~704px wide. Do the arithmetic against the container, not the breakpoint.

**`table-fixed` starves auto-width columns.** Fixed `w-*` columns take exactly
their width; whatever is left is split between the auto columns. If the fixed
widths sum to more than the table's own width, every auto column collapses to
~0px — the content silently disappears, or renders one character per line. So:

> sum(fixed widths in that breakpoint band) + a floor for **each** auto column
> (≥ 160px for a name/text column, ≥ 96px for a short one) ≤ the table's `min-w-[N]`

Recompute the sum for every band, because responsive columns change it. When it
doesn't fit, raise `min-w-[N]` — scrolling inside the card is the correct
outcome. Add `title={...}` to any chip or cell that can still truncate.

**Long unbreakable tokens push their parent wider.** Emails, URLs, tracking
numbers, ids and junk input like `//////////` have no break opportunity, and
`min-width` defaults to `auto`, so a flex or grid child refuses to shrink below
them and blows out the card — or the page. Give the text `truncate` (one line)
or `break-words` (prose), and give **every** flex/grid ancestor in that chain
`min-w-0`. For user-entered free text use `break-words whitespace-pre-wrap` so
real newlines survive but a junk token still wraps.

## Copy

- Buttons: verb first ("Register patient", "Save changes", "Upload document").
- Errors: what happened + what to do ("Couldn't load orders. Retry").
- Empty: headline names the space ("No documents yet"), one line, one action.
- Dates: `16 Aug 2026`, times `09:12` (24h), relative only for "Today 09:12" /
  "Yesterday 14:02" / "2h ago" in activity feeds. Use `formatRegistered` /
  `formatAuditTime` from `components/patient-dashboard/dashboard-data.ts`.
- Phone: `formatPhone` → `077 123 4567`.
