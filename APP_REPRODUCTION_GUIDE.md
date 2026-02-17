# Experiment Scheduler Reproduction Guide

This document explains the current top-level app in enough detail to rebuild it from scratch.

Scope:
- Included: top-level files only.
- Excluded: all subfolders and their code.

Files covered:
- `.gitignore`
- `index.html`
- `style.css`
- `config.js`
- `dateManager.js`
- `sessionManager.js`
- `pdfGenerator.js`
- `script.js`
- `scheduling_rules.html`

## 1. What the app does

The app is a browser-based scheduler for one participant at a time.

The participant receives a unique URL with `?uid=<link_id>`, then:
1. Picks the instruction session date (which is also experiment night 1).
2. Picks the instruction timeslot for that date.
3. Picks 17 additional experiment nights (18 total sessions in one list).
4. Reviews and submits.
5. Downloads a generated PDF summary.

All availability is derived from the `schedules` table in Supabase and refreshed in real time (poll every 10 seconds).

## 2. Runtime architecture

This is a plain static web app (no bundler, no framework):
- HTML provides containers.
- CSS styles everything.
- JS is split by concern and loaded in dependency order.
- Supabase JS SDK and jsPDF are loaded via CDN.

Global dependency chain:
1. `config.js` defines `SUPABASE_CONFIG`, `SCHEDULER_CONFIG`.
2. `dateManager.js` uses `SCHEDULER_CONFIG` for blocked-date checks.
3. `sessionManager.js` uses `DateManager`.
4. `pdfGenerator.js` uses `DateManager` and `window.jspdf`.
5. `script.js` orchestrates everything and uses all previous globals.

No modules/imports are used. Every class/function is global in browser scope.

## 3. Top-level file responsibilities

### `.gitignore`
- Ignores:
  - `.env`
  - `backups/`

### `index.html`
- Defines all visible structure and IDs used by JS.
- Loads external libraries:
  - jsPDF: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
  - Supabase JS v2: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Loads local scripts in dependency-safe order:
  - `config.js`
  - `dateManager.js`
  - `sessionManager.js`
  - `pdfGenerator.js`
  - `script.js`

### `style.css`
- Styles page layout, status boxes, date buttons, timeslot buttons, summary section.
- Defines `.hidden` class used by JS to show/hide sections.
- Includes some extra styles for `.dropout-details` (not used in `index.html`, but present).

### `config.js`
- Holds all configurable constraints:
  - session counts
  - date windows
  - max concurrency
  - timeslot list
  - blocked dates
- Holds Supabase project URL + anon key used to initialize client in browser.

### `dateManager.js`
- Pure date utility class:
  - normalization to UTC date strings
  - parse/coerce to midnight UTC `Date`
  - display formatting
  - experiment-night date generation
  - blocked date / blocked instruction-weekday checks
  - start-date search algorithm for valid experiment windows

### `sessionManager.js`
- Stateful selection and validation engine:
  - selected sessions/timeslot
  - live availability maps from backend
  - per-date and per-timeslot constraints
  - submission payload construction
  - final validation against fresh availability data
  - equipment reservation date expansion

### `pdfGenerator.js`
- Creates and downloads participant PDF summary with:
  - instruction session
  - all experiment sessions
  - location/contact text

### `script.js`
- Main controller:
  - initialize app on DOM ready
  - read participant from URL + Supabase
  - fetch availability maps
  - render calendars/buttons
  - handle selection events
  - update UI state
  - poll availability every 10 seconds
  - submit schedule to Supabase
  - call PDF generation

### `scheduling_rules.html`
- Standalone static rules display page.
- Not part of scheduler runtime logic.
- Documents expected constraints for admins/users.

## 4. External dependencies and environment assumptions

Dependencies:
- Browser with modern JS support (`Map`, `const`, `let`, arrow functions).
- Internet access for CDN-loaded libraries.
- Supabase project with `schedules` table and permissive RLS policy for this flow.

Assumptions in code:
- This app runs client-side only.
- Anonymous client can read/update rows as needed (through RLS rules).
- Participant link (`uid`) uniquely identifies one row in `schedules`.
- `session_dates` is null before submission; if truthy, user is treated as already submitted.

## 5. Supabase data contract (reconstruct this exactly)

The JS code expects the `schedules` table to include at least these columns:
- `id`
- `link_id`
- `participant_id`
- `schedule_from`
- `submission_timestamp`
- `session_dates`
- `backup_dates`
- `instruction_timeslot`
- `has_equipment_days`

Recommended Postgres types for compatibility:
- `id`: `uuid` (or bigint) primary key.
- `link_id`: `text` unique not null.
- `participant_id`: `text` not null.
- `schedule_from`: `date` (or `timestamp`).
- `submission_timestamp`: `timestamptz`.
- `session_dates`: `text[]` (stores `YYYY-MM-DD`).
- `backup_dates`: `text[]` (stores `YYYY-MM-DD`).
- `instruction_timeslot`: `text` (e.g. `13:00`).
- `has_equipment_days`: `text[]` (derived reservation span).

How code queries:
- Participant fetch:
  - `.from('schedules').select('id, link_id, participant_id, schedule_from, submission_timestamp, session_dates').eq('link_id', uid).maybeSingle()`
- Availability fetch:
  - `.from('schedules').select('session_dates, backup_dates, instruction_timeslot, has_equipment_days')`
- Submission update:
  - `.from('schedules').update(submissionData).eq('link_id', participantInfo.link_id)`

Important behavior:
- If `session_dates` is truthy for the participant row, app blocks scheduling (`"already submitted"`).
- During availability counting, `has_equipment_days` takes priority over `session_dates`.
- Legacy fallback still reads `backup_dates` when present in old rows.

## 6. Configuration semantics (`config.js`)

### Supabase config
- `SUPABASE_CONFIG.URL`: project URL.
- `SUPABASE_CONFIG.ANON_KEY`: public anon key.

### Scheduler config
- `TOTAL_SESSIONS = 18`
- `MAX_CONCURRENT_SESSIONS = 14`
- `SESSION1_WINDOW_DAYS = 14`
- `EXPERIMENT_WINDOW_DAYS = 25`
- `MIN_AVAILABLE_DAYS = 25`
- `TIME_SLOTS = ['11:00','13:00','16:00']`
- `INSTRUCTION_BLOCKED_WEEKDAYS = Set(['Saturday','Sunday'])` (weekday names, case-insensitive)
- `BLOCKED_DATES = Set([...YYYY-MM-DD...])`
- `INSTRUCTION_BLOCKED_DATE_TIME_RANGES = [{ date:'YYYY-MM-DD', start:'HH:mm', end:'HH:mm' }, ...]`

Note:
- `INSTRUCTION_BLOCKED_WEEKDAYS` and `BLOCKED_DATES` apply to instruction-date eligibility only.
- `INSTRUCTION_BLOCKED_DATE_TIME_RANGES` applies to instruction-timeslot eligibility only and blocks slots when slot start is in `[start, end)`.

## 7. Date handling model (`dateManager.js`)

The app is mostly UTC-normalized to avoid timezone drift.

Core methods:
- `toYYYYMMDD(date)`:
  - Coerces input via `new Date(...)`.
  - Returns UTC-formatted `YYYY-MM-DD`.
  - Returns `null` on invalid input.
- `toUTCDate(dateInput)`:
  - Accepts `Date` or string (`YYYY-MM-DD` or ISO timestamp).
  - Builds/normalizes to midnight UTC.
  - Returns `null` if invalid.
- `formatForDisplay(date)`:
  - Uses `toLocaleDateString(..., timeZone:'UTC')`.
  - Returns human-readable weekday/month/day/year.
- `isWeekend(date)`:
  - `getUTCDay()` in `{0,6}`.
- `isInstructionWeekdayBlocked(date, config)`:
  - compares the date's weekday name to `config.INSTRUCTION_BLOCKED_WEEKDAYS` (case-insensitive).
- `isDateBlocked(date)`:
  - converts to `YYYY-MM-DD`, checks `SCHEDULER_CONFIG.BLOCKED_DATES`.

Generators:
- `generateExperimentDates(baseDate, days)`:
  - Returns day+1 through day+N (does not include base day).

Start-date search algorithm:
- `findExperimentStartDate(searchStartDate, dateCountMap, config)`:
  - Builds `statusMap` for 365 + `MIN_AVAILABLE_DAYS`.
  - For each candidate day `i` in first 365 days:
    - candidate must be:
      - weekday not in `INSTRUCTION_BLOCKED_WEEKDAYS`
      - not globally blocked
      - not full (`count < MAX_CONCURRENT_SESSIONS`)
    - next `MIN_AVAILABLE_DAYS` window must contain no `isFull` day.
  - Returns first valid start date or `null`.

Pseudo:

```text
for each day d in search horizon:
  status[d] = {
    instructionWeekdayBlocked?,
    blocked?,
    full? (count >= 14)
  }

for each candidate c in first 365 days:
  if c is valid first day:
    if every day in [c, c+24] is not full:
      return c

return null
```

## 8. Selection and validation engine (`sessionManager.js`)

State variables:
- `selectedSessions: Date[]`
- `selectedTimeslot: string|null`
- `dateCountMap: Map<YYYY-MM-DD, number>`
- `takenDateTimeSlots: Map<YYYY-MM-DD_HH:mm, number>`

### Availability data ingestion
- `updateAvailability(dateCountMap, takenDateTimeSlots)` replaces both maps.

### Date availability
- `isDateAvailable(date)`:
  - true when `count < MAX_CONCURRENT_SESSIONS`.

### Instruction-date availability
- `isDateAvailableForInstruction(date)` requires all:
  - date is available (`isDateAvailable`)
  - not blocked
  - weekday not in `INSTRUCTION_BLOCKED_WEEKDAYS`
  - `< 3` instruction sessions already on that date
  - at least one valid timeslot remains

### Timeslot availability logic

Two methods implement near-identical logic:
- bulk: `getAvailableTimeSlots(date)`
- single: `isTimeslotAvailable(timeslot, date)`

Rules enforced:
1. 48-hour rule:
   - slot datetime must be >= now + 48 hours.
2. Friday block:
   - no slot from 10:00 to 14:29 (UTC-based day check).
3. Monday block:
   - no slot before 13:00.
4. Config blocked date-time ranges:
   - no slot when `(date, slotStart)` matches any configured range in `INSTRUCTION_BLOCKED_DATE_TIME_RANGES`.
5. Same-slot capacity:
   - max 2 bookings at exact same date+time.
6. Gap between different active slots:
   - if another occupied slot exists on that date and absolute difference < 150 min, disallow.

Practical consequence with slots `11:00`, `13:00`, `16:00`:
- `11:00` and `13:00` conflict (120 min apart).
- `13:00` and `16:00` conflict (180 min apart, so actually allowed because 180 >= 150).
- `11:00` and `16:00` allowed.

### Selection APIs

- `selectFirstSession(date)`:
  - clicking same first session deselects all sessions.
  - selecting new first session resets downstream selections and timeslot.
- `_findDateIndex(date, array)`:
  - date equality by `getTime()`.
- `selectFollowUpSession(date)`:
  - toggle behavior.
  - max `TOTAL_SESSIONS` total sessions.
- `setTimeslot(timeslot)` sets selection.

### Readiness and counts
- `isReadyForReview()` requires:
  - exactly 18 sessions
  - one timeslot selected
- `getFollowUpCount()` returns `selectedSessions.length - 1` with floor at 0.

### Equipment days derivation

`getEquipmentDays()`:
1. Use selected sessions.
2. Sort ascending.
3. Find first selected day and last selected day.
4. Compute cleaning day:
   - start at day after last selected day.
   - then jump to next workday via `DateManager.getNextWorkDay`.
5. Return every calendar day from first selected through final cleaning day (inclusive), as `YYYY-MM-DD`.

This is used as occupancy source for existing participants in later scheduling (`fetchAndUpdateAvailability`).

### Submission payload

`getSubmissionData()` returns:
- `session_dates: sorted YYYY-MM-DD[]`
- `backup_dates: []` (kept empty for compatibility)
- `instruction_timeslot: selectedTimeslot`
- `has_equipment_days: derived YYYY-MM-DD[]`

### Final conflict validation

`validateSelection()` checks current selected dates/timeslot against latest maps:
- any selected date now full -> conflict.
- selected first-session timeslot now invalid -> conflict.
- returns `{ isValid, conflicts[] }`.

## 9. Main application control flow (`script.js`)

### Boot and global state

At load:
- Initializes `supabaseClient` with URL/key from config if SDK exists.
- Caches all DOM nodes into `elements` object.
- Creates `sessionManager = new SessionManager(SCHEDULER_CONFIG)`.
- Registers `DOMContentLoaded -> initializeScheduler`.

### `initializeScheduler()`
1. Shows loading status.
2. Reads participant data via `getParticipantInfo()`.
3. Shows participant ID banner.
4. Populates first-session calendar.
5. Hides loading, reveals scheduler content.
6. Starts availability polling.
7. On error, shows error banner and stops loading state.

### `getParticipantInfo()`
1. Reads URL `uid` query param.
2. Queries `schedules` by `link_id`.
3. Rejects if:
   - no uid
   - query error
   - no row
   - row already has `session_dates` (already submitted)
4. Converts `schedule_from` to UTC Date.
5. Returns participant object.

### `fetchAndUpdateAvailability()`
1. Fetches all schedules with:
   - `session_dates`, `backup_dates`, `instruction_timeslot`, `has_equipment_days`.
2. Builds:
   - `dateCountMap`: per-day occupancy count.
   - `takenDateTimeSlots`: per-date-timeslot instruction occupancy count.
3. Occupancy source per row:
   - use `has_equipment_days` if present/truthy
   - else use `session_dates` (plus legacy `backup_dates` if present)
4. For timeslots:
   - take only first session date (`session_dates[0]`) + instruction timeslot.
   - normalize timeslot to first 5 chars (`HH:mm`).
5. Push maps into `sessionManager.updateAvailability(...)`.

### Step 1 calendar generation

`populateSession1Calendar()`:
1. Resolve search start:
   - `participantInfo.schedule_from` if present
   - else next work day from current date
2. Refresh availability maps first.
3. Compute earliest valid experiment start via `DateManager.findExperimentStartDate`.
4. From that start date, iterate forward day-by-day and collect up to 14 dates where `isDateAvailableForInstruction` is true.
5. Render each as `createDateButton(..., 'session1')`.
6. If no valid start, throw user-facing error.

### Step 2 timeslot rendering

`populateTimeslotButtons()`:
- Clears old timeslot buttons.
- Gets current first-session date.
- Asks `sessionManager.getAvailableTimeSlots(selectedDate)`.
- Creates a button per slot and binds click handler.
- Shows selected date text.
- Unhides timeslot section.

### Step 3 experiment-night rendering

`populateFollowUpCalendar()`:
- Clears experiment-night calendar.
- Updates counter.
- Generates `EXPERIMENT_WINDOW_DAYS` days after first session.
- Renders each generated day as selectable experiment-night date.
- Shows section.

### Generic date button factory

`createDateButton(date, container, type)`:
- stores ISO in `data-date` attribute.
- renders `day month + weekday`.
- disables if day is unavailable.
- marks selected style if already in sessions.
- binds click to `handleDateSelection`.

### Selection event handlers

`handleDateSelection(date, type, button)`:
- clears error first.
- delegates to sessionManager by type:
  - `session1`: set/reset first session and downstream sections.
  - `followUp`: toggle.
- updates counters/visibility.
- recalculates review button enabled state.

`handleTimeslotSelection(timeSlot, button)`:
- visual select one timeslot button.
- stores timeslot in manager.
- renders experiment-night calendar.

### Review state

`checkReviewButtonState()`:
- enables review only if `sessionManager.isReadyForReview()`.
- hides summary if no longer ready.

Review click handler:
- builds text summary into `<pre id="logOutput">`.
- includes participant ID, chosen timeslot, and session list.
- unhides summary section and enables submit button.

### Submit state

Submit click handler:
1. Show "Submitting..." status, disable submit/review.
2. Re-fetch availability maps.
3. Re-validate selection for race conditions.
4. If invalid:
   - show explanatory error
   - auto-reload page after 5s
5. If valid:
   - build submission payload + `submission_timestamp`
   - update row by `link_id`
   - stop polling interval
   - show success status
   - disable all date/timeslot buttons
   - auto-generate/download PDF
   - show "Download PDF" button for repeat download
6. On failure:
   - show error status
   - re-enable submit/review

### Real-time polling

`startAvailabilityPolling()`:
- every 10 seconds:
  - fetch availability maps
  - run `updateCalendars()`

`updateCalendars()`:
- for each `.date-button` not currently selected:
  - disable if now unavailable.
- for visible timeslot buttons not selected:
  - disable if now unavailable.

This avoids removing user selections mid-flow while still reflecting new conflicts.

## 10. PDF generation details (`pdfGenerator.js`)

`generateAndDownloadPDF(scheduleData, participantId)`:
1. Pulls `jsPDF` constructor from `window.jspdf`.
2. Creates doc and writes title + participant line.
3. Writes instruction session details:
   - selected timeslot
   - formatted first session date
4. Writes static location text.
5. Writes experiment session list with labels:
   - session 1 includes instruction timeslot note.
6. Adds pages as needed when vertical cursor exceeds threshold.
7. Adds closing contact text.
8. Saves as `Experiment_Schedule_<participantId>.pdf`.
9. Updates `#pdfStatus` to success if element exists.

## 11. UI structure (`index.html` + `style.css`)

Main layout:
- single centered `.container`.
- status/info/error boxes at top.
- warning instructions block.
- hidden scheduler content until initialization succeeds.

Core sections by ID:
- `participantInfo`
- `errorMessages`
- `loadingStatus`
- `schedulerContent`
- `session1Calendar`
- `timeslotSection`, `timeslotButtons`, `selectedDateDisplay`
- `followUpSection`, `followUpCalendar`, `followUpCount`
- `reviewButton`
- `summarySection`, `logOutput`
- `submitButton`
- `downloadPdfButton`
- `submissionStatus`
- `pdfStatus`

CSS behavior conventions:
- `.hidden { display: none; }` is the main visibility toggle contract.
- `.date-button.selected` and `.timeslot-button.selected` indicate chosen state.
- `:disabled` styles communicate unavailable/locked actions.
- responsive adjustments at max-width 600px.

## 12. Rebuild instructions (from zero)

If you rebuild this app from scratch, follow this order.

1. Create root files with exact names:
   - `.gitignore`
   - `index.html`
   - `style.css`
   - `config.js`
   - `dateManager.js`
   - `sessionManager.js`
   - `pdfGenerator.js`
   - `script.js`
   - `scheduling_rules.html`

2. Build `index.html` first:
   - include all required IDs/classes from section 11.
   - include CDN scripts and local script load order exactly.

3. Add `style.css`:
   - implement classes referenced by JS (`hidden`, status boxes, date/timeslot buttons).
   - ensure `.date-button.selected`, `.timeslot-button.selected`, and disabled states are present.

4. Add `config.js`:
   - define both config objects globally.
   - preserve constants used by other files.

5. Add `dateManager.js` class:
   - keep UTC normalization behavior.
   - keep start-date search logic requiring 25-day non-full window.

6. Add `sessionManager.js` class:
   - implement state, selection toggles, availability checks, timeslot constraints, payload and validation methods.

7. Add `pdfGenerator.js`:
   - implement `generateAndDownloadPDF(...)` and status update.

8. Add `script.js` last:
   - wire DOM IDs.
   - implement initialization, Supabase fetch/update calls, rendering, handlers, polling, submit flow.

9. Build Supabase table and row lifecycle:
   - pre-create participant rows with `link_id`.
   - ensure `session_dates` is null pre-submission.
   - enable safe update policy for participant row access pattern.

10. Serve as static files:
   - any static server is fine (`python -m http.server`, nginx, etc.).
   - open URL with `?uid=<link_id>`.

11. Validate behavior with manual tests (section 13).

## 13. Manual test checklist to confirm parity

Participant/link flow:
- Missing `uid` shows error.
- Invalid `uid` shows error.
- Row with existing `session_dates` blocks re-submission.

Step sequencing:
- Scheduler content hidden until initialization succeeds.
- Selecting first date reveals timeslots.
- Selecting timeslot reveals experiment-night options.
- Review button only enabled at 18 sessions + 1 timeslot.

Availability/rules:
- Dates at capacity are disabled.
- Instruction weekdays in `INSTRUCTION_BLOCKED_WEEKDAYS` are blocked for instruction start dates.
- `BLOCKED_DATES` blocked for instruction start dates.
- Timeslot blocked within 48 hours.
- Friday 10:00-14:29 times blocked.
- Monday <13:00 blocked.
- `INSTRUCTION_BLOCKED_DATE_TIME_RANGES` blocks matching instruction timeslots.
- Same exact date+timeslot allows up to 2 then blocks.
- Other occupied slots within 150 minutes conflict.

Submission/race:
- If availability changes before submit and selection is invalid, user gets conflict message and page reloads after 5s.
- Successful submit writes fields and stops polling.
- After successful submit, date/timeslot controls are disabled.
- PDF auto-downloads and can be re-downloaded with button.

## 14. Known quirks and mismatches to preserve (if reproducing current behavior)

1. `scheduling_rules.html` says available slots include `17:00`, but scheduler config uses `16:00`.

2. `scheduling_rules.html` says blocked dates are Dec 23-Jan 4, while actual blocked dates in config are specific March/April 2026 dates.

3. `scheduling_rules.html` can drift from config (`INSTRUCTION_BLOCKED_WEEKDAYS`, `INSTRUCTION_BLOCKED_DATE_TIME_RANGES`, etc.) unless updated manually.

4. Comment in `populateSession1Calendar` says "next 7 valid weekdays", but logic actually collects up to 14 instruction-eligible dates (based on config).

5. `countInstructionSessionsOnDate` counts unique keys in map, not summed slot counts; this can undercount if one slot has count > 1.

6. Mix of local-time methods (`getDate/setDate`) and UTC methods exists in some utilities; behavior still works but can be timezone-sensitive at edges.

7. `createDateButton` only checks generic date capacity for disabling; specific instruction constraints are handled when source lists are generated, not per-button universal logic.

## 15. Minimal mental model (one-paragraph)

Think of this app as a client-side finite workflow over shared capacity data: it continuously builds two maps from all schedule rows (day capacity and first-session timeslot occupancy), lets one participant assemble a constrained schedule in stages, then re-validates right before write to prevent race-condition conflicts, persists sorted date arrays plus derived equipment-reservation span, and issues a local PDF receipt.
