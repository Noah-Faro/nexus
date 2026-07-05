# NEXUS ML Engine: Comprehensive Blueprint (Subagent Drafts)

## Part 1: Data Sourcing & APIs Strategy (Agent 1)
Given the fragmented ecosystem of wearable technology and health apps, the optimal approach balances direct integrations with aggregation strategies.

### A. Core Platform Integrations (React Native)
Since NEXUS is a React Native (Expo) application, integrating directly with the host OS's native health stores is the most critical step.
*   **iOS (Apple HealthKit):** Recommended SDK: `react-native-health` or `@kingstinct/react-native-healthkit`. Requires Expo Custom Dev Client.
*   **Android (Google Health Connect):** Recommended SDK: `react-native-health-connect`. Health Connect is the required standard for Android health integrations in 2026.

### B. Third-Party Wearables (Oura, Whoop, MyFitnessPal)
1.  **Tier 1: Mobile-First Aggregation (The "Free" Approach - Recommended):** Rely on the fact that Oura, Whoop, and MyFitnessPal apps natively sync their data to Apple HealthKit and Google Health Connect. NEXUS simply queries the local iOS/Android health datastores. We inherit the user's wearable data without managing OAuth tokens or separate pipelines.

### C. Specific Strategy for Pulling Data Locally
*   Treat the OS (HealthKit/Health Connect) as the primary data lake.
*   When the app opens, query the native health SDK for the delta since the last sync timestamp.
*   Implement a local utility layer to map these native objects to the standard NEXUS ML schema.
*   Feed the normalized data directly from the local cache to the local ML Engine.

---

## Part 2: Database & Security Strategy (Agent 2)
**Current Architecture:** Local Vault (AES-256-GCM) + SQLite/AsyncStorage + CRDT tombstones for Google Drive sync.

**Security Verdict:** ✅ **Highly Secure.** AES-256-GCM combined with iOS Keychain policies is industry-standard.
**Performance Verdict:** ❌ **Not Performant Enough.** Relying on JS-based cryptography (`crypto-js`) for massive ML tensors will freeze the UI. AsyncStorage will OOM on large tensors. CRDT tombstone bloat for high-frequency time-series data will cause your database to explode.

### Recommended Architecture Shift
1. **The "Index + Blob" Strategy:** Use SQLite strictly as a fast indexer (metadata, timestamps, file pointers). Store raw tensors/matrices as binary files (e.g., Protocol Buffers or raw `.bin`) directly on the local file system. Do NOT put them in SQLite or AsyncStorage.
2. **Native Cryptography (JSI):** Move away from `crypto-js`. Implement JSI-based native crypto (`react-native-quick-crypto`) to encrypt these binary tensor files off the JS thread.
3. **Chunked / Immutable Cloud Sync:** Abandon per-row CRDT tracking for ML data. Aggregate time-series data into **immutable time-window chunks** (e.g., `tensor_2026-05-31.enc`) and upload directly to Google Drive. No merging required—just download missing files.

---

## Part 3: Prediction Targets (Agent 3)
Predictions are structured into two categories: Direct Targets and Cross-Domain Syntheses.

### A. Direct Prediction Targets
*   **Sleep Onset Latency & Duration Forecasting:** Predicts the exact time it will take to fall asleep tonight and total expected sleep duration based on today's baseline.
*   **Next-Day Energy & Mood Baselines:** Enables proactive calendar management.
*   **Dynamic Target Training RPE:** Acts as a governor to prevent central nervous system burnout by down-regulating target RPE if systemic recovery is poor.
*   **Caffeine Clearance & Cut-off Threshold:** The exact timestamp when active bloodstream caffeine will decay below the "sleep-safe physiological threshold."

### B. Cross-Domain Predictions (Correlative Synthesis)
*   **Training Readiness (Sleep × Hydration × Nutrition):** "You slept well, but due to low water intake and an extended fasting state, your peak power output will likely drop. Pre-hydrate heavily before training."
*   **Deep Sleep Disruption (Exertion × Caffeine Timing):** "High-RPE leg days combined with caffeine after 3 PM historically reduces your deep sleep by 45 minutes."
*   **Habit Adherence Decay (Mood × Sleep Debt):** Calculates the statistical probability of breaking a streak on Protocol habits.

---

## Part 4: Model Assignment Strategy (Agent 4)
Matching the exact ML algorithm to the specific prediction task.

### 1. Sleep Quality (XGBoost)
*   Sleep quality is heavily influenced by non-linear factors and thresholds (e.g., caffeine only hurts sleep if taken after 2 PM). XGBoost inherently handles these complex feature interactions and naturally provides feature importance scores to show the user exactly what is ruining their sleep.

### 2. Required Sleep (Lasso Regression / L1 Regularized)
*   A user's required sleep is fundamentally an additive function (Baseline + Sleep Debt + Strain). Lasso applies an L1 penalty, automatically shrinking coefficients of irrelevant features to zero, ensuring the model remains simple, interpretable, and doesn't overfit to noisy variables.

### 3. Mood (XGBoost Classifier)
*   Self-reported mood is highly subjective and non-linear. A user's mood might stay stable despite minor stress, but plummet entirely once a specific "breaking point" threshold of sleep deprivation and strain is crossed.

### 4. Readiness (Isolation Forest)
*   Readiness is uniquely sensitive to acute physiological stressors (e.g., oncoming illness, alcohol). An Isolation Forest is an unsupervised anomaly detection algorithm that excels at identifying "out of bounds" physiological states (like a sudden drop in HRV).

---

## Part 5: Ground Truth & Unsupervised Learning (Agent 5)
How to predict targets like "Sleep Quality" or "Required Sleep" when the user doesn't explicitly log a "ground truth" score.

### Strategy A: Proxy Metrics (Surrogate Ground Truth)
*   **HRV & RHR:** Instead of directly predicting an abstract "sleep quality score," the ML engine targets a proxy. "Optimal sleep" is defined as the sleep architecture that maximizes morning Heart Rate Variability (HRV) and minimizes morning Resting Heart Rate (RHR) relative to a 30-day baseline.

### Strategy B: Unsupervised Learning (State Discovery)
*   **Clustering (K-Means / Gaussian Mixture Models):** Cluster the user's daily biometric footprint (sleep duration, deep/REM ratios, waking HRV). The algorithm will naturally separate data points into distinct physiological clusters (e.g., "Prime/Recovered," "Baseline," "Depleted") without needing a user to label them.

### Proposed Solution: The NEXUS Hybrid Approach
1.  **Define Target States (Unsupervised):** Run GMM clustering on morning vitals to establish personalized "Recovery States".
2.  **Predictive Modeling (Supervised):** Train the model (XGBoost) to predict *which physiological state* the user will wake up in tomorrow, using daytime behaviors as input features.
3.  **Reverse Engineering "Required Sleep":** The ML engine queries the predictive model: *"What is the minimum sleep duration required tonight to achieve a >85% probability of landing in the 'Optimal' recovery cluster tomorrow?"*