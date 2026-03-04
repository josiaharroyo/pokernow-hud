# PokerNow DOM Findings

From DOM spy analysis. These are the confirmed selectors and structures the
content script should use.

---

## Game Type Detection

```
p.table-game-type
```
Text content: `"No Limit Texas Hold'em"` / `"Pot Limit Omaha"` etc.

---

## Player Seats

Container: `div.seats`

Each seat: `div.table-player.table-player-N` (N = 1–10)

### Key classes that change dynamically:

| Class added to seat div       | Meaning                        |
|-------------------------------|--------------------------------|
| `table-player-seat`           | Seat is **empty**              |
| `you-player`                  | **Your** seat                  |
| `decision-current`            | **This player's turn** to act  |
| `offline`                     | Player is disconnected         |

### Per-seat info selectors:

| Data              | Selector                                              |
|-------------------|-------------------------------------------------------|
| Display name      | `div.table-player-name > span > a` (text content)    |
| Stack size        | `p.table-player-stack span.normal-value` (text)      |
| Bet on table      | `p.table-player-bet-value` (text)                    |

---

## Table State

| Data              | Selector                                              |
|-------------------|-------------------------------------------------------|
| Dealer button     | `div.dealer-button-ctn.dealer-position-N` in `div.seats` |
| Pot size          | `div.table-pot-size .normal-value` (text)            |
| Community cards   | `div.table-cards.run-1`                              |

---

## Hand Completion Signal

When a hand ends, this element appears:

```
div.popover-1.review-hand-popover
```

This is the trigger to fire: "hand is over — parse and save."

---

## The Game Log (Critical)

The live action log lives in:

```
div.modal.full-modal.log-modal
  └── div.modal-body
        └── div.log-modal-body
              └── div.log-modal-entries   ← watch this for new children
```

This modal opens when the user clicks "Log / Ledger."

### Log Entry Types

Each action is a `div.entry-ctn` added as a child of `div.log-modal-entries`.
Some entries have additional classes indicating the action type:

| Classes                       | Example text                                              |
|-------------------------------|-----------------------------------------------------------|
| `start-game entry-ctn`        | `-- starting hand #4 (id: ybwhcgtkyjkc) No Limit Texas Hold'em (dealer: Josiah 1) --` |
| `entry-ctn` (plain)           | `Player stacks: #1 Josiah 1 (13220) \| #10 Josiah 2 (6780)` |
| `entry-ctn` (plain)           | `Your hand is K♣, 6♣`                                    |
| `entry-ctn` (plain)           | `Flop: [8♦, 9♣, A♦]`                                    |
| `entry-ctn` (plain)           | `The player Josiah 2 joined the game with a stack of 6780.` |
| `entry-raise entry-ctn`       | `Josiah 1 posts a small blind of 10`                     |
| `entry-raise entry-ctn`       | `Josiah 2 posts a big blind of 20`                       |
| `entry-raise entry-ctn`       | `Josiah 1 raises to 260`                                 |
| `entry-raise entry-ctn`       | `Josiah 2 bets 1170`                                     |
| `entry-call entry-ctn`        | `Josiah 1 calls 780`                                     |
| (need more hands)             | fold, check, showdown, winner entries TBD                |

### Parsing the `start-game` entry:
```
-- starting hand #4 (id: ybwhcgtkyjkc) No Limit Texas Hold'em (dealer: Josiah 1) --
```
Extracts:
- **Hand ID**: `ybwhcgtkyjkc` — used for deduplication
- **Game type**: `No Limit Texas Hold'em`
- **Dealer (BTN) seat**: `Josiah 1`

### Parsing the `Player stacks` entry:
```
Player stacks: #1 Josiah 1 (13220) | #10 Josiah 2 (6780)
```
Extracts:
- Seat number → display name → starting stack for every player in the hand

---

## Player Unique IDs — The Gap

**The action log entries use display names only** — no `@ uniqueID` suffix.

The unique IDs appear in the **Ledger** tab of the same modal:

```
div.game-ledger-body
```

Text content example:
```
Josiah 1 @ fXvM3XBWcf   Details  In:10000  Out:0  Stack:13220  Net:+3220
Josiah 2 @ elmXvakBxz   Details  In:10000  Out:0  Stack:6780   Net:-3220
```

### Strategy for the developer:

1. When the log modal opens, read `div.game-ledger-body` and parse
   all `Name @ UniqueID` entries to build a `displayName → uniqueID` map.
2. Store this map in memory for the session.
3. When parsing action log entries, use the display name to look up the unique ID.
4. If the ledger hasn't been read yet, queue parsed hands until the map is available.

### Alternative (to investigate):

The player name `<a>` tags in the seat DOM may have an `href` pointing to a
player profile URL containing the unique ID. The DOM spy did not capture `href`
attributes — this should be verified by inspecting a player name link in DevTools
(right-click → Inspect on a player name during a live game).

---

## Open Questions for Next DOM Spy Run

1. **Are log entries added to the DOM even when the log modal is closed?**
   If yes, the extension can watch `div.log-modal-entries` passively without
   requiring the modal to be open.
   If no, an alternative approach is needed (e.g. intercepting network requests).

2. **Do player name `<a>` tags have an `href` with the unique ID?**
   Check in DevTools Elements panel: inspect `div.table-player-name > span > a`.

3. **What do fold, check, and showdown log entries look like?**
   Need a hand with those actions to capture their class names and text format.

4. **What do Turn and River street marker entries look like?**
   Similar to `Flop: [8♦, 9♣, A♦]` but for Turn/River.

5. **What does the winner/pot collection entry look like?**
   e.g. `Josiah 1 collected 60 from pot` — need to confirm class and text format.
