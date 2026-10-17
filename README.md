# CareConnect.

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

---

## Hackathon Presentation Mode & Interactive UI

The CareConnect caregiver UI includes built-in live demonstration controls designed specifically for presentation to judges:

- **1-Click Clinical Scenarios**:
  - `🟢 Resting Baseline`: Normal resting physiological state (GREEN routine alert).
  - `🟡 Tachycardia`: Elevated resting heart rate > 110 bpm (YELLOW warning alert with rest instructions).
  - `🔴 Critical Hypoxia`: Acute peripheral SpO2 drop to < 90% (RED emergency desaturation protocol).
  - `⚡ Compound Multi-Drug Risk`: Severe dual hypotension crash triggered by concomitant ACE inhibitor + Calcium channel blocker (RED compound alert with interactive drug mechanism details).
- **Auto Telemetry Simulator**:
  - Toggle the continuous streaming loop in the UI (`Demo Studio -> Start Auto Loop`) to stream live physiological vitals even without running background terminal processes.
- **Continuous Recharts Waveforms**:
  - Multi-signal telemetry stream with threshold lines (Hypoxia at 94% SpO2, Tachycardia at 100 bpm), scrubbable dark tooltips, and time window filters.
- **Caregiver Protocol Checklist**:
  - Interactive checkboxes on every clinical alert allow caregivers to check off protocol steps during an incident.
- **Prescription AI Parser Studio**:
  - Testbed for unstructured doctor's prescription text with 4 pre-loaded presets, confidence matching, and 1-click addition to the patient's active chart.

