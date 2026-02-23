# PokerNow HUD — Full Product Specification

---

## 1. Overview

A Google Chrome extension that overlays a poker HUD (Heads-Up Display) on PokerNow game tables. The extension scrapes live game data in real-time, stores hand histories in a local database, and displays per-player statistics directly on the table. A companion dashboard provides hand history import, player stat browsing, and settings management.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | Vanilla HTML + CSS + JavaScript (no frameworks, no build tools) |
| Local Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Launcher | One-click shell/batch launcher script to start the backend |

The backend runs entirely on the user's local machine. The extension communicates with it via HTTP requests to `localhost`. No external services or internet connection required for core functionality.

---

## 3. Data Collection

### 3.1 Primary — Live Scraping
- The extension observes DOM changes on the PokerNow game page in real-time.
- Stats are parsed and stored **after each hand completes** (not during).
- The extension detects hand completion events by monitoring the PokerNow page structure.

### 3.2 Secondary — Hand History File Import
- Users can import PokerNow hand history CSV exports via the dashboard.
- Bulk import of large historical files must be supported.
- **Deduplication:** Any hand already in the database (matched by unique hand ID) is skipped automatically. This prevents double-counting hands captured both live and via import.

---

## 4. Player Identification

- Players are identified by their **PokerNow unique ID**, embedded in their display tag (e.g., `Josiah @ uUVVitEqhJ`). The alphanumeric suffix after `@` is the stable identifier.
- The **display name** shown in the HUD always reflects the player's most recent name used.
- Name changes do not create duplicate player profiles.
- **The user's own stats are tracked and displayed** alongside opponent stats.

---

## 5. Game Variants

The extension supports three game variants, **auto-detected** from the PokerNow page:

- **NLH** — No-Limit Hold'em
- **PLO** — Pot-Limit Omaha (4 cards)
- **PLO5** — Pot-Limit Omaha (5 cards)

Each player has **separate stat profiles per game variant**. NLH stats never mix with PLO or PLO5 stats.

---

## 6. Table Size Categories & Position Labels

Stats are also tracked separately across three table size categories, determined by the number of active players at the table (auto-detected):

| Category | Player Count |
|---|---|
| Full Ring | 7–10 players |
| 6-Max | 4–6 players |
| Short-Handed | 1–3 players |

Position labels use **standard adaptive naming** that adjusts based on active player count:
- Positions: UTG, MP, CO, BTN, SB, BB (and variants like UTG+1, HJ, etc. for full ring)

A player's stats are always stored and displayed in the context of the correct table size category.

---

## 7. HUD Overlay

### 7.1 Placement
- Stat displays are **overlaid directly on or near each player's seat** on the PokerNow table — the classic poker HUD experience.
- Works across **multiple PokerNow table tabs simultaneously**, each with its own overlay, all reading from and writing to the same shared database.
- Layout and design are **fixed** — no user repositioning, resizing, or opacity controls.

### 7.2 Core Visible Row
Always visible next to each player's seat. Includes:

```
Hands | VPIP | PFR | 3B | Fold to 3B | Flop CBet SRP | Fold to Flop CBet SRP | Turn Barrel | Flop XR | River AF | WWSF
```

- **Hands** also serves as the sample size indicator.
- Stats display immediately regardless of sample size — the hand count communicates reliability.

### 7.3 Hover Popup
- Triggered by **hovering** over a player's HUD overlay.
- Closes **immediately** when the mouse leaves the overlay.
- No pin/lock functionality.
- Popup contains four tabbed sections: **Preflop / Flop / Turn / River**.

---

## 8. Stat Definitions

The same stat structure applies to **NLH, PLO, and PLO5**.

### PREFLOP (Popup Tab)

**Overall:**
- VPIP
- PFR
- Raise First In (RFI)
- 3Bet Total
- Fold to 3Bet
- 4Bet
- Fold to 4Bet
- Squeeze
- Fold to Squeeze
- Cold Call 3Bet IP
- Cold Call 3Bet OOP

**By Position:**
- RFI EP
- RFI MP
- RFI CO
- RFI BTN
- RFI SB
- BB Defend vs BTN
- Fold BB vs SB

---

### FLOP (Popup Tab)

**SRP (Single Raised Pot):**
- CBet Flop
- Fold to Flop CBet
- Call Flop CBet
- Raise Flop CBet
- Donk Flop

**3Bet Pot:**
- CBet Flop 3BP IP
- CBet Flop 3BP OOP
- Fold to Flop CBet 3BP
- Raise Flop CBet 3BP

**General:**
- Check-Raise Flop
- WWSF

---

### TURN (Popup Tab)
- Turn Barrel After Flop CBet
- Fold to Turn Barrel
- Probe Turn (Bet vs Missed CBet)
- Delayed CBet
- Turn Check-Raise
- Overbet Turn
- Fold to Turn XR

---

### RIVER (Popup Tab)
- River Aggression Frequency
- River Bet %
- River Overbet %
- River Check-Raise
- Fold to River Bet
- WTSD (Went to Showdown)
- W$SD (Won $ at Showdown)

---

## 9. Stats Display & Filtering

### 9.1 Lifetime vs. Session Toggle
- Users can toggle between **Lifetime stats** and **Session stats** directly on the HUD overlay (a persistent control on the page).
- **Session** is defined as **table-based**: all hands played at the current specific PokerNow table URL constitute the session.

### 9.2 Rolling Hand Sample
- Stats are computed over a **configurable rolling window** of the most recent N hands.
- **Default: 1,000 hands.**
- Setting is **global** (applies to all players and all tables).
- The full hand history is always stored in the database regardless of the rolling window — the window only affects stat computation.
- Rolling sample size is configurable in the dashboard settings.

---

## 10. Dashboard

Accessible via the Chrome extension popup or a dedicated extension page. Contains three sections:

### 10.1 Player List
- Simple list of all tracked players.
- No search, sort, or filter functionality (v1).
- Clicking a player shows their full stat profile (all variants, all table sizes).

### 10.2 Hand History Import
- Upload PokerNow CSV hand history files.
- Supports bulk import of large files.
- Deduplication runs automatically on import.
- Shows import progress and a summary of hands added vs. skipped.

### 10.3 Settings
- Rolling hand sample size (default: 1,000)
- No other configurable settings for v1.

---

## 11. Error Handling

- If the **local backend server is not running**, the extension displays a **visible warning** on the PokerNow page (e.g., a banner or overlay indicator) informing the user to start the server.
- All other error handling is standard (failed requests are silently retried or ignored without crashing the overlay).

---

## 12. Backend API (High-Level)

The Node.js + Express backend exposes a REST API on `localhost` that the extension calls. Key responsibilities:

- Receive and store completed hand data (parsed by the extension's content script)
- Compute and return player stats (filtered by variant, table size, session, rolling window)
- Handle hand history CSV imports
- Serve settings read/write endpoints

The SQLite database stores:
- **Hands** — full hand records with unique hand ID, timestamp, table ID, variant, player count
- **Actions** — per-player actions within each hand (for stat computation)
- **Players** — unique player registry (unique ID + most recent display name)
- **Settings** — key/value config store

---

## 13. Launcher

- A single **one-click launcher script** (e.g., `start.sh` for Mac/Linux, `start.bat` for Windows) starts the Node.js backend server.
- The script should check if Node.js is installed and provide a clear error message if not.
- Server runs on a fixed localhost port (e.g., `3000`).

---

## 14. Scope Exclusions (v1)

The following are explicitly **out of scope** for the initial version:

- Player notes or color-coded labels
- Visual HUD customization (size, position, opacity)
- Stat export (CSV or otherwise)
- Player search/sort in the dashboard
- Date-range filtering
- Cloud sync or multi-machine support
- Stake/blind level tracking
- Real-time intra-hand stat updates
