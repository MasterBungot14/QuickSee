# QuickSee — Personal Web3 Tracker

A high-performance, client-side Web3 portfolio and radar tracker for airdrops, whitelists, games, tokens, and release dates.

> **"Paste once, organize quickly, and see what is coming next."**

---

## 🌟 Key Features

1. **Dashboard Overview**
   - Live metrics: Total records, Whitelists, Airdrops, Web3 Games, and Overdue milestones.
   - Configurable Upcoming Milestone radar (7, 30, or 90 day lookahead).
   - Urgent In-App Reminder alerts for imminent claims and overdue dates.
   - Visual Status Distribution breakdown.
   - Recently active & updated records list with 1-click details.

2. **Crypto Projects Tracker**
   - Separate, dedicated tracking for **Airdrops** and **Whitelists** (required selection).
   - Rich fields: Project Name, Network, Token Symbol, Contract Address (CA), Date Joined, Expected Release/TGE Date, Claim Date, Listing Date, Date Confidence (Confirmed vs. Estimated), Status, and Notes.
   - 1-click Contract Address (CA) copy with animated tooltip and toast feedback.
   - Filters: Search query, Type filter (Whitelist / Airdrop), Status filter, Network filter, and Sorting (Recently Updated, Release Date, Name, Date Added).
   - View switch: Responsive Table view vs. Card Grid view.

3. **Web3 Games Tracker**
   - Tailored specifically for blockchain games and game tokens.
   - Fields: Game Name, Official Link, Network, Token Symbol, Token Price (USD), Contract Address, Date Joined, Game Release Date, Token Release Date, Status, and Notes.
   - Quick external official site launch and 1-click CA copy.

4. **Quick Paste Announcement Parser (Local Heuristic Engine)**
   - Paste copied announcement text from X (Twitter), Discord, or Telegram.
   - Automatically extracts candidate fields:
     - Project / Game Name
     - Network (Ethereum, Solana, Base, Arbitrum, Monad, Berachain, Sui, Aptos, etc.)
     - Token ticker symbol ($TOKEN)
     - Contract Address (EVM `0x...` & Solana Base58)
     - Record Type (Whitelist vs. Airdrop vs. Game)
     - Milestone Dates (TGE, Claim, Listing, Game Launch)
     - Links and Game Token Prices
   - Zero external cloud dependencies; runs 100% locally.
   - Flags missing or uncertain fields without guessing or fabricating data.
   - Full review & edit step before saving.

5. **4-Stage Duplicate Detection**
   - Automatically checks candidate records against existing entries in priority order:
     1. Exact normalized X/Twitter post link.
     2. Exact normalized official / project URL.
     3. Normalized Contract Address (CA) + Network.
     4. Normalized Project/Game name (soft warning).
   - Actionable duplicate warning dialog: "View Existing Record", "Ignore & Save Anyway", or "Cancel".

6. **Interactive Calendar & Milestone Agendas**
   - **Month Grid View**: Visual day cells showing color-coded milestone pills (TGE, Claim, Listing, Launch) with overdue flags.
   - **Agenda List View**: Chronological grouping into *Overdue Milestones*, *Today & Tomorrow*, *This Week*, *This Month*, and *Upcoming Later*.
   - Filter by milestone category: All, Crypto Only, Games Only, Claims, or TGEs.
   - Local device timezone display.

7. **Local Storage & Full Data Portability**
   - **100% Client-Side**: Stored in your browser's LocalStorage. Zero accounts, zero tracking, zero third-party API exposure.
   - **Full JSON Backup & Restore**: One-click download of versioned `quicksee_backup.json` and safe restoration with duplicate merging.
   - **RFC 4180 CSV Export & Import**:
     - Export Crypto Projects (`quicksee_crypto_projects.csv`)
     - Export Games (`quicksee_games.csv`)
     - Safe CSV Import with pre-import validation table, error reporting, duplicate suppression, and acceptance preview.
   - **Curated Sample Data**: One-click seed button to load realistic Web3 projects (Monad, Berachain, Grass, Illuvium, etc.) for instant testing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)

### Running Locally
```bash
# Start the local development server
npm start
# or
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🎨 Design System & Palette

- **Dark Navy Background**: `#0B1220`
- **Surface / Card**: `#111C2E`
- **Elevated Surface**: `#17263A`
- **Primary Mint**: `#35E0B5`
- **Secondary Cyan**: `#55C7F7`
- **Warning / Alert**: `#F5B942`
- **Error / Overdue**: `#F87171`
- **Success**: `#34D399`
- **Typography**: `Inter` (UI), `Outfit` (Headings), `JetBrains Mono` (Addresses & Codes)

---

## 📂 Project Architecture

```
QuickSee/
├── index.html              # Main application single-page structure
├── package.json            # Node project configuration
├── server.js               # Zero-dependency local static server
├── README.md               # Documentation and guides
├── css/
│   ├── variables.css       # Design tokens, color palette, typography
│   ├── main.css            # Base styles, app shell, header, sidebar
│   ├── components.css      # Buttons, cards, tables, badges, modals, calendar
│   └── responsive.css      # Tablet and mobile breakpoints & drawers
├── js/
│   ├── app.js              # Application controller, router & view renderer
│   ├── storage.js          # Versioned local storage manager, CRUD, JSON backup
│   ├── parser.js           # Heuristic announcement parser for X posts
│   ├── duplicates.js       # 4-stage duplicate detection engine
│   ├── calendar.js         # Month grid generator, agenda calculator
│   ├── csv.js              # RFC 4180 CSV serializer, parser, validator
│   ├── sampleData.js       # Curated sample Web3 projects and games
│   └── ui.js               # Toast alerts, copy-to-clipboard, modals
├── assets/
│   └── favicon.svg         # Modern Web3 radar favicon
└── test/
    ├── run_tests.js        # Automated unit & integration tests
    └── test_http.js        # HTTP server response verification
```

---

## 🔒 Security & Privacy Notice

QuickSee is architected as a local-first utility.
- No wallet private keys, seed phrases, or credentials are required or stored.
- Pasted announcement text is sanitized before rendering to prevent script injection.
- Always export backups regularly, as clearing your browser cache/cookies will delete local storage data.
