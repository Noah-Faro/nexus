# NEXUS Design & Style Guide (Hydration Module Baseline)

This document serves as the unified architectural, design, and coding reference for the NEXUS Super-App, grounded directly in the implementation standards of the **Hydration Tracker** module. 

Use this baseline to ensure perfect visual consistency, OLED-first responsiveness, and platform-compliant typography across the entire codebase, including the launcher vault and secondary modules.

---

## 🎨 1. OLED-First Color Palette

All screens employ a premium, ultra-high-contrast **OLED Dark Theme** optimized for battery efficiency and maximum readability in low-light contexts.

### Base Containers
- **Deep Background (`#000000`)**: The base background of all primary views (OLED absolute battery saving).
- **Elevated Surfaces (`#0a0a0a` / `#151515`)**: Modular panels, calendar blocks, and sheet backgrounds (e.g., the base of the `BrewLab` custom drink form and settings card backings).
- **System Card Surface (`#1c1c1e`)**: iOS-native slate gray container for logs lists, metrics readouts, and console logs.
- **Muted Borders (`#222222` / `#111111`)**: Separators, layout grids, and keyboard text inputs (e.g., `CommandPalette` terminal borders).

### Hydration Module Accents
- **Hydration Cyan (`#64d2ff`)**: Primary color for water tracker curves, today target progress rings, and base hydration lines.
- **Caffeine Amber (`#ff9f0a`)**: Highlights active caffeine pooled logs, clearance timescales, and sleep-safe physiological thresholds.
- **Goal Success Green (`#32d74b`)**: Indicates standard log confirmations, daily goal completions, and celebration modals.
- **Warning Red (`#ff453a`)**: Flags high caffeine limits, custom beverage deletions, or database wipe warnings.
- **Text Primary (`#ffffff`)**: Pure white text for headings, numbers, and primary readouts.
- **Text Muted (`#8e8e93`)**: Captions, timestamps, and guidelines (e.g., "12 AM to 12 PM" hour markers).

---

## ✍️ 2. Cross-Platform Typography Hierarchy

NEXUS utilizes the **Outfit** Google Font family. Styles must explicitly bind weight strings directly to `fontFamily` parameters (rather than using generic `fontWeight` declarations) to guarantee exact rendering on Android and iOS devices.

### Primary Screen Titles (Bold - `Outfit_700Bold`)
Used exclusively for the highest-level headings to anchor the view layout.
- **Vault Hub Logo Header**: `fontSize: 42px`, `letterSpacing: 8px` (spaced out "N E X U S").
- **Universal Sheet Titles (`<SheetHeader>`)**: `fontSize: 18px` ("Brew Lab", "New Exercise", "New Template").
- **Sub-App Main Title**: `fontSize: 18px` ("Hydration", "Insights", "History", "Training"). Must be styled with bold Outfit font (`Outfit_700Bold`) and no letter-spacing.
- **Date Heading (`DailyNoteView`)**: `fontSize: 22px` ("Today, May 29").

### Secondary Section & Card Headers (Semi-Bold - `Outfit_600SemiBold`)
Used for structural sections, diagnostic readouts, and text buttons.
- **Module Cards (`NexusVault`)**: `fontSize: 18px` ("Hydration Module", "Training Module").
- **System Status Titles**: `fontSize: 15px` ("System Status").
- **Form Labels & Section Toggles**: `fontSize: 14px` ("DRINK NAME", "ACCENT COLOR", "STANDARD BEVERAGES").
- **Increment Values (`StepperInput`)**: `fontSize: 15px` (numerical values).
- **Synthesized Preset Buttons**: `fontSize: 14px` ("Coffee", "Matcha Latte").

### Body Copy & Metadata (Regular - `Outfit_400Regular` / `theme.typography.sans`)
Used for regular descriptive content, guidelines, and command console feedback.
- **Descriptions & Hints**: `fontSize: 12px - 14px` ("Wine is dehydrating (-0.4x)", "Wipe entire database").
- **Terminal Inputs & Console Code**: `fontSize: 13px - 16px` (e.g., command syntax `/goal 3000`).

---

## 📐 3. Spacing, Borders & Proportional Divider Systems

To retain a polished, state-of-the-art layout, enforce consistent dimensions across all screen panels:

- **Spacing Tokens Scale**:
  - `xs: 4px` (inner stepper button padding, custom slider labels)
  - `sm: 8px` (badge cushions, spacing inside drink preset icons)
  - `md: 16px` (text input padding, default card margins)
  - `lg: 24px` (outer boundary safe margins, large content clusters)
- **Rounded Corners Structure**:
  - `sm: 8px` (button blocks, quick presets cards, console inputs)
  - `md: 12px` (diagnostics boxes, daily notes scrolls)
  - `lg: 18px` (large bottom sheets, sliders)
- **Divider thickness**: Standardized to `StyleSheet.hairlineWidth` colored with `#222222`.

---

## 🧩 4. Core Hydration Tracker UI Patterns

All functional segments must reuse standardized core components rather than repeating custom touch layouts.

### A. Reusable Slide Sheets (`<SheetHeader>`)
Used as the standard top bar inside the floating liquid custom synthesis form (`BrewLabSheet`):
```tsx
import SheetHeader from './SheetHeader';
import { Sparkles } from 'lucide-react-native';

<SheetHeader
  title="Brew Lab"
  onClose={handleClose}
  icon={<Sparkles size={20} color={selectedColor} />}
/>
```

### B. Segmented Controls (`<SegmentedControl>`)
Standardizes tab triggers (Today / Stats / Trends navigation) and Settings parameters (e.g., metric units and activity ranges):
```tsx
import SegmentedControl from './SegmentedControl';

<SegmentedControl
  values={['tracker', 'stats', 'calendar'] as const}
  selectedValue={activeView}
  onChange={onViewChange}
  labels={['Today', 'Stats', 'Trends']}
/>
```

### C. Standard Preset Controls (`<StepperInput>`)
Used for all numeric modifiers (such as standard cup custom volume modifiers and manual target values adjustment):
```tsx
import StepperInput from './StepperInput';

<StepperInput
  value={currentWeight}
  onChange={setCurrentWeight}
  min={30}
  step={1}
/>
```

---

## 🛠️ 5. Interaction & Quality-of-Life Engineering Principles

### 1. Tactile Haptic Feedbacks
- **Action Selection** (Switches, tab adjustments, custom slider dragging): Apply `Haptics.selectionAsync()`.
- **Primary Logging Events** (Tapping preset cards to record 250ml water): Apply `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
- **Intake Goal Reached Success Celebration**: Trigger `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.

### 2. Purity & Order of React Hooks
- **Zero Conditional Hooks**: All React hooks must be declared at the top level of the component and **never** placed after an early return statement (e.g., the loading fonts asset gate).
- **Fallback Loading State**: Use fallbacks (like `settings || DEFAULT_SETTINGS`) to calculate state before the asynchronous launch fetches complete.

### 3. Touch Gesture Target Rules
- Nested `TouchableOpacity` elements will cause gesture conflicts and failure of callbacks on both iOS and Android.
- **Rule**: Map functional controls as sibling blocks inside a shared `View` layout (like the separate card headers and list bodies) rather than wrapping buttons inside buttons.

---

## 🛑 6. Unified Dialogs & Form Actions

To provide a cohesive, premium experience across all NEXUS sub-applications, adhere to these interaction standards:

### A. Reusable Dark Alert Dialogs (`<AppAlertModal>`)
Native OS dialogs (`Alert.alert`) look cheap and clash with the OLED dark theme. **Never use native OS Alerts.** All message notices, warnings, and confirmations must use `<AppAlertModal>`.

- **State Helper Hook Pattern**:
```tsx
const [alertConfig, setAlertConfig] = useState<{
  visible: boolean;
  title: string;
  message: string;
  buttons: AppAlertButton[];
}>({
  visible: false,
  title: '',
  message: '',
  buttons: []
});

const triggerAlert = (title: string, message: string, buttons?: AppAlertButton[]) => {
  setAlertConfig({
    visible: true,
    title,
    message,
    buttons: buttons || [{ text: 'OK', style: 'default' }]
  });
};
```

- **Avoid Modal Layer Conflicts**: Standard sheets and settings components that render inside a separate `<Modal>` context should define and render `AppAlertModal` **locally** within their own modal trees. Standard `View` children should consume `triggerAlert` passed via props from the parent.

### B. Standard Form Action Button Styling
Form triggers and visual actions must maintain absolute color and visual weight consistency:
- **Vault Back Button**: Standardize the back button in sub-app hubs (like `TrainingApp`) to use `ChevronLeft` in `theme.colors.accent` (iOS Blue `#0a84ff`) accompanied by the text `"Vault"` (or `"Back"` for sub-views) in the system accent color.
- **Large Block Buttons (Bottom)**: Modal sheets and settings pages with extensive forms (e.g. `SettingsModal`, `TrainingSettings`, `TemplateEditorSheet`) must place the primary action as a full-width block button in a safe bottom footer layout. The button must use a pure white background (`theme.colors.text`) with black text (`#000000`) and a semi-bold/bold layout.
- **Top Close/Cancel Triggers**: To maximize screen real estate and prevent visual clutter, sheet modal headers can replace text cancellations with a grey close "X" icon (`Trash2`/`X` style) on the **top-left** of the sheet header, colored in `theme.colors.textMuted` (`#8e8e93`).
- **Destructive Deletion Triggers**: All item deletion links and `Trash2` icons (placed on the **top-right** of sheet headers when editing existing entities, or inside list items) must use `theme.colors.accentRed` (`#ff453a`) to signify danger.

### C. Unified Settings Menus & Typography Standards
To maintain complete layout and typographic consistency across all configuration screens:

- **Card-Row Settings Layout**: All settings panels (such as Profile Details and Exercise Defaults) must follow a standard card structure:
  - **Card Container**: Encapsulated within `theme.colors.surfaceElevated` (`#151515`) backgrounds, rounded with `theme.borderRadius.lg` (`18px`), and spaced with `theme.spacing.xl` (`32px`) bottom margins.
  - **Card Header & Title**: Features an uppercase title in `theme.colors.textMuted` styled with `theme.typography.semibold` at `fontSize: 13px` and `letterSpacing: 0.5px`.
  - **Inner Row Padding & Dividers**: Settings rows inside the card are separated by a standard divider (`StyleSheet.hairlineWidth`) using `theme.colors.border` and a left indent matching `theme.spacing.md`.
  - **Accordions & Panels**: Accordion rows rendered inside cards must have a transparent base background (`backgroundColor: 'transparent'`) to integrate seamlessly. The expanded drawer panel must utilize a pure dark surface background (`#0a0a0a`) with a 1px border (`#111111`) to achieve contrast depth.

- **Typographical Bolding Rules**: Custom Google Fonts (e.g. Outfit) on Android can break and fall back to generic system typefaces if combined with a separate `fontWeight` style parameter.
  - **Rule**: Always bind Outfit bold weights directly using their typeface family tokens (**`theme.typography.bold`** or **`theme.typography.semibold`**) directly in `fontFamily` declarations, and completely omit custom `fontWeight` parameters on these style classes.

