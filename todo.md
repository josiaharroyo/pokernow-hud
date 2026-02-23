# PokerNow HUD — Development Checklist

---

## 1. Project Setup

- [ ] Initialize Node.js project in `/backend` folder (`npm init`)
- [ ] Install backend dependencies: `express`, `better-sqlite3`, `cors`
- [ ] Create Chrome extension folder structure (`/extension`)
- [ ] Create `manifest.json` (Manifest V3) with correct permissions (`tabs`, `storage`, `host_permissions` for PokerNow and localhost)
- [ ] Create one-click launcher script (`start.sh` for Mac/Linux, `start.bat` for Windows)
- [ ] Launcher script checks that Node.js is installed and shows clear error if not
- [ ] Add `node_modules/` and `*.db` to `.gitignore`
- [ ] Define folder structure:
  ```
  /backend
    server.js
    db.js
    routes/
    /extension
    manifest.json
    content.js
    overlay.js
    popup/
    dashboard/
  ```

---

## 2. Database Schema

- [ ] Create `players` table:
  - `player_id` (TEXT, unique PokerNow ID, PRIMARY KEY)
  - `display_name` (TEXT, most recent name)
  - `created_at`, `updated_at`
- [ ] Create `hands` table:
  - `hand_id` (TEXT, unique PokerNow hand ID, PRIMARY KEY)
  - `table_id` (TEXT, PokerNow table URL/identifier)
  - `variant` (TEXT: `NLH`, `PLO`, `PLO5`)
  - `table_size_category` (TEXT: `full_ring`, `six_max`, `short_handed`)
  - `player_count` (INTEGER)
  - `played_at` (DATETIME)
  - `raw_data` (TEXT, full hand JSON for reprocessing)
- [ ] Create `hand_players` table (junction — one row per player per hand):
  - `hand_id`, `player_id`
  - `position` (TEXT: BTN, SB, BB, UTG, MP, CO, etc.)
  - `hole_cards`, `final_hand`
  - `went_to_showdown` (BOOLEAN)
  - `won_at_showdown` (BOOLEAN)
  - `net_amount` (REAL)
- [ ] Create `actions` table:
  - `id`, `hand_id`, `player_id`
  - `street` (TEXT: preflop, flop, turn, river)
  - `action_type` (TEXT: fold, call, raise, check, bet, etc.)
  - `amount` (REAL)
  - `pot_type` (TEXT: SRP, 3bet_pot, 4bet_pot)
  - `is_ip` (BOOLEAN — in position flag)
  - `sequence_order` (INTEGER)
- [ ] Create `settings` table:
  - `key` (TEXT, PRIMARY KEY)
  - `value` (TEXT)
- [ ] Seed default settings: `rolling_sample_size = 1000`
- [ ] Write DB initialization script that creates all tables on first run

---

## 3. Backend — Server & API

### Core Server
- [ ] Set up Express server on fixed port (e.g., `3000`)
- [ ] Enable CORS for the Chrome extension origin
- [ ] Add graceful shutdown handling
- [ ] Log startup message with localhost URL

### Player Endpoints
- [ ] `GET /players` — list all players (id + display name)
- [ ] `GET /players/:id` — get single player profile
- [ ] `PUT /players/:id/name` — update display name

### Hand Endpoints
- [ ] `POST /hands` — receive and store a completed hand from content script
- [ ] Deduplication check: reject hand if `hand_id` already exists
- [ ] `GET /hands` — list hands (filterable by `table_id`, `variant`, `player_id`)

### Stats Endpoints
- [ ] `GET /stats/:player_id` — return full stat profile for a player
  - Query params: `variant`, `table_size_category`, `scope` (`lifetime` or `session`), `table_id` (for session), `sample_size` (rolling window)
- [ ] Stats computed from raw `actions` table (not pre-aggregated)
- [ ] Rolling window logic: use only the most recent N hands per player

### Import Endpoint
- [ ] `POST /import` — accept PokerNow CSV upload
- [ ] Parse CSV line by line, extract hands
- [ ] Deduplicate against existing `hand_id`s
- [ ] Return summary: `{ imported: N, skipped: N, errors: N }`

### Settings Endpoints
- [ ] `GET /settings` — return all settings
- [ ] `PUT /settings/:key` — update a setting value

---

## 4. Stats Computation Engine

### Preflop Stats (NLH / PLO / PLO5)
- [ ] VPIP (Voluntarily Put money In Pot %)
- [ ] PFR (Preflop Raise %)
- [ ] Raise First In (RFI overall)
- [ ] 3Bet Total %
- [ ] Fold to 3Bet %
- [ ] 4Bet %
- [ ] Fold to 4Bet %
- [ ] Squeeze %
- [ ] Fold to Squeeze %
- [ ] Cold Call 3Bet IP %
- [ ] Cold Call 3Bet OOP %
- [ ] RFI by position: EP, MP, CO, BTN, SB
- [ ] BB Defend vs BTN %
- [ ] Fold BB vs SB %

### Flop Stats
- [ ] CBet Flop SRP %
- [ ] Fold to Flop CBet SRP %
- [ ] Call Flop CBet SRP %
- [ ] Raise Flop CBet SRP %
- [ ] Donk Flop %
- [ ] CBet Flop 3BP IP %
- [ ] CBet Flop 3BP OOP %
- [ ] Fold to Flop CBet 3BP %
- [ ] Raise Flop CBet 3BP %
- [ ] Check-Raise Flop %
- [ ] WWSF (Won When Saw Flop %)

### Turn Stats
- [ ] Turn Barrel After Flop CBet %
- [ ] Fold to Turn Barrel %
- [ ] Probe Turn (Bet vs Missed CBet) %
- [ ] Delayed CBet %
- [ ] Turn Check-Raise %
- [ ] Overbet Turn %
- [ ] Fold to Turn XR %

### River Stats
- [ ] River Aggression Frequency
- [ ] River Bet %
- [ ] River Overbet %
- [ ] River Check-Raise %
- [ ] Fold to River Bet %
- [ ] WTSD (Went to Showdown %)
- [ ] W$SD (Won $ at Showdown %)

### Stat Segmentation
- [ ] All stats computed separately per variant (`NLH`, `PLO`, `PLO5`)
- [ ] All stats computed separately per table size category (`full_ring`, `six_max`, `short_handed`)
- [ ] Lifetime stats (all hands ever)
- [ ] Session stats (hands at current table only)
- [ ] Rolling sample window applied correctly (most recent N hands)

---

## 5. Chrome Extension — Content Script (Live Scraping)

- [ ] Inject content script on all PokerNow table pages (`https://www.pokernow.club/games/*`)
- [ ] Auto-detect game variant (NLH / PLO / PLO5) from page DOM
- [ ] Auto-detect active player count and determine table size category
- [ ] Identify each player's unique ID from their display tag (e.g., `Josiah @ uUVVitEqhJ`)
- [ ] Extract stable unique ID (the alphanumeric suffix after `@`)
- [ ] Detect hand completion event via DOM mutation observer
- [ ] On hand completion, parse the full hand:
  - [ ] Hand ID
  - [ ] All player IDs and positions
  - [ ] All actions per street (preflop, flop, turn, river)
  - [ ] Pot type (SRP, 3bet pot, 4bet pot)
  - [ ] In-position flags per action
  - [ ] Showdown results (who went to showdown, who won)
- [ ] Send parsed hand JSON to backend via `POST /hands`
- [ ] Handle backend not running: show visible warning banner on the page
- [ ] Remove warning banner when backend becomes reachable again
- [ ] Support multiple simultaneous table tabs (each tab runs independently)

---

## 6. Chrome Extension — HUD Overlay

### Overlay Injection
- [ ] After each hand, fetch updated stats from backend for all players at the table
- [ ] Map each seat position on the page to its corresponding player ID
- [ ] Inject/update stat overlay element near each player's seat
- [ ] Overlay updates only after hand completion (not intra-hand)
- [ ] Overlay persists correctly when players sit out, leave, or join mid-session

### Core Visible Row
Display the following for each player:
- [ ] Hands (sample size)
- [ ] VPIP
- [ ] PFR
- [ ] 3B
- [ ] Fold to 3B
- [ ] Flop CBet SRP
- [ ] Fold to Flop CBet SRP
- [ ] Turn Barrel
- [ ] Flop XR
- [ ] River AF
- [ ] WWSF

### Lifetime / Session Toggle
- [ ] Add persistent toggle control on the table page (not per-player, global)
- [ ] Toggle switches all overlays between lifetime and session stats simultaneously
- [ ] Session = hands played at the current table (by table ID)

### Hover Popup
- [ ] Hover over a player's core row triggers the popup
- [ ] Popup closes immediately when mouse leaves the overlay
- [ ] Popup contains four tabs: **Preflop / Flop / Turn / River**
- [ ] Each tab displays the full stat breakdown as defined in the spec
- [ ] Popup is positioned to avoid going off-screen (clamp to viewport)

### New Player Handling
- [ ] If a player has zero hands in the database, show `—` for all stats but display `0` for Hands
- [ ] Overlay still renders for players with no history

---

## 7. Hand History File Import (Dashboard)

- [ ] Parse PokerNow CSV hand history format correctly
- [ ] Handle large files without blocking the UI (stream or chunk processing)
- [ ] Detect and extract: hand ID, variant, player IDs, all actions, timestamps
- [ ] Deduplicate against existing hands in the database
- [ ] Show real-time progress indicator during import
- [ ] Display final summary: hands imported, hands skipped (duplicates), errors

---

## 8. Dashboard UI

### Player List Page
- [ ] List all tracked players (display name + unique ID)
- [ ] Show total hands tracked per player
- [ ] Click a player to view their full stat profile
- [ ] Player detail view shows stats broken down by variant and table size category

### Import Page
- [ ] File picker for PokerNow CSV hand history files
- [ ] Progress bar / status during import
- [ ] Results summary after import completes

### Settings Page
- [ ] Display current rolling sample size
- [ ] Input to update rolling sample size (saved to backend)

### General
- [ ] Dashboard accessible via Chrome extension toolbar icon popup or dedicated page
- [ ] Clean, minimal UI consistent with the HUD's visual style
- [ ] Show connection status (backend running / not running)

---

## 9. Position Mapping Logic

- [ ] Implement adaptive position labeling based on player count:
  - 2 players: BTN/SB, BB
  - 3 players: BTN, SB, BB
  - 4 players: BTN, CO, SB, BB
  - 5 players: BTN, CO, HJ, SB, BB
  - 6 players: BTN, CO, HJ, UTG, SB, BB
  - 7–9 players: BTN, CO, HJ, UTG, UTG+1, MP, SB, BB (adjust as needed)
- [ ] Correctly assign position labels to each player before storing hand data

---

## 10. Testing

- [ ] Test live scraping on a real NLH PokerNow game
- [ ] Test live scraping on a real PLO PokerNow game
- [ ] Test live scraping on a real PLO5 PokerNow game
- [ ] Test with 2, 4, 6, and 9 player tables
- [ ] Verify stats match manual calculations on known hands
- [ ] Test CSV import with a large hand history file
- [ ] Verify deduplication works (import same file twice)
- [ ] Test multi-table: open 2+ PokerNow tabs simultaneously
- [ ] Test session vs. lifetime toggle
- [ ] Test rolling sample window (import 1500 hands, verify only last 1000 used)
- [ ] Test backend-not-running warning banner
- [ ] Test warning banner disappears when backend is restarted
- [ ] Test player name change: verify same stats retained under new display name
- [ ] Verify own stats appear correctly in HUD

---

## 11. Polish & Edge Cases

- [ ] Handle PokerNow DOM changes gracefully (don't crash if an element is missing)
- [ ] Avoid overlay flicker between hands
- [ ] Ensure overlay z-index doesn't interfere with PokerNow UI elements
- [ ] Handle players who leave and rejoin mid-session
- [ ] Handle all-in situations and run-it-twice (if PokerNow supports it)
- [ ] Graceful handling of malformed or incomplete hand data
- [ ] Backend returns sensible defaults if no hands found for a player/filter combo

---

## 12. Deployment & Distribution

- [ ] Write clear `README.md` with setup instructions:
  - Install Node.js
  - Run `npm install` in `/backend`
  - Run launcher script to start server
  - Load extension in Chrome via `chrome://extensions` (Developer mode)
- [ ] Test full setup flow from scratch on a clean machine
- [ ] Optionally package extension as a `.zip` for manual distribution
