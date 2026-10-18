from pathlib import Path
import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def main():
    # 1. Resolve paths relative to the project root
    project_root = Path(__file__).resolve().parent.parent
    data_path = project_root / "data" / "creditcard.csv"
    model_dir = project_root / "ml" / "model"
    model_path = model_dir / "fraud_model.joblib"

    print("========================================")
    print("   FraudShield-AI: Model Training Pipeline")
    print("========================================")
    print(f"Loading dataset from: {data_path}")

    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {data_path}. Please place 'creditcard.csv' inside the 'data/' directory."
        )

    # 2. Load dataset
    df = pd.read_csv(data_path)
    print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")

    # 3. Separate features and target
    X = df.drop(columns=["Class"])
    y = df["Class"]

    # 4. Stratified 80/20 train/test split
    print("\nSplitting dataset (80% train, 20% test, stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )
    print(f"Training samples: {len(X_train)} (Fraud: {y_train.sum()})")
    print(f"Testing samples:  {len(X_test)} (Fraud: {y_test.sum()})")

    # 5. Build Pipeline: StandardScaler + LogisticRegression (balanced weights)
    print("\nBuilding and fitting pipeline...")
    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    class_weight="balanced",
                    random_state=42,
                    max_iter=1000,
                ),
            ),
        ]
    )

    # Fitting fits StandardScaler only on training data, then trains LogisticRegression
    pipeline.fit(X_train, y_train)
    print("Model training completed.")

    # 6. Evaluate on the test set
    print("\nEvaluating model on the test set...")
    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]

    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    avg_precision = average_precision_score(y_test, y_pred_proba)
    cm = confusion_matrix(y_test, y_pred)

    print("\n================ Evaluation Metrics ================")
    print(f"Precision:         {precision:.4f}")
    print(f"Recall:            {recall:.4f}")
    print(f"F1-Score:          {f1:.4f}")
    print(f"Average Precision: {avg_precision:.4f} (PR-AUC)")
    print("\nConfusion Matrix:")
    print(f"  [TN: {cm[0][0]:>5}  |  FP: {cm[0][1]:>5}]")
    print(f"  [FN: {cm[1][0]:>5}  |  TP: {cm[1][1]:>5}]")
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, digits=4))
    print("====================================================")

    # 7. Save fitted pipeline
    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)

    # 8. Success message
    print(f"\n[SUCCESS] Model successfully saved to:\n  --> {model_path.resolve()}\n")


if __name__ == "__main__":
    main()

