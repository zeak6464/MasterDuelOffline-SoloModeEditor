# MasterDuelOffline-SoloModeEditor

Browser-based editor for YgoMaster (offline Yu-Gi-Oh! Master Duel) Data files.
Edit Solo Mode, decks, shop, settings, banlists, card pool, and more — then save
directly back into your Data folder.

## Requirements

- Python 3.x (https://www.python.org/)
- A working YgoMaster install with a Data folder (Solo.json, etc.)
- Internet access for card images / names (YGOPRODeck API)

## Quick Start

1. Keep this folder next to your YgoMaster Data folder, e.g.:

   YgoMaster\
     Data\
     MasterDuelOffline-SoloModeEditor-main\
       server.py
       solo_editor.html
       editor_app.js
       editor_tools.js

2. Run the server:

   python server.py

   The server auto-finds Data (looks in ..\Data and common install paths)
   and copies the editor HTML/JS into Data so they can be served.

3. Open in your browser:

   http://localhost:8000/solo_editor.html

4. Press Ctrl+C in the terminal to stop the server.

## Features

### Solo Mode
- Gates, Chapters, Unlocks
- Solo Duels (settings + visual Deck Editor)
- Movies
- Campaign tools: clone gate, bulk rewards, import YDK into a chapter

### Deck tools
- Deck Editor (player/CPU main/extra/side, card search + preview)
- Deck Browser (Solo Duels / Structure Decks) with YDK export
- Structure Deck editor

### Game data
- Settings (unlock-all toggles, gems, deck slots, craft costs)
- Custom Duel (LP, hand, CPU, mats, sleeves, BGM, deck paths)
- Shop + pack odds (prices, card lists, rarity rates)
- Card Pool (CardList.json + CardCraftableList.json) with card-grid UI
- Banlist editor (Regulation.json / Regulation.d) with card-grid UI
- Topics / home screen (Topics/YgoMaster.json)
- Cosmetics / BGM pickers (from ItemID.json)

### Utilities
- Save in place over HTTP (writes into Data, creates .bak backups)
- Backups tab: diff and restore .bak files
- Global search (gates, chapters, packs, cards)
- Validation (missing duels/movies, broken links, unknown card IDs)

## Saving

Most Save buttons write directly to files under Data and create a .bak copy
of the previous file. If the server save fails, the editor falls back to
downloading the JSON.

Example paths written:
- Data\Solo.json
- Data\SoloDuels\<chapterId>.json
- Data\Settings.json
- Data\Shop.json / ShopPackOdds.json
- Data\CardList.json / CardCraftableList.json
- Data\Regulation.json or Data\Regulation.d\*.json
- Data\StructureDecks\*.json
- Data\Topics\YgoMaster.json
- Data\CustomDuel.json

## Notes

- Card IDs in Master Duel / YgoMaster are game IDs (right-hand values in
  Data\YdkIds.txt). YDK import/export converts via that mapping.
- Settings.json / CustomDuel.json may lose // comments when saved (still valid).
- After updating editor files, restart server.py (or copy HTML/JS into Data)
  and hard-refresh the browser (Ctrl+F5).
- Default port is 8000. Close anything else using that port first.

## Original project

Based on: https://github.com/zeak6464/MasterDuelOffline-SoloModeEditor
Extended locally for full YgoMaster Data editing.
