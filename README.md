# Personal Expense Tracker

A basic full-stack app for tracking personal expenses: add, view, edit, and
delete expenses, with a monthly total.

## Tech Stack

| Layer     | Technology                                      |
|-----------|--------------------------------------------------|
| Frontend  | Angular 22 (standalone components, reactive forms) |
| Backend   | ASP.NET Core Web API (.NET 10)                   |
| ORM       | Entity Framework Core (Code First + Migrations)  |
| Database  | SQL Server (accessed/inspected via SSMS)         |

Fixed categories: `Food`, `Travel`, `Bills`, `Shopping`, `Other`

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
        ├── validators/                     # notFutureDateValidator
        ├── components/expense-form/        # Add/Edit form
        ├── components/expense-list/        # Table + edit/delete actions
        └── components/expense-summary/     # Monthly total
```

## Prerequisites

- .NET 10 SDK
- Node.js + npm
- Angular CLI (`npm install -g @angular/cli`)
- SQL Server (local instance) + SSMS (optional, for inspecting the database)
- `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)

## Setup & Running

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
(configured in `src/environments/environment.ts`).

CORS is configured in `Program.cs` to allow only `http://localhost:4200` (the
Angular dev server) to call the API from the browser.

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
