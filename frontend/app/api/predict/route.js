import modelWeights from "./model_weights.json";

export async function POST(request) {
  try {
    const body = await request.json();

    // 1. Try local FastAPI instance if available (e.g. running on port 8000 in dev)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return Response.json(data, { status: res.status });
      }
    } catch {
      // Local FastAPI not active (e.g. deployed on Vercel)
      // Transparently fall through to serverless execution using exact model weights
    }

    // 2. Serverless execution using exact fitted pipeline parameters (StandardScaler + LogisticRegression)
    const { features, means, scales, coefficients, intercept } = modelWeights;

    // Validate inputs
    for (const f of features) {
      if (body[f] === undefined || body[f] === null || isNaN(Number(body[f]))) {
        return Response.json(
          { detail: `Missing or invalid numeric value for feature: ${f}` },
          { status: 422 }
        );
      }
    }

    // Standardize & compute logit: intercept + sum(coef_i * (x_i - mean_i)/scale_i)
    let logit = intercept;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const val = Number(body[f]);
      const z = (val - means[i]) / scales[i];
      logit += z * coefficients[i];
    }

    // Sigmoid probability: 1 / (1 + exp(-logit))
    const fraudProb = 1.0 / (1.0 + Math.exp(-logit));
    const predictedClass = fraudProb >= 0.5 ? 1 : 0;
    const resultLabel = predictedClass === 1 ? "Likely Fraud" : "Likely Legitimate";
    const riskLevel = predictedClass === 1 ? "High" : "Low";

    return Response.json({
      predicted_class: predictedClass,
      fraud_probability: parseFloat(fraudProb.toFixed(4)),
      result: resultLabel,
      risk_level: riskLevel,
      disclaimer:
        "Notice: This assessment is an automated statistical model prediction and is not a financial guarantee.",
    });
  } catch (err) {
    return Response.json(
      { detail: `Inference failed: ${err.message}` },
      { status: 500 }
    );
  }
}
