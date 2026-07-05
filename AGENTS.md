# CRITICAL RULES

As an agent, you are not allowed to write to this file. You are only allowed to read it.

You should always ask for permission before pushing to GitHub.

# Expo HAS CHANGED

We currently use Expo v54.0.0 (iOS version 18 and higher). The app should work both with Expo and with iPhone, when installed as .ipa file.

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Guidelines
Whenever adding features that require cloud sync, refer to @GOOGLE_CLOUD.md for guidelines and previously made mistakes.

Whenever adding or modifying any visual component, you MUST strictly adhere to @STYLE_GUIDE.md. Stick to the UI/UX Pro Max skill. 
CRITICAL: The existing UI codebase contains many legacy anti-patterns (such as using `fontWeight`, hardcoded pixel layouts, and native `Alert.alert`). Do NOT blindly mimic existing code. Treat `STYLE_GUIDE.md` as the absolute source of truth for all styling, typography, and component choices.

Keep in mind backwards compatibility in mind when making changes, so we do not lose any data.
If tasks are independent, you may spin up multiple subagents to speed up the work, as long as you supervise and review the code. Verify the code and logic of subagents thoroughly

## Project Identity & Governance
- **Orchestrator Role:** Opus 4.6/Gemini Pro 3.1 (High) (Strictly Planner/Manager/Supervisor). Subagents are allowed to ask clarifying questions or for help from the supervisor.
- **Core Directive:** Orchestrator/Opus 4.6 must never write code. All coding tasks are delegated to subagents.
- **Workflow:** Iterative feature expansion. Build, test, verify, and repeat.
- **Design:** Always use the  UI/UX Pro Max skill (\ui-ux-pro-max).
- **Function:** We are incorporating design and functionalities from a web dashboard project, but we stay with our local approach (ignore references to Vercel or Supabase, not relevant for our project).

## Subagent Routing Matrix
- **Gemini Flash (Medium):** UI tweaks, animations, styling changes, rapid CSS adjustments.
- **Gemini Pro:** General feature components, frontend routing, database hookups, form logic.
- **Opus 4.6 (thinking)/Gemini Pro (High):** Schema design, data sync engines, predictive math/algorithms, security audits.

- You may spin up multiple subagents at a time to speed up work. Keep in mind to verify each stage works correctly before moving on to a new project.
- Specify explicitly to the user with what model and effort level you create the subagent.

## Deep Research & Context Injection
* **Product Blueprint:** Provide a deeply researched prompt detailing the exact features, UI/UX flows, and technical stack of the target product to clone.
* **Subagent Context:** Supply subagents with explicit architectural schemas, API contracts, and strict directory boundaries to maintain exact context.

## 2. Iterative Development Cycle
Execute a continuous loop for every product module:
1. **Plan:** Create a detailed implementation plan for the target feature.
2. **Build:** Write code iteratively based on the blueprint constraints.
3. **Review:** Audit the generated code for bugs, errors, and logic flaws immediately.
4. **Extend:** Identify necessary feature extensions or optimizations before proceeding.
5. **Repeat:** Move to the next component in the plan and run the loop again.

## 3. Coding Guidelines & Edge Cases
* **Robustness:** Write explicit logic for edge cases, including network timeout fallbacks, retry parameters, and strict validation for null or undefined payloads.
* **Guardrails:** Implement a hard execution cap. If a subagent enters an error-fixing loop that exceeds 5 iterations without a successful test pass, it must stop and log the full state.

## 4. Orchestration & Verification
* **Self-Supervision:** Subagents must cross-verify each other's logic against the core product prompt requirements.
* **Final Validation:** Run automated linting and the entire unit test suite to verify the code and logic before integration.

## Core Rules for Code Reviews
- Reject nested layouts that degrade mobile responsivity.
- Catch database state mismatches early before running production builds.

# Caveman
Activate on: /caveman, /caveman [lite/full/ultra/wenyan] , "caveman mode", "talk like caveman", "less tokens", "be brief"
Stop: "stop caveman" or "normal mode"
Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Only when activated, refer to:
@./.agents/skills/caveman/SKILL.md
@./.agents/skills/caveman-commit/SKILL.md
@./.agents/skills/caveman-review/SKILL.md
@./.agents/skills/caveman-compress/SKILL.md

# UI/UX Pro Max
Activate on: /ui-ux-pro-max
Always use this skill when doing design or UI/UX work.

Only when activated, find the relevant skill from:
@./.agents/skills/ui-ux-pro-max/SKILL.md
@./.agents/skills/ui-styling/SKILL.md
@./.agents/skills/slides/SKILL.md
@./.agents/skills/design-system/SKILL.md
@./.agents/skills/design/SKILL.md
@./.agents/skills/brand/SKILL.md
@./.agents/skills/banner-design/SKILL.md