# Overlap — PRD

Oct 14, 2026 · @Nexo

## Overview

Overlap finds the time a group is free: share one link, everyone paints their free slots, and the organizer gets the best time picked for them.

**Problem.** Planning anything with 4+ people (a study group, a team sync, a family dinner) becomes a long chat of "Tue works?" / "No, Wed?". Nobody can see the overlap at a glance.

**Who it's for.** Students, small teams, friend groups. No accounts needed for participants.

**Course fit.** Uses HTML, CSS, JS, PHP and React with a real reason for each: React for the organizer dashboard, vanilla HTML/CSS/JS for the lightweight public page, PHP + MySQL for the API.

## Goals and non-goals

**Goals**

- An organizer creates an event and gets a shareable link in under 30 seconds
- A participant marks availability on a phone in under a minute, with no login
- The organizer sees overlap live and gets the top 3 suggested slots

**Non-goals (for this version)**

- Google Calendar / Outlook sync
- Email or push notifications
- Recurring events
- Real-time websockets (polling is enough)

## Users and flows

Two users, two surfaces.

**Organizer (React app)**

1. Opens Overlap and creates an event: title, date range, daily time window, slot size, meeting length
2. Gets two links: a public share link and a private admin link
3. Shares the public link in WhatsApp or another group chat
4. Watches the heatmap fill in as people respond
5. Picks from the top 3 suggestions and locks the final time

**Participant (vanilla page at /e/{slug})**

1. Opens the link and enters a name
2. Drags across the grid to paint free slots
3. Submits and gets a personal edit link to change it later
4. Once the time is locked, the page shows the final time and an .ics download

## Features

| Feature | Scope | Done when |
| --- | --- | --- |
| Create event | MVP | Form validates the range and window, returns share + admin links |
| Paint availability | MVP | Click-drag and touch-drag both paint and erase on a phone |
| Edit later | MVP | The edit link reloads the participant's saved slots |
| Live heatmap | MVP | Organizer view updates within 5 s of a submit; hover shows names |
| Best-slot suggestions | MVP | Top 3 windows of meeting length, each with who's missing |
| Finalize | MVP | Admin locks a slot; the public page switches to the final time |
| .ics export | Stretch | Download opens in Google Calendar / Apple Calendar |
| Organizer accounts | Stretch | PHP session login; dashboard lists all of the organizer's events |
| Quick presets | Stretch | One tap to fill "weekday evenings" or "all afternoon" |

## Tech architecture

React and vanilla JS each own one surface, and both call the same PHP JSON API backed by MySQL.

&#91;embedded content: architecture · 2 front ends, 1 API, 1 database\]

The participant page skips React on purpose: it opens from a chat link on any phone, so it must load fast with no build step or bundle.

**Data model.** Every slot in the grid gets a number (slot\_index 0…N), so the heatmap is a simple GROUP BY and times are converted only at the edges.

| Table | Columns |
| --- | --- |
| events | id, slug, title, start\_date, end\_date, day\_start, day\_end, slot\_minutes, meeting\_length, timezone, admin\_token, final\_slot |
| participants | id, event\_id, name, edit\_token |
| availability | participant\_id, slot\_index (primary key on both) |

**API**

| Method | Endpoint | Does |
| --- | --- | --- |
| POST | /api/events | Create event; return slug + admin link |
| GET | /api/events/{slug} | Event config and grid size |
| POST | /api/events/{slug}/join | Name in; participant id + edit\_token out |
| PUT | /api/participants/{id}/slots | Replace that participant's slots (token required) |
| GET | /api/events/{slug}/heatmap | Count + names per slot |
| GET | /api/events/{slug}/suggest | Top 3 windows + who's missing |
| POST | /api/events/{slug}/finalize | Lock the final slot (admin token) |

## Best-slot algorithm

Slide a window of the meeting length across each day and score it by how many people are free for the whole window.

1. Let k = meeting\_length / slot\_minutes (a 1 h meeting on 30 min slots means k = 2)
2. For each day, for each start slot i where i + k stays inside that day: free(i) = the set of people free in every slot from i to i + k − 1
3. Score = size of free(i); break ties by the earlier date, then the earlier time
4. Return the top 3, each with missing = everyone − free(i)

This is O(days × slots × k × people), which is tiny at course scale. The "who's missing" list is the feature that makes it more useful than a plain heatmap: it tells the organizer exactly whom to nudge.

## UI direction

**Decision: Risograph print**, in teal and fluorescent orange inks on off-white paper. It mimics a two-ink riso print: dot grain on the paper, a slight misregistration offset, and halftone dots on selected cells. The heatmap reads as ink density, so more people free means heavier ink.

| Token | Value | Used for |
| --- | --- | --- |
| Paper | #F5F0E6 + dot grain | Page background |
| Ink 1 (teal) | #006D73 | Text, borders, primary button |
| Ink 2 (fluorescent orange) | #FF6C2F | Chips, misregistration offsets, button shadow |
| Halftone | #E04E12 dots on #FF8A54 | Selected slot fill |
| Display font | Bricolage Grotesque 600/800 | Wordmark, headings, day labels |
| Body font | Courier Prime 400/700 | Body text, inputs, times |

Both the React dashboard and the vanilla page use these as CSS custom properties from one shared stylesheet. Effects stay CSS-only (gradients, shadows, no images), so the page stays light on cheap phones.

## Milestones and risks

**Build order**

1. MySQL schema + PHP API, tested with curl or Postman
2. Vanilla paint page, including touch drag (riskiest UI, so it goes early)
3. React create form + organizer dashboard with polling heatmap
4. Best-slot suggestions + finalize
5. Apply the chosen UI style, then test on 2–3 real phones

**Risks**

| Risk | Fallback |
| --- | --- |
| Touch drag doesn't fire on the cell under the finger | Use document.elementFromPoint() inside touchmove |
| Time zones shift slots for people in other regions | Store the event's timezone; show times in it, labelled |
| Two devices edit the same participant at once | Last write wins; acceptable at this scale |
| A heavy UI style slows the vanilla page on cheap phones | Keep effects in CSS only; no images or JS animation libraries |
