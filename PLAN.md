# Overlap — Implementation Plan

Decisions: PHP 8.5 + MariaDB (MySQL-compatible, installed via Homebrew); Vite + React for organizer; scope = MVP + .ics + presets (no accounts).

## Layout
- `db/schema.sql` — events, participants, availability
- `api/` — PHP JSON API (`index.php` router, `lib.php` helpers + best-slot algorithm, `config.php`)
- `public/` — docroot: `router.php` (dev router), `e/index.html` + `paint.js` (vanilla participant page), `shared.css` (riso tokens), `app/` (React build output)
- `web/` — Vite React app (create form, dashboard w/ polling heatmap, suggestions, finalize)

## Steps (PRD build order)
1. Schema + API; verify with curl
2. Vanilla paint page (mouse + touch via elementFromPoint), edit link, final time + .ics, presets
3. React create form + dashboard (5 s polling heatmap, hover names)
4. Suggestions + finalize
5. Riso styling from one shared stylesheet; run tests / browser check

## Key design
- slot_index = dayIdx * slotsPerDay + slotInDay; times converted only at the edges
- Event timezone stored and labelled in UI
- Tokens: 16-hex random; admin_token / edit_token compared with hash_equals
