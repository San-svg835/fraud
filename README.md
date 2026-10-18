# FraudShield AI

A minimal scaffold for a fraud‑detection web app built with **Next.js (App Router)**, a **Python/Scikit‑learn** model, and a Neon PostgreSQL backend (to be added later).

## Quick Start (Windows)

1. **Install Node.js (LTS)** and **Python 3.11+**.
2. **Frontend**
   ```powershell
   cd FraudShield-AI/frontend
   npm install   # installs Next.js and React
   npm run dev   # starts the dev server at http://localhost:3000
   ```
3. **Python environment**
   ```powershell
   cd ..\ml
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn inference:app --reload   # runs the API at http://localhost:8000
   ```
4. **Training (local only)**
   ```powershell
   cd ..\scripts
   python train_model.py   # implement your training pipeline here
   ```

> The project is deliberately minimal – add database credentials, deployment configs, and real model code later.
