# QuickSee --- Approved Project Plan Draft (Implementation On Hold)

> **Status:** Planning draft prepared from the user's specified
> requirements. This is not an approval to code. Do not implement until
> the user explicitly approves the plan.

## Decision Summary

-   App name: QuickSee
-   Storage: Local browser storage
-   X data collection: Manual paste from copied posts
-   Reminders: In-app only
-   Platform: Responsive desktop/tablet/mobile web app
-   Primary record groups: Crypto Projects and Games

## Scope

Use `Client_Brief.md` for the full product requirements and acceptance
criteria. Use `Project_Name.md` for product identity, visual direction,
navigation, and core product rules.

## Proposed Navigation

Dashboard → Crypto Projects → Games → Quick Paste → Calendar → Settings
& Data

## Primary User Flow

1.  Open Quick Paste.
2.  Choose Crypto Project or Game.
3.  Paste copied announcement text and optionally add its source URL.
4.  Review the suggested fields; correct uncertain or missing values.
5.  Confirm record type/status and relevant dates.
6.  Check duplicate warnings.
7.  Save locally.
8.  Find the record from search/filters and monitor its milestones on
    the dashboard/calendar.
9.  Export CSV or a full JSON backup regularly.

## Technical Direction

-   Responsive React/Next.js + TypeScript interface.
-   Tailwind CSS or equivalent consistent styling system.
-   Local browser persistence, using localStorage for a small/simple
    data set or IndexedDB if testing indicates a better fit.
-   No backend, account system, cloud database, X API, or external data
    service in the MVP.
-   Keep storage access behind a small repository/service layer so a
    future storage migration can be considered without rewriting the UI.
-   Keep parsing deterministic and local; parsing results are
    suggestions, never trusted facts until reviewed.

## Data Model Outline

-   `CryptoProject`: id, projectName, network, token, tokenCA, type,
    postLink, joinedAt, releaseDate, claimDate, listingDate,
    dateConfidence metadata, status, notes, createdAt, updatedAt.
-   `Game`: id, gameName, gameLink, network, token, tokenPrice, tokenCA,
    joinedAt, gameReleaseDate, tokenReleaseDate, dateConfidence
    metadata, status, notes, createdAt, updatedAt.
-   `Milestone`: derived from record date fields for calendar display;
    avoid unnecessary duplicate copies of date data.
-   `AppBackup`: schemaVersion, exportedAt, cryptoProjects, games, user
    preferences if any.

## Key Quality Requirements

-   Review before save for pasted data.
-   Field-level validation and helpful error messages.
-   Duplicate detection across normalized URLs and contract address +
    network; name-only matches should be warnings, not hard blocks.
-   Safe text rendering and safe URL handling.
-   Clear confirmations for destructive actions.
-   Keyboard-accessible forms and visible focus states.
-   Mobile card/list presentation; wide-screen table presentation.
-   Reliable CSV encoding and parsing, including commas, quotes, and
    newlines.
-   Versioned JSON backups and validation before restore.
-   No hidden outbound transmission of stored user data.

## Known Constraints

-   Browser-local data belongs to that browser profile/device and will
    not automatically sync elsewhere.
-   Browser data clearing, private browsing, device failure, or storage
    limitations may cause loss; export/backup is essential.
-   In-app reminders are shown when the app runs; reminders cannot be
    guaranteed while the app is closed.
-   Rule-based paste parsing will not recognize every announcement
    format.
-   Live token prices and automated X monitoring are not included.

## Implementation Plan

1.  Confirm the plan and resolve open questions.
2.  Build responsive shell, navigation, and theme.
3.  Implement local data model and storage service.
4.  Implement Crypto Projects and Games CRUD.
5.  Implement copy contract address and form validation.
6.  Implement Quick Paste parsing, review, and duplicate warnings.
7.  Implement dashboard metrics, search, filters, and sorting.
8.  Implement calendar and in-app reminders.
9.  Implement CSV import/export and JSON backup/restore.
10. Run responsive, accessibility, security, persistence, and
    data-portability tests.
11. Compare implementation against the acceptance criteria in
    `Client_Brief.md`.

## Approval Gate

**No implementation work is authorized by this draft.** The next action
is to review the brief and plan. Only proceed to coding after the user
explicitly says to approve or begin implementation.
