# QuickSee --- Client Brief

## 1. Project Overview

**Product name:** QuickSee\
**Product type:** Personal, responsive Web3 project tracker\
**Primary purpose:** Help the user organize crypto airdrops, whitelist
opportunities, and blockchain games they have joined; quickly save
details from copied X posts; and monitor release, TGE, claim, listing,
and game launch dates.

## 2. Goals

-   Reduce manual entry by parsing pasted announcement text.
-   Keep Crypto Projects and Games organized in separate, searchable
    sections.
-   Give the user a single dashboard for statuses and upcoming
    milestones.
-   Prevent accidental duplicate records.
-   Keep records stored locally on the user's device.
-   Support data portability through CSV import/export and
    backup/restore.

## 3. Target User and Usage

A single user who follows Web3 projects and games, copies announcements
from X, and needs to maintain a personal record of participation and
expected release dates. The initial version does not require accounts, a
cloud database, or automatic X monitoring.

## 4. Core Information Architecture

1.  **Dashboard** --- totals, status breakdowns, upcoming dates, overdue
    milestones, recently added records, and quick actions.
2.  **Crypto Projects** --- airdrop and whitelist records.
3.  **Games** --- game and game-token records.
4.  **Quick Paste** --- paste copied post text, parse candidate fields,
    review/edit, then save.
5.  **Calendar** --- monthly and agenda views of release, claim/listing,
    and game launch dates.
6.  **Settings & Data** --- CSV import/export, full backup/restore,
    local data information, and display preferences.

## 5. Data Requirements

### 5.1 Crypto Projects

-   Project name
-   Network
-   Token name/symbol
-   Token contract address (CA)
-   Type: Whitelist or Airdrop (required selection)
-   X post link
-   Date joined
-   Expected release/TGE date
-   Claim date
-   Listing date
-   Status
-   Notes
-   Created and updated timestamps (system-managed)

Suggested status options: Researching, Joined, Eligible, Not Eligible,
Upcoming, Claimable, Listed, Completed, Paused, Dropped. The UI should
make status selection easy and permit a clear status change history in a
later version if needed.

### 5.2 Games

-   Game name
-   Game/official link
-   Network
-   Token name/symbol
-   Token price (manual numeric entry in MVP; currency displayed as USD
    unless changed)
-   Token contract address (CA)
-   Date joined
-   Game release date
-   Token release/TGE date
-   Status
-   Notes
-   Created and updated timestamps (system-managed)

Suggested status options: Researching, Joined, Playing, Upcoming, Live,
Token Upcoming, Completed, Paused, Dropped.

### 5.3 Date and Confidence Handling

-   Dates are optional unless the user explicitly marks a date as
    required.
-   Unknown dates must remain blank; never infer or fabricate a date.
-   Distinguish confirmed dates from estimated dates using a
    date-confidence field or label.
-   Show overdue milestones only when a valid date exists and the
    milestone is not completed.
-   Use the device's local timezone for calendar presentation.

## 6. Quick Paste Parsing

-   Provide a large paste field for copied X post text and a separate
    optional post URL field.
-   Offer record type selection: Crypto Project or Game.
-   For Crypto Projects, attempt to identify project name, network,
    token, token CA, whitelist/airdrop wording, post URL, and dates.
-   For Games, attempt to identify game name, game link, network, token,
    token price, token CA, and dates.
-   Extract only information actually present or confidently recognized
    in pasted content.
-   Clearly flag missing or uncertain fields; do not guess.
-   Let the user edit every extracted field before saving.
-   Show duplicate warnings before saving.
-   If the pasted post does not contain a field, leave it blank and
    request manual entry only where necessary.
-   Initial parsing is local and rule-based; it does not fetch or
    monitor X posts. Avoid claiming that arbitrary posts can always be
    parsed perfectly.

## 7. Dashboard and Search

Dashboard should include: - Total crypto project count - Whitelist
count - Airdrop count - Game count - Upcoming milestones within
configurable ranges (e.g., 7, 30, 90 days) - Overdue milestones -
Recently added/updated records - Quick Paste and Add Manually actions

Search/filter controls: - Search by project/game name, token, network,
or contract address - Filter by record type, status, network, and date
range - Sort by name, date added, release date, status, and most
recently updated - Provide clear empty states and a one-click reset for
filters

## 8. Calendar and In-App Reminders

-   Month and agenda/list views.
-   Include release/TGE, claim, listing, and game launch dates.
-   Show milestone name, record name, milestone type, status, and date.
-   Highlight upcoming and overdue items using accessible labels as well
    as color.
-   In-app reminder panel on the dashboard.
-   Since the app is local-only, reminders run when the app is opened;
    background/push reminders are not guaranteed when the browser is
    closed.
-   No email or server-side notifications in MVP.

## 9. Local Storage and Data Portability

-   Store records in browser-local storage; consider IndexedDB if data
    volume or future file attachments justify it.
-   No account or cloud synchronization in MVP.
-   Data remains in the same browser profile on the same device. It is
    not automatically available on another device or browser.
-   Provide explicit export of all data to a versioned JSON backup.
-   Provide CSV export for Crypto Projects and Games separately, with
    documented column headers.
-   Provide CSV import with preview, validation, duplicate detection,
    and a summary of rows accepted/rejected.
-   Never silently overwrite existing records during import.
-   Explain that clearing browser/site data, private browsing, or device
    loss can erase local records. Encourage regular backups.
-   Restore should validate the file format and ask for confirmation
    before replacing or merging data.

## 10. Duplicate Detection

Check, in order: 1. Exact normalized X post link for Crypto Projects. 2.
Exact normalized game/project link. 3. Normalized contract address plus
network, when a CA exists. 4. Normalized project/game name plus record
category as a softer warning.

Different networks may legitimately use the same token symbol. Do not
use token symbol alone as a hard duplicate key. Allow the user to
cancel, edit the existing record, or explicitly save a possible
duplicate where appropriate.

## 11. UX and Visual Design

-   Dark navy base with mint-green and cyan accents; white/light gray
    text.
-   Suggested palette:
    -   Background: `#0B1220`
    -   Surface/card: `#111C2E`
    -   Elevated surface: `#17263A`
    -   Primary mint: `#35E0B5`
    -   Cyan accent: `#55C7F7`
    -   Main text: `#F4F7FB`
    -   Muted text: `#9AAEC3`
    -   Warning: `#F5B942`
    -   Error: `#F87171`
    -   Success: `#34D399`
-   Use restrained gradients and subtle borders; avoid visual clutter.
-   Use consistent spacing, typography, button styles, form labels,
    badges, and date formats.
-   Prefer tables on wide screens and stacked cards/compact lists on
    narrow screens.
-   Do not rely on color alone to communicate status.
-   Provide keyboard navigation, visible focus states, sufficient
    contrast, descriptive labels, and usable touch targets.

## 12. Responsive Requirements

-   Desktop: persistent sidebar, overview cards, data tables,
    multi-column forms where helpful.
-   Tablet: collapsible sidebar, responsive grids, tables with
    horizontal scroll or condensed columns.
-   Mobile: compact top navigation or drawer, stacked forms, card/list
    records, full-width primary actions, and calendar agenda view by
    default.
-   Support common widths from small phones through large desktop
    displays.
-   No essential action should require hover.
-   Long contract addresses should wrap or truncate safely and always
    remain copyable.

## 13. Security and Privacy

-   Local-first, no account credentials, and no external API calls in
    MVP.
-   Treat pasted text and imported CSV/JSON as untrusted input.
-   Render user-provided text safely; never interpret pasted content as
    executable HTML or script.
-   Validate URLs and data types; use safe external-link behavior.
-   Do not expose private keys, seed phrases, wallet passwords, or other
    secrets in notes; the app is not a wallet.
-   No transaction signing, wallet connection, or smart-contract
    interaction in MVP.
-   Add clear destructive-action confirmations for deleting records,
    clearing all data, and replacing data during restore.
-   Avoid collecting analytics or sending saved project data externally.

## 14. Error, Loading, and Empty States

Design explicit states for: - Empty dashboard / no records - No search
results - Invalid or unsupported CSV/JSON - CSV rows with
missing/invalid fields - Duplicate warnings - Invalid URL or malformed
contract address - Storage quota or save failure - Export failure -
Restore validation failure - Unparseable pasted text - Partial parse
with fields requiring review - Date conflict or past date warning -
Confirmation before deletion or replacement

Errors should explain what happened and the next action. Preserve
unsaved form text when safe to do so.

## 15. MVP Acceptance Criteria

-   User can add, edit, view, search, filter, and delete Crypto Project
    records.
-   User can add, edit, view, search, filter, and delete Game records.
-   User can paste announcement text and receive an editable parse
    preview.
-   User can choose Whitelist or Airdrop explicitly.
-   User can copy a saved contract address with visible feedback.
-   Dashboard summarizes saved records and upcoming/overdue milestones
    accurately.
-   Calendar displays saved milestones.
-   Duplicate detection warns before saving/importing.
-   CSV import/export works with documented formats and
    preview/validation.
-   JSON backup and restore work with confirmation and validation.
-   Data persists after refresh in the same browser profile.
-   Layout is usable on desktop, tablet, and mobile.
-   No data is sent to an external service in the local-only MVP.

## 16. Out of Scope for MVP

-   Automatic X account monitoring or scheduled scraping
-   Guaranteed automatic extraction from every post format
-   Live token price feeds
-   Cloud sync, multi-user collaboration, and authentication
-   Email, push, or server-side reminders
-   Wallet connection, transaction execution, or token claiming
-   Investment recommendations or profitability predictions

## 17. Recommended Implementation Stages

1.  **Stage 1 --- Plan approval:** Confirm requirements, terminology,
    statuses, and visual direction.
2.  **Stage 2 --- Foundation:** Responsive layout, navigation, theme,
    local data model, and storage abstraction.
3.  **Stage 3 --- CRUD records:** Crypto Projects and Games forms,
    detail views, edit/delete, validation, and CA copy.
4.  **Stage 4 --- Quick Paste:** Local parser, field
    confidence/missing-field handling, review-before-save, and duplicate
    warnings.
5.  **Stage 5 --- Dashboard and discovery:** Summary metrics, search,
    filters, sorting, and recent records.
6.  **Stage 6 --- Calendar:** Milestone aggregation, agenda/month views,
    and in-app upcoming/overdue reminders.
7.  **Stage 7 --- Data portability:** CSV import/export, JSON
    backup/restore, validation, and duplicate review.
8.  **Stage 8 --- QA and polish:** Responsive testing, accessibility,
    error states, storage failure handling, security review, and
    acceptance testing.

**Approval gate:** Do not begin implementation until the user explicitly
approves this plan.
