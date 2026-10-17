.PHONY: dev sim test install db backend frontend prescription validate

COMPOSE ?= docker compose
PY ?= python
BACKEND_DIR := backend
FRONTEND_DIR := frontend
SIM_DIR := simulator
RX_DIR := prescription

install:
	cd $(BACKEND_DIR) && npm install
	cd $(FRONTEND_DIR) && npm install
	cd $(SIM_DIR) && $(PY) -m pip install -r requirements.txt
	cd $(RX_DIR) && $(PY) -m pip install -r requirements.txt

db:
	$(COMPOSE) up -d

# Start Postgres + InfluxDB, then the API, UI, and prescription service.
# On Windows, prefer Git Bash or a GNU Make build. Use Ctrl+C to stop node/python;
# databases keep running until `docker compose down`.
dev: db
	@echo "Starting backend, frontend, and prescription (Ctrl+C stops them)."
	cd $(BACKEND_DIR) && npm run dev &
	cd $(FRONTEND_DIR) && npm run dev &
	cd $(RX_DIR) && $(PY) -m uvicorn app.main:app --reload --port 8000 &
	wait

sim:
	cd $(SIM_DIR) && $(PY) run.py

test:
	cd $(BACKEND_DIR) && npm test
	cd $(FRONTEND_DIR) && npm test
	cd $(SIM_DIR) && $(PY) -m pytest
	cd $(RX_DIR) && $(PY) -m pytest

validate:
	$(PY) docs/validation/run_all_validation.py

