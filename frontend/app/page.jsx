"use client";

import { useState, useEffect, useRef } from "react";

// Initial state for 30 features
const INITIAL_FEATURES = {
  Time: 84200.0,
  Amount: 85.5,
  ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`V${i + 1}`, 0.0])),
};

// Preset demonstration inputs
const PRESET_BASELINE = {
  Time: 0.0,
  Amount: 50.0,
  ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`V${i + 1}`, 0.0])),
};

const PRESET_NORMAL = {
  Time: 84200.0,
  Amount: 42.5,
  V1: 1.18,
  V2: 0.25,
  V3: -0.38,
  V4: 0.82,
  V5: 0.15,
  V6: -0.12,
  V7: 0.28,
  V8: -0.04,
  V9: 0.21,
  V10: -0.15,
  V11: 0.42,
  V12: 0.31,
  V13: -0.28,
  V14: 0.14,
  V15: 0.68,
  V16: -0.06,
  V17: -0.12,
  V18: 0.18,
  V19: -0.04,
  V20: -0.01,
  V21: -0.07,
  V22: -0.11,
  V23: 0.03,
  V24: -0.21,
  V25: 0.29,
  V26: 0.12,
  V27: 0.02,
  V28: 0.01,
};

const PRESET_HIGH_RISK = {
  Time: 42100.0,
  Amount: 285.0,
  V1: -2.85,
  V2: 2.15,
  V3: -3.85,
  V4: 4.22,
  V5: -2.1,
  V6: -1.35,
  V7: -3.42,
  V8: 1.88,
  V9: -2.65,
  V10: -5.12,
  V11: 3.85,
  V12: -6.42,
  V13: -0.55,
  V14: -7.15,
  V15: -0.42,
  V16: -4.85,
  V17: -8.12,
  V18: -2.95,
  V19: 0.85,
  V20: 0.45,
  V21: 0.78,
  V22: -0.18,
  V23: -0.25,
  V24: -0.08,
  V25: 0.42,
  V26: 0.25,
  V27: 0.65,
  V28: 0.18,
};

// Generates a random synthetic demonstration feature vector
function generateDemonstrationVector(forceAnomaly = false) {
  const isAnomaly = forceAnomaly || Math.random() < 0.28; // ~28% suspicious rate for active demonstration
  const now = new Date();
  const timeSeconds = Math.floor(now.getTime() / 1000) % 172800; // Time feature within 2-day range

  const vector = {
    Time: timeSeconds,
    Amount: isAnomaly
      ? parseFloat((Math.random() * 850 + 45).toFixed(2))
      : parseFloat((Math.random() * 120 + 8.5).toFixed(2)),
  };

  for (let i = 1; i <= 28; i++) {
    const key = `V${i}`;
    if (isAnomaly) {
      // Realistic PCA anomalies observed in benchmark credit card fraud
      if (key === "V14") vector[key] = parseFloat((-3.5 - Math.random() * 5.0).toFixed(4));
      else if (key === "V12") vector[key] = parseFloat((-3.0 - Math.random() * 4.5).toFixed(4));
      else if (key === "V10") vector[key] = parseFloat((-2.5 - Math.random() * 4.0).toFixed(4));
      else if (key === "V17") vector[key] = parseFloat((-3.0 - Math.random() * 5.0).toFixed(4));
      else if (key === "V4") vector[key] = parseFloat((2.0 + Math.random() * 3.2).toFixed(4));
      else if (key === "V11") vector[key] = parseFloat((1.8 + Math.random() * 2.8).toFixed(4));
      else {
        // Standard variation
        const noise = (Math.random() + Math.random() - 1) * 1.5;
        vector[key] = parseFloat(noise.toFixed(4));
      }
    } else {
      // Normal variation centered around 0
      const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;
      vector[key] = parseFloat(noise.toFixed(4));
    }
  }

  return vector;
}

export default function FraudShieldApp() {
  // Navigation tabs: "monitoring" | "manual" | "benchmarks"
  const [activeTab, setActiveTab] = useState("monitoring");

  // Transactions list
  const [transactions, setTransactions] = useState([]);
  const [tableFilter, setTableFilter] = useState("all"); // "all" | "flagged" | "legitimate"
  const [selectedTxn, setSelectedTxn] = useState(null);

  // Simulation controls
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isSingleRunning, setIsSingleRunning] = useState(false);
  const [simError, setSimError] = useState(null);

  // Manual analysis form state
  const [manualFeatures, setManualFeatures] = useState(INITIAL_FEATURES);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState(null);

  // Backend connectivity state
  const [backendStatus, setBackendStatus] = useState({
    checking: true,
    online: false,
    modelLoaded: false,
    message: "Pinging inference engine...",
  });

  const streamIntervalRef = useRef(null);

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  async function checkHealth() {
    setBackendStatus((prev) => ({ ...prev, checking: true }));
    try {
      let res;
      try {
        res = await fetch("http://127.0.0.1:8000/health", { cache: "no-store" });
      } catch {
        res = await fetch("/api/health", { cache: "no-store" });
      }

      if (res.ok) {
        const data = await res.json();
        setBackendStatus({
          checking: false,
          online: true,
          modelLoaded: !!data.model_loaded,
          message: data.model_loaded ? "FastAPI Online • Model Ready" : "FastAPI Online • Model Missing",
        });
      } else {
        setBackendStatus({
          checking: false,
          online: false,
          modelLoaded: false,
          message: `Backend returned HTTP ${res.status}`,
        });
      }
    } catch {
      setBackendStatus({
        checking: false,
        online: false,
        modelLoaded: false,
        message: "FastAPI Offline (Port 8000)",
      });
    }
  }

  // Sends an individual transaction payload to the real inference API
  async function scoreTransaction(featureVector, customId = null) {
    const txnId = customId || `TXN-${Math.floor(10000 + Math.random() * 90000)}`;
    const timeLabel = new Date().toLocaleTimeString();

    let res;
    try {
      // Primary: Forward through Next.js proxy route to FastAPI
      res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featureVector),
      });
    } catch (netErr) {
      // Direct fallback
      try {
        res = await fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(featureVector),
        });
      } catch (err2) {
        throw new Error(`Inference endpoint unreachable: ${netErr.message}`);
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const detail = errData.detail || `HTTP ${res.status} Inference Error`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    const predictionData = await res.json();

    const record = {
      id: txnId,
      timestamp: timeLabel,
      amount: featureVector.Amount,
      features: featureVector,
      prediction: predictionData,
      isSimulated: true,
    };

    return record;
  }

  // Simulator: Single transaction
  async function handleSimulateSingle(forceAnomaly = false) {
    if (isSingleRunning || isBatchRunning) return;
    setIsSingleRunning(true);
    setSimError(null);

    try {
      const vector = generateDemonstrationVector(forceAnomaly);
      const record = await scoreTransaction(vector);
      setTransactions((prev) => [record, ...prev]);
    } catch (err) {
      setSimError(`Simulation failed: ${err.message}`);
    } finally {
      setIsSingleRunning(false);
    }
  }

  // Simulator: Batch of 5 transactions
  async function handleSimulateBatch() {
    if (isBatchRunning || isSingleRunning) return;
    setIsBatchRunning(true);
    setSimError(null);

    try {
      for (let i = 0; i < 5; i++) {
        // Introduce one guaranteed high-risk pattern in the batch for demonstration
        const forceRisk = i === 2;
        const vector = generateDemonstrationVector(forceRisk);
        const record = await scoreTransaction(vector);
        setTransactions((prev) => [record, ...prev]);
        // Slight natural delay between batch elements
        await new Promise((r) => setTimeout(r, 220));
      }
    } catch (err) {
      setSimError(`Batch simulation halted: ${err.message}`);
    } finally {
      setIsBatchRunning(false);
    }
  }

  // Simulator: Continuous stream toggle
  function toggleStreaming() {
    if (isStreaming) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      setSimError(null);
      // Run immediately, then every 2.4s
      handleSimulateSingle();
      streamIntervalRef.current = setInterval(() => {
        setTransactions((curr) => {
          // Safety cap to prevent browser memory leak
          if (curr.length > 80) return curr.slice(0, 80);
          return curr;
        });
        const vector = generateDemonstrationVector();
        scoreTransaction(vector)
          .then((record) => {
            setTransactions((prev) => [record, ...prev]);
          })
          .catch((err) => {
            setSimError(`Stream paused: ${err.message}`);
            setIsStreaming(false);
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
          });
      }, 2400);
    }
  }

  function clearHistory() {
    if (isStreaming) toggleStreaming();
    setTransactions([]);
    setSelectedTxn(null);
  }

  // Manual Form Submission
  async function handleManualSubmit(e) {
    e.preventDefault();
    setManualLoading(true);
    setManualError(null);
    setManualResult(null);

    // Validate all numeric
    const payload = {};
    for (const key of Object.keys(INITIAL_FEATURES)) {
      const val = manualFeatures[key];
      if (val === "" || val === null || isNaN(Number(val))) {
        setManualError(`Feature "${key}" must be a valid numeric value.`);
        setManualLoading(false);
        return;
      }
      payload[key] = Number(val);
    }

    try {
      const record = await scoreTransaction(payload, `MANUAL-${Math.floor(1000 + Math.random() * 9000)}`);
      setManualResult(record.prediction);
      // Also register into monitoring log
      setTransactions((prev) => [record, ...prev]);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  }

  // Live session statistics
  const totalSessionCount = transactions.length;
  const flaggedCount = transactions.filter((t) => t.prediction?.predicted_class === 1).length;
  const legitCount = transactions.filter((t) => t.prediction?.predicted_class === 0).length;
  const flaggedRatio = totalSessionCount > 0 ? ((flaggedCount / totalSessionCount) * 100).toFixed(1) : "0.0";
  const latestTxn = transactions[0] || null;

  // Filtered transactions for table
  const displayedTransactions = transactions.filter((t) => {
    if (tableFilter === "flagged") return t.prediction?.predicted_class === 1;
    if (tableFilter === "legitimate") return t.prediction?.predicted_class === 0;
    return true;
  });

  return (
    <div style={styles.container}>
      {/* Sidebar Navigation */}
      <aside style={styles.sidebar}>
        <div style={styles.brandBox}>
          <div style={styles.brandLogo}>FS</div>
          <div>
            <h1 style={styles.brandTitle}>FraudShield AI</h1>
            <span style={styles.brandSubtitle}>Cyber Threat Detection</span>
          </div>
        </div>

        <nav style={styles.navGroup}>
          <div style={styles.navLabel}>CONSOLE VIEWS</div>
          <button
            onClick={() => setActiveTab("monitoring")}
            style={{
              ...styles.navItem,
              ...(activeTab === "monitoring" ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>⚡</span>
            Live Monitoring & Simulator
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            style={{
              ...styles.navItem,
              ...(activeTab === "manual" ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>⚙️</span>
            Manual Vector Analysis
          </button>

          <button
            onClick={() => setActiveTab("benchmarks")}
            style={{
              ...styles.navItem,
              ...(activeTab === "benchmarks" ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>📊</span>
            Model Diagnostics & Benchmarks
          </button>
        </nav>

        {/* Backend Connectivity Status Box */}
        <div style={styles.sidebarFooter}>
          <div style={styles.sidebarCard}>
            <div style={styles.statusRow}>
              <span
                style={{
                  ...styles.statusDot,
                  backgroundColor: backendStatus.online ? "#10b981" : "#f43f5e",
                  boxShadow: backendStatus.online
                    ? "0 0 8px rgba(16, 185, 129, 0.6)"
                    : "0 0 8px rgba(244, 63, 94, 0.6)",
                }}
              />
              <span style={styles.statusText}>{backendStatus.message}</span>
            </div>
            <button onClick={checkHealth} style={styles.refreshBtn}>
              {backendStatus.checking ? "Checking..." : "Re-check Health"}
            </button>
          </div>
          <div style={styles.versionTag}>FastAPI 1.0.0 • Scikit-Learn Engine</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* Top Header */}
        <header style={styles.topHeader}>
          <div>
            <h2 style={styles.pageHeading}>
              {activeTab === "monitoring" && "Financial Crime & Transaction Intelligence"}
              {activeTab === "manual" && "30-Feature Parameter Verification"}
              {activeTab === "benchmarks" && "Model Architecture & Benchmark Validation"}
            </h2>
            <p style={styles.pageSubheading}>
              Live machine-learning scoring powered by a balanced Logistic Regression pipeline.
            </p>
          </div>

          <div style={styles.headerRight}>
            <div
              style={{
                ...styles.badge,
                backgroundColor: backendStatus.modelLoaded
                  ? "rgba(20, 184, 166, 0.15)"
                  : "rgba(244, 63, 94, 0.15)",
                borderColor: backendStatus.modelLoaded
                  ? "rgba(20, 184, 166, 0.4)"
                  : "rgba(244, 63, 94, 0.4)",
                color: backendStatus.modelLoaded ? "#14b8a6" : "#f43f5e",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: backendStatus.modelLoaded ? "#14b8a6" : "#f43f5e",
                  marginRight: 6,
                }}
              />
              {backendStatus.modelLoaded ? "MODEL READY" : "BACKEND OFFLINE"}
            </div>
          </div>
        </header>

        {/* =========================================================================
            SECTION 1: SUMMARY CARDS (Current-Session Statistics vs. Model Benchmarks)
           ========================================================================= */}
        <section style={styles.metricsGrid}>
          {/* Card 1: Session Total Analysed */}
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <span style={styles.metricLabel}>SESSION TRANSACTIONS</span>
              <span style={styles.metricBadgeLive}>LIVE SESSION</span>
            </div>
            <div style={styles.metricValue}>{totalSessionCount}</div>
            <div style={styles.metricDesc}>Total demonstration transactions processed</div>
            <div style={styles.metricSessionNote}>* Current active browser session counter</div>
          </div>

          {/* Card 2: Flagged High Risk */}
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <span style={styles.metricLabel}>FLAGGED SUSPECTED FRAUD</span>
              <span style={{ ...styles.metricBadgeLive, color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.3)" }}>
                HIGH RISK
              </span>
            </div>
            <div style={{ ...styles.metricValue, color: "#f43f5e" }}>
              {flaggedCount}{" "}
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#fda4af" }}>
                ({flaggedRatio}%)
              </span>
            </div>
            <div style={styles.metricDesc}>Model flagged Class 1 (Suspicious pattern)</div>
            <div style={styles.metricSessionNote}>* Derived strictly from model probability &gt; threshold</div>
          </div>

          {/* Card 3: Legitimate Predictions */}
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <span style={styles.metricLabel}>LEGITIMATE CLEARED</span>
              <span style={{ ...styles.metricBadgeLive, color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                CLEARED
              </span>
            </div>
            <div style={{ ...styles.metricValue, color: "#10b981" }}>{legitCount}</div>
            <div style={styles.metricDesc}>Model predicted Class 0 (Normal pattern)</div>
            <div style={styles.metricSessionNote}>* Verified via live `/predict` inference API</div>
          </div>

          {/* Card 4: Latest Detection Activity */}
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <span style={styles.metricLabel}>LATEST MODEL DETECTION</span>
              <span style={styles.metricBadgeLive}>ACTIVITY</span>
            </div>
            <div style={{ ...styles.metricValue, fontSize: "18px", marginTop: "6px" }}>
              {latestTxn ? (
                <span
                  style={{
                    color: latestTxn.prediction.predicted_class === 1 ? "#f43f5e" : "#14b8a6",
                    fontWeight: "700",
                  }}
                >
                  {latestTxn.prediction.result} ({latestTxn.id})
                </span>
              ) : (
                <span style={{ color: "#64748b", fontSize: "16px" }}>No activity yet</span>
              )}
            </div>
            <div style={styles.metricDesc}>
              {latestTxn
                ? `${(latestTxn.prediction.fraud_probability * 100).toFixed(1)}% probability • $${latestTxn.amount.toFixed(2)}`
                : "Launch the simulator to begin stream"}
            </div>
            <div style={styles.metricSessionNote}>
              {latestTxn ? `Evaluated at ${latestTxn.timestamp}` : "Ready for ingestion"}
            </div>
          </div>
        </section>

        {/* Prominent Distinction Notice: Session Stats vs Benchmark Metrics */}
        <div style={styles.benchmarkNoticeBanner}>
          <div style={styles.noticeIcon}>ℹ️</div>
          <div>
            <strong>Notice on System Statistics:</strong> The 4 cards above show{" "}
            <span style={{ color: "#38bdf8", fontWeight: "600" }}>live demo session counters</span> scored dynamically by the running model. By contrast, model baseline benchmarks (such as the <strong>284,807 transaction dataset</strong>, <strong>91.84% test fraud recall</strong>, and <strong>0.7190 PR-AUC</strong>) are offline evaluation metrics and can be inspected in the{" "}
            <button
              onClick={() => setActiveTab("benchmarks")}
              style={{
                background: "none",
                border: "none",
                color: "#14b8a6",
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "12px",
                padding: "0 2px",
              }}
            >
              Model Diagnostics view
            </button>.
          </div>
        </div>

        {/* Error Notification Banner if simulator catches error */}
        {simError && (
          <div style={styles.errorBox}>
            <div style={styles.errorIcon}>⚠️</div>
            <div>
              <strong style={{ color: "#f43f5e" }}>Inference Error</strong>
              <p style={styles.errorText}>{simError}</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: LIVE MONITORING & SIMULATOR CONSOLE
           ========================================================================= */}
        {activeTab === "monitoring" && (
          <div style={styles.tabContentContainer}>
            {/* Simulator Control Action Bar */}
            <section style={styles.simulatorControlCard}>
              <div style={styles.simCardLeft}>
                <div style={styles.simIconBox}>⚡</div>
                <div>
                  <h3 style={styles.simTitle}>Transaction Stream Simulator</h3>
                  <p style={styles.simSubtitle}>
                    Generate realistic synthetic demonstration transactions with unique IDs and varied amounts. Each transaction is scored in real-time by the trained Scikit-Learn model.
                  </p>
                </div>
              </div>

              <div style={styles.simCardRight}>
                {/* Single Transaction Button */}
                <button
                  onClick={() => handleSimulateSingle(false)}
                  disabled={isSingleRunning || isBatchRunning}
                  style={styles.simBtnSecondary}
                >
                  {isSingleRunning ? "Evaluating..." : "+ Single Demo Txn"}
                </button>

                {/* Batch of 5 Button */}
                <button
                  onClick={handleSimulateBatch}
                  disabled={isBatchRunning || isSingleRunning}
                  style={styles.simBtnSecondary}
                >
                  {isBatchRunning ? "Running Batch (5)..." : "+ Batch (5 Txns)"}
                </button>

                {/* Continuous Stream Toggle Button */}
                <button
                  onClick={toggleStreaming}
                  style={{
                    ...styles.simBtnPrimary,
                    backgroundColor: isStreaming ? "#f43f5e" : "#14b8a6",
                    boxShadow: isStreaming
                      ? "0 0 14px rgba(244, 63, 94, 0.4)"
                      : "0 0 14px rgba(20, 184, 166, 0.3)",
                  }}
                >
                  {isStreaming ? (
                    <>
                      <span style={styles.pulsingDot} /> Stop Simulation Stream
                    </>
                  ) : (
                    "▶ Start Simulation Stream"
                  )}
                </button>

                {transactions.length > 0 && (
                  <button onClick={clearHistory} style={styles.clearBtn} title="Clear session table">
                    Clear Table
                  </button>
                )}
              </div>
            </section>

            {/* Transaction Monitoring Table Panel */}
            <section style={styles.tablePanel}>
              <div style={styles.tablePanelHeader}>
                <div>
                  <h3 style={styles.tableTitle}>Real-Time Detection Feed</h3>
                  <span style={styles.tableSubtitle}>
                    All entries scored via `POST http://127.0.0.1:8000/predict`. Click any row to inspect feature vector.
                  </span>
                </div>

                {/* Filter Pills */}
                <div style={styles.filterPillGroup}>
                  <button
                    onClick={() => setTableFilter("all")}
                    style={{
                      ...styles.filterPill,
                      ...(tableFilter === "all" ? styles.filterPillActive : {}),
                    }}
                  >
                    All ({totalSessionCount})
                  </button>
                  <button
                    onClick={() => setTableFilter("flagged")}
                    style={{
                      ...styles.filterPill,
                      ...(tableFilter === "flagged" ? styles.filterPillActive : {}),
                    }}
                  >
                    Flagged Fraud ({flaggedCount})
                  </button>
                  <button
                    onClick={() => setTableFilter("legitimate")}
                    style={{
                      ...styles.filterPill,
                      ...(tableFilter === "legitimate" ? styles.filterPillActive : {}),
                    }}
                  >
                    Legitimate ({legitCount})
                  </button>
                </div>
              </div>

              {/* Table / Feed */}
              {displayedTransactions.length === 0 ? (
                <div style={styles.emptyTableState}>
                  <div style={styles.emptyStateIcon}>🛡️</div>
                  <h4 style={styles.emptyStateTitle}>No Transactions in Current Stream</h4>
                  <p style={styles.emptyStateDesc}>
                    Click <strong>&ldquo;+ Single Demo Txn&rdquo;</strong>, <strong>&ldquo;+ Batch (5 Txns)&rdquo;</strong>, or <strong>&ldquo;Start Simulation Stream&rdquo;</strong> to ingest synthetic financial events.
                  </p>
                </div>
              ) : (
                <div style={styles.tableResponsiveWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.th}>RISK</th>
                        <th style={styles.th}>TRANSACTION ID</th>
                        <th style={styles.th}>TIMESTAMP</th>
                        <th style={styles.th}>AMOUNT</th>
                        <th style={styles.th}>MODEL ASSESSMENT</th>
                        <th style={styles.th}>FRAUD PROBABILITY</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTransactions.map((t) => {
                        const isFraud = t.prediction.predicted_class === 1;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTxn(t)}
                            style={{
                              ...styles.tableRow,
                              backgroundColor: isFraud ? "rgba(244, 63, 94, 0.08)" : "transparent",
                              borderLeft: isFraud
                                ? "3px solid #f43f5e"
                                : "3px solid transparent",
                            }}
                          >
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.riskBadge,
                                  backgroundColor: isFraud
                                    ? "rgba(244, 63, 94, 0.18)"
                                    : "rgba(16, 185, 129, 0.18)",
                                  color: isFraud ? "#f43f5e" : "#10b981",
                                  borderColor: isFraud
                                    ? "rgba(244, 63, 94, 0.4)"
                                    : "rgba(16, 185, 129, 0.4)",
                                }}
                              >
                                {isFraud ? "HIGH RISK" : "CLEARED"}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.txnIdText}>{t.id}</span>
                              <span style={styles.simTag}>[DEMO]</span>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.timestampText}>{t.timestamp}</span>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.amountText}>${t.amount.toFixed(2)}</span>
                            </td>

                            <td style={styles.td}>
                              <span
                                style={{
                                  fontWeight: "600",
                                  color: isFraud ? "#f43f5e" : "#10b981",
                                }}
                              >
                                {t.prediction.result}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <div style={styles.probCellContainer}>
                                <div style={styles.probMiniBarTrack}>
                                  <div
                                    style={{
                                      ...styles.probMiniBarFill,
                                      width: `${Math.min(
                                        Math.max(t.prediction.fraud_probability * 100, 3),
                                        100
                                      )}%`,
                                      backgroundColor: isFraud ? "#f43f5e" : "#14b8a6",
                                    }}
                                  />
                                </div>
                                <span style={styles.probText}>
                                  {(t.prediction.fraud_probability * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            <td style={{ ...styles.td, textAlign: "right" }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTxn(t);
                                }}
                                style={styles.inspectBtn}
                              >
                                Inspect Vector →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MANUAL 30-FEATURE ANALYSIS CONSOLE
           ========================================================================= */}
        {activeTab === "manual" && (
          <div style={styles.manualContainer}>
            <div style={styles.manualHeaderCard}>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>Manual 30-Feature Parameter Verification</h3>
                  <p style={styles.panelSubtitle}>
                    Enter custom transaction parameters. Features V1 through V28 represent orthogonal PCA-transformed components from the benchmark credit card dataset.
                  </p>
                </div>

                {/* Presets Toolbar */}
                <div style={styles.presetToolbar}>
                  <span style={styles.presetLabel}>Load Test Vector:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualFeatures(PRESET_BASELINE);
                      setManualError(null);
                    }}
                    style={styles.presetBtn}
                  >
                    Baseline Zeros
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualFeatures(PRESET_NORMAL);
                      setManualError(null);
                    }}
                    style={styles.presetBtn}
                  >
                    Legitimate Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualFeatures(PRESET_HIGH_RISK);
                      setManualError(null);
                    }}
                    style={{ ...styles.presetBtn, borderColor: "rgba(244, 63, 94, 0.4)", color: "#fb7185" }}
                  >
                    High-Risk Anomaly
                  </button>
                </div>
              </div>

              {/* Informational callout on PCA features */}
              <div style={styles.pcaInfoBanner}>
                <strong>PCA Feature Clarification:</strong> Due to privacy constraints on financial data, features <code>V1</code> to <code>V28</code> are standardized principal components extracted via Principal Component Analysis. Only <code>Time</code> and <code>Amount</code> were preserved in their raw numerical representations.
              </div>

              <form onSubmit={handleManualSubmit} style={styles.form}>
                {/* Primary Fields */}
                <div style={styles.primaryInputsGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>
                      Time (Elapsed Seconds)
                      <span style={styles.inputHelper}>Relative timestamp (0 – 172,800s)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={manualFeatures.Time}
                      onChange={(e) =>
                        setManualFeatures((prev) => ({ ...prev, Time: e.target.value }))
                      }
                      required
                      style={styles.textInput}
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>
                      Amount ($ USD)
                      <span style={styles.inputHelper}>Gross transaction charge</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={manualFeatures.Amount}
                      onChange={(e) =>
                        setManualFeatures((prev) => ({ ...prev, Amount: e.target.value }))
                      }
                      required
                      style={styles.textInput}
                    />
                  </div>
                </div>

                {/* PCA Matrix V1 to V28 */}
                <div style={styles.pcaContainer}>
                  <div style={styles.pcaHeader}>
                    <span style={styles.pcaTitle}>PCA Feature Vector (V1 through V28)</span>
                    <span style={styles.pcaSub}>Sensible 0.0 defaults (normalized standard deviation)</span>
                  </div>
                  <div style={styles.pcaGrid}>
                    {Array.from({ length: 28 }, (_, i) => {
                      const key = `V${i + 1}`;
                      return (
                        <div key={key} style={styles.pcaInputCell}>
                          <label style={styles.pcaCellLabel}>{key}</label>
                          <input
                            type="number"
                            step="any"
                            value={manualFeatures[key]}
                            onChange={(e) =>
                              setManualFeatures((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            style={styles.pcaInput}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Action */}
                <div style={styles.formFooter}>
                  <button
                    type="submit"
                    disabled={manualLoading}
                    style={{
                      ...styles.submitBtn,
                      opacity: manualLoading ? 0.6 : 1,
                      cursor: manualLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {manualLoading ? "Evaluating Vector..." : "Run Real ML Model Prediction"}
                  </button>
                </div>
              </form>
            </div>

            {/* Manual Output Box */}
            {manualError && (
              <div style={styles.errorBox}>
                <div style={styles.errorIcon}>⚠️</div>
                <div>
                  <strong style={{ color: "#f43f5e" }}>Submission Error</strong>
                  <p style={styles.errorText}>{manualError}</p>
                </div>
              </div>
            )}

            {manualResult && (
              <div style={styles.predictionBox}>
                <div
                  style={{
                    ...styles.resultHero,
                    backgroundColor:
                      manualResult.predicted_class === 1
                        ? "rgba(244, 63, 94, 0.12)"
                        : "rgba(16, 185, 129, 0.12)",
                    borderColor:
                      manualResult.predicted_class === 1
                        ? "rgba(244, 63, 94, 0.4)"
                        : "rgba(16, 185, 129, 0.4)",
                  }}
                >
                  <span style={styles.resultBadge}>RISK LEVEL: {manualResult.risk_level.toUpperCase()}</span>
                  <div
                    style={{
                      ...styles.resultTitle,
                      color: manualResult.predicted_class === 1 ? "#f43f5e" : "#10b981",
                    }}
                  >
                    {manualResult.result}
                  </div>
                  <div style={styles.resultSub}>
                    Predicted Class: <strong>{manualResult.predicted_class}</strong> • Fraud Probability:{" "}
                    <strong>{(manualResult.fraud_probability * 100).toFixed(2)}%</strong>
                  </div>
                </div>

                <div style={styles.disclaimerBox}>
                  <span style={styles.disclaimerTitle}>STATISTICAL DISCLAIMER</span>
                  <p style={styles.disclaimerContent}>
                    {manualResult.disclaimer ||
                      "Predictions are statistical estimates generated by a machine-learning algorithm and must not be treated as guaranteed financial decisions."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: MODEL DIAGNOSTICS & BENCHMARKS
           ========================================================================= */}
        {activeTab === "benchmarks" && (
          <div style={styles.benchmarksContainer}>
            <div style={styles.benchmarkCard}>
              <h3 style={styles.benchmarkTitle}>Model Architecture & Training Pipeline</h3>
              <p style={styles.benchmarkText}>
                The fraud classifier uses an end-to-end <strong>Scikit-Learn Pipeline</strong> consisting of a <code>StandardScaler</code> preprocessor followed by a <code>LogisticRegression</code> classifier parameterized with <code>class_weight=&quot;balanced&quot;</code>. Preprocessing parameters are fitted strictly on training data to prevent data leakage.
              </p>

              <div style={styles.pipelineSpecGrid}>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Classifier</span>
                  <span style={styles.specVal}>Logistic Regression (L2 Penalty)</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Class Weighting</span>
                  <span style={styles.specVal}>balanced (Inverse frequency adjusted)</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Preprocessing</span>
                  <span style={styles.specVal}>StandardScaler (Mean 0, Variance 1)</span>
                </div>
                <div style={styles.specItem}>
                  <span style={styles.specKey}>Model Storage</span>
                  <span style={styles.specVal}>ml/model/fraud_model.joblib</span>
                </div>
              </div>
            </div>

            <div style={styles.benchmarkCard}>
              <h3 style={styles.benchmarkTitle}>Test-Set Confusion Matrix & Evaluation Figures</h3>
              <p style={styles.benchmarkText}>
                Evaluated on a 20% stratified hold-out split (56,962 test transactions with 98 confirmed fraud cases).
              </p>

              <div style={styles.cmGrid}>
                <div style={styles.cmCell}>
                  <span style={styles.cmLabel}>True Negatives (TN)</span>
                  <span style={styles.cmVal}>55,478</span>
                  <span style={styles.cmDesc}>Legitimate transactions allowed</span>
                </div>
                <div style={styles.cmCell}>
                  <span style={styles.cmLabel}>False Positives (FP)</span>
                  <span style={styles.cmVal}>1,386</span>
                  <span style={styles.cmDesc}>Legitimate transactions flagged for review</span>
                </div>
                <div style={styles.cmCell}>
                  <span style={styles.cmLabel}>False Negatives (FN)</span>
                  <span style={{ ...styles.cmVal, color: "#f43f5e" }}>8</span>
                  <span style={styles.cmDesc}>Fraud cases missed</span>
                </div>
                <div style={styles.cmCell}>
                  <span style={styles.cmLabel}>True Positives (TP)</span>
                  <span style={{ ...styles.cmVal, color: "#10b981" }}>90</span>
                  <span style={styles.cmDesc}>Fraud cases intercepted (91.84% recall)</span>
                </div>
              </div>

              <div style={styles.tradeoffBox}>
                <strong>Engineering Rationale for Metric Profile:</strong>
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#cbd5e1" }}>
                  In financial security, missing a multi-thousand dollar fraudulent charge (False Negative) is catastrophic, whereas requesting secondary step-up verification for a legitimate customer (False Positive) is an acceptable friction. The balanced class weight intentionally elevates fraud recall to <strong>91.84%</strong> at the cost of nominal precision (6.10%).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TRANSACTION DETAILS MODAL / DRAWER
           ========================================================================= */}
        {selectedTxn && (
          <div style={styles.modalBackdrop} onClick={() => setSelectedTxn(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalBadgeRow}>
                    <span
                      style={{
                        ...styles.riskBadge,
                        backgroundColor:
                          selectedTxn.prediction.predicted_class === 1
                            ? "rgba(244, 63, 94, 0.2)"
                            : "rgba(16, 185, 129, 0.2)",
                        color: selectedTxn.prediction.predicted_class === 1 ? "#f43f5e" : "#10b981",
                        borderColor:
                          selectedTxn.prediction.predicted_class === 1
                            ? "rgba(244, 63, 94, 0.4)"
                            : "rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      {selectedTxn.prediction.predicted_class === 1 ? "HIGH RISK DETECTED" : "LOW RISK CLEARED"}
                    </span>
                    <span style={styles.simTag}>[SIMULATED DEMO TRANSACTION]</span>
                  </div>
                  <h3 style={styles.modalTitle}>Transaction Vector Telemetry: {selectedTxn.id}</h3>
                  <span style={styles.modalSubtitle}>
                    Scored at {selectedTxn.timestamp} • Charge Amount: ${selectedTxn.amount.toFixed(2)}
                  </span>
                </div>

                <button onClick={() => setSelectedTxn(null)} style={styles.modalCloseBtn}>
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={styles.modalBodyGrid}>
                {/* Column 1: Model Prediction Telemetry */}
                <div style={styles.modalCol}>
                  <h4 style={styles.modalSectionHeading}>Model Output Payloads</h4>
                  <div style={styles.attrCard}>
                    <div style={styles.modalAttrRow}>
                      <span style={styles.attrKey}>Predicted Class</span>
                      <span style={styles.attrVal}>Class {selectedTxn.prediction.predicted_class}</span>
                    </div>
                    <div style={styles.modalAttrRow}>
                      <span style={styles.attrKey}>Fraud Probability</span>
                      <span style={styles.attrVal}>
                        {(selectedTxn.prediction.fraud_probability * 100).toFixed(2)}% (
                        {selectedTxn.prediction.fraud_probability})
                      </span>
                    </div>
                    <div style={styles.modalAttrRow}>
                      <span style={styles.attrKey}>Assessment Tag</span>
                      <span style={styles.attrVal}>{selectedTxn.prediction.result}</span>
                    </div>
                    <div style={styles.modalAttrRow}>
                      <span style={styles.attrKey}>Assigned Risk Level</span>
                      <span style={styles.attrVal}>{selectedTxn.prediction.risk_level}</span>
                    </div>
                    <div style={styles.modalAttrRow}>
                      <span style={styles.attrKey}>Pipeline Runtime</span>
                      <span style={styles.attrVal}>Scikit-Learn (Port 8000)</span>
                    </div>
                  </div>

                  <div style={styles.disclaimerBox}>
                    <span style={styles.disclaimerTitle}>LEGAL DISCLAIMER</span>
                    <p style={styles.disclaimerContent}>{selectedTxn.prediction.disclaimer}</p>
                  </div>
                </div>

                {/* Column 2: 30 Input Features */}
                <div style={styles.modalCol}>
                  <h4 style={styles.modalSectionHeading}>Input Feature Coordinates (30 Features)</h4>
                  <div style={styles.featureCoordinateGrid}>
                    <div style={styles.featureCoordItem}>
                      <span style={styles.coordKey}>Time</span>
                      <span style={styles.coordVal}>{selectedTxn.features.Time}s</span>
                    </div>
                    <div style={styles.featureCoordItem}>
                      <span style={styles.coordKey}>Amount</span>
                      <span style={styles.coordVal}>${selectedTxn.features.Amount}</span>
                    </div>
                    {Array.from({ length: 28 }, (_, i) => {
                      const k = `V${i + 1}`;
                      const val = selectedTxn.features[k];
                      return (
                        <div key={k} style={styles.featureCoordItem}>
                          <span style={styles.coordKey}>{k}</span>
                          <span
                            style={{
                              ...styles.coordVal,
                              color: val < -2.5 ? "#f43f5e" : val > 2.5 ? "#f59e0b" : "#cbd5e1",
                            }}
                          >
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                <span style={styles.modalFooterNote}>
                  All demonstration events are synthetic and processed in-memory for testing purposes.
                </span>
                <button onClick={() => setSelectedTxn(null)} style={styles.modalDoneBtn}>
                  Close Telemetry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Transparency Footer */}
        <footer style={styles.pageFooter}>
          <p>
            <strong>FraudShield AI Security Suite</strong> • An algorithmic demonstration sandbox. Model predictions are statistical estimates. Simulated demonstration data does not reflect real financial banking transactions.
          </p>
        </footer>
      </main>
    </div>
  );
}

// Styling system tailored for modern dark navy fintech cybersecurity
const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "var(--bg-primary, #070b14)",
    color: "var(--text-primary, #f8fafc)",
  },
  sidebar: {
    width: "270px",
    flexShrink: 0,
    backgroundColor: "var(--bg-secondary, #0d1527)",
    borderRight: "1px solid var(--border-subtle, #19253d)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    gap: "28px",
  },
  brandBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingBottom: "16px",
    borderBottom: "1px solid var(--border-subtle, #19253d)",
  },
  brandLogo: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    backgroundColor: "rgba(20, 184, 166, 0.15)",
    border: "1px solid rgba(20, 184, 166, 0.4)",
    color: "#14b8a6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "16px",
    letterSpacing: "0.5px",
  },
  brandTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f8fafc",
    lineHeight: "1.2",
  },
  brandSubtitle: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flexGrow: 1,
  },
  navLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#475569",
    letterSpacing: "1px",
    marginBottom: "8px",
    paddingLeft: "8px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#94a3b8",
    background: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  navItemActive: {
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    color: "#14b8a6",
    fontWeight: "600",
  },
  navIcon: {
    fontSize: "15px",
  },
  sidebarFooter: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sidebarCard: {
    backgroundColor: "#111a30",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "12px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#cbd5e1",
    lineHeight: "1.3",
  },
  refreshBtn: {
    width: "100%",
    padding: "6px 8px",
    backgroundColor: "#0d1527",
    border: "1px solid #253658",
    borderRadius: "4px",
    color: "#94a3b8",
    fontSize: "11px",
    cursor: "pointer",
    textAlign: "center",
  },
  versionTag: {
    fontSize: "11px",
    color: "#475569",
    textAlign: "center",
  },
  mainContent: {
    flexGrow: 1,
    padding: "32px 40px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    overflowY: "auto",
  },
  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageHeading: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: "4px",
  },
  pageSubheading: {
    fontSize: "14px",
    color: "#94a3b8",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  badge: {
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },
  metricCard: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-subtle, #19253d)",
    borderRadius: "10px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  metricHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    letterSpacing: "0.8px",
  },
  metricBadgeLive: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#0ea5e9",
    border: "1px solid rgba(14, 165, 233, 0.3)",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(14, 165, 233, 0.08)",
  },
  metricValue: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: "2px 0",
  },
  metricDesc: {
    fontSize: "12px",
    color: "#cbd5e1",
  },
  metricSessionNote: {
    fontSize: "10px",
    color: "#64748b",
    fontStyle: "italic",
    marginTop: "2px",
  },
  benchmarkNoticeBanner: {
    backgroundColor: "rgba(14, 165, 233, 0.08)",
    border: "1px solid rgba(14, 165, 233, 0.25)",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "12px",
    color: "#cbd5e1",
    lineHeight: "1.4",
  },
  noticeIcon: {
    fontSize: "16px",
  },
  tabContentContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  simulatorControlCard: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-subtle, #19253d)",
    borderRadius: "10px",
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  simCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    maxWidth: "600px",
  },
  simIconBox: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    border: "1px solid rgba(20, 184, 166, 0.3)",
    color: "#14b8a6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
  },
  simTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  simSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "2px",
    lineHeight: "1.4",
  },
  simCardRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  simBtnPrimary: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    color: "#070b14",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.15s ease",
  },
  simBtnSecondary: {
    padding: "10px 16px",
    backgroundColor: "#0a0f1d",
    border: "1px solid #253658",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  clearBtn: {
    padding: "10px 14px",
    backgroundColor: "transparent",
    border: "1px solid #1e293b",
    borderRadius: "6px",
    color: "#94a3b8",
    fontSize: "12px",
    cursor: "pointer",
  },
  pulsingDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    animation: "pulseGlow 1.2s infinite ease-in-out",
  },
  tablePanel: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-subtle, #19253d)",
    borderRadius: "10px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  tablePanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  tableTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  tableSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    display: "block",
    marginTop: "2px",
  },
  filterPillGroup: {
    display: "flex",
    gap: "6px",
    backgroundColor: "#0a0f1d",
    padding: "4px",
    borderRadius: "6px",
    border: "1px solid #19253d",
  },
  filterPill: {
    padding: "5px 12px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "4px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
  },
  filterPillActive: {
    backgroundColor: "#16223d",
    color: "#f8fafc",
    fontWeight: "600",
  },
  emptyTableState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 20px",
    textAlign: "center",
    gap: "10px",
  },
  emptyStateIcon: {
    fontSize: "40px",
  },
  emptyStateTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#cbd5e1",
  },
  emptyStateDesc: {
    fontSize: "13px",
    color: "#64748b",
    maxWidth: "420px",
    lineHeight: "1.5",
  },
  tableResponsiveWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  tableHeaderRow: {
    borderBottom: "1px solid #19253d",
  },
  th: {
    padding: "12px 14px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  tableRow: {
    borderBottom: "1px solid #111a30",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  td: {
    padding: "14px 14px",
    verticalAlign: "middle",
  },
  riskBadge: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "700",
    border: "1px solid",
    display: "inline-block",
    letterSpacing: "0.5px",
  },
  txnIdText: {
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#f1f5f9",
  },
  simTag: {
    fontSize: "10px",
    color: "#64748b",
    marginLeft: "6px",
    fontWeight: "500",
  },
  timestampText: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  amountText: {
    fontWeight: "600",
    color: "#f8fafc",
  },
  probCellContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  probMiniBarTrack: {
    width: "60px",
    height: "6px",
    backgroundColor: "#19253d",
    borderRadius: "3px",
    overflow: "hidden",
  },
  probMiniBarFill: {
    height: "100%",
    borderRadius: "3px",
  },
  probText: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#cbd5e1",
    minWidth: "40px",
  },
  inspectBtn: {
    backgroundColor: "transparent",
    border: "1px solid #253658",
    color: "#14b8a6",
    borderRadius: "4px",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  manualContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  manualHeaderCard: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-subtle, #19253d)",
    borderRadius: "10px",
    padding: "24px",
  },
  pcaInfoBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.25)",
    borderRadius: "6px",
    padding: "10px 14px",
    fontSize: "12px",
    color: "#fde68a",
    marginBottom: "20px",
    lineHeight: "1.4",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "16px",
  },
  panelTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  panelSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  presetToolbar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  presetLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "500",
  },
  presetBtn: {
    padding: "5px 10px",
    backgroundColor: "#0a0f1d",
    border: "1px solid #253658",
    borderRadius: "4px",
    fontSize: "11px",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  primaryInputsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  inputLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#cbd5e1",
    display: "flex",
    flexDirection: "column",
  },
  inputHelper: {
    fontSize: "11px",
    fontWeight: "400",
    color: "#64748b",
  },
  textInput: {
    backgroundColor: "var(--bg-input, #0a0f1d)",
    border: "1px solid var(--border-strong, #253658)",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
  },
  pcaContainer: {
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "16px",
  },
  pcaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  pcaTitle: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  pcaSub: {
    fontSize: "11px",
    color: "#475569",
  },
  pcaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(75px, 1fr))",
    gap: "8px",
    maxHeight: "260px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  pcaInputCell: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  pcaCellLabel: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#64748b",
  },
  pcaInput: {
    backgroundColor: "#111a30",
    border: "1px solid #1e2b45",
    borderRadius: "4px",
    padding: "6px 6px",
    color: "#f1f5f9",
    fontSize: "12px",
    outline: "none",
    textAlign: "right",
  },
  formFooter: {
    display: "flex",
    justifyContent: "flex-end",
  },
  submitBtn: {
    backgroundColor: "#14b8a6",
    color: "#070b14",
    border: "none",
    borderRadius: "6px",
    padding: "12px 24px",
    fontWeight: "700",
    fontSize: "14px",
    letterSpacing: "0.3px",
    boxShadow: "0 2px 10px rgba(20, 184, 166, 0.25)",
  },
  predictionBox: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  resultHero: {
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  resultBadge: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#94a3b8",
  },
  resultTitle: {
    fontSize: "22px",
    fontWeight: "800",
  },
  resultSub: {
    fontSize: "13px",
    color: "#cbd5e1",
  },
  disclaimerBox: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.25)",
    borderRadius: "6px",
    padding: "12px",
  },
  disclaimerTitle: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: "0.8px",
    display: "block",
    marginBottom: "4px",
  },
  disclaimerContent: {
    fontSize: "11px",
    color: "#cbd5e1",
    lineHeight: "1.4",
  },
  errorBox: {
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    border: "1px solid rgba(244, 63, 94, 0.35)",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  errorIcon: {
    fontSize: "18px",
  },
  errorText: {
    fontSize: "12px",
    color: "#fda4af",
    marginTop: "2px",
    lineHeight: "1.4",
  },
  benchmarksContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  benchmarkCard: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-subtle, #19253d)",
    borderRadius: "10px",
    padding: "24px",
  },
  benchmarkTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: "6px",
  },
  benchmarkText: {
    fontSize: "13px",
    color: "#94a3b8",
    lineHeight: "1.5",
    marginBottom: "16px",
  },
  pipelineSpecGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "16px",
  },
  specItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  specKey: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  specVal: {
    fontSize: "13px",
    color: "#e2e8f0",
    fontWeight: "500",
  },
  cmGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    margin: "16px 0",
  },
  cmCell: {
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cmLabel: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "600",
  },
  cmVal: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  cmDesc: {
    fontSize: "11px",
    color: "#64748b",
  },
  tradeoffBox: {
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "12px",
    color: "#e2e8f0",
    lineHeight: "1.5",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7, 11, 20, 0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "var(--bg-card, #111a30)",
    border: "1px solid var(--border-strong, #253658)",
    borderRadius: "12px",
    maxWidth: "840px",
    width: "100%",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
    overflow: "hidden",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #19253d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  modalCloseBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "18px",
    cursor: "pointer",
    padding: "4px 8px",
  },
  modalBodyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    padding: "20px 24px",
    overflowY: "auto",
  },
  modalCol: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  modalSectionHeading: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  attrCard: {
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  modalAttrRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    padding: "4px 0",
    borderBottom: "1px solid #111a30",
  },
  attrKey: {
    color: "#64748b",
  },
  attrVal: {
    color: "#f1f5f9",
    fontWeight: "600",
  },
  featureCoordinateGrid: {
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    padding: "12px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    maxHeight: "300px",
    overflowY: "auto",
  },
  featureCoordItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    padding: "4px 6px",
    backgroundColor: "#111a30",
    borderRadius: "4px",
  },
  coordKey: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  coordVal: {
    fontFamily: "monospace",
    fontWeight: "600",
  },
  modalFooter: {
    padding: "14px 24px",
    borderTop: "1px solid #19253d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalFooterNote: {
    fontSize: "11px",
    color: "#64748b",
  },
  modalDoneBtn: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    color: "#f8fafc",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  pageFooter: {
    padding: "16px 20px",
    backgroundColor: "#0a0f1d",
    border: "1px solid #19253d",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#64748b",
    lineHeight: "1.5",
    marginTop: "12px",
  },
};
