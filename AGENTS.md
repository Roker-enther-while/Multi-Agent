# Repository Guidelines

## Project Structure & Module Organization

Backend code lives in `backend/app/` with FastAPI routes under `api/`, database code under `db/`, retrieval logic under `search/`, model adapters under `models/`, and ingestion code under `ingestion/`. Backend tests are in `backend/tests/`.

The Next.js UI is in `frontend/`; components are in `frontend/src/components/`, app routes in `frontend/src/app/`, and API helpers in `frontend/src/lib/`. Shared workflow contracts and prompt tooling are in `src/`. Documentation is in `docs/`, configs in `configs/`, utility scripts in `scripts/`, and local media under `data/raw/` and `data/processed/`.

## Build, Test, and Development Commands

Run commands from the repository root unless noted.

- `docker compose up --build`: starts backend, frontend, PostgreSQL, Qdrant, Redis, and MinIO.
- `cd backend && python -m pip install -e ".[dev]"`: installs backend runtime and test dependencies.
- `cd backend && pytest`: runs the FastAPI and retrieval test suite.
- `cd backend && alembic upgrade head --sql`: validates database migrations without applying them.
- `cd frontend && npm install`: installs UI dependencies.
- `cd frontend && npm run dev`: starts the Next.js development server.
- `cd frontend && npm run lint && npm run build`: checks linting and production build.
- `cd src && npm run build && npm run lint && npm test`: builds and tests the TypeScript workflow package.

## Coding Style & Naming Conventions

Python uses 4-space indentation, type hints where useful, and `snake_case` for modules, functions, and variables. Keep FastAPI schemas in `backend/app/schemas/` and route handlers in `backend/app/api/`.

TypeScript uses strict project configs, `PascalCase` for React components, `camelCase` for functions and variables, and `.test.ts` for tests. Prefer existing Tailwind utility patterns.

## Testing Guidelines

Place backend tests in `backend/tests/test_*.py` and keep fixtures in `backend/tests/conftest.py`. Add tests for API behavior, retrieval ranking, ingestion paths, database CRUD, and evaluation metrics when those areas change. For `src/`, compile before running `npm test`.

## Commit & Pull Request Guidelines

Recent history uses concise conventional prefixes such as `feat:` and `docs:`. Keep commit subjects imperative and scoped, for example `feat: add audio ingestion validator`.

Pull requests should include a short summary, test evidence, linked issue or task context, and screenshots for visible frontend changes. Note service assumptions such as Docker Desktop, Qdrant, or database availability.

## Security & Configuration Tips

Do not commit local media, generated reports, secrets, or `.env` files. Use `.env.example` as the template for `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL`, storage roots, and `NEXT_PUBLIC_API_BASE_URL`.
