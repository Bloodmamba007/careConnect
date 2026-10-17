# CareConnect

Monorepo for a remote patient-monitoring stack: a vitals **simulator**, a realtime **backend**, a **React** caregiver UI, and a **prescription** parsing API. Shared payload shapes live in [`docs/contracts.md`](docs/contracts.md).

This repository does **not** include camera, video, or pose-estimation code.

## Layout

| Path | Runtime | Role |
| --- | --- | --- |
| `simulator/` | Python 3.11 | Emits `VitalsPacket` JSON to the backend |
| `backend/` | Node.js 20, Express, Socket.io, TypeScript | Ingests vitals, emits `Alert` events |
| `frontend/` | React + Vite + Tailwind CSS | Caregiver dashboard |
| `prescription/` | Python, FastAPI | Returns structured `Medication` records |
| `docs/` | Markdown | JSON contracts |

## Prerequisites

- Node.js 20
- Python 3.11
- Docker (for PostgreSQL and InfluxDB)
- GNU Make (optional; commands below work without it)

Copy environment variables:

```bash
cp .env.example .env
```

## Setup

Install JavaScript and Python dependencies:

```bash
make install
```

Or manually:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
python -m pip install -r simulator/requirements.txt
python -m pip install -r prescription/requirements.txt
```

Start local databases:

```bash
docker compose up -d
```

- PostgreSQL: `localhost:5432` (`DATABASE_URL` in `.env.example`)
- InfluxDB UI: `http://localhost:8086` (`INFLUX_*` in `.env.example`)

## Run

| Make target | What it does |
| --- | --- |
| `make dev` | `docker compose up -d`, then backend (`:4000`), frontend (`:5173`), prescription (`:8000`) |
| `make sim` | Run the vitals simulator against `BACKEND_URL` |
| `make test` | Backend, frontend, simulator, and prescription tests |

Without Make:

```bash
# terminals 1–3
cd backend && npm run dev
cd frontend && npm run dev
cd prescription && python -m uvicorn app.main:app --reload --port 8000

# terminal 4
cd simulator && python -m simulator
```

## Contracts

TypeScript types in `backend/src/types.ts` mirror:

1. **VitalsPacket** — `patient_id`, ISO `timestamp`, `heart_rate`, `spo2`, `systolic_bp`, `diastolic_bp`
2. **Medication** — `drug_name`, `generic_name`, `form`, `strength`, `frequency`, `timing`, `duration_days`, `confidence`, `rxnorm_id`
3. **Alert** — `event_id`, `patient_id`, `timestamp`, `severity` (`GREEN` \| `YELLOW` \| `RED`), `type` (`VITALS` \| `COMPOUND`), `message`, `instructions[]`, `contributing_signals[]`, optional `interaction`
