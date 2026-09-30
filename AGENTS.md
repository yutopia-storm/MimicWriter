# Codex Project Instructions

## Purpose

This repository contains an AI-native screenplay writing, analysis and rewriting application.

The current working product name is **MimicWriter**.

MimicWriter is a temporary working name and must not be treated as a permanent product identity.

The application is being developed desktop-first, with a hosted/cloud version planned after the desktop application is stable.

---

# Required Project Documentation

Before planning or implementing a development task, read the following files:

1. `PROJECT.md`
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `BUILD_RULES.md`
5. `ROADMAP.md`
6. `DECISIONS.md`

These files form the authoritative architectural and product context for this repository.

---

# Document Responsibilities

## PROJECT.md

Defines what the complete product is intended to become.

It includes features that may not yet exist.

The presence of a feature in `PROJECT.md` does NOT authorise its implementation.

---

## ARCHITECTURE.md

Defines how major systems should interact and records architectural principles that current development must preserve.

---

## DATA_MODEL.md

Defines the conceptual entities and relationships the application must support.

Some entities may be reserved for future implementation.

Do not create every future entity merely because it is documented.

---

## BUILD_RULES.md

Contains mandatory development constraints.

These rules apply to every build unless the user explicitly changes the relevant rule.

---

## ROADMAP.md

Defines development sequencing.

Future phases exist to inform architecture, not to expand the scope of the current task.

---

## DECISIONS.md

Records important product and architectural decisions and the reasoning behind them.

Do not silently reverse these decisions.

If a requested change conflicts with a documented decision, identify the conflict before implementing it.

---

# Scope Rule

The current user request defines the implementation scope.

The project documentation defines the context within which that implementation must operate.

Therefore:

**Future compatibility does not equal current implementation.**

Do not implement speculative features simply because the architecture anticipates them.

---

# Before Every Build

Before changing code:

1. Read this file.
2. Read the relevant project documentation.
3. Inspect the existing implementation.
4. Identify the systems affected by the requested change.
5. Check whether the request conflicts with an existing architectural decision.
6. Determine the smallest implementation that satisfies the request while remaining compatible with the documented architecture.
7. Preserve existing unrelated functionality.

Do not begin by rewriting or replacing existing systems simply because another implementation appears cleaner.

---

# During Every Build

Follow these principles:

- implement only the requested scope;
- preserve existing working functionality;
- avoid unnecessary redesign;
- avoid speculative UI;
- avoid speculative database structures;
- avoid unnecessary dependencies;
- use existing architecture where appropriate;
- maintain backwards compatibility where reasonably possible;
- keep owner-changeable values configurable;
- preserve stable entity identifiers;
- maintain revision safety;
- keep AI providers abstracted from product logic;
- keep storage implementations abstracted from core project logic;
- maintain the ability to use the screenplay editor without AI connectivity.

---

# After Every Build

Before considering a task complete:

1. Test the affected workflow.
2. Test relevant existing workflows for regressions.
3. Confirm that unrelated functionality has not changed.
4. Confirm that owner-changeable values have not been unnecessarily hard-coded.
5. Confirm that the implementation remains compatible with future desktop/cloud architecture.
6. Update project documentation if the task introduced or changed an architectural decision.
7. Update `DECISIONS.md` when a significant architectural decision has been made.
8. Do not alter roadmap status unless the relevant work has actually been completed.

---

# Product Naming Rule

`MimicWriter` is a working product name.

Do not unnecessarily embed:

- MimicWriter
- Mimic Writer
- mimicwriter
- mimic_writer

inside application business logic, database design, project formats or permanent identifiers.

Use configurable brand values.

Internal technical identifiers should be brand-neutral wherever reasonably possible.

The future public product may use an entirely different name.

---

# Configuration Rule

If the application owner could reasonably want to change a product value later, that value should normally be configurable rather than hard-coded.

Examples include:

- product name;
- tagline;
- logos;
- icons;
- colours;
- terminology;
- descriptions;
- onboarding copy;
- information pages;
- feature availability;
- default user settings;
- AI models;
- AI operation defaults;
- AI prompts;
- rewrite options;
- built-in style profiles;
- usage limits;
- backup defaults;
- supported options where technically appropriate.

Security-sensitive secrets are an exception and must use secure credential or environment storage.

---

# AI Rule

AI is an assistant to the writer.

AI must not silently rewrite screenplay content.

Creative AI changes require explicit writer invocation.

Background analysis may occur automatically where designed, but inferred information must not silently become confirmed story canon.

---

# Screenplay Safety Rule

Original imported screenplay content must be preserved.

AI operations must create revisions rather than destructively replacing content.

Locked content and protected beats must be respected.

---

# Development Philosophy

The central architectural principle is:

**Understand globally.  
Retrieve selectively.  
Change locally.  
Preserve explicitly.  
Validate globally.**

Build the system around this principle.

The application should understand the larger screenplay or series while allowing precise, controlled changes to individual scenes.

---

# Final Instruction

When uncertain between:

1. a larger implementation that anticipates many future features; and
2. a smaller implementation that satisfies the current request while preserving future extensibility;

prefer the second.

Do not turn architectural foresight into uncontrolled scope expansion.