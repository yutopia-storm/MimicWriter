# Architecture Specification

## 1. Purpose

This document defines the architectural boundaries and principles of the application.

It describes how major systems should relate.

It does not require every documented subsystem to be implemented immediately.

---

# 2. Architectural Goals

The architecture must support:

- desktop-first development;
- future hosted implementation;
- local-first screenplay editing;
- AI-provider independence;
- structured story intelligence;
- revision safety;
- stable scene identity;
- configurable branding;
- configurable owner settings;
- project portability;
- future expansion without unnecessary rewrites.

---

# 3. Architectural Layers

Conceptually separate the application into:

## Presentation Layer

Responsible for:

- screenplay editor;
- project navigation;
- settings;
- Admin;
- rewrite controls;
- comparisons;
- Project Brain views.

Presentation components should not directly implement storage or AI-provider logic.

---

## Domain/Core Layer

Responsible for product concepts such as:

- projects;
- screenplays;
- episodes;
- scenes;
- revisions;
- characters;
- locations;
- story facts;
- styles;
- rewrite operations.

This should remain as independent as reasonably possible from whether the application is running locally or hosted.

---

## Storage Layer

Responsible for persistence.

Desktop implementation uses local storage.

Future hosted implementation may use server databases/object storage.

Business logic should not assume that filesystem paths are the only possible storage mechanism.

---

## AI Orchestration Layer

Responsible for:

- capability selection;
- context assembly;
- model selection;
- structured responses;
- retries;
- validation;
- usage logging.

Product features should call capabilities rather than provider APIs directly.

---

## Provider Adapter Layer

Responsible for provider-specific AI communication.

Potential adapters:

- OpenAI;
- Anthropic;
- Google;
- future providers.

Provider-specific SDK usage belongs here.

---

## Import/Export Layer

Responsible for:

- Fountain;
- FDX;
- PDF import;
- PDF export;
- native project package;
- future supported formats.

---

## Configuration Layer

Responsible for:

- branding;
- terminology;
- feature flags;
- owner defaults;
- AI configuration;
- prompt templates;
- built-in styles;
- editable content.

---

# 4. Stable Identity

Core entities should use stable unique identifiers.

Scene identity must not depend upon screenplay position.

Display numbering is presentation data.

---

# 5. Scene Architecture

A scene should conceptually contain or reference:

- permanent scene ID;
- screenplay/episode ID;
- order;
- heading;
- structured screenplay elements;
- current revision;
- revision history;
- lock state;
- scene purpose;
- protected beats;
- relevant story threads;
- style overrides;
- AI settings;
- metadata.

Not every field must be implemented immediately.

---

# 6. Screenplay Elements

Screenplay content should be represented structurally rather than as one undifferentiated text field wherever practical.

Potential element types:

- scene heading;
- action;
- character;
- dialogue;
- parenthetical;
- transition;
- dual dialogue;
- page break;
- other supported screenplay semantics.

This structure supports reliable import/export and selective rewriting.

---

# 7. Original vs Working Content

Original imported content must remain distinguishable from current working content.

Revision operations must not destructively replace the only recoverable original.

---

# 8. Revision Architecture

Revisions should be append-oriented.

A revision should be able to record:

- revision ID;
- scene ID;
- source revision;
- content;
- origin;
- timestamp;
- AI operation where applicable;
- relevant settings.

Potential origins:

- import;
- writer edit;
- AI rewrite;
- restore.

---

# 9. Lock Architecture

Scene lock state must be checked by AI transformation operations.

Do not rely solely on disabling a button in the UI.

The domain/service layer should reject unauthorised transformations of locked scenes.

---

# 10. Protected Beat Architecture

Protected beats should reference stable scene/content locations where possible.

AI context construction must include relevant protections.

Post-generation validation should check that required protected material remains represented.

---

# 11. Project Brain Architecture

Project Brain must be structured.

Do not implement project intelligence solely as a large prose summary.

Knowledge should eventually be independently addressable and queryable.

Potential entity groups:

- characters;
- character states;
- relationships;
- locations;
- story facts;
- objects;
- timeline;
- character knowledge;
- story threads;
- project rules;
- scene summaries.

---

# 12. Provenance

AI-extracted knowledge should support provenance.

Where practical, a story fact should be traceable to:

- project;
- screenplay/episode;
- scene;
- source content;
- extraction operation.

---

# 13. Confidence and Status

Where AI interpretation is involved, information should support states such as:

- confirmed;
- inferred;
- possible;
- rejected;
- superseded.

Do not treat AI confidence scores as objective truth.

---

# 14. Character State

Permanent character information and scene-specific/current state should remain distinct.

This prevents temporary conditions from becoming permanent character attributes.

---

# 15. Timeline

Timeline information should not rely solely on screenplay order.

The architecture should eventually support explicit and relative chronology.

---

# 16. Character Knowledge

Knowledge should eventually be representable as time-sensitive state.

The architecture should be capable of distinguishing:

- knows;
- believes;
- suspects;
- falsely believes;
- does not know.

Implementation may be deferred.

---

# 17. AI Capability Interface

Application features should call semantic capabilities.

Conceptual examples:

- analyse screenplay;
- extract project knowledge;
- analyse style;
- rewrite scene;
- enhance atmosphere;
- check continuity;
- analyse character voice;
- query project.

Do not make UI components responsible for constructing provider API requests.

---

# 18. AI Context Assembly

AI operations should use the minimum relevant context necessary for the requested task.

Typical rewrite context may include:

- current scene;
- relevant character information;
- relevant current character state;
- relevant relationships;
- relevant story facts;
- protected beats;
- scene purpose;
- project rules;
- selected style profile;
- transformation settings.

Avoid sending the entire project unnecessarily for every operation.

---

# 19. Global Analysis, Local Transformation

Whole-project analysis and local rewriting are separate concerns.

The system may analyse a complete screenplay globally.

Creative transformation should normally target selected scenes or explicitly selected sequences.

---

# 20. AI Validation

Where appropriate, generation should be followed by validation.

Validation may check:

- protected beats retained;
- names unchanged where required;
- scene purpose retained;
- story outcome retained;
- character knowledge respected;
- locked material untouched;
- textual similarity concerns.

Validation should not silently modify writer content without an explicit workflow.

---

# 21. Style Architecture

Style profiles should be structured data.

A style profile may contain:

- action characteristics;
- dialogue characteristics;
- atmosphere characteristics;
- descriptive metadata;
- source/provenance;
- recommended settings.

Built-in and user-created styles should use compatible concepts.

---

# 22. Deterministic Analysis

Use deterministic code where the characteristic is objectively measurable.

Examples:

- paragraph length;
- sentence length;
- dialogue/action ratio;
- scene count;
- parenthetical frequency;
- scene length;
- word counts.

Use AI for semantic or interpretive analysis.

---

# 23. Storage Abstraction

Core project logic should not depend directly upon filesystem implementation details.

Desktop may use filesystem-backed repositories/services.

Future cloud may use database/object-storage-backed implementations.

The domain model should remain compatible with both.

---

# 24. Desktop Storage

Initial desktop storage must support:

- writer-selected root folder;
- project storage;
- backups;
- exports;
- references where retained;
- recovery.

Write access must be verified during onboarding.

---

# 25. Autosave

Autosave should be resilient and should not block ordinary writing.

The UI should communicate save state.

Potential states:

- Saving;
- Saved;
- Save failed;
- Backup pending.

Exact terminology remains configurable.

---

# 26. Backup Architecture

Backup should be conceptually separate from ordinary save.

A corrupted current project should not automatically destroy every recovery copy.

Future backup mechanisms may include:

- revision history;
- snapshots;
- secondary destination;
- native project package.

---

# 27. Offline Architecture

Ordinary writing and project navigation should not depend on active internet access.

AI operations must fail gracefully when connectivity is unavailable.

---

# 28. API Credentials

Desktop API credentials must be stored through secure platform credential facilities where practical.

Never include raw credentials in:

- logs;
- project exports;
- configuration exports;
- crash reports;
- backup packages.

---

# 29. Configuration Architecture

Configuration should have clear scopes.

Potential scopes:

## System Defaults

Application defaults.

## Owner/Admin Configuration

Product-level configuration controlled by the application owner.

## Project Settings

Settings applying to a particular project.

## User Preferences

Writer-specific preferences.

## Scene Overrides

Scene-specific settings.

More specific scopes may override broader defaults where designed.

---

# 30. Brand Independence

Display branding must resolve through configuration.

Internal domain entities should use stable brand-neutral identifiers.

Renaming the product should not require data-model migration merely because a display name changed.

---

# 31. Terminology Independence

Display terminology should be separated from internal entity names where appropriate.

For example:

Internal key:

`project_brain`

Display label:

`Project Brain`

Later display label:

`Story Bible`

Changing the label should not alter stored project data.

---

# 32. Editable Content

Editable pages should use content records rather than hard-coded page components where appropriate.

A content page may contain:

- stable internal key;
- title;
- body;
- visibility;
- last-updated timestamp.

---

# 33. Prompt Architecture

Prompt templates should eventually be:

- centrally stored;
- versioned;
- associated with capabilities;
- editable by authorised owner/admin controls;
- recoverable.

Prompt text should not be scattered across UI components.

---

# 34. Feature Flags

Feature availability should be centrally controlled.

Flags should be evaluated consistently.

Do not create multiple unrelated booleans for the same feature throughout the codebase.

---

# 35. Native Project Portability

Project export/import should eventually allow movement between desktop and hosted implementations.

The portable representation should use versioned schemas.

Project files should record a schema version.

---

# 36. Schema Migration

Persisted project formats and databases must support explicit migration.

Do not silently reinterpret incompatible old data.

Migration should preserve writer work.

---

# 37. Logging

Logs should assist debugging without leaking screenplay content or secrets unnecessarily.

Avoid recording:

- API keys;
- full screenplay text;
- sensitive credentials.

AI usage metrics should be separable from creative content.

---

# 38. Error Handling

Failure of:

- AI provider;
- backup destination;
- export;
- reference analysis;
- network connectivity;

must not unnecessarily crash or corrupt the active screenplay.

---

# 39. Future Cloud Architecture

The hosted product will require additional systems including:

- authentication;
- authorisation;
- server persistence;
- managed AI;
- billing;
- usage allowances;
- recovery;
- account deletion;
- server-side privacy controls.

These concerns should be anticipated but not implemented during desktop development unless explicitly required.

---

# 40. Architectural Test

When introducing a new feature, ask:

1. Does this preserve stable scene identity?
2. Does this preserve revision history?
3. Does this introduce unnecessary provider coupling?
4. Does this introduce unnecessary storage coupling?
5. Does this hard-code owner-changeable values?
6. Does this compromise offline editing?
7. Does this make future cloud implementation unnecessarily difficult?
8. Does this silently give AI authority the writer should retain?

If so, reconsider the implementation.
## Implemented story timeline boundary (Build 002)

The project repository exposes one versioned story record alongside the existing screenplays. Shared domain queries combine chronology, plots, character roles and locations; Master, Plot, Character and Combined views are projections of that record. Scene-card metadata modals update stable-ID relationships without editing screenplay text or order. Persistence and backup behavior are documented in ADR-054.

Scene metadata now supports writer-authorized deterministic defaults from character cues, clear action introductions, headings and full-screenplay pagination, with source provenance and manual override protection (ADR-055). This extraction remains storage-neutral and offline; no AI service is involved.

### Contextual profile boundary

The story refinement replaces permanent metadata/filter matrices with searchable relationships and inherited event context. Shared domain queries power List/Tracks, entity indexes, quick cards, profiles and one right inspector. Screenplay editing remains mounted and authoritative. Profile controls are application overlays, not document nodes. The existing story autosave and storage adapter are the only persistence route for metadata; images use a shared project asset adapter, and presentation settings use UserPreferences. See ADR-057/058 for legacy compatibility and ownership rules.

The right story inspector is permanently available as a collapsed rail and expands into scoped story indexes or an individual InspectorContext. Scope derives from existing scene, screenplay, episode and season identities. Relationship reciprocity, family modifiers, in-law projections and discovery visibility are deterministic domain queries over writer-authored relationship records; derived family links are never persisted as duplicate canon.

Event, Plot and Scene views share one indexed relationship projection. Event `plotIds` own Event-to-Plot membership; Event occurrence, reveal and reference fields own Event-to-Scene membership; Scene `plotIds` retain only writer-authored additional Plot associations. Effective Scene Plots are the deduplicated union of explicit Scene links and Plots on Events that occur in or are revealed in the Scene. References do not contribute Plot membership. The projection cache is keyed by immutable StoryRecord snapshots, so Timeline, Plot Tracks, entity profiles and the right Inspector resolve the same links without scanning the whole model for each displayed row or persisting reverse copies.

Timeline scene projections and automatic Location extraction share the scene-heading parser. Only explicit headings with a meaningful location enter those projections; token-only or incomplete headings remain editable screenplay content and retain their IDs and metadata. Character Quick Cards and margin notes are fixed/absolute application overlays outside document flow. Quick Cards use a fixed display anchor, while margin notes calculate their horizontal anchor from the physical page boundary rather than from the formatted screenplay element.
