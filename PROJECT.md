# Project Specification

## Working Name

**MimicWriter**

This is a temporary working name.

Brand identity must remain configurable so that the application can be renamed without significant code changes, database restructuring or project-file migration.

---

# Core Reference Style Workflow

A central capability of the product is allowing a writer to use another screenplay as a stylistic reference for their own screenplay.

The intended workflow is:

1. The writer creates or imports their own screenplay.
2. The writer uploads one or more separate screenplays as style references.
3. The application analyses the reference screenplay's stylistic characteristics.
4. The analysis is converted into structured Style DNA / a Style Profile.
5. The writer selects a scene or permitted selection from their own screenplay.
6. The writer chooses the reference Style Profile and the desired level of influence.
7. The writer chooses which aspects may be transformed, such as:
   - action;
   - dialogue;
   - prose;
   - atmosphere;
   - description;
   - tension;
   - pacing;
   - dialogue rhythm.
8. The application combines:
   - the writer's original scene;
   - relevant project/story context;
   - relevant character information;
   - protected beats;
   - preservation requirements;
   - the selected reference Style Profile;
   - the writer's transformation settings.
9. AI produces a proposed revision influenced by the stylistic characteristics of the reference screenplay.
10. The writer compares the proposed revision with the source version.
11. The writer may:
   - accept;
   - reject;
   - edit;
   - regenerate;
   - change settings and retry.
12. Accepted transformations become revisions and never destroy the recoverable source material.

The objective is to reproduce relevant **stylistic characteristics and techniques**, not to copy phrases, dialogue, scenes, characters, story content or other expressive material from the reference screenplay.

Reference material informs **how the writer's own material is expressed**.

The writer's screenplay remains the source of:

- story;
- characters;
- plot;
- dramatic intention;
- established facts;
- character knowledge;
- protected details.

The reference screenplay primarily informs stylistic characteristics.

The architecture must therefore distinguish clearly between:

**Source Screenplay**
The writer's screenplay being written or transformed.

and

**Reference Screenplay**
A screenplay supplied for stylistic analysis.

A reference screenplay must never accidentally be imported into the writer's project as story canon.

## Reference Style Strength

The writer should be able to control how strongly the selected reference style influences a transformation.

The exact interface remains configurable, but may support values such as:

- Light;
- Medium;
- Strong;

or a more granular influence control.

Style influence must remain separate from preservation controls.

A strong style influence must not automatically grant permission to change protected story information.

## Multiple Reference Screenplays

The architecture should support future use of multiple reference screenplays.

Potential workflows include:

- analysing several screenplays to identify common stylistic characteristics;
- creating a Style Profile from multiple references;
- blending multiple Style Profiles;
- assigning different reference styles to different transformation dimensions.

Multiple-reference functionality does not need to be implemented until required by the roadmap.

## Saved Reference Styles

Once a reference screenplay has been analysed, the resulting Style Profile should be capable of being saved for reuse.

The writer should not have to upload and analyse the same reference screenplay every time they rewrite another scene.

The system should distinguish the derived Style Profile from the original reference file so that the original file can potentially be removed while the permitted derived analysis remains available.

## Reference Analysis Without Rewriting

Writers should also be able to analyse a reference screenplay without immediately transforming their own work.

The Style Engine may show characteristics such as:

- action density;
- paragraph length;
- sentence rhythm;
- dialogue length;
- dialogue fragmentation;
- use of interruptions;
- description density;
- sensory detail;
- environmental activity;
- humour;
- profanity;
- exposition patterns;
- pacing characteristics.

This allows the Style Engine to function as an analytical tool as well as a rewriting tool.

# 1. Product Vision

MimicWriter is an AI-native screenplay writing, analysis, rewriting and story-intelligence environment.

It is not merely an AI screenplay generator.

The application should allow professional and developing screenwriters to write normally while selectively using AI to analyse, understand, improve and transform their own work.

The writer remains the creative authority.

The application should progressively understand the screenplay, characters, relationships, locations, timeline, style and story state as the project develops.

For television projects, this understanding should continue across episodes.

The long-term goal is for the application to function simultaneously as:

- a professional screenplay editor;
- an intelligent screenplay analysis environment;
- a controlled AI rewriting system;
- a living series/project bible;
- a continuity assistant;
- a style-analysis system;
- a revision and version-management system.

---

# 2. Core Philosophy

The central design principle is:

**Understand globally.  
Retrieve selectively.  
Change locally.  
Preserve explicitly.  
Validate globally.**

The AI may understand an entire screenplay or series, but transformations should normally operate on specific scenes or explicitly selected material.

This reduces unintended changes and gives the writer control.

---

# 3. Desktop First

The first commercial implementation is a desktop application.

Desktop users will:

- install the application;
- select a local project storage location;
- optionally select a cloud-synchronised folder;
- provide their own supported AI API credentials;
- retain direct control of their screenplay files;
- write without requiring continuous AI connectivity.

The desktop application must become stable before the hosted version is released to writers who do not want to configure AI providers themselves.

---

# 4. Future Hosted Version

A hosted/browser version is planned.

The hosted version should eventually provide:

- accounts;
- browser-based screenplay editing;
- server project storage;
- managed AI infrastructure;
- subscriptions;
- AI usage allowances or credits;
- server recovery systems;
- downloadable independent backups.

The desktop and hosted products should share compatible project concepts, data structures and core intelligence.

Do not architect the desktop application in a way that unnecessarily prevents future hosted implementation.

However, do not build hosted functionality until the roadmap requires it.

---

# 5. Project Types

The system must support at minimum:

## Feature Project

Project  
→ Screenplay  
→ Scenes  
→ Elements  
→ Revisions

## Series Project

Project  
→ Series  
→ Pilot/Episodes  
→ Scenes  
→ Elements  
→ Revisions

A series project must be able to retain knowledge established in earlier episodes and make that knowledge available to later episodes.

---

# 6. Scene as Fundamental Unit

The scene is the fundamental creative and revision unit.

Every scene requires a permanent internal identifier independent of:

- scene number;
- screenplay order;
- heading;
- location;
- episode position.

Moving a scene must not break:

- revision history;
- Project Brain references;
- notes;
- protected beats;
- continuity references;
- AI analysis.

---

# 7. Screenplay Creation

Writers must eventually be able to:

- create a screenplay from scratch;
- create scenes sequentially;
- edit existing scenes;
- reorder scenes;
- delete scenes safely;
- restore relevant previous versions;
- work in scene view;
- work in continuous screenplay view;
- create episodes within a series;
- compile the project into a complete screenplay.

AI must not be required simply to type or edit a screenplay.

---

# 8. Screenplay Import

The application should ultimately support:

- Fountain;
- FDX;
- PDF.

FDX and Fountain should be treated as structurally preferable sources where available.

PDF import requires screenplay structure detection.

The import system should identify elements including:

- scene headings;
- action;
- character cues;
- dialogue;
- parentheticals;
- transitions;
- dual dialogue where possible;
- page breaks;
- title-page information.

PDF imports should allow the writer to review detected structure before accepting the import.

Example:

**84 scenes detected. Review import.**

The application must not assume that every PDF was parsed perfectly.

---

# 9. Screenplay Export

The application should ultimately support:

- Fountain;
- FDX;
- PDF;
- native project backup/export.

Exported screenplay files should follow professional screenplay formatting expectations.

---

# 10. Native Project Format

A native project backup format should eventually exist.

Working extension:

`.mimicwriter`

The extension is provisional because the product name is provisional.

The underlying format must not fundamentally depend on the public product name.

The native project backup should be capable of preserving more than the screenplay text.

It should eventually include:

- project structure;
- screenplays;
- episodes;
- scenes;
- revisions;
- characters;
- locations;
- relationships;
- story facts;
- timeline;
- protected beats;
- scene purposes;
- project rules;
- style profiles;
- AI-derived structured information;
- relevant user settings.

---

# 11. Original Material

Imported original screenplay material must remain recoverable.

The system must distinguish between:

- original imported content;
- writer edits;
- AI-generated revisions;
- restored revisions;
- current working content.

AI should never silently overwrite the only copy of existing material.

---

# 12. Scene Status

Scenes should eventually support states including:

- untouched;
- modified;
- locked.

A locked scene is considered protected from AI transformation unless the writer explicitly unlocks it.

Scene locking must not prevent ordinary reading, compilation or export.

---

# 13. Revision System

Every meaningful screenplay change should be compatible with revision history.

AI operations must create revisions.

Writers should ultimately be able to:

- compare revisions;
- compare original with current;
- compare AI result with source;
- accept AI changes;
- reject AI changes;
- restore previous versions.

The system should support rewriting either:

- the original scene; or
- the current working version.

This prevents repeated AI transformation from unintentionally drifting further from the writer's original scene.

---

# 14. Protected Beats

Writers should eventually be able to mark important material as protected.

Examples:

- a visual behaviour;
- a specific prop interaction;
- a line;
- a reveal;
- an action;
- a story beat.

AI rewrites must preserve protected beats unless the writer explicitly removes protection.

Protected material may exist at:

- scene level;
- character level;
- project level.

---

# 15. Scene Purpose

Scenes may have a writer-defined dramatic purpose.

AI may suggest scene purposes, but the writer remains authoritative.

Rewrites should preserve the declared scene purpose unless explicitly instructed otherwise.

Future analysis may warn when a rewrite appears to weaken or contradict that purpose.

---

# 16. Rewrite Engine

The application should provide controlled AI transformation rather than a single generic "rewrite" button.

Potential transformation targets include:

- action;
- dialogue;
- action and dialogue;
- atmosphere;
- prose;
- description;
- tension;
- pacing;
- dialogue rhythm;
- humour;
- custom instruction.

The architecture must allow transformation controls to evolve without requiring fundamental rewrites of the application.

---

# 17. Rewrite Intensity

Transformation dimensions should support configurable intensity where appropriate.

Examples:

- Off;
- Light;
- Medium;
- Strong.

These values must not be unnecessarily hard-coded.

---

# 18. Rewrite Modes

The application should eventually support concepts such as:

## Additive

Preserve existing material and enrich around it.

## Balanced

Rewrite where useful while retaining meaningful existing beats.

## Transformative

Allow more extensive reconstruction while preserving required story information and explicit protections.

---

# 19. Preservation Controls

AI transformations should be capable of preserving:

- plot outcome;
- scene purpose;
- character intention;
- established facts;
- character knowledge;
- dialogue meaning;
- important behaviour;
- protected beats;
- character names;
- story continuity.

The writer should have clear control over what the AI is permitted to change.

---

# 20. Atmosphere

Atmosphere is a distinct transformation dimension.

Atmosphere should not merely add generic description.

It should identify environmental, sensory, object and background details capable of strengthening the existing dramatic purpose.

Core principle:

**Atmosphere should not merely describe the location. It should describe the location through what matters to the scene.**

Atmosphere may use:

- sound;
- environmental behaviour;
- objects;
- weather;
- sensory information;
- background characters;
- location-specific activity;
- character-filtered observation.

An atmosphere-only operation should be capable of following a rule such as:

**Do not compress. Do not restructure. Do not alter dialogue. Do not remove existing visual behaviour. Enrich the scene's atmosphere using the selected stylistic characteristics.**

---

# 21. Atmosphere Perspective

Atmosphere should eventually support perspective controls:

## Story

Environmental detail serves the dramatic situation.

## Character

Environmental detail is selected according to what a particular character notices, values, fears or is affected by.

## Both

Environmental detail serves both the dramatic situation and the selected character's perception.

---

# 22. Character Lens

Characters should be capable of having structured perception and behaviour profiles.

Potential Character Lens information includes:

- perception;
- sensitivities;
- attention biases;
- behaviour;
- worldview;
- professional knowledge;
- habits;
- relevant preferences.

Example principle:

A chef may notice ruined expensive food.

A locksmith may notice damage to a lock.

A detective may notice someone's hands.

The reference style determines **how** something is written.

Character and story context help determine **what deserves attention**.

---

# 23. Character State

Permanent character information must be distinguishable from temporary state.

For example:

Permanent:

- vegan;
- noise-sensitive;
- relationship to another character.

Temporary:

- injured;
- intoxicated;
- frightened;
- missing medication;
- currently suspicious of another character.

Temporary state may change from scene to scene.

---

# 24. Style Engine

The application should eventually support a structured Style Engine.

Writers may:

- choose built-in styles;
- upload reference screenplays;
- analyse their own writing;
- create custom styles;
- save styles;
- apply styles at project or scene level;
- potentially combine styles later.

The system should analyse style rather than simply imitate source text.

---

# 25. Style DNA

Style analysis may include structured measurements and observations.

## Action

Potential dimensions include:

- paragraph length;
- sentence length;
- fragments;
- complete sentences;
- density;
- whitespace;
- verbs;
- description density;
- camera language;
- rhythm;
- humour;
- profanity;
- interiority;
- metaphor/simile;
- character names within action.

## Dialogue

Potential dimensions include:

- average speech length;
- interruptions;
- fragments;
- questions;
- repetition;
- directness;
- subtext;
- pauses;
- ellipses;
- profanity;
- exposition density;
- character differentiation.

## Atmosphere

Potential dimensions include:

- sensory density;
- environmental activity;
- background behaviour;
- sound;
- weather;
- object use;
- location specificity;
- character-filtered observation.

Where a characteristic can be measured deterministically, deterministic code should be preferred over asking AI to guess.

---

# 26. Reference Screenplays

Writers may upload reference screenplays for style analysis.

The system should extract structured stylistic characteristics rather than depend on reproducing source wording.

Reference screenplay text should not be unnecessarily retained after analysis where product functionality does not require it.

The architecture should support privacy-conscious handling of reference material.

---

# 27. Built-In Styles

The application may provide built-in style profiles.

These should be stored as configurable data rather than hard-coded application behaviour.

Examples might include descriptive profiles such as:

- Investigative Procedural;
- Sparse British Drama;
- Naturalistic Crime Drama;
- Rapid Workplace Comedy;
- Literary Psychological Thriller.

Built-in styles should be editable, enableable and disableable through owner/admin configuration.

---

# 28. User Writing Style

The application should eventually be capable of analysing a writer's own work and creating a profile representing their existing writing tendencies.

This allows reference influence to be blended with preservation of the writer's own voice.

---

# 29. Project Style

A project may have a default style profile.

Series projects should be capable of maintaining stylistic consistency across episodes.

Individual scenes may override project defaults where appropriate.

---

# 30. Project Brain

A major long-term differentiator is the **Project Brain**.

"Project Brain" is working terminology and must be configurable.

The Project Brain is structured story knowledge extracted from and confirmed against the screenplay.

Potential information includes:

- characters;
- character states;
- locations;
- relationships;
- story facts;
- objects;
- timeline;
- unresolved information;
- story threads;
- scene summaries;
- character knowledge;
- project rules;
- protected beats;
- scene purposes;
- style information.

It must not be implemented as one giant unstructured AI summary.

---

# 31. Canon and Inference

AI must not silently decide story canon.

Structured knowledge should distinguish where appropriate:

- confirmed fact;
- writer rule;
- AI inference;
- possible interpretation;
- current state.

Information should retain provenance where practical.

Example:

**Zider is vegan.**

Source:
Episode 3, Scene 17.

Reinforced:
Episode 5, Scene 22.

Status:
Confirmed.

---

# 32. Timeline

Timeline should eventually become a first-class story system.

Potential information:

- story date;
- story day;
- time of day;
- duration;
- event ordering;
- before/after relationships;
- character state at particular times.

The system must not assume screenplay order always equals chronological story order.

---

# 33. Character Knowledge

The system should eventually track what characters know, believe, suspect or misunderstand.

This may support questions such as:

- When did Apple learn about Peter?
- Who currently knows Peter did not kill himself?
- Does this character know information used in this line?
- Is this reveal premature?

Character knowledge should be time-sensitive rather than treated as one permanent list.

---

# 34. Character Voice

Future Character Voice analysis may learn patterns including:

- speech length;
- vocabulary;
- sentence completeness;
- humour;
- evasiveness;
- repetition;
- questions;
- profanity;
- directness;
- conversational habits;
- subjects avoided.

The system may later identify possible voice drift.

It must not treat statistical difference as proof that dialogue is wrong.

---

# 35. Relationship Intelligence

Character relationships may develop distinct interaction patterns.

Future analysis may track:

- interruption patterns;
- affection;
- hostility;
- shared references;
- humour;
- exposition;
- conversational dominance;
- indirect communication.

A character's voice may change depending on whom they are speaking to.

---

# 36. Story Threads

Future functionality should allow scenes to be associated with story threads.

Examples:

- investigation;
- relationship;
- disappearance;
- murder;
- family conflict.

Writers should eventually be able to view scenes associated with a particular thread.

---

# 37. Setup and Payoff

Future analysis may identify potential setups and payoffs.

The writer should remain able to classify something as:

- Setup;
- Payoff;
- Motif;
- Incidental.

AI suggestions must not automatically become canon.

---

# 38. Character Journey

The application may eventually allow writers to view all scenes relevant to a particular character in sequence.

Analysis should focus on progression and contradiction rather than simplistic numeric scoring.

---

# 39. Project Rules

Projects should eventually support explicit creative rules.

Examples:

- non-supernatural;
- keep supernatural explanations ambiguous;
- low-production requirements;
- police do not solve everything;
- particular story information must remain unresolved.

AI operations should respect these rules.

---

# 40. Change Setting

A future Change Setting operation should not simply replace one scene heading with another.

Before suggesting or applying a new setting, the system should consider the dramatic requirements of the original location, including:

- privacy;
- interruptions;
- overheard information;
- cast;
- time of day;
- physical actions;
- production implications.

The replacement location should preserve required dramatic functionality unless the writer permits story changes.

---

# 41. Change Impact

When a writer changes established information, future functionality may identify later scenes potentially affected by the change.

The system should assist rather than automatically rewrite every dependent scene.

---

# 42. Draft Comparison

The application should eventually compare screenplay drafts.

Comparison may include:

- textual changes;
- scene changes;
- character changes;
- story changes;
- location changes;
- continuity implications.

---

# 43. Notes

Future notes functionality may support:

- writer notes;
- producer notes;
- network notes;
- general notes.

Notes may attach to:

- project;
- screenplay;
- episode;
- scene;
- character;
- story thread.

AI may later help identify which scenes relate to a note.

---

# 44. Ask Project

A future project-aware query interface should allow writers to interrogate their own screenplay knowledge.

Example questions:

- When did Apple first learn about Peter?
- Show every Zider/Jessica scene.
- Has Zider met Harvey?
- Where was Zider's noise sensitivity established?
- Which scenes occur at the Old Chain Pier?
- Does anything establish how Apple knows this?

Answers should link to relevant scenes and evidence where possible.

This should operate against structured project knowledge and relevant screenplay retrieval rather than relying on generic conversational memory.

---

# 45. Production Awareness

Future functionality may optionally consider production implications.

Potential modes:

- No production changes;
- Low-budget conscious;
- Unrestricted.

Potential warnings:

- new location introduced;
- new speaking character introduced;
- vehicle required;
- crowd required;
- production complexity increased.

This is advisory, not authoritative.

---

# 46. Writing Mode

Writers must be able to write without AI constantly interrupting them.

A clean Writing Mode should prioritise screenplay composition.

Background systems may update structured project information where appropriate, but creative AI operations should occur only when invoked.

---

# 47. AI Provider Architecture

The product must not be tightly coupled to one AI provider.

Potential providers include:

- OpenAI;
- Anthropic;
- Google;
- future providers.

Application logic should call product capabilities rather than directly scattering provider calls throughout the codebase.

Conceptual capabilities may include:

- `analyseScreenplay()`
- `extractCanon()`
- `analyseStyle()`
- `rewriteScene()`
- `enhanceAtmosphere()`
- `checkContinuity()`
- `analyseCharacterVoice()`
- `queryProject()`

Provider adapters should implement supported capabilities.

---

# 48. AI Model Strategy

Different operations may use different model tiers.

Potential categories:

## Lower-cost operations

- extraction;
- classification;
- metadata;
- simple continuity checks;
- Project Brain updates.

## Mid-level operations

- Style DNA;
- character analysis;
- atmosphere enhancement;
- routine rewriting.

## Higher-capability operations

- sophisticated dialogue/prose transformation;
- complex screenplay reasoning;
- final continuity analysis.

Model assignments must be configurable.

---

# 49. AI Usage Measurement

Every AI operation should eventually be measurable.

Potential recorded information:

- operation type;
- provider;
- model;
- input tokens;
- output tokens;
- cached tokens where available;
- estimated or actual API cost;
- project;
- timestamp.

This is important for understanding eventual hosted-service economics.

Do not record sensitive screenplay content in usage logs unless specifically required.

---

# 50. Desktop AI Credentials

Desktop users provide their own supported API credentials.

Credentials must use secure operating-system credential storage where possible.

Do not store raw API keys in:

- project files;
- exported configuration;
- ordinary logs;
- plaintext settings files.

---

# 51. AI Failure

The application must remain usable as a screenplay editor when AI is unavailable.

Writers should still be able to:

- write;
- edit;
- navigate;
- reorder;
- compile;
- export;
- view existing structured information;
- access revisions;
- back up projects.

AI functionality may indicate that connectivity or credentials are unavailable.

---

# 52. Local Storage

Desktop users must choose a writable storage location during initial setup before creating or importing projects.

The application should verify that the location is usable.

Potential structure:

MimicWriter/
- Projects/
- Backups/
- Exports/
- References/

These visible names should ultimately use configurable branding where appropriate.

---

# 53. Cloud-Synchronised Folders

Writers may choose a folder already synchronised by services such as:

- OneDrive;
- Dropbox;
- Google Drive;
- iCloud;
- other filesystem-based synchronisation.

The application should write ordinary local files and not unnecessarily depend upon a specific cloud provider.

Cloud-sync conflict behaviour must be considered carefully.

---

# 54. Backups

The principle is:

**The application should never intentionally maintain only one recoverable copy of important writing.**

Desktop should eventually support:

- autosave;
- revision history;
- automatic backups;
- recovery snapshots;
- optional separate backup destination.

Backup behaviour and frequency should be configurable.

---

# 55. Hosted Backup Responsibility

The future hosted version should provide server-side recovery while also encouraging writers to maintain independent backups.

Potential future prompts:

**Your project has not been backed up locally for 9 days.**

Writers should be able to download complete project backups.

The product should clearly communicate that writers remain responsible for maintaining independent copies of important work.

---

# 56. Offline Behaviour

Desktop architecture should support local-first writing.

Loss of internet connectivity must not prevent ordinary screenplay editing.

AI-dependent functionality may wait for connectivity.

---

# 57. Privacy

Unpublished screenplays are sensitive intellectual property.

The product should minimise unnecessary transmission and retention.

Hosted architecture must eventually consider:

- encrypted transport;
- private storage;
- access control;
- deletion;
- backup retention;
- AI-provider processing;
- user consent;
- data retention.

Customer scripts must not be used to train proprietary models without explicit consent.

---

# 58. Branding

The current name is provisional.

Brand configuration should eventually support:

- product name;
- short name;
- company/developer name;
- tagline;
- short description;
- long description;
- logo;
- compact logo;
- application icon;
- favicon where relevant;
- splash assets;
- colours;
- typography;
- terminology.

Changing the brand should not require hunting through application source code.

---

# 59. Terminology

Important product terminology should be configurable where practical.

Examples:

- Project Brain;
- Style DNA;
- Lock Scene;
- Rewrite;
- Project;
- AI Credits.

Terminology configuration must not compromise internal data integrity.

Stable internal identifiers should remain independent from display labels.

---

# 60. Editable Content

Information and help content likely to change should be editable through owner/admin functionality.

Potential pages:

- Welcome;
- Getting Started;
- About;
- How It Works;
- AI & Privacy;
- Backups;
- Help;
- Keyboard Shortcuts;
- Terms;
- Privacy;
- Licence;
- What's New;
- Support.

Content should not be unnecessarily hard-coded into application components.

---

# 61. Owner/Admin Configuration

Owner/admin controls should eventually manage appropriate changeable product values.

Potential sections:

- Brand;
- Terminology;
- Features;
- AI Providers;
- AI Models;
- AI Operations;
- Prompt Templates;
- Built-In Styles;
- Defaults;
- Backup Defaults;
- Content Pages;
- Import/Export Settings;
- Limits;
- Diagnostics;
- Trial/licensing configuration;
- future hosted subscription settings.

Admin configuration should not expose secrets insecurely.

---

# 62. AI Prompt Management

Important AI instructions should eventually be stored as versioned configuration.

Potential prompt categories:

- screenplay analysis;
- Project Brain extraction;
- scene rewrite;
- atmosphere rewrite;
- style analysis;
- character analysis;
- continuity;
- character voice;
- project querying.

Prompt versions should be recoverable so that degraded behaviour can be reverted.

---

# 63. Feature Flags

Features should be capable of being enabled or disabled without deleting implementation.

This is particularly important during development and beta testing.

Feature flags should not be used as a substitute for proper access control or security.

---

# 64. Configuration Portability

Non-secret application configuration should eventually be exportable and restorable.

Configuration exports must never include:

- API secrets;
- encryption keys;
- signing secrets;
- database credentials;
- sensitive authentication information.

---

# 65. Commercial Model

The likely commercial direction is:

## Desktop

- downloadable application;
- writer provides AI API credentials;
- licence purchase or equivalent commercial model.

## Hosted

- subscription;
- managed AI;
- usage allowance/credits;
- optional additional usage purchase.

The final pricing model remains undecided and must not be unnecessarily embedded into core architecture.

---

# 66. Trial

A future hosted trial may be constrained by both:

- time;
- usage.

Trial configuration must remain changeable.

Do not assume a permanent 30-day trial in application logic.

---

# 67. Licensing

Desktop licensing should eventually use proper licence/activation mechanisms.

Do not rely on one universal unlock code.

Potential future requirements include:

- licence generation;
- limited device activation;
- periodic verification;
- offline grace periods.

Exact licensing architecture remains a future decision.

---

# 68. Simple and Advanced Controls

The rewrite interface should ultimately avoid overwhelming writers.

A Simple Mode may expose common creative goals.

An Advanced Mode may expose granular controls.

Do not require ordinary writers to understand model parameters or prompt engineering.

---

# 69. User Presets

Writers may eventually save reusable rewrite configurations.

Examples:

- character-specific scenes;
- investigation scenes;
- relationship scenes;
- personal transformation presets.

Presets should reference stable configuration values rather than duplicate implementation logic.

---

# 70. Design Principle

The interface should remain screenplay-first.

AI functionality should support the writing rather than dominate the screen.

The application should feel like professional writing software with intelligence built into it, not a chatbot with a screenplay attached.

---

# 71. Non-Goals

The product should not:

- silently write entire projects without writer control;
- silently alter screenplay canon;
- silently rewrite locked scenes;
- require AI connectivity for basic editing;
- trap writers inside a proprietary format;
- depend permanently on one AI provider;
- hard-code temporary branding throughout the application;
- implement every possible future feature during early development.

---

# 72. Development Principle

Future capabilities documented here exist so current architecture can accommodate them.

They do not define current build scope.

The roadmap and current task determine what is implemented now.