from pathlib import Path
from typing import Dict
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

# 1. Resolve paths relative to the project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "ml" / "model" / "fraud_model.joblib"

# Exact 30 feature names in the exact order expected by the trained pipeline
FEATURE_NAMES = [
    "Time",
    "V1",
    "V2",
    "V3",
    "V4",
    "V5",
    "V6",
    "V7",
    "V8",
    "V9",
    "V10",
    "V11",
    "V12",
    "V13",
    "V14",
    "V15",
    "V16",
    "V17",
    "V18",
    "V19",
    "V20",
    "V21",
    "V22",
    "V23",
    "V24",
    "V25",
    "V26",
    "V27",
    "V28",
    "Amount",
]

# 2. Load model pipeline
model = None
try:
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
except Exception:
    model = None


# 3. Pydantic schemas for request and response validation
class TransactionInput(BaseModel):
    Time: float = Field(..., description="Seconds elapsed since the reference start time")
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float = Field(..., description="Transaction amount")


class PredictionResponse(BaseModel):
    predicted_class: int
    fraud_probability: float
    result: str
    risk_level: str
    disclaimer: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_path: str


# 4. Initialize FastAPI app
app = FastAPI(
    title="FraudShield-AI Inference API",
    description="Machine-learning inference service for financial fraud detection.",
    version="1.0.0",
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Confirms the API is running and reports model load status."""
    return HealthResponse(
        status="ok" if model is not None else "degraded",
        model_loaded=(model is not None),
        model_path=str(MODEL_PATH),
    )


@app.post("/predict", response_model=PredictionResponse)
def predict_fraud(transaction: TransactionInput) -> PredictionResponse:
    """Predicts whether an incoming transaction is likely fraudulent or legitimate."""
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fraud detection model is not loaded. Train the model or check model file location.",
        )

    # Construct input dataframe preserving feature names and order
    feature_dict = transaction.model_dump()
    input_data = pd.DataFrame([feature_dict], columns=FEATURE_NAMES)

    # Pipeline prediction and probability estimation
    prediction = int(model.predict(input_data)[0])
    probabilities = model.predict_proba(input_data)[0]
    fraud_prob = float(probabilities[1])

    if prediction == 1:
        result_label = "Likely Fraud"
        risk_level = "High"
    else:
        result_label = "Likely Legitimate"
        risk_level = "Low"

    return PredictionResponse(
        predicted_class=prediction,
        fraud_probability=round(fraud_prob, 4),
        result=result_label,
        risk_level=risk_level,
        disclaimer=(
            "Notice: This assessment is an automated statistical model prediction and is not a financial guarantee."
        ),
    )
