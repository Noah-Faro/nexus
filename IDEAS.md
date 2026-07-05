# NEXUS Super-App: Feature Blueprints & Idea Backlog

This document serves as the long-term visionary backlog for the NEXUS Super-App. It details comprehensive blueprints for new modules, integrations, and architectural refactors, ensuring all future development strictly adheres to the established `STYLE_GUIDE.md` and offline-first `GOOGLE_CLOUD.md` paradigms.

---

## 1. Sleep & Recovery Module

### Core Features & Functionalities
- **Sleep Phase Logging:** Track sleep cycles, latency, interruptions, and time-in-bed vs. time asleep.
- **Recovery Composite Score (0-100):** A daily synthesized metric calculating readiness based on sleep architecture, previous day's training strain, and systemic recovery variables.
- **Sleep Debt Calculator:** Cumulatively track missed sleep hours against baseline needs, suggesting calculated "catch-up" durations or nap protocols.
- **Morning Readiness Check-in:** A brief daily intake flow (subjective fatigue, muscle soreness, HRV/RHR if imported from wearables) to calibrate the day's recovery score.

### Synergy with Existing Modules
- **Caffeine Tracking:** Deep integration with the active caffeine pooled logs and clearance timescales. The UI will cross-reference the user's bedtime with the "sleep-safe physiological threshold." High active caffeine at bedtime flags a warning for expected sleep latency.
- **Hydration Tracker:** Late-night fluid intake logs correlate directly with sleep interruptions (nocturia). Chronic dehydration down-regulates the daily Recovery Score.
- **Training Module:** Training volume directly dictates sleep need. A heavy session recorded in the Training Module increases the recommended sleep duration for that night. Conversely, a poor recovery score acts as a governor, suggesting a down-regulated training intensity for the day.

### Data Structures & Vault Sync
Data follows the LWW (Last-Write-Wins) CRDT strategy integrated directly into the encrypted AES-256-GCM Vault.

```typescript
interface SleepLog {
  id: string; // UUID v4
  date: string; // YYYY-MM-DD
  bedTime: number; // Unix timestamp
  wakeTime: number; // Unix timestamp
  latencyMinutes: number;
  interruptions: number;
  restingHR?: number;
  hrv?: number;
  updatedAt: number; // Required for mergeById LWW resolution
}

interface DailyRecovery {
  id: string;
  date: string; // YYYY-MM-DD
  compositeScore: number; // 0-100
  subjectiveSoreness: number; // 1-5
  notes: string;
  updatedAt: number; 
}
```
*Note:* Deleting a `SleepLog` must push its `id` to `tombstones.ts` to ensure the deletion propagates across Google Drive cloud syncs, avoiding the "ghost log" resurrection bug.

### UX/UI Suggestions (OLED-First)
- **Colors:** Base background uses Deep Background (`#000000`). Introduce **Recovery Indigo (`#5e5ce6`)** as the primary accent for sleep graphs and recovery rings. Warning Red (`#ff453a`) highlights sleep deprivation states.
- **Typography:** The main hub uses `Outfit_700Bold` at `18px` without letter spacing ("Sleep", "Recovery"). Sub-sections use `Outfit_600SemiBold` (`15px`).
- **Components:** 
  - Use `<SegmentedControl>` for switching between `['last_night', 'trends', 'debt']`.
  - Use `<StepperInput>` for manual adjustments to sleep latency and interruption counts.

---

## 2. Protocol / Habit Engine

### Core Features & Functionalities
- **Custom Synthesized Protocols:** Group multiple habits into thematic stacks (e.g., "Morning Huberman Routine", "Deep Work Phase", "Pre-Bed Wind Down").
- **Binary & Quantifiable Habits:** Track simple yes/no completions or trackable targets (e.g., "Read 20 pages").
- **Dynamic Contextual Triggers:** Rules-based habit activation (e.g., "Trigger Post-Workout Protocol immediately after logging a Training session").
- **Streak & Adherence Tracking:** Visual completion rings and weekly adherence heatmaps.

### Synergy with Existing Modules
- **Hydration & Caffeine:** Completing a habit like "Drink 500ml Water Upon Waking" automatically dispatches a command to the Hydration Module to log the standard beverage. A habit like "Delay Caffeine 90 mins" listens to the Sleep Module's `wakeTime` and blocks/flags caffeine logs within that window.
- **Training Module:** Protocol habits like "Mobility Work" can be automatically checked off if a specific exercise is logged in the Training Module.

### Data Structures & Vault Sync
Habits require strict `updatedAt` tracking to ensure offline-first compliance when toggling completions on different devices.

```typescript
interface Protocol {
  id: string;
  title: string;
  description: string;
  triggerContext?: 'morning' | 'post_workout' | 'pre_bed';
  isActive: boolean;
  updatedAt: number;
}

interface HabitEvent {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completedValue: number; // 1 for binary, N for numeric
  timestamp: number;
  updatedAt: number;
}
```

### UX/UI Suggestions (OLED-First)
- **Colors:** Use Goal Success Green (`#32d74b`) for completed habits. Elevated Surfaces (`#0a0a0a` / `#151515`) are used for Protocol card containers. 
- **Typography:** `<SheetHeader>` titles for the "New Protocol" creation sheet use `Outfit_700Bold` at `18px`.
- **Components:** Destructive actions (e.g., deleting a Protocol) must use `<AppAlertModal>` and NEVER the native `Alert.alert`.

---

## 3. Nutrition & Macro Tracking Module

### Core Features and Functionalities
- **Macro & Calorie Tracking:** Quick entry for Protein, Carbs, Fats, and Calories. Support for defining daily targets based on body weight or goals.
- **Barcode & Label Scanning:** Integration with an external API for scanning nutritional labels.
- **Quick Logging & Presets:** "Synthetic Presets" similar to the Hydration module's `BrewLab` (e.g., standard meals like "Post-Workout Shake").
- **Fasting Timer:** Built-in intermittent fasting tracker with progress visualizations overlaying estimated metabolic states.

### Synergies with Existing Modules
- **Hydration Module:** Consuming water-dense foods (e.g., watermelon, soups) automatically contributes a defined percentage to the daily hydration goal. Dehydrating foods (e.g., high sodium) subtly adjusts the hydration target.
- **Caffeine Tracking:** Logging caffeinated foods (e.g., dark chocolate, matcha bars) seamlessly feeds into the existing caffeine clearance timescales.
- **Training Module:** Post-workout protein synthesis tracking. Training volume and intensity automatically adjust the day's calorie and carbohydrate targets (dynamic TDEE).

### Data Structures & Vault Integration
```typescript
interface NutritionLog {
  id: string; // UUIDv4
  timestamp: string; // ISO-8601
  type: 'FOOD' | 'QUICK_MACROS';
  name: string; // e.g., "Post-Workout Shake"
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterContentMl?: number; // Synergizes with Hydration
  caffeineMg?: number; // Synergizes with Caffeine module
  updatedAt: number;
}
```

### UX/UI Suggestions
- **Colors:** Protein (`#ff375f`), Carbs (`#ffd60a`), Fats (`#bf5af2`).
- **Components:** Progress rings for macro targets mapping against the daily goal, glowing in their respective accent colors when completed (accompanied by `Haptics.notificationAsync(Success)`).

---

## 4. Cross-Module Insights Dashboard

### Core Features and Functionalities
- **Unified Daily Timeline:** A single scrolling timeline merging logs from Hydration, Caffeine, Training, and Nutrition chronologically.
- **Correlative Analytics:** Heuristic-based insights (e.g., "Your heavy deadlift days correlate with missed hydration goals" or "High caffeine intake past 4 PM correlates with missed morning workouts").
- **Weekly & Monthly Radar Charts:** Visualizing adherence to all lifestyle pillars simultaneously.

### Synergies with Existing Modules
- Acts as the brain of the app, pulling read-only data from all modules to map out behavioral trends without mutating their core state. Direct deep-links from an insight jump directly into specific module settings to adjust routines.

---

## 5. Apple HealthKit / Google Fit Passive Integration

### Core Implementation Strategy
- **Unified Health Facade:** Implement a generic `HealthService` to abstract platform-specific libraries (`expo-health-connect` for Android and `rn-apple-healthkit` for iOS) into a single, unified API.
- **Background Synchronization:** Utilize `expo-background-fetch` and `expo-task-manager` to periodically poll for new health events when the app is backgrounded.

### Enhancements to Existing Modules
- **Hydration Module:** Seamlessly log water intake recorded via smart water bottles or third-party apps. Read active energy expenditure and sweat loss to dynamically scale up daily hydration targets automatically.
- **Training Module:** Passively import workouts (e.g., Strava runs, Apple Fitness+) into the NEXUS timeline.

### Guardrails (Crucial)
- **Device Lock (`SECURE_STORE_LOCKED`):** Background health fetches must explicitly catch `SECURE_STORE_LOCKED` errors. If the device is locked, the fetch must abort silently to prevent writing unencrypted data or causing the encryption wipe bug.
- **Native OS Dialog Ban:** Do not use `Alert.alert` to request health permissions. All context and rationale for health data access must be explained within the custom `<AppAlertModal>`.

---

## 6. System-wide Style Guide & Technical Debt Refactoring

### Core Implementation Strategy
- **Typography Standardization:** Audit the entire codebase to strip out native `fontWeight` styles. Replace them directly with font family bindings (`Outfit_700Bold`, `Outfit_600SemiBold`) via the theme tokens to prevent Android font fallback bugs.
- **Hook Purity Checks:** Ensure zero conditional React hooks. All hooks must be declared above early return statements.
- **Gesture Refactoring:** Hunt down and refactor nested `TouchableOpacity` elements. Replace them with structured sibling layouts within standard `View` containers to eliminate touch gesture conflicts.

### Value Proposition
- **OLED-First Consistency:** Guarantees absolute visual parity across all modules. Enforces the `#000000` deep background and `#64d2ff` cyan accents, heavily optimizing battery life on modern displays.
- **Predictable Performance:** Eliminating nested touch handlers and rogue useEffects reduces re-rendering cycles and interface freezing.
- **Future-Proofing:** Establishes an unshakeable foundation for upcoming modules (like Sleep or Nutrition), ensuring developers don't clone legacy anti-patterns.

---

## 7. Local Machine Learning & Prediction Engine

### Overview
A privacy-first, on-device machine learning engine designed to find correlations between the user’s daily habits, physiological data, and mental wellbeing. By processing data strictly on the local machine, NEXUS guarantees absolute data privacy while delivering highly personalized health insights.

### Core Predictions
*   **Sleep Forecasting:** Predicts the upcoming night's sleep duration and quality score based on the day's activities and physiological baseline.
*   **Mood & Energy Prediction:** Estimates tomorrow's baseline mood and energy levels, allowing the user to proactively adjust their schedule.
*   **Habit Impact Analysis:** Identifies complex, individualized correlations (e.g., "High-RPE leg days combined with caffeine after 3 PM reduces deep sleep by 45 minutes").

### Feature Inputs (Data Sources)
The model aggregates a holistic snapshot of the user's day:
*   **Fitness & Exertion:** Workout volume (total weight, reps), specific muscle groups targeted, and RPE (Rating of Perceived Exertion).
*   **Intake:** Hydration levels (timing and total volume) and Caffeine intake (dosage and timing).
*   **Recovery:** Previous nights' sleep duration and quality metrics.
*   **Psychological:** User-logged mood and stress scores.
*   **Physiological (Wearables):** Heart rate, resting heart rate (RHR), and HRV metrics.

### Technical Strategy & Execution
*   **On-Device Engine:** Utilize `@tensorflow/tfjs-react-native` to run inference and local training directly on the device, leveraging native backend bindings for hardware acceleration.
*   **Non-Blocking Architecture:** 
    *   **Inference:** Daily predictions are lightweight and run asynchronously, ensuring the React Native JS thread remains responsive.
    *   **Re-training/Fine-tuning:** Model re-estimation (e.g., updating weights with the last 7 to 14 days of new data) is scheduled using `expo-background-fetch` and `expo-task-manager`. Re-training events are configured to trigger only when optimal (e.g., device is idle, plugged in) to prevent battery drain and UI freezing.
    *   **Data Aggregation:** Leverage `expo-sqlite` async queries to build training tensors efficiently before feeding them to the ML engine.
    *   **Performance Fallback:** If device constraints cause frame drops during training, the process will be chunked over multiple asynchronous ticks using `setImmediate`, or downscaled to simpler statistical regression models for older hardware.

### Privacy & Granular Data Controls
*   **Zero Cloud Processing:** All ML weights, feature tensors, and personal data remain strictly on the local filesystem. No health data is sent to external servers for processing.
*   **Modular Permissions UI:** A dedicated "Prediction Data Sources" settings screen gives users absolute control over what feeds the engine.
    *   Individual toggle switches for internal app data (e.g., "Include Workout Data", "Include Mood Logs").
    *   Granular API permissions for external sources like Apple Health or Health Connect (e.g., "Allow Read Access: Heart Rate", "Allow Read Access: Sleep").
    *   If a source is toggled off, the model dynamically masks or drops that feature column during the next inference or training cycle, ensuring user consent is instantly respected.

### Advanced Data Architecture & Algorithm Selection
To ensure the model remains robust against messy, real-world data and edge cases (such as zero-variance columns and missing data), the following strategies are strictly implemented:

*   **Handling Missing Data (EMA & Shadow Variables):**
    *   **Single-Day Missing:** Handled via localized linear interpolation.
    *   **Multi-Day Missing:** Forward-filling outliers is dangerous. We instead use a 7-day Exponential Moving Average (EMA) so data smoothly decays to a personalized baseline.
    *   **Shadow Variables:** For every feature, a boolean "shadow variable" (`is_missing`) is generated. If a feature is imputed with an EMA, the shadow variable is set to `1`. This allows the network/tree to mathematically isolate and ignore the imputed fake value, relying dynamically on the remaining active features.
*   **Preventing Matrix Singularity (The Zero-Variance Problem):**
    *   If a user *never* grants a permission (e.g., Apple Health), that feature column has zero variance. This causes perfect multicollinearity, crashing standard OLS Linear Regression.
    *   **Phase 1 Algorithm (Lasso Regression):** We deploy Lasso (L1 Regularization) because it is mathematically immune to non-invertible matrices. It actively shrinks zero-variance feature coefficients to exactly `0.0`. Deployed as a raw JS dot-product, inference takes under `0.1ms` and adds 0 MB to the bundle.
    *   **Phase 2 Algorithm (XGBoost via ONNX):** If complex, non-linear interactions are discovered, we upgrade to XGBoost. Tree-based models naturally ignore zero-variance features as they provide zero information gain during node splits.
*   **The "Day 100" Problem (Dynamic Variance):**
    *   If a zero-variance column suddenly gains variance (e.g., the user turns on a permission on Day 100), the incrementally trained model seamlessly adapts. The L1 regularizer stops forcing the weight to `0.0` and begins naturally assigning it predictive weight on the fly without breaking the fixed tensor input shape.

---

## 8. AI Insights & Dashboard Visualization

This module transforms passive local health data into an actionable, predictive engine, utilizing an OLED-optimized visual language and secure remote AI synthesis to shape user behavior intra-day.

### 1. OLED-First Predictive Dashboards
The dashboard translates local ML predictions (sleep latency, energy levels, mood) into highly intuitive visual curves, strictly adhering to the NEXUS OLED dark theme.

*   **The Sleep/Caffeine Intersect Curve**:
    *   **Visuals**: Plotted on a deep background (`#000000`), the user's predicted "Sleep Propensity" curve is rendered in `Hydration Cyan` (`#64d2ff`), while active bloodstream caffeine clearance is overlaid as a fading area chart in `Caffeine Amber` (`#ff9f0a`).
    *   **Threshold Markers**: A vertical dashed line (using `Warning Red` `#ff453a`) dynamically appears on the timeline to mark the exact moment where further caffeine intake will delay the predicted 8-hour sleep goal past the user's target bedtime.
    *   **UI Containers**: Graphs are nested inside Elevated Surfaces (`#151515`) with `12px` (`md`) rounded corners and `1px` muted borders (`#222222`), ensuring deep contrast and battery efficiency.

### 2. Intra-Day Behavior Modification
Visualizations are not just read-only; they are interactive tools designed to empower real-time habit changes.

*   **"What-If" Impact Simulation**: Users can use a `<StepperInput>` to virtually "add" a 150mg coffee to the current time. 
*   **Haptic & Visual Feedback**: As the simulated caffeine curve pushes the sleep onset time into the red zone, the UI triggers `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`. The intersection point turns `Warning Red` (`#ff453a`), vividly demonstrating the biological consequence *before* the user consumes the drink.
*   **Actionable Prompts**: Instead of generic stats, system card surfaces (`#1c1c1e`) display blunt, actionable directives using `Outfit_600SemiBold` (`15px`): *"Caffeine Cut-off Reached. To achieve 8 hours of sleep, switch to water."*

### 3. Daily AI-Based "Nugget of Wisdom" (Remote API)
To complement local ML curves, an optional, daily AI insight is generated via a remote LLM (OpenAI/Gemini) to uncover complex correlations between habits.

*   **Privacy & Safe Data Strategy**:
    *   **Anonymized Payloads**: Never transmit PII. The local engine compiles a strict JSON schema containing only categorical and numerical aggregates (e.g., `{"total_caffeine_mg": 400, "sleep_duration_hrs": 6.2, "mood_score": 3, "hydration_ml": 2500}`). 
    *   **Consent via Unified Dialogs**: Opt-in prompts bypass native OS alerts entirely, utilizing the custom `<AppAlertModal>` to securely request permission to process data remotely.
*   **Insight Presentation**:
    *   Displayed in a daily "Insight Card" under the "Trends" tab of a `<SegmentedControl>`.
    *   **Typography**: The "nugget" utilizes `Outfit_400Regular` (`14px`) with `Text Primary` (`#ffffff`), while contextual metadata uses `Text Muted` (`#8e8e93`). 
    *   **Example Output**: *"Yesterday's late workout combined with 300mg of caffeine after 4 PM reduced your deep sleep by 20%. Consider shifting high-intensity training to the morning."*
    *   **Execution**: The insight is fetched asynchronously during the first morning launch, cached locally to eliminate redundant API calls, and finalized with `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` when the card renders.

---

## 9. Comprehensive ML Architecture Blueprint (Subagent Synthesis)

To support the Local Machine Learning & Prediction Engine, the following architecture has been peer-reviewed and verified by cross-domain specialists:

### A. Data Sourcing & Security (The Foundation)
*   **The OS as the Data Lake:** HealthKit (iOS) and Health Connect (Android) serve as the primary truth sources. Wearable data (Oura, Whoop, etc.) is passively inherited via the OS, avoiding complex third-party API management.
*   **The "Index + Blob" Architecture:** Raw high-frequency biometric tick-data is NEVER stored in the local SQLite database. SQLite acts solely as a fast indexer, while the actual ML tensors are persisted as immutable, binary chunks (e.g., `tensor_2026-05-31.enc`) directly on the filesystem.
*   **Native Cryptography (JSI):** To prevent UI-thread freezing on mobile, JavaScript-based encryption (`crypto-js`) is strictly avoided for ML data. All binary tensor encryption and ML model execution are offloaded to C++ JSI modules or Expo background workers.

### B. Ground Truth & "Recovery States" (Unsupervised Learning)
For subjective targets where explicit "ground truth" labels are missing (e.g., "Sleep Quality" or "Required Sleep"):
*   **Hybrid Proxy-Cluster Reverse-Engineering:** We discard supervised regression (like Lasso) for subjective metrics. Instead, we use unsupervised learning (Gaussian Mixture Models / K-Means) to cluster the user's daily biometric proxy footprint (waking HRV, RHR) into discrete, categorical "Recovery States" (e.g., Optimal, Neutral, Depleted).
*   **Natural Downsampling:** Storing a single daily categorical cluster (e.g., "Optimal") instead of minute-by-minute heart rate ledgers naturally compresses the data, making the core SQLite database highly performant.

### C. Specific Model Assignments & Cross-Domain Predictions
*   **Sleep Quality & Mood (XGBoost):** XGBoost is utilized for these targets because it natively handles the complex, non-linear feature interactions (e.g., the threshold where caffeine disrupts deep sleep) and seamlessly manages missing wearable data without aggressive imputation.
*   **Training Readiness (Isolation Forest):** Readiness is uniquely sensitive to acute physiological stressors. An Isolation Forest (anomaly detection) is used to flag when the body enters an "out-of-bounds" state (e.g., sudden HRV drop from illness).
*   **Deriving "Required Sleep":** Rather than predicting sleep duration directly, the ML engine reverse-engineers the XGBoost classifier, mathematically querying: *"What is the minimum sleep duration required tonight to achieve an >85% probability of landing in the 'Optimal' recovery cluster tomorrow?"*
