# Freelancer Project & Income Tracker

A MERN application foundation with JWT authentication, user-owned Client/Project/Payment CRUD APIs, payment balance protection, project filtering, and dashboard backend APIs. Frontend features beyond the starter page are not implemented.

## Requirements

- Node.js 22.12+ (Node.js 24 LTS recommended) and npm.
- MongoDB Atlas or a local MongoDB replica set. Project/payment writes use multi-document transactions; a standalone MongoDB server is insufficient for those writes.

## Structure

```text
frontend/
  public/                 Static assets
  src/
    assets/               Imported assets
    components/           Reusable UI (reserved)
    hooks/                React hooks (reserved)
    pages/                Starter and not-found pages
    services/             API base URL configuration
    styles/               Tailwind entry stylesheet
    App.jsx               React Router routes
    main.jsx              React entry point
  .env.example
  vite.config.js          React, Tailwind, and development API proxy
backend/
  src/
    config/               Environment and MongoDB connection
    controllers/          Authentication, resource, dashboard, and health controllers
    middleware/           JWT authentication, auth validation/rate limits, and JSON errors
    models/               User, Client, Project, Payment, and shared schema definitions
    routes/               Authentication, resource, dashboard, and health routes
    services/             JWT signing/verification and transactional payment balances
    utils/                API errors, monetary arithmetic, and project filters
    app.js                Express application
    server.js             Database-first startup and shutdown
  test/                   Authentication, isolation, CRUD, and dashboard integration tests
  test-support/           Disposable test-only JWT environment configuration
  .env.example
package.json              npm workspace scripts
package-lock.json         Locked dependencies for both workspaces
```

## Setup

From the repository root:

```powershell
npm install
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

Edit `backend/.env` to set `MONGODB_URI`. The example uses a local single-node replica set named `rs0`. Configure and initialize that replica set before starting the backend, or use MongoDB Atlas with its connection string, database name, database user, and network access settings. A standalone server can connect successfully but project/payment writes return an actionable 503 because they require transactions. Do not commit credentials.

`JWT_SECRET` is required: use a private, cryptographically random value of at least 32 bytes, stored only in backend environment configuration. The example placeholder and short/missing secrets cause startup to fail. To generate a new value locally, run the following from the root and copy the result into `backend/.env` (keep it private):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

During Step 4 a random secret was generated in the existing ignored local `.env` if it was missing or a placeholder; existing valid secrets were preserved. Deployments need their own private secret. `JWT_EXPIRES_IN` defaults to `15m`; explicit units `s`, `m`, `h`, or `d` are required, with a maximum of 7 days. Signing and verification pin HS256, the issuer, and the audience. Restart the backend after changing environment values.

For a new local development database, run `mongod --replSet rs0 --dbpath <your-existing-data-directory> --bind_ip 127.0.0.1 --port 27017`, then initialize it once in `mongosh` with `rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})`. Wait for it to become primary. If you already use a MongoDB service on port 27017, configure that service for a replica set instead of starting a second server on the same port.

The frontend defaults work without a local `.env`. Vite proxies `/api` to `http://localhost:5000`. If you change the backend port, update `API_PROXY_TARGET`. `VITE_API_BASE_URL` is public browser configuration, never a place for secrets. For a future production deployment, configure a reverse proxy for `/api` or set a public API URL before building, and set the backend `CLIENT_ORIGIN` to your frontend origin.

## Start development servers

Run in two terminals from the repository root:

```powershell
# Terminal 1: backend, with automatic reload
npm run dev:backend
```

```powershell
# Terminal 2: frontend
npm run dev:frontend
```

- Frontend: http://localhost:5173
- API health: http://localhost:5000/api/health
- Proxied API health: http://localhost:5173/api/health

The backend connects to MongoDB before listening. Invalid or unreachable database configuration causes startup to exit with an error rather than silently running without a database. Successful startup logs `MongoDB connected.` and the API URL.

Health-check response when connected:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "freelancer-project-income-tracker-api",
    "database": "connected"
  }
}
```

This is a liveness endpoint: it returns HTTP 200 while Express is responding and separately reports database connectivity. If MongoDB disconnects after startup, `database` becomes `disconnected`.

## Verification and production commands

```powershell
npm test
npm run build
npm start
```

`npm test` runs HTTP smoke tests plus integration tests using `mongodb-memory-server`. The latter downloads a real MongoDB binary on first use and starts disposable single-node replica sets. Tests cover registration/login/me, bcrypt hashing, JWT validation, unauthorized access, cross-user isolation, reference and nested population isolation, rate limiting, secure JWT startup configuration, and all earlier CRUD/calculation/concurrency behavior. Tests authenticate through real registration endpoints, never connect to the application database, and do not mock Mongoose. The test preloader generates disposable JWT secrets rather than using application credentials. Network access is required for the initial binary download. You may supply an installed compatible `mongod` executable through `MONGOMS_SYSTEM_BINARY` to avoid downloading it.

The integration suite pins MongoDB 8.2.6 and caches its binary under the ignored root `node_modules/.cache/mongodb-binaries` directory. Test databases are temporary and are stopped and removed afterward.

Step 4 verification on October 12, 2026 executed `npm test`: **50 tests passed, zero failed or skipped**, against real MongoDB replica sets. This includes unauthorized requests, cross-user reads/writes/references/population/dashboard isolation, authentication rate limits, JWT rejection cases, and the prior financial concurrency tests.

If the default download host cannot resolve, use the official alternative mirror:

```powershell
$env:MONGOMS_DOWNLOAD_MIRROR = 'https://downloads.mongodb.org'
npm test
```

The frontend production output is `frontend/dist`; `npm start` runs the backend only. `npm run preview --workspace frontend` locally previews the frontend production build; it is not a production hosting server.

To verify the complete running setup after configuring MongoDB:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5173/api/health
```

Both should report `data.database: connected`. Open the frontend URL to see the starter page; an unknown frontend URL displays the not-found page.

## Authentication and backend security

| Endpoint | Request / behavior |
| --- | --- |
| `POST /api/auth/register` | `{ "name": "...", "email": "...", "password": "..." }`; returns 201 with `{ user, token, tokenType: "Bearer" }` inside `data` |
| `POST /api/auth/login` | `{ "email": "...", "password": "..." }`; returns the same token/user structure |
| `GET /api/auth/me` | Requires a Bearer token; returns `{ user }` inside `data` |

Email is trimmed, lowercased, validated, and protected by a unique database index. Registration requires a non-empty name up to 120 characters and a password of at least 12 characters, limited to 72 UTF-8 bytes to avoid bcrypt truncation. Passwords are hashed with `bcryptjs` using cost 12 and never appear in API responses, JWT claims, or default User queries. Login uses the same generic 401 message for unknown emails and incorrect passwords, including a bcrypt comparison for unknown accounts. Duplicate registration returns 409; validation errors return 400.

Send `Authorization: Bearer <access-token>` for **all** `/api/clients`, `/api/projects`, `/api/payments`, and `/api/dashboard` requests. Tokens are accepted only in that header. Missing, malformed, forged, expired, wrong-issuer/audience/algorithm tokens, and tokens for deleted users return 401. `/api/health` remains public. Authentication responses and successful protected responses set `Cache-Control: no-store`; Helmet adds security headers. Use HTTPS outside local development.

Login is limited to 10 requests and registration to 5 requests per IP per 15 minutes, including failed/invalid attempts. Limit responses use the normal JSON error envelope, HTTP 429, and retry/rate-limit headers. The default limiter store is process-local; use a shared store before deploying multiple API instances. Express currently keeps `trust proxy` disabled; configure only your actual trusted proxy topology when deploying behind a reverse proxy.

Ownership comes exclusively from the verified token's existing User record. All create operations assign `user` on the server; a request body containing `user` is rejected with 400, including attempts to clear or transfer it. Reads, lists, updates, deletes, reference checks, project write locks, balance aggregates, dashboard queries, and nested population are scoped to that owner. Missing and foreign-owned IDs/references both return 404. Cross-owner legacy populated references become `null` instead of leaking the foreign record.

Old records without an owner are inaccessible through authenticated APIs and excluded from dashboard totals. They are not automatically claimed by the first registered user. Any migration must assign verified owners explicitly, including matching client/project/payment relationships. This step provides access tokens only: refresh tokens, logout/revocation, password reset, and email verification are not implemented. Access tokens remain valid until expiry unless the user is deleted or the signing secret is rotated.

## Backend CRUD API

All paths are relative to `http://localhost:5000` and require a Bearer access token.

| Method | Clients | Projects | Payments | Behavior |
| --- | --- | --- | --- | --- |
| POST | `/api/clients` | `/api/projects` | `/api/payments` | Create (201) |
| GET | `/api/clients` | `/api/projects` | `/api/payments` | List (200) |
| GET | `/api/clients/:id` | `/api/projects/:id` | `/api/payments/:id` | Get one (200) |
| PUT / PATCH | `/api/clients/:id` | `/api/projects/:id` | `/api/payments/:id` | Update supplied fields (200) |
| DELETE | `/api/clients/:id` | `/api/projects/:id` | `/api/payments/:id` | Delete (200) |

PUT and PATCH both perform partial updates; omitted fields remain unchanged. Lists are sorted newest first and currently return all records owned by the authenticated user. Unknown fields, MongoDB operators, empty update bodies, and writes to `user`, `_id`, timestamps, or `__v` are rejected.

Required fields and validation:

- **Client:** `name` (trimmed, non-empty, max 120). Optional `email` (valid email, lowercase, max 254), `phone` (max 40), `company` (max 160), `notes` (max 5000).
- **Project:** `projectName` (trimmed, non-empty, max 200), `client` (existing Client ObjectId), `fee` (finite JSON number >= 0). `status` defaults to `Pending` and allows `Pending`, `In Progress`, or `Completed`. Optional `description` (max 5000), `startDate`, `dueDate` (ISO dates). When both dates exist, due date must be on or after start date, including partial updates.
- **Payment:** `project` (existing Project ObjectId), `amount` (finite JSON number > 0), `paymentMethod` (trimmed, non-empty string, max 80, such as `Bank Transfer` or `Cash`). `paymentDate` defaults to now; supplied values must be ISO dates. Optional `notes` (max 5000).
- All business models include timestamps and a required, indexed, immutable `user: ObjectId` reference. This field is server-assigned and cannot be supplied or changed by API clients.
- `fee` and `amount` accept at most two decimal places and values up to 1 trillion. Balances and totals are calculated in integer minor units and returned as JSON monetary numbers. The app currently assumes one shared currency.

Project responses populate `client` with contact fields. Payment responses populate `project` and its `client`. Client/project references are checked on create and update. Delete dependent payments before deleting their project; delete or reassign projects before deleting their client. Parent deletion otherwise returns 409 rather than cascading. Payment writes, fee edits, and project deletion acquire a shared project write lock inside MongoDB transactions, so concurrent requests cannot exceed the fee or create payments for a concurrently deleted project. Client deletion versus project creation still uses application-level reference checks and is not transactionally serialized.

Successful responses use `{ "success": true, "data": ... }`. Lists return an array; delete returns the deleted `_id` plus a message. Errors use `{ "success": false, "message": "...", "errors": [] }`, with field details where relevant. Status codes: 400 for invalid inputs, 404 for missing records/references, 409 for overpayments, fee reductions below payments, dependency or concurrent-edit conflicts, 503 for database selection failures or unsupported transaction deployments, and 500 for unexpected errors. Internal error details are not exposed.

## Dashboard and payment calculations

| GET endpoint | Response `data` |
| --- | --- |
| `/api/dashboard/summary` | `totalIncome`, `totalProjectValue`, `pendingPayments`, `activeProjects`, `totalClients`, `totalProjects` |
| `/api/dashboard/monthly-income` | Chronological `[{ month: "2026-01", totalIncome: 200, paymentCount: 1 }]` across all recorded years |
| `/api/dashboard/monthly-income?year=2026` | All 12 months of the requested year, including zero-income months |
| `/api/dashboard/project-status` | `[{ status: "Pending", count: 2 }, ...]`, always including all three statuses |

Income is the sum of actual recorded payments owned by the authenticated user, regardless of project status. Project value is the sum of that user's project fees. Pending payments sum `max(fee - recorded payments, 0)` **for each owned project**, counting only payments from the same owner; legacy overpayments on one project cannot cancel another project's unpaid balance. Active projects have status `In Progress`. Monthly income uses `paymentDate` and UTC month boundaries, keeping different years separate. Without a year filter an empty database returns `[]`; a requested year returns 12 zero rows. Summary totals cover only the authenticated user and are not affected by project-list filters.

Project listing supports combined filters:

```text
GET /api/projects?status=In%20Progress&client=CLIENT_OBJECT_ID&search=website
```

`status` must be one of the three schema statuses, `client` must be the ObjectId of a client owned by the logged-in user (missing/foreign clients return 404), and `search` performs a case-insensitive literal substring search on owned projects' `projectName`, up to 200 characters. Blank search is ignored. Unknown, repeated, or structured filter parameters return 400.

Payment creation and edits must fit within the destination project's remaining balance. Updates exclude the edited payment's previous amount before checking the proposed amount; moving a payment checks the destination and commits both changes atomically. Reducing a project fee below its recorded payments returns 409; setting the fee equal to payments is allowed. Rejected operations roll back all changes. Deleting a payment restores available balance. Existing overpayments are not silently modified or migrated; dashboard pending balances clamp them at zero.

Transaction behavior follows MongoDB's [write conflict and locking guidance](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/) and Mongoose's transaction API. Tests include simultaneous payment creates, payment edits, fee reductions, and project deletion.

Example create bodies (replace references with IDs returned by preceding requests):

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "company": "Analytical Studio" }
```

```json
{ "projectName": "Company website", "client": "CLIENT_OBJECT_ID", "fee": 2500, "startDate": "2026-10-12", "dueDate": "2026-11-12" }
```

```json
{ "project": "PROJECT_OBJECT_ID", "amount": 750, "paymentMethod": "Bank Transfer", "notes": "Deposit" }
```

Tailwind uses its official [Vite plugin integration](https://tailwindcss.com/docs/installation/using-vite) with `@import "tailwindcss"`, so no legacy Tailwind/PostCSS configuration is needed.
