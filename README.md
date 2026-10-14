# Freelancer Project & Income Tracker

Keep your freelance work and finances in one place. Manage clients, organize projects, record payments, and see how your business is performing through a responsive dashboard.

## Features

- **Dashboard:** View total income, project value, outstanding balances, active projects, and client counts at a glance.
- **Client management:** Add, edit, and delete client records, including contact information, company details, and notes.
- **Project tracking:** Manage project fees, descriptions, timelines, and statuses: Pending, In Progress, and Completed.
- **Combined filters:** Find projects by name, status, and client, with options to clear individual searches or all filters.
- **Payment records:** Record and edit payments with a project, amount, payment method, date, and notes.
- **Income analytics:** Explore monthly income by year, switch between area and bar charts, and compare project statuses.
- **Outstanding balances:** See which projects still have unpaid fees and compare recorded payments against agreed fees.
- **Currency selection:** Choose US dollars (USD) or Sri Lankan rupees (LKR) from the top bar.
- **Account access:** Register, sign in, and manage your own clients, projects, and payments.
- **Responsive interface:** Use tables on larger screens and compact cards on smaller screens, with form validation, notifications, and confirmation dialogs.

## Using the app

1. Create an account or sign in.
2. Add a client with their contact details.
3. Create a project, assign its client, and enter the agreed fee and timeline.
4. Update the project status as work progresses.
5. Record payments as they arrive.
6. Review the dashboard and income analytics to track earnings and unpaid balances.

### Currency selection

Use the currency dropdown in the top bar to choose **USD ($)** or **LKR (Rs)**. The selection applies to money displays across the dashboard, project lists, payment records, charts, and forms. Your choice is saved in the current browser and restored when you return.

Currency selection changes how amounts are displayed. It does not perform exchange-rate conversion or assign separate currencies to individual records. Keep all amounts in the same currency when using the tracker.

### How totals work

| Metric | Meaning |
| --- | --- |
| Total income | Sum of recorded payments, regardless of project status. |
| Project value | Sum of agreed project fees. |
| Outstanding balance | Unpaid amount remaining on each project, added together. |
| Active projects | Projects with the In Progress status. |
| Monthly income | Payments grouped by their payment date, using UTC month boundaries. |
| Average monthly income | Total income for the selected year divided by 12. |

Dashboard summary totals cover all your records. The year selector applies to the monthly income chart and year-specific metrics.

### Payment and deletion rules

- Payments must be greater than zero and cannot exceed the project's remaining balance.
- Fees and payment amounts support up to two decimal places.
- A project fee cannot be reduced below the payments already recorded against it.
- Deleting a payment increases the project's outstanding balance.
- Delete or reassign a project's payments before deleting the project.
- Delete or reassign a client's projects before deleting the client.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React, React Router, Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP requests | Axios |
| Backend | Node.js, Express |
| Workspace management | npm workspaces |
| Backend tests | Node.js test runner |

## Project structure

```text
frontend/
  src/
    components/
      charts/       Income and project charts
      forms/        Client, project, and payment forms
      layout/       Navigation, sidebar, and top bar
      ui/           Shared interface components
    context/        Account, currency, and notification state
    hooks/          Data fetching and shared interaction hooks
    pages/          Sign-in, dashboard, clients, projects, payments, and income
    services/       HTTP client and request helpers
    styles/         Application styles
    utils/          Formatting and validation helpers
    App.jsx         Application routes
    main.jsx        Application entry point
  vite.config.js    Frontend development and build configuration
backend/
  src/
    controllers/    Request handlers
    middleware/     Request validation, access checks, and error handling
    models/         Application record definitions
    routes/         Application routes
    services/       Business logic
    utils/          Shared backend helpers
    app.js          Express application
    server.js       Server entry point
  scripts/          Supporting utilities
  test/             Backend tests
package.json        Shared workspace commands
package-lock.json   Locked dependency versions
```

## Local development

### Requirements

- Node.js **22.12 or later**.
- npm.
- Backend configuration prepared for your environment before starting the server.

Run all commands below from the repository root.

### Install dependencies

```sh
npm install
```

### Start the app

Open two terminals.

**Terminal 1 — backend**

```sh
npm run dev:backend
```

**Terminal 2 — frontend**

```sh
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The backend uses port **5000** by default, and the frontend development server forwards application requests to it.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev:frontend` | Start the frontend development server. |
| `npm run dev:backend` | Start the backend with automatic reload. |
| `npm test` | Run the backend test suite. |
| `npm run build` | Create the frontend production build in `frontend/dist`. |
| `npm run preview --workspace frontend` | Preview the frontend production build locally. |
| `npm start` | Start the backend without automatic reload. |

The preview command requires a completed frontend build. It is intended for local review. `npm start` runs the backend; it does not serve the frontend build.

## Verification

Run the available checks before submitting changes:

```sh
npm test
npm run build
```

The backend tests cover account access, record ownership, client and project operations, payment validation, balances, and dashboard calculations. The frontend build checks that the application can be bundled for production.

For a manual check, add a client and project, record a payment, and confirm the updated totals. Try the project filters, switch the income chart year and chart type, and select both currencies to check the money displays.
