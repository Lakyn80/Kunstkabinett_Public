# AI-Driven Full-Stack Architecture Showcase

Public showcase version of a production-oriented full-stack project focused on AI workflow orchestration, modular backend architecture, asynchronous processing, and containerized local development.

## Overview

This repository presents a portfolio-safe version of a larger real-world system.
It is designed to demonstrate not only full-stack development, but primarily how AI can be orchestrated across a modern application architecture.

The showcased system combines:

- a multi-mode frontend built from one codebase
- a modular FastAPI backend acting as the orchestration core
- PostgreSQL as the transactional source of truth
- Redis + RQ for asynchronous job execution
- AI pipelines for image analysis, text generation, rewriting, and translation
- Docker Compose for consistent multi-service local execution

The public version intentionally excludes private deployment data, secrets, runtime uploads, database dumps, internal operational files, and environment-specific production settings.

## Tech Stack

- Frontend: Next.js
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Queue / background jobs: Redis, RQ
- AI integrations: vision, generation, rewriting, and translation workflows
- Containers: Docker Compose
- Testing / CI: pytest, GitHub Actions

## Architecture

### Frontend

Single frontend codebase supporting multiple application modes such as public client and admin interface.
Mode switching is handled through `NEXT_PUBLIC_APP_MODE`, with mode-specific routing behavior configured in `frontend-next/next.config.mjs`.

### Backend

The backend is assembled in `backend/app/main.py` as a modular FastAPI application.
It composes public routes, admin routes, AI routes, media routes, realtime routes, background task registration, and upload/static mounting into one runtime.

This makes the backend the orchestration core of the platform rather than just a CRUD API.

### Data layer

PostgreSQL is used for transactional data, Alembic for migrations, and Redis for queue coordination and worker execution.

### Background processing

Dedicated workers handle asynchronous AI and language-processing tasks such as translation flows, media analysis, and other long-running jobs.

## System Orchestration

### Service topology

`docker-compose.yml` runs the platform as cooperating services:

- `app_client`
- `app_admin`
- `app_backend`
- `app_db`
- `app_redis`
- `app_translation_worker`
- `app_vision_worker`

That split mirrors the actual runtime responsibilities:

- synchronous user-facing flows run through frontend + backend
- asynchronous AI and translation workloads are delegated to workers
- state is persisted in PostgreSQL
- queue coordination is handled through Redis

### Backend orchestration patterns

The orchestration design is centered around clear boundaries between:

- request/response APIs
- async queue-triggered processing
- database-backed persistence
- storage-backed media processing
- AI service layers reused across multiple entry points

This avoids mixing admin triggers, user-facing APIs, and long-running AI workloads into one execution path.

## AI Workflow Orchestration

### 1. Image description pipeline

The main orchestration logic lives in `backend/app/modules/ai/art/service.py`.

The image-description flow is implemented as a staged pipeline:

1. image bytes are normalized and preprocessed for vision input
2. an image-scoped hash key is created for traceability
3. RAG metadata hints are loaded from the vector memory layer
4. a vision model generates structured JSON output:
   - title
   - description
   - tags
   - detected art type
5. the output is checked for genericity
6. if needed, the system retries with higher image detail
7. the generated description is compared against existing product descriptions
8. if similarity is too high, regeneration is triggered
9. the final result can be written back into the RAG layer as metadata

Important architectural detail:

- RAG is used as contextual inspiration, not as a source for copying stored descriptions
- the flow is designed to generate new text, not retrieve and restate existing text
- duplicate guarding is enforced against database content

This creates a controlled AI pipeline instead of a simple prompt wrapper.

### 2. Rewrite pipeline

The same AI module also supports controlled description rewriting.

The orchestration pattern is:

1. generate a base description first
2. keep it associated with the image key
3. request a rewrite mode such as `shorten`, `marketing`, `regenerate`, or `lyric`
4. load RAG context again
5. call a text model with mode-specific constraints
6. return a variant while preserving factual consistency

This allows one canonical source description to drive multiple downstream content variants.

### 3. AI inbox / draft generation flow

`backend/app/modules/media_inbox/ai_draft_service.py` connects uploaded image files to the shared image-description pipeline.

Instead of implementing a separate AI branch, inbox processing reuses the same core description service used elsewhere.
That is an important orchestration decision:

- one AI core service
- multiple admin entry points
- shared generation logic
- shared output structure

This reduces divergence between bulk workflows and manual workflows.

### 4. Vision worker pipeline

The asynchronous image-analysis worker is implemented in `backend/app/modules/vision_queue/jobs.py`.

Its orchestration pattern is:

1. worker receives a media job
2. product media bytes are loaded from storage
3. an image hash is computed
4. existing AI output for the same media + model + hash is checked
5. duplicate work is skipped when possible
6. AI description is generated
7. structured AI result is stored in the relational database

This gives the platform idempotent AI media processing instead of fire-and-forget calls.

## Translation Orchestration

The translation pipeline is split between:

- `backend/app/modules/translation_queue/queue.py`
- `backend/app/modules/translation_queue/jobs.py`
- `backend/app/modules/translation_queue/worker.py`

The orchestration design is explicit and resilient:

1. source content is normalized into a stable payload
2. a source hash is generated from the current product content
3. one queue job is created per target language
4. each job gets a deterministic job id
5. duplicate or already-active jobs are skipped
6. workers process one language at a time
7. stale jobs are ignored if the product source changed meanwhile
8. retryable failures are retried with backoff
9. terminal failures are separated from transient failures
10. commits happen per language, not as one fragile bulk transaction

There is also startup recovery orchestration:

- on backend startup, the app enqueues a repair scan for missing translations
- the repair job walks products in batches
- missing language rows are seeded
- only missing translations are re-enqueued

This makes the translation subsystem self-healing and operationally predictable.

## Why This Showcase Is AI-Driven

The AI aspect of this project is not limited to calling a model API.
The main engineering work is in orchestration:

- deciding which workloads stay synchronous and which move to workers
- building deterministic job identities
- handling retries, stale state, and deduplication
- separating retrieval context from generated output
- reusing one AI core across multiple admin entry points
- combining relational data, queue state, file storage, and AI results into one coherent flow

That orchestration layer is the main reason this repository is presented as an AI-driven full-stack system rather than just a web app with AI features.

## AI-Oriented Showcase Highlights

- AI workflow orchestration across multiple backend modules
- image analysis and structured AI content generation
- controlled rewriting and transformation flows
- translation pipeline handled through queue-based workers
- deterministic async job processing with Redis + RQ
- modular FastAPI architecture for AI-assisted features
- separation of synchronous API flows and asynchronous AI workloads
- database-backed persistence for AI-related processing results
- Dockerized multi-service local development
- testing and CI for backend validation

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

- Frontend client: `http://127.0.0.1:3000`
- Frontend admin: `http://127.0.0.1:8080`
- Backend API: `http://127.0.0.1:8000`

## Testing

Backend tests:

```bash
pytest
```

CI example:

- GitHub Actions workflow runs backend validation on push and pull request.

## What Is Intentionally Omitted From This Public Version

- real environment files
- API keys and secrets
- production domains
- private deployment scripts
- runtime uploads and generated media
- database dumps and local data artifacts
- internal operational documentation

## Purpose

Public showcase of a production-oriented full-stack system focused on AI workflow orchestration, modular backend architecture, asynchronous processing, and containerized application design.
