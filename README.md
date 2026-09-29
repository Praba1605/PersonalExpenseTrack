# Personal Expense Tracker

A full-stack app for tracking personal expenses — add, view, edit and delete
them with per-month totals and filtering — plus a built-in two-person video
meeting with chat, emoji, and host microphone controls.

## Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Frontend  | Angular 22 (standalone components, reactive forms) |
| Backend   | ASP.NET Core Web API (.NET 10)                     |
| ORM       | Entity Framework Core (Code First + Migrations)    |
| Database  | SQL Server (accessed/inspected via SSMS)           |
| Video/chat| PeerJS over WebRTC (public broker, peer-to-peer)   |

Fixed categories: `Food`, `Travel`, `Bills`, `Shopping`, `Other`

## Features

### Expenses tab

- Add and edit in a dialog opened from **+ Add Expense**, closing on X, Cancel,
  Esc, a backdrop click, or a successful save. Full screen on a phone.
- A month dropdown listing **All months** plus every month that has expenses,
  with the total and count for the chosen period.
- Per-column filters for **Date** and **Category**, tucked behind a funnel icon
  in the column header. The funnel stays highlighted while a filter is set, so
  a collapsed filter can never hide rows silently.
- Coloured category badges, right-aligned amounts, row hover, and icon buttons
  for edit and delete. Deleting asks for confirmation in the row first.
- The list re-fetches every 5 seconds in the background, so a change made
  elsewhere (another tab, another device hitting the same API) shows up without
  a reload. That poll deliberately does not touch the loading or error state —
  it would otherwise blank the table every few seconds, and one missed request
  is not worth interrupting the view for.

### Meeting tab

- **New meeting** reserves a Google Meet style code (`xxx-xxxx-xxx`) and gives
  you a link to share. **Enter a code or link** joins an existing one.
- A pre-join screen shows your camera and asks for your name, which is
  remembered in `localStorage` for next time.
- Two equal video tiles side by side at every screen size, each labelled with
  the person's name and a grey **Host** badge on whoever created the room.
- Mic, camera, screen share, chat and leave in a floating control bar.
- Chat opens as a side panel from the control bar and carries an unread count
  on the chat button while it is closed. It runs over the WebRTC data channel,
  with a 56-emoji picker. Emoji travel as Twemoji codepoint ids, never URLs, so
  a peer cannot point an `<img>` at an arbitrary address.
- Microphone controls: mute and unmute yourself from the mic button. The host
  additionally gets a **⋮ menu** in the control bar with *Mute participant*,
  *Unmute participant*, *Mute all* and *Unmute all*. Mic state syncs to both
  tiles in real time, and only a guest acts on host commands, so a participant
  cannot mute the host.
- A room seats two; a third person is told the meeting is full.

## Project Structure

```
PersonalExpenseTracker/
├── ExpenseTrackerApi/
│   ├── Controllers/ExpensesController.cs   # CRUD API endpoints
│   ├── Models/Expense.cs                   # Expense entity (maps to the Expenses table)
│   ├── DTOs/                               # CreateExpenseDto, UpdateExpenseDto, ExpenseResponseDto
│   ├── Validation/                         # AllowedCategoriesAttribute, NotFutureDateAttribute
│   ├── Data/AppDbContext.cs                # EF Core database context
│   ├── Migrations/                         # EF Core migration history
│   ├── Program.cs                          # App startup: DbContext, OpenAPI, CORS
│   └── appsettings.json                    # SQL Server connection string
└── ExpenseTrackerAngular/
    └── src/app/
        ├── models/expense.model.ts         # Shared Expense interface + category list
        ├── services/expense.service.ts     # All HTTP calls to the API
        ├── services/peer-session.service.ts# The single PeerJS connection, room codes, links
        ├── services/emoji.service.ts       # The emoji set and codepoint validation
        ├── utils/                          # clipboard, camera constraints
        ├── validators/                     # notFutureDateValidator
        ├── components/expense-form/        # Add/Edit form (shown in a dialog)
        ├── components/expense-list/        # Table, column filters, row actions
        ├── components/expense-summary/     # Month filter + total
        ├── components/meeting/             # Landing, join box, pre-join preview
        ├── components/meeting-call/        # Meet-style call screen (extends VideoCall)
        └── components/video-call/          # Call engine: media, chat, mic, screen share
```

`MeetingCall` extends `VideoCall` with only a different template and styles, so
the media, chat and microphone logic exists in one place.

## Routes

| Route             | Purpose                                                    |
|-------------------|------------------------------------------------------------|
| `/`               | The app (Expenses and Meeting tabs)                        |
| `/meeting/:code`  | Join a meeting by its shared code                          |
| `/call/:peerId`   | The original direct-call screen                            |

Both link routes read their parameter on load and then clear it from the
address bar, so a refresh does not redial an ended call.

`/call/:peerId` still works, but the header button that used to create those
links has been removed — the Meeting tab is the supported way to start a call.

> **Production note:** these are client-side routes with no server rendering.
> `ng serve` falls back to `index.html`, but a static host will return 404 for
> `/meeting/...` unless you add a rewrite to `index.html`.

## Prerequisites

- .NET 10 SDK
- Node.js + npm
- Angular CLI (`npm install -g @angular/cli`)
- SQL Server (local instance) + SSMS (optional, for inspecting the database)
- `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)

## Setup & Running

Both servers are also described in `.claude/launch.json` (`api` and `angular`),
so an editor or agent that reads that file can start them without running the
commands below by hand.

### 1. Backend (ExpenseTrackerApi)

From `ExpenseTrackerApi/`:

```bash
dotnet restore
dotnet ef database update
dotnet run
```

- `dotnet ef database update` creates the `ExpenseTrackerDB` database (if it
  doesn't exist) and the `Expenses` table, using the connection string in
  `appsettings.json`
  (`Server=localhost;Database=ExpenseTrackerDB;Trusted_Connection=True;TrustServerCertificate=True;`).
  Open SSMS and connect to `localhost` to browse the database directly if you want.
- API: `http://localhost:5158/api/expenses`
- OpenAPI document (dev only): `http://localhost:5158/openapi/v1.json`

### 2. Frontend (ExpenseTrackerAngular)

From `ExpenseTrackerAngular/`:

```bash
npm install
npm start
```

- App: `http://localhost:4200`

Run the backend first (or at least before adding/viewing expenses) — the
Angular app expects the API to already be reachable at `http://localhost:5158`
(configured in `src/environments/environment.development.ts`).

CORS is configured in `Program.cs` to allow only `http://localhost:4200` (the
Angular dev server) to call the API from the browser.

## Video calling notes

- **A secure context is required.** `getUserMedia` only works over HTTPS or on
  `localhost`. Opening the app at a plain-http LAN address such as
  `http://192.168.1.5:4200` loads the Expenses page fine, but the browser will
  refuse the camera and microphone. To test on a phone over USB, use
  `adb reverse tcp:4200 tcp:4200 && adb reverse tcp:5158 tcp:5158` — the phone
  then sees the app as `localhost`, which counts as secure.
- **Screen sharing is desktop only.** Chrome and Safari on mobile do not
  implement `getDisplayMedia`, so the control is disabled there.
- **Signalling uses PeerJS's free public broker.** Media and chat are
  peer-to-peer; no audio, video or message passes through the API. Two peers
  behind strict NATs may fail to connect if a TURN relay is unreachable.
- Meeting codes register with the broker under an `etmeet-` prefix so they
  cannot collide with the random ids `/call/` links use. The prefix is internal
  and never shown.

## API Endpoints

| Method | Route                              | Description                          |
|--------|-------------------------------------|---------------------------------------|
| GET    | `/api/expenses`                     | List all (optional `category`, `month=YYYY-MM` filters) |
| GET    | `/api/expenses/{id}`                | Get one by id                        |
| POST   | `/api/expenses`                     | Create                                |
| PUT    | `/api/expenses/{id}`                | Update                                |
| DELETE | `/api/expenses/{id}`                | Delete                                |

Validation rules (enforced on both backend and frontend): `Title` required
(max 100 chars), `Amount` required and greater than 0, `Category` required
and one of the fixed list, `Date` required and cannot be in the future.

The meeting features use no API endpoints — they run entirely in the browser.

## How Data Flows: Angular → .NET Web API → EF Core → SQL Server

1. **Angular (browser)** — A component calls a method on `ExpenseService`,
   which uses `HttpClient` to send an HTTP request (GET/POST/PUT/DELETE) in
   JSON to `http://localhost:5158/api/expenses`.
2. **ASP.NET Core Web API** — `ExpensesController` receives the request,
   deserializes the JSON body into a DTO, and validates it against the
   `[Required]`/custom validation rules.
3. **Entity Framework Core** — The controller calls methods on `AppDbContext`,
   which EF Core translates into SQL commands (SELECT/INSERT/UPDATE/DELETE).
4. **SQL Server** — EF Core sends that SQL to the `ExpenseTrackerDB` database
   and returns the result.
5. The result flows back up the same path: SQL Server → EF Core → the
   controller (maps to a response DTO, returns an HTTP status code) →
   Angular's `HttpClient` → the component updates its state.

## Reference Artifacts

- [Expense Ledger Reference](https://claude.ai/code/artifact/07fba5b0-6e62-4bf7-8c75-9b4349f43895) — API documentation: the `Expense` data model, all 5 endpoints with real request/response examples, and the status-code legend.
- [Expense Request Flow](https://claude.ai/code/artifact/103d6b4e-8ba9-40f1-97d9-c008173543f3) — diagrams of how a request crosses from Angular to SQL Server and back, and the full create-expense decision path including both validation gates.

Both are static references (no live data) and won't reflect changes unless
manually republished. They cover the API only, which is unchanged.
