🎯 Multitenant SaaS Platform

A secure, production-oriented multitenant SaaS platform designed to support multiple organizations within a single system — with strict tenant isolation, role-based access control, auditability, and failure resilience.

This project focuses on real-world SaaS concerns such as authentication, authorization, observability, data integrity, and controlled failure handling.

🚀 Key Capabilities
🔐 Authentication & Authorization

JWT-based authentication

Role-based access control (SuperAdmin, Org Admin, Employee, Customer)

Protected frontend & backend routes

Token expiration handling

Prevention of privilege escalation & direct URL access

🏢 Multitenancy (Core Design)

Strong tenant isolation

No cross-tenant data leakage

Organization-scoped users, projects, tasks, and data

Org admins restricted strictly to their own tenant

SuperAdmin access across all tenants (platform level)

🗂️ Project & Task Management

Project lifecycle management

Task creation, assignment, and status tracking

Role-restricted actions

Clean dashboard-driven workflows

Transaction-safe operations for complex flows

⚡ Real-Time Collaboration

Real-time updates using Socket.IO

Live task and project status updates

Multi-user activity synchronization

🧾 Audit Logging & Observability (Production-Focused)
✅ Audit Logs

All critical actions are audited:

Authentication attempts (success & failure)

Employee / Customer lifecycle events

Project & task operations

Organization plan changes

SuperAdmin actions

Each audit record captures:

Actor identity & role

Tenant context

Action performed

Outcome (SUCCESS / FAILURE / DENIED)

Timestamp & metadata

🚨 Error Logs

Centralized error logging for:

Database failures

Transaction failures

Audit log write failures

Unexpected runtime exceptions

Error logs include:

Severity level

Affected tenant / user (if applicable)

Request & stack context

♻️ Log Retention

Automatic audit log pruning

Retains latest records for operational relevance

Oldest logs are safely deleted when threshold is exceeded

Runs as a background job on server startup (non-blocking)

🧪 Testing & Validation

This system was validated using a risk-based testing strategy, focusing on production-critical paths rather than superficial coverage.

Tested Areas

Authentication & role enforcement

Tenant isolation

Privilege escalation prevention

Audit log integrity

Error handling & graceful degradation

Transaction rollback safety

Infrastructure failure scenarios

Test Artifacts

Structured Excel test matrix with:

Risk levels (Critical / High / Medium)

Pass / Fail tracking

Auto-calculated scores

Dedicated TESTING.md documenting methodology & results

Overall system validation score: 88.9%
(Failures were limited to non-fatal UX degradation during DB outages — no security or data integrity risks.)

🧱 Architecture Overview
Frontend (React + Vite)
        |
        | REST APIs + WebSockets
        v
Backend API (Node.js + Express)
        |
        | Prisma ORM
        v
PostgreSQL (NeonDB)

📦 Tech Stack
Frontend

React

Vite

Tailwind CSS

Backend

Node.js

Express.js

Prisma ORM

JWT Authentication

Database

PostgreSQL (NeonDB)

Real-Time

Socket.IO

Deployment

Render (Frontend + Backend)

🚀 Deployment (Render)
Frontend (Static Hosting)

Build command: npm run build

Publish directory: dist

Rewrite rule:

/* → /index.html


Configure environment variables

Backend (Web Service)

Start command: npm start

Prisma migrations run automatically

Environment variables configured via Render dashboard

📁 Project Structure
root/
│── frontend/
│   └── src/
│
│── backend/
│   ├── prisma/
│   ├── routes/
│   ├── controllers/
│   ├── middlewares/
│   ├── utils/
│   └── server.js

🧠 Design Philosophy

Prioritizes security, observability, and correctness

Explicit handling of failure scenarios

Strong separation of concerns

Designed to scale conceptually to real SaaS usage

Honest testing with documented limitations

🙌 Contributing

Issues and pull requests are welcome for improvements, optimizations, or additional features.

📄 License

MIT License
