# AI-Driven Full-Stack Architecture Showcase

Public showcase version of a production-oriented full-stack project focused on AI workflow orchestration, modular backend architecture, asynchronous processing, and containerized local development.

## Overview

This repository presents a portfolio-safe version of a larger real-world system.
It is designed to demonstrate not only full-stack development, but primarily how AI can be orchestrated across a modern application architecture.

The showcased system combines:

* a multi-mode frontend built from one codebase
* a modular FastAPI backend acting as the orchestration core
* PostgreSQL as the transactional source of truth
* Redis + RQ for asynchronous job execution
* AI pipelines for image analysis, text generation, rewriting, and translation
* Docker Compose for consistent multi-service local execution

The public version intentionally excludes private deployment data, secrets, runtime uploads, database dumps, internal operational files, and environment-specific production settings.

## Tech Stack

* Frontend: Next.js
* Backend: FastAPI, SQLAlchemy, Alembic
* Database: PostgreSQL
* Queue / background jobs: Redis, RQ
* AI integrations: vision, generation, rewriting, and translation workflows
* Containers: Docker Compose
* Testing / CI: pytest, GitHub Actions

## Architecture

### Frontend

Single frontend codebase supporting multiple application modes such as public client and admin interface.

### Backend

Modular FastAPI backend with separated API layers, services, AI modules, background jobs, and database access.

### Data layer

PostgreSQL for relational data, Alembic for migrations, Redis for queue coordination and worker execution.

### Background processing

Dedicated workers handle asynchronous AI and language-processing tasks such as translation flows, media analysis, and other long-running jobs.

## AI-Oriented Showcase Highlights

* AI workflow orchestration across multiple backend modules
* image analysis and structured AI content generation
* controlled rewriting and transformation flows
* translation pipeline handled through queue-based workers
* deterministic async job processing with Redis + RQ
* modular FastAPI architecture for AI-assisted features
* separation of synchronous API flows and asynchronous AI workloads
* database-backed persistence for AI-related processing results
* Dockerized multi-service local development
* testing and CI for backend validation

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

* real environment files
* API keys and secrets
* production domains
* private deployment scripts
* runtime uploads and generated media
* database dumps and local data artifacts
* internal operational documentation

## Purpose

Public showcase of a production-oriented full-stack system focused on AI workflow orchestration, modular backend architecture, asynchronous processing, and containerized application design.

