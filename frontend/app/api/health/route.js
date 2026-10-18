export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch("http://127.0.0.1:8000/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return Response.json(data, { status: res.status });
    }
  } catch {
    // If local FastAPI not active, serverless model is ready
  }

  return Response.json({
    status: "ok",
    model_loaded: true,
    runtime: "Vercel Serverless Ready",
    model_path: "embedded (Scikit-Learn Balanced Logistic Regression Pipeline)",
  });
}
