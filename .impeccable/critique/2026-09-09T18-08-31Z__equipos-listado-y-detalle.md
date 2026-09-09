---
target: equipos (listado y detalle)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Mikel\\Documents\\dev\\areto\\equipos (listado y detalle)"
timestamp: 2026-09-09T18-08-31Z
slug: equipos-listado-y-detalle
---
Method: dual-agent (A: design-review subagent · B: detector/browser-evidence subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Vista-switcher and filters lack transitional feedback, but action toasts cover most cases |
| 2 | Match System / Real World | 3 | Good club vocabulary (dorsal, plantilla) but "vista: datos/tallas/medico" is a system-side grouping, not how a coordinator thinks |
| 3 | User Control and Freedom | 2 | Deleting a team with a full roster gets the same plain confirm dialog as deleting a single document — no differentiated warning |
| 4 | Consistency and Standards | 4 | Exemplary use of the composition layer — PageHeader, StatusBadge/status-tone, SectionPlaceholder, table `priority` all used correctly |
| 5 | Error Prevention | 2 | National ID/phone/address exposed in the "datos" view behind the same permission as roster editing, no masking |
| 6 | Recognition Rather Than Recall | 3 | Tab counts are a nice aid, but the 4-way roster "vista" hides column sets, forcing memory across switches |
| 7 | Flexibility and Efficiency of Use | 2 | No bulk actions, no keyboard-friendly row actions, list search doesn't match jersey number |
| 8 | Aesthetic and Minimalist Design | 3 | List page is spare; detail page's roster tab stacks up to 3 alert/summary cards before the actual list |
| 9 | Error Recovery | 2 | Roster-health alerts (duplicate jersey, age out of range) are passive tooltip badges with no click-through to the offending row |
| 10 | Help and Documentation | 1 | No inline help or explainer for what health-alert badges mean; first-timer gets zero scaffolding |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: This reads as competently-executed, disciplined admin CRUD with a few genuinely domain-specific touches — roster-health alerts for duplicate jerseys/expired medical certs/age-out-of-range, captain armband, federation-card tracking, and the "acta" roster-sheet print flow. But nothing about the list or detail page telegraphs "sports club" beyond icons and copy: no visual distinction between team categories/genders, no color-coding, no jersey-number-forward layout, no photo-forward roster (avatars are `size="sm"` inside a dense data table, not a visual anchor). `EquiposBrowser` and `RosterTable` are both textbook data-grid patterns. Verdict: functional and disciplined, domain specificity confined to data/copy, not to interaction design or visual language.

**Deterministic scan**: `impeccable detect --json` returned `[]` (exit 0) against the `equipos` directory and again against each target file individually (`page.tsx`, `[teamId]/page.tsx`, `loading.tsx`, `nuevo/page.tsx`, `[teamId]/acta/page.tsx`). Zero rule violations — no raw hex colors, no ad hoc `dark:` overrides, no hand-rolled headers, no unsuffixed lucide icons. This corroborates Assessment A's heuristic-4 finding: the composition-layer discipline here is real, not a self-report.

**Visual overlays**: Not available this run — no Chrome browser-automation tools are exposed in this session (checked at both the parent and subagent level), so no live-page injection or [Human]-tab overlay could be produced. Fallback signal: source-level review + a clean deterministic scan only. No user-visible overlay exists; treat the findings below as source-derived.

## Overall Impression

The composition-layer engineering here is genuinely strong — probably the best-adhering pair of pages in the app given a clean detector run and correct use of every documented component. What's missing isn't craft, it's product judgment about *attention*: the team detail page piles registration status, a web-registration alert card, a roster-health card, and per-row health badges into the same scroll, and every one of those signals is passive (a badge, a tooltip, a toast) rather than actionable. The biggest opportunity is turning "here's a problem" into "click here to fix it" — for roster-health alerts specifically, and more broadly for the page's information architecture under time pressure (e.g. federation deadlines).

## What's Working

1. **Query-concurrency discipline** — `loadSeasonRenewals` is deliberately pulled out of the page's `Promise.all` (`equipos/[teamId]/page.tsx:169-186`) with a comment explaining why, directly matching this project's own hard-won rule about the Supavisor pooler. Correct and non-obvious.
2. **`RosterHealth` component** (`roster-health.tsx:82-102`) — a well-judged "strip, not panel" summary: inline stats + badges in one flat `Card`, appropriately de-emphasized when everything's fine rather than an empty placeholder box.
3. **Composition-layer adherence** — `PageHeader size="compact"` on the detail page, `TableHead priority` for column-hiding instead of relying only on horizontal scroll, `StatusBadge` + `status-tone.ts` throughout. No hand-rolled headers or ad hoc badge colors anywhere in these files, confirmed by both the LLM read and the clean detector scan.

## Priority Issues

**[P1] Roster-health alerts are informational-only, with no click-through to fix**
- **Why it matters**: A coordinator who sees "2 dorsales duplicados" has to manually scan the whole roster table to find which two players. Under a federation deadline this passive-alert design actively costs time instead of saving it.
- **Fix**: Make the alert badge (in `roster-health.tsx` and the row-level icon in `equipos-browser.tsx:210-226`) a trigger that scrolls to and highlights the affected row(s) in `RosterTable`, rather than a native-tooltip-only badge.
- **Suggested command**: `/impeccable shape` (plan the alert → row interaction before building it)

**[P1] Sensitive personal data sits behind a plain view-switch with no additional friction**
- **Why it matters**: The "datos" view (`roster-table.tsx:268-276`) exposes national ID, phone, and full address for every roster member — including minors, given visible categories like Cadete/Infantil — gated only by the same `canManage` permission used for editing rosters. There's no masking or reveal-on-demand, and no separation from print/export paths.
- **Fix**: Mask national ID by default with an explicit reveal action; confirm the "datos" view is excluded from any acta/export path that doesn't need it.
- **Suggested command**: `/impeccable harden`

**[P2] Team deletion has no differentiated confirmation for consequence**
- **Why it matters**: `DeleteTeamDialog` → `DeleteEntityDialog` treats deleting a team with a full roster, documents, and notes identically to deleting a single document. Deleting a team with an active roster is a genuinely high-stakes, hard-to-reverse action.
- **Fix**: Pass roster/document counts into the dialog's `values` so the description reads "Se eliminarán también sus N jugadores, M documentos…" — the generic component already supports interpolated `values`, so this is a copy-level fix, not a new dialog.
- **Suggested command**: `/impeccable clarify`

**[P2] Roster tab is visually top-heavy: up to 3 stacked cards before the actual list**
- **Why it matters**: On a team with both an incomplete web registration and roster-health issues, a user scrolls past two full-width alert cards (`page.tsx:298-346`) to reach the roster they came for — three different "attention needed" signals (header registration badge, web-registration alert, roster-health card) compete before the primary content.
- **Fix**: Consolidate the two alert cards into one row, or make the web-registration card collapsible/dismissible once acknowledged.
- **Suggested command**: `/impeccable layout`

**[P3] List-page search doesn't match jersey number**
- **Why it matters**: "Who has jersey 7" is a plausible, common query for a coach or coordinator, but `EquiposBrowser`'s search (`equipos-browser.tsx:93-104`) only matches team name/category, not player-level jersey numbers.
- **Fix**: Extend search matching to jersey number where feasible, or make clear this is a team-level (not player-level) search.
- **Suggested command**: `/impeccable shape`

## Persona Red Flags

**Alex (power-user — team coordinator managing many teams weekly)**: Browsing is fast (client-side search, `usePagedRows`), and opening a team is a single hover-prefetched click — good. But Alex hits real friction in the roster tab: checking medical-cert status for the whole roster while also wanting to see role/position requires two separate "vista" states, and switching back and forth is exactly the kind of repetitive task a power user resents. No bulk actions exist (e.g. "flag all missing web registrations for a reminder email") — the alert card only links off to a season-level pending list, it can't act from here.

**Riley (stress-tester — registering rosters right before a federation deadline)**: The duplicate-jersey/age-out-of-range/medical alerts are visible but entirely passive — no "N problems, fix them now" call to action, no way to filter the roster table down to just the flagged rows. The "web registration missing" card's only action is a button that navigates away to `/temporadas/{id}/pendientes?team={id}`, pulling Riley out of the team page entirely rather than resolving inline — costly context-switching when triaging many teams against a deadline.

## Minor Observations

- The "all good" health state (`equipos-browser.tsx:211-226`) uses a bare `CheckIcon` with only an `aria-label`, visually silent next to the destructive/secondary problem badges — probably intentional (don't reward noise with visual weight) but worth a glance-test to confirm it reads clearly in the actual table.
- `RosterTable`'s `MedicalBadge` correctly reuses `StatusBadge`/`MEDICAL_CERT_TONE` — good adherence to the semantic-tone rule, not an issue.
- The empty-roster state (`page.tsx:328-345`) duplicates the "add member" CTA (once in the empty state, again as a `headerActions` item once populated) — functionally fine, slightly inconsistent placement.
- No visible distinction between "no photo uploaded" and "photo failed to load" — `photoUrls.get(...) ?? null` silently falls back to initials in both cases.

## Questions to Consider

1. Is the roster's four-way "vista" switcher (roster/médico/tallas/datos) the right model, or would a single roster view with progressively-disclosed detail (expand a row for medical/sizes/contact) serve better than a full column-set swap for the whole team?
2. Should "quién falta por inscribirse" live inside the team detail at all, or is surfacing it here — alongside roster health, registration status, and the roster table itself — just adding a fourth "attention" signal to an already-busy page?
3. Given that `equipos.view`/`equipos.manage` is the only permission gate, is showing national ID/phone/address to every manager the intended privacy model, or has it just inherited the coarsest available permission because a finer one didn't exist yet?
