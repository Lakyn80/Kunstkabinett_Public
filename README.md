# AI-Driven Full-Stack E-Commerce Platform Showcase

Public showcase version of a production-oriented full-stack project focused on modern web architecture, backend services, admin workflows, AI-assisted content processing, and containerized local development.

## Overview

This repository presents a portfolio-safe version of a larger real-world project.  
It demonstrates how the application is structured, how the backend and frontend interact, and how AI-supported processing is integrated into the system design.

The public version intentionally excludes private deployment data, secrets, runtime uploads, database dumps, internal operational files, and environment-specific production settings.

## Tech Stack

- Frontend: Next.js
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Queue / background jobs: Redis, RQ
- AI integrations: vision and text-processing workflows
- Containers: Docker Compose
- Testing / CI: pytest, GitHub Actions

## Architecture

### Frontend
Single frontend codebase supporting multiple application modes such as public client and admin interface.

### Backend
Modular FastAPI backend with separated API layers, services, background jobs, and database access.

### Data layer
PostgreSQL for relational data, Alembic for migrations, Redis for queue processing.

### Background processing
Dedicated workers handle asynchronous tasks such as translation flows, media analysis, and other long-running jobs.

## Showcase Highlights

- Modular full-stack architecture
- Public + admin application structure
- API-first backend design
- Background worker processing
- AI-assisted media and text workflows
- Database migrations and tests
- Dockerized local development
- CI pipeline structure for backend validation

## Repository Structure

```text
.
├─ .github/workflows/
├─ backend/
│  ├─ app/
│  ├─ alembic/
│  ├─ scripts/
│  └─ tests/
├─ frontend-next/
├─ docker-compose.yml
├─ package.json
├─ pytest.ini
└─ README.md
```

## Local Development

Example local start:

```bash
docker compose up -d --build
```

Example local services:

* Frontend client: `http://127.0.0.1:3000`
* Frontend admin: `http://127.0.0.1:8080`
* Backend API: `http://127.0.0.1:8000`

## Testing

Backend tests:

```bash
pytest
```

CI example:

* GitHub Actions workflow runs backend validation on push and pull request.

## What Is Intentionally Omitted From This Public Version

* Real environment files
* API keys and secrets
* Production domains
* Private deployment scripts
* Runtime uploads and generated media
* Database dumps and local data artifacts
* Internal operational documentation

## Purpose

This repository is intended as a public technical showcase for portfolio, collaboration, and code review purposes.
