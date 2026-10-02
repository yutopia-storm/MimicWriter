Architectural Decision Record

This document records significant product and architecture decisions.

Do not remove historical decisions when they are superseded.

Mark them as superseded and record the replacement decision.

ADR-001: Desktop First

Decision

The first product implementation will be a desktop application.

Reason

This allows development and testing of the core screenplay environment without immediately requiring hosted accounts, billing, managed AI costs and server infrastructure.

Desktop users can supply their own AI API credentials.

Future

A hosted version is planned after desktop stability.

ADR-002: Future Hosted Version

Decision

Desktop architecture should not unnecessarily prevent a future hosted version.

Reason

Both products should share project concepts and intelligence rather than becoming unrelated applications.

Constraint

Future hosted requirements do not justify implementing cloud infrastructure during early desktop development.

ADR-003: Working Brand

Decision

MimicWriter is a temporary working name.

Reason

The final commercial brand has not been selected.

Consequence

Brand values must be configurable and should not be unnecessarily embedded in permanent application logic or data structures.

ADR-004: Owner-Changeable Values Are Soft-Coded

Decision

Product values the owner may reasonably need to change should normally be configurable.

Includes

branding;

terminology;

prompts;

styles;

defaults;

feature availability;

editable content;

appropriate limits.

Exception

Security-sensitive values use secure secret storage.

ADR-005: Editable Product Pages

Decision

Informational pages likely to change should be editable through owner/admin functionality rather than hard-coded.

Reason

Product copy, help information, privacy information and onboarding will evolve.

ADR-006: Scene Is Fundamental Creative Unit

Decision

The scene is the primary unit for screenplay transformation and revision.

Reason

This gives writers precise control while allowing global screenplay understanding.

ADR-007: Stable Scene Identity

Decision

Every scene receives a permanent stable identifier independent of order or scene number.

Reason

Reordering scenes must not break revisions, story knowledge, notes or AI references.

ADR-008: Global Understanding, Local Transformation

Decision

The system may analyse complete screenplays or projects globally, but creative transformations normally operate on selected scenes or explicitly selected sequences.

Reason

This reduces unintended changes and increases writer control.

ADR-009: Original Material Is Recoverable

Decision

Imported original screenplay content must remain recoverable.

Reason

AI and subsequent edits must not destroy the writer's source material.

ADR-010: Revision-Based AI Changes

Decision

AI transformations create revisions.

Reason

Writers need comparison, rejection and restoration.

ADR-011: Scene Locking

Decision

Writers can lock scenes against AI transformation.

Reason

Completed scenes should not be unintentionally changed by later operations.

ADR-012: Protected Beats

Decision

Writers should be able to explicitly protect important material within scenes.

Reason

A rewrite may improve prose while accidentally removing a small but important behaviour, object or story beat.

ADR-013: Writer Retains Creative Authority

Decision

AI assists but does not silently take creative authority.

Consequence

Creative AI operations require explicit invocation.

AI inference does not automatically become confirmed canon.

ADR-014: Project Brain Is Structured

Decision

Project intelligence should be stored as structured, queryable information rather than one giant AI-generated summary.

Reason

Continuity, character knowledge, provenance and future querying require addressable information.

ADR-015: Canon and Inference Are Distinct

Decision

The system should distinguish confirmed facts from AI inference and possible interpretation.

Reason

AI interpretation is not authoritative screenplay canon.

ADR-016: Provenance Matters

Decision

Story knowledge should retain source provenance where practical.

Reason

Writers should be able to understand why the system believes something is true.

ADR-017: Character Permanent State and Current State Are Distinct

Decision

Permanent character traits must be separated from changing conditions.

Reason

Temporary states such as injury, intoxication or suspicion must not become permanent character attributes.

ADR-018: Style Analysis Rather Than Text Copying

Decision

Reference screenplays are used to derive structured stylistic characteristics.

Reason

The goal is controlled stylistic analysis and transformation, not copying source wording.

ADR-019: Atmosphere Is Independent From Prose

Decision

Atmosphere and prose are separate transformation concepts.

Reason

Prose describes how screenplay action is written.

Atmosphere controls the environmental and sensory material surrounding existing dramatic action.

ADR-020: Atmosphere Can Use Perspective

Decision

Atmosphere should eventually support Story, Character and Both perspectives.

Reason

Relevant environmental detail depends both on dramatic context and on what a particular character notices.

ADR-021: AI Provider Abstraction

Decision

Core product functionality must not be tightly coupled to one AI provider.

Reason

Providers, models, capabilities and economics change.

ADR-022: Different AI Operations May Use Different Models

Decision

The system may assign different model tiers to different operations.

Reason

Extraction does not necessarily require the same model capability or cost as sophisticated dialogue rewriting.

ADR-023: Deterministic Measurement Where Possible

Decision

Objective metrics should use deterministic code where practical.

Reason

AI should not be asked to estimate values that software can calculate reliably.

ADR-024: BYO AI for Initial Desktop Product

Decision

Initial desktop users provide supported AI API credentials.

Reason

This reduces commercial AI-cost risk while the product and real usage patterns are being validated.

ADR-025: Editor Works Without AI

Decision

Loss of AI access must not disable ordinary screenplay writing.

Reason

The product is screenplay software, not merely an API interface.

ADR-026: Mandatory Storage Setup

Decision

Desktop users must choose a valid writable storage location before creating or importing projects.

Reason

The application must know where writer work is stored and must verify that it can save safely.

ADR-027: Writer-Controlled Storage

Decision

Desktop projects are stored in locations controlled by the writer.

These may include local folders or folders synchronised by third-party cloud services.

ADR-028: Backup Is Separate From Save

Decision

Ordinary save/autosave and backup/recovery are distinct concepts.

Reason

A corrupted current project should not automatically eliminate recovery options.

ADR-029: Independent Backups Are Encouraged

Decision

The future hosted version should maintain server recovery systems while encouraging writers to maintain independent downloadable backups.

Reason

Writers should retain control over important creative work.

ADR-030: Native Portable Project Backup

Decision

The application should eventually support a native project package containing screenplay content and relevant structured project information.

Reason

A screenplay export alone cannot preserve the full intelligent project state.

ADR-031: Project Format Is Versioned

Decision

Persisted project structures should include schema version information.

Reason

Future application updates must be capable of migrating older projects safely.

ADR-032: Project Format Must Be Brand-Independent

Decision

The underlying project format must not fundamentally depend on the temporary public product name.

Reason

Rebranding should not require redesigning writer projects.

ADR-033: Feature Flags

Decision

Appropriate incomplete, experimental or optional features should be controllable using central feature flags.

Reason

Development and beta testing require controlled exposure.

ADR-034: Prompt Versioning

Decision

Important AI prompt templates should eventually be centrally managed and versioned.

Reason

Prompt behaviour changes over time and must be reversible.

ADR-035: Simple and Advanced AI Controls

Decision

The eventual rewrite interface should support approachable controls for ordinary writers while permitting deeper control where useful.

Reason

Professional power should not require every writer to become a prompt engineer.

ADR-036: No Premature Future Feature Implementation

Decision

Documenting a future capability does not authorise its implementation.

Reason

Architecture requires foresight; development requires scope discipline.

ADR-037: Screenplay-First Interface

Decision

The screenplay remains the primary interface and creative object.

Reason

AI should support the writing environment rather than make the application feel like a chatbot wrapped around a screenplay.

ADR-038: Development Documentation Lives With Repository

Decision

Project architecture documents live in the repository and are version-controlled.

Reason

Codex and future development sessions require persistent architectural context independent of conversation history.

ADR-039: Electron, React and TypeScript Desktop Foundation

Decision

The initial desktop application uses Electron for the native shell, React for presentation and TypeScript for shared contracts and application code.

The Electron main process owns filesystem and operating-system capabilities. The renderer is sandboxed and accesses a narrow preload API. Domain records and configuration contracts remain ordinary TypeScript modules without Electron dependencies where practical.

Reason

This provides mature Windows and macOS support, keeps privileged desktop access outside presentation components and allows suitable domain/configuration logic to be reused by a future hosted client.

ADR-040: Versioned Filesystem Project Repositories for Build 001

Decision

Build 001 stores each project in a stable-ID directory beneath the writer-selected `Projects` folder. Each project has a versioned `project.json` record. JSON writes use temporary files followed by atomic rename, and metadata snapshots are written separately beneath `Backups`.

Reason

The current build needs transparent local persistence without introducing a database or cloud infrastructure. A repository boundary prevents core project logic from depending on this particular storage implementation and leaves later storage adapters possible.

ADR-041: Configuration Scopes Are Persisted Separately

Decision

Owner/product configuration, writer preferences and machine-level application state are stored as separate versioned records. Secure credentials use an operating-system encryption abstraction and are never part of these JSON records.

Reason

Product ownership choices, writer experience choices, storage state and future secrets have different responsibilities and portability/security requirements.

ADR-042: Screenplays Are First-Class Versioned Project Records

Decision

Project metadata and screenplay content are persisted as separate versioned records. Feature projects reference one principal screenplay; Series projects reference independently stored episode screenplays. Scenes and screenplay elements have stable UUIDs and explicit ordering. Ordinary autosaves atomically replace the current screenplay record, while immutable revision snapshots are stored through a separate revision boundary.

Legacy Build 001 project records are migrated on read. The repository writes a backup before migration and commits the upgraded project record only after the new screenplay records have been written successfully.

Reason

Screenplay content changes far more frequently than project metadata. Separate records keep the domain storage-neutral, preserve stable identities through editing and reordering, make episode isolation explicit and avoid conflating routine persistence with writer-visible revision history.

ADR-043: Structured Screenplay Editing and Formatting

Decision

Screenplay element content remains plain text. Partial emphasis is stored as typed offset ranges, while alignment remains element-level metadata. The editor renders these structures but does not persist arbitrary HTML. Dual dialogue is represented by shared group membership, side and role metadata on the existing stable elements. Character and scene-heading suggestions are derived deterministically from current screenplay records. Document typography and conventional element geometry are defined in one screenplay-format configuration module.

These additions are optional fields on the existing screenplay schema, so older Build 002 records remain valid without destructive migration. Compilation exposes formatting, alignment and dual-dialogue metadata alongside the original plain text and stable identities.

Reason

Plain text plus explicit structure can be validated, autosaved and consumed later by Fountain, FDX and PDF adapters without coupling project data to the React editor or uncontrolled HTML. Stable element IDs remain intact when formatting or dual-dialogue presentation changes.

ADR-044: Shared Editor State, Commands and Transaction History

Decision

Screenplay View and Scene View are projections of one in-memory ScreenplayRecord and one persistence stream. Scene display numbers derive from array order while UUID identity remains unchanged. Structural scene operations, find/replace, formatting and typing changes enter one editor-wide undo/redo history; continuous typing is grouped by element and time while structural commands are atomic transactions. Autosave persists the current result but does not clear editing history.

Central command identifiers resolve keyboard shortcuts independently from their labels. Scene drag-and-drop and accessible movement commands call the same reorder operation. Screenplay-aware copies generate new scene/element UUIDs while also exposing ordinary plain text. Find, statistics and approximate page counts are derived rather than persisted. Recent episode, scene and view are presentation state stored separately from screenplay data.

Electron uses its local spellchecker and the writer's separately persisted `en-GB` or `en-US` preference. Screenplay text is not sent to an external spelling service.

Reason

One screenplay authority prevents view synchronisation bugs. Explicit transactions make destructive and structural actions reversible without conflating undo with revisions or backups, while centralized commands and derived services remain reusable by later desktop menus and export systems.
## ADR-045: Continuous writing is a projection of the structured screenplay

**Decision:** Continuous Writing View renders the existing ordered scenes as one visually flowing document. Scene and element IDs remain authoritative; creating a new scene heading through the continuous keyboard flow inserts a real scene rather than flattening or copying screenplay text. Empty, unstructured editing placeholders are converted in place when their type changes, preserving element identity and preventing abandoned rows from reaching persistence.

**Reason:** Writers need uninterrupted composition without introducing a second screenplay representation or weakening scene-aware navigation, persistence, compilation, and revision safety.

## ADR-046: Project hierarchy and document format are separate

**Decision:** Project schema v3 distinguishes `projectType` from `documentFormat`. Feature and Short projects each reference an independent Screenplay document. A Series project contains stable Season records, each containing stable Episode records that reference independent Screenplay documents. Lightweight Project Collections persist ordered project IDs only and never embed or own screenplay data.

Existing schema-v2 Series projects migrate deterministically into one initial Season while preserving Series, Episode, Screenplay, Scene and element identities. Collection removal and deletion never cascade to projects.

**Reason:** This establishes the required creative-work hierarchy without conflating project organisation with document grammar, duplicating screenplay records, or prematurely implementing future document formats and cross-project intelligence.

## ADR-047: Physical screenplay layout is derived from project-owned geometry

**Decision:** Professional A4 and US Letter presets are immutable central configurations expressed in millimetres. A screenplay may persist a copied custom override and a continuation-marker preference. The editor and deterministic pagination service resolve the same configuration. Page View derives editable element fragments, widow/orphan protection, physical pages, page numbers and dialogue continuation markers without persisting page ownership or generated marker text.

**Reason:** Page count and element positioning must remain stable across window sizes and reusable by future print/export adapters, while custom submission geometry must not mutate canonical defaults or fragment stable scenes and elements into page-owned records.

## ADR-048: Continuous editing commands operate on structured paragraph identities

**Decision:** Screenplay paragraphs retain stable element IDs and plain-text content while shared domain operations perform type transformation, caret-position splitting, compatible boundary joining, parenthetical normalisation and Character cue parsing. Character extensions are optional structured metadata and canonical autocomplete identity excludes the extension. The UI exposes one caret-aware element control; paragraph-level type selectors are not part of the writing surface.

**Reason:** Mature document behaviour must not require flattening the screenplay or letting React component boundaries dictate editing semantics. Central transformations keep keyboard, mouse, history, persistence and future import/export behaviour aligned around the same structured record.

## ADR-049: Editor modes share one scene editor with distinct presentation scopes

**Decision:** Screenplay Mode renders every scene as its own content-height card, Scene Mode renders the selected scene as one content-height card, and Continuous Mode renders all scenes in one uninterrupted screenplay surface. All three projections use the same structured `SceneEditor`, element commands, SmartType, formatting and Dual Dialogue implementation. Shot is a first-class screenplay element with central geometry and keyboard/menu access.

**Reason:** View purpose must not create separate editing engines or force physical page components into scene-focused workflows. Shared commands preserve stable scene/element identities and consistent behaviour while presentation remains mode-specific.

## ADR-050: One production screenplay editor surface

**Decision:** The structured continuous-document editor is the sole production editing surface across Screenplay, Scene and Continuous modes. The former Current Editor / Editor Preview choice and its beta feature flag are retired. The three modes remain presentation scopes over the same screenplay record and editor implementation.

**Reason:** Maintaining two editing surfaces created inconsistent behavior and duplicated interaction paths. The newer structured editor now covers the required editing workflows, so one surface reduces regressions while preserving the existing screenplay data model and stable identities.

## ADR-051: All writing modes consume complete-screenplay pagination

**Decision:** The physical pagination service is the sole source of page boundaries, source offsets, dialogue continuations and scene page spans. The workspace paginates the complete screenplay before applying a scene or location filter. Screenplay, Scene and Continuous modes consume that same result through non-editable ProseMirror decorations. Soft line wraps and page indicators never create document nodes, replace source text, change scene membership, or enter undo history. Scene lengths are rounded up to screenplay eighths from their occupied span in the full pagination.

**Reason:** Presentation scope must not change pagination. One derived layout keeps A4/Letter geometry, focused-scene edits, subsequent page numbers and automatic MORE/CONT'D consistent while preserving continuous selection and stable content identities. This extends ADR-047 to the sole production surface described in ADR-050.

Continuous Mode presents that shared result as full-height physical paper sheets separated by a narrow gap. Generated spacing reserves each page's configured top and bottom margins, including unused printable space before an early break. Page headers display the shared page number at the configured header height and right margin. These paper surfaces and spacing remain presentation-only; the editable document and compact scene-mode indicators use the same pagination result.

## ADR-052: Semantic, interoperable screenplay clipboard

**Decision:** Clipboard operations use a versioned, brand-neutral `application/x-screenplay-fragment+json` payload plus HTML and indented plain text. Electron writes all representations atomically through an allowlisted clipboard adapter; the browser uses native clipboard events and standard ClipboardItems. HTML also carries the validated semantic payload for environments that drop private formats. Selection is read from document nodes, never editor DOM chrome or pagination decorations.

Paste prioritizes valid private semantics, recognized FDX paragraph structure, rich HTML, then contextual plain-text inference. Imported elements use the existing native model and project pagination. Parentheticals retain their type, brackets and supported emphasis. Lyrics are a native supported element with centralized geometry. Source page positions are not imported; ambiguous text is retained. Partial dual-dialogue groups become valid standalone elements, while complete groups receive fresh relationship IDs.

Pastes and cuts are atomic workspace history entries. The document adapter preserves unprojected scenes while admitting inserted scenes and removing selected scenes. New element/scene/group IDs are generated rather than reusing clipboard identities. Clipboard data never owns project metadata or revisions.

**Reason:** A local in-memory clipboard cache cannot support cross-project or external interoperability. Separating semantics from portable presentation preserves writing structure and formatting while keeping UI and generated continuation markers out of pasted content.

## ADR-053: Writer notes are anchored annotations

**Decision:** Writer notes are optional records on the screenplay, anchored to stable scene and element identities with text offsets and a copy of the originally selected text. A note may carry a dealt-with state and ordered responses. Notes remain separate from screenplay elements and formatting. The editor renders them as presentation-only margin decorations, and note visibility is a local workspace preference rather than screenplay content.

Existing schema-v1 screenplay records remain valid because notes are optional. Stale anchors do not prevent a screenplay from loading or saving; the editor clamps their presentation position to the available element text.

**Reason:** Notes must persist with the writing without becoming screenplay dialogue, action, exported text, or pagination input. Stable structural anchors retain useful context while keeping the screenplay model storage-neutral and backwards compatible.

## ADR-054: Project story relationships are one versioned model

**Decision:** Build 002 adds a storage-neutral `StoryRecord` shared by all screenplays in a project. The desktop repository stores it in `story.json` alongside the existing project and screenplay records. The browser adapter uses the same contract. The explicit pre-story migration (absent sidecar, version 0) creates an empty schema-v1 record without modifying project files, screenplay content, IDs, or revisions. Unsupported versions and invalid relationships are rejected before saving. Existing project schema v3 and screenplay schema v1 remain unchanged.

Plots (configurable UI terminology), characters, locations and independent events have stable IDs. Scene metadata references the existing scene and screenplay IDs; it does not contain duplicate screenplay content. Occurrence and reveal links belong to events. Present, involved and referenced character relationships are distinct and never inferred from dialogue or mentions. All timeline modes query the same records. Writers explicitly select a story-day, calendar-date, relative-position or screenplay-order scale; incomparable or missing values are not silently assigned chronology.

Story autosaves are serialized separately from screenplay saves, with visible error/retry state and unsaved navigation protection. Desktop writes are atomic and preserve a separate prior-story snapshot. Project metadata snapshots include the story record; future native project packages must include `story.json` with screenplays and revisions. Deletion of a plot/character/location removes only its links after confirmation; archiving preserves all links. Deleting screenplay content retains independent events and scene metadata with unresolved scene IDs so restoration reconnects them. The timeline identifies removed scenes rather than cascading deletions.

**Reason:** Project-wide relationships support episodes, intersecting plots and character chronology without competing timeline data, name-based identity, or changes to the screenplay editor. Manual metadata is accessed through scene-card header buttons in Screenplay and Scene modes, using a modal with create, edit and delete controls. AI inference and continuity checking remain deferred.

## ADR-055: Scene-derived defaults remain distinguishable from writer overrides

**Decision:** At the writer's request, the manual-only extraction restriction in ADR-054 is superseded for deterministic scene metadata. Character cues and clear action introductions create/reuse stable Character records; explicit scene-heading locations create/reuse Location records. Cue and heading element bindings prevent partially typed names from creating duplicate entities and retain identity when names are edited. Source-name aliases preserve associations after a metadata rename. Ordinary cues and clear physical actions default to presence; voice-over/filtered/phone cues default to involvement. Mentions alone do not establish physical presence. All automatically populated fields remain editable.

Scene headings supply general time-of-day defaults: Early Morning, Morning, Afternoon, Evening and Night. DAY maps to Afternoon. Explicit clock time can be stored independently; no exact clock time is invented from a general period. Supported heading indicators may also supply chronology type. Timeline ordering uses central period ordering where precise clock time is absent.

Duration is estimated from the unrounded scene page span returned by the existing complete-screenplay pagination service, using a centrally configured 60 seconds per page and rounding the estimate to whole seconds. The existing `chronology.duration` remains fractional minutes for backwards compatibility; the UI edits minutes and seconds, and timeline labels display both. Thus 1/6 page is ten seconds and 1/2 page is thirty seconds. Existing pagination, displayed eighths, screenplay text and ordering are unchanged.

Optional source provenance, last-derived values, explicit manual-field overrides and deletion suppression are additive fields on story schema v1. Old story files keep their existing duration units, event major flag, IDs and user-entered metadata; no destructive migration or reinterpretation is needed. Automatic defaults refresh after screenplay changes, but explicit edits, clears, entity deletions and deletion of scene details are preserved. “Use scene defaults” explicitly resets these overrides for the selected scene. Events remain independent, with an explicit Major Event / Minor Event selector over the existing boolean field. This is local deterministic extraction, not AI inference or automated continuity checking.

**Reason:** Writers should not have to re-enter information already present in their screenplay. Tracking the source and preserving manual decisions prevents convenient defaults from taking ownership of creative metadata.

## ADR-056: Scene-heading case is normalized in the shared screenplay model

**Decision:** Scene headings are automatically uppercased when created, edited, normalized on workspace entry, compiled, and saved through either storage adapter. The central heading formatter also supplies uppercase labels in scene navigation, timeline activities and metadata selectors. This applies across Screenplay, Scene and Continuous modes without changing scene order or identity. Action, dialogue and other prose retain their existing case.

Uppercase conversion retains formatting ranges and note-anchor positions, including Unicode case expansion. Caret restoration uses the corresponding uppercase prefix length. Original imported/revision records are not rewritten; normalization applies to the working screenplay through its existing autosave path. This is an explicitly requested deterministic text correction, not an AI rewrite or schema change.

## ADR-057: Story refinement uses inheritance and canonical identity

The Build 002 change request supersedes the independent-event defaults and generic scene involvement terminology in ADR-054/055. New scene-attached events resolve day/date/time, location, plots and participants through their occurrence scene at query time. `contextOverrides` names only explicit exceptions, including intentional clears. Absent override metadata identifies older independent events: their existing values remain unchanged until the writer explicitly chooses scene inheritance. Legacy duration, relative position, chronology classification, involvement and combined reveal/reference links remain recoverable; new UI hides obsolete controls and does not guess how ambiguous earlier links should be reclassified. Revealed and Referenced now have separate stable-ID lists. Remote/voice-over speakers have an objective `remoteIds` relationship and are not physically present by implication.

Scene positions Present, Past, Future, Flashback and Flashforward are distinct. Exact time determines its daypart; approximate time remains editable. Fractional-minute duration storage remains compatible while UI shows an estimate and optional seconds override. Refresh updates managed extraction without clearing manual story information. DAY remains Afternoon. Bare heading tokens cannot become locations; old automatically generated token locations are archived rather than destroyed.

List, plot tracks, character tracks, activity summaries and indexes query the same StoryRecord. Character plot membership derives from physical scene presence or event participation, not mentions. Together requires physical participation. Plots retain IDs when changing labels/scope/status; resolution references are optional. Parent location relationships are optional and cycle-checked. Parent/child activity is explicitly distinguished from direct activity.

Character/location merges redirect canonical links, retain screenplay source names/element bindings and save source entity/link history. Separating restores original IDs and source appearances without editing screenplay text. Nested merges separate in reverse order. Source profile conflicts remain recoverable. Entity deletion removes links only; archive preserves them. All additions are optional fields on story schema v1, preserving older records, IDs and units without destructive file migration.

## ADR-058: Shared contextual profiles, UI preferences and project assets

Character and Location profiles extend the existing canonical entities with optional writer-owned profile information. They do not maintain duplicate scene, plot, event, location or chronology lists. Nicknames differ from actual screenplay identities. Dialogue statistics resolve cue modifiers and merged source names through canonical characterId. Appearance ranges and directional/symmetrical character relationships refer to canonical scene/event chronology or structured day/date boundaries. Appearance resolution prioritizes explicit scenes, specific scene/event ranges, broader ranges, then default; tied priorities are reported as conflicts rather than guessed. Optional appearance and relationship timeline layers are query projections, not generated StoryEvent records.

One reusable InspectorContext (type, entityId, sourceSceneId) serves character, location, event, plot and scene navigation. Quick cards, one resizable right inspector and full profiles share the existing story autosave queue. Full profiles overlay the mounted editor and preserve its document history and selection. Metadata undo is separate. A single lightweight hover control is positioned outside the editor DOM/text flow; Alt+I provides keyboard access. No profile controls enter compilation, clipboard content, pagination or exports.

Card module order/visibility and inspector open/width/section state belong to the existing user preference record. Character and Location settings are independent. Last inspector context is local workspace UI state. Profiles retain their originating scene until deliberately opened elsewhere. Location heading parsing exposes parent/area candidates; writers confirm organization and merging rather than silently establishing fictional geography.

Image references use stable asset UUIDs. Desktop image bytes and MIME metadata live in the project's assets directory; metadata snapshots copy immutable assets to the project's backup asset directory. The browser adapter uses a separate IndexedDB asset store. The common API abstracts import/read operations. PNG, JPEG, GIF and WebP signatures and size are validated; primary StoryRecord JSON never contains binary data or arbitrary absolute image paths. Removing profile references retains immutable assets for backup/undo recovery. Future native packages must include assets with the story sidecar. No image generation, facial recognition, AI psychology, production locations or cloud infrastructure is added.

## ADR-059: The story inspector is a permanent scoped navigation surface

The writing workspace always reserves a narrow right-side story rail. It defaults to a collapsed icon state and expands through the same preference-backed inspector rather than creating another story-data surface. Timeline, Location, Character, Event and Plot indexes are projections of StoryRecord and the existing timeline query. Feature and short projects scope these projections to the current scene or screenplay. Series projects also scope by episode, each saved series/season grouping, or all time. Selecting an entity reuses InspectorContext, profile editing and story metadata editing; screenplay nodes and pagination remain unchanged.

Character profiles add an optional date of birth. CharacterRelationship retains its stable ID and legacy label while optionally adding a configured relationship type, family modifier, audience discovery boundary and per-character discovery boundaries. Direct relationships are writer-owned canon. Reciprocal labels and spouse/sibling in-law connections are deterministic projections and are not duplicated in StoryRecord. Discovery boundaries control when projected relationship information becomes visible and create an optional timeline layer; they do not silently alter screenplay text or confirm inferred relationships beyond the writer's direct records.

## ADR-060: Timeline eligibility and writing overlays use structural anchors

Story Timeline scene rows require an explicit scene-heading element whose parsed heading contains a meaningful location. Interior/exterior markers and timing words are syntax, not locations; a heading containing only those tokens is excluded from scene projections and location extraction while its screenplay element, scene ID and recoverable metadata remain untouched. The same deterministic parser supplies both decisions, so a valid heading such as `INT. ZIDER'S HOUSE - LATER` remains eligible.

The Character Quick Card is one fixed bottom-right overlay. Hovering a Character cue only reveals its icon. Hovering or keyboard-focusing that icon opens the card after 300ms, moving between character icons replaces its context in place, leaving the cue/icon/card group closes it after 300ms, and clicking the icon opens the persistent Inspector. Cue resolution prefers its stable source-element binding, then canonical screenplay identities, then retained merge history. When the visible cue differs from the canonical Character name, the card and Inspector state “Appears here as …” so role-to-character identity remains clear. Existing preference-backed module visibility and order remain authoritative. Margin notes are also overlays: their horizontal centre is measured against the physical page's left edge, independent of element indentation or dual-dialogue layout, while their vertical position follows the anchored screenplay text and collision stacking. These overlays do not contribute to document layout or pagination. A stored date of birth deterministically refreshes the existing optional age field when the profile is edited or opened; displayed birth dates use an unambiguous day, abbreviated month and year presentation while storage remains ISO-compatible. The Inspector presents the entity description once, in its initially expanded collapsible section.

## ADR-061: Event relationships own Plot and Scene linkage

**Decision:** `StoryEvent.plotIds` is the canonical many-to-many Event-to-Plot relationship. Event `occursInSceneId`, `revealedInSceneIds` and `referencedInSceneIds` remain the canonical typed Event-to-Scene relationships. `SceneStory.plotIds` continues to store writer-authored additional Scene Plot associations and is never populated as reverse writeback from Events.

Shared indexed resolvers project Events for a Plot, grouped Events for a Scene, effective Plots for a Scene and effective Scenes for a Plot. Occurring and revealed Events contribute their Plots to a Scene; referenced Events do not. Effective Plot results deduplicate by stable ID while retaining every source so the UI can explain and edit the owning canonical link. Archived relationships remain stored and can be included by historical queries, while ordinary active views omit archived entities.

This decision supersedes the statement in ADR-057 that an Event inherits Plot membership from its occurrence Scene. An Event inherits chronology, Location and physically present Characters from its occurrence Scene, while its Participants and Plot memberships remain Event-owned. Existing Scene Plot relationships remain explicit and existing Event data remains valid without a schema-version migration. Events may remain temporarily unassigned.

**Reason:** A relationship entered from Event, Scene, Plot, Timeline or Inspector must update the same fact. Query-time projection prevents circular writeback and ghost Scene Plot links when an Event moves, is deleted or loses a Plot, while preserving direct Scene Plot associations for story beats that do not warrant Events.


## ADR-062: Timeline is a chronological and screenplay progression projection

**Decision:** At the writer's request, List groups shared story days/calendar dates and then available periods or exact times, with scenes containing their linked story activity. Missing chronology remains Unpositioned. Explicitly different Event occurrence chronology stays independent; later typed scene interactions are projected at the Scene chronology and reference the same Event ID. Tracks follow a selected Plot, Character, Event or Location through screenplay order. Optional Scene role maps store writer-owned progression labels by canonical entity ID; they do not duplicate events or chronology.

Event sceneInteractions optionally add Investigated, New evidence and Reinterpreted alongside existing occurrence, reveal and reference links. These additive schema-v1 fields round-trip through the existing storage adapters. This supersedes ADR-061 only for effective Scene Plot projection: all typed Event interactions, including Referenced, contribute their canonical Event Plot memberships. Scene plotIds remain explicit additional links with no reverse writeback.

Removed scenes are excluded by default and appear dimmed only with Include removed scenes. This supersedes ADR-054's normal removed-scene display. Unresolved IDs and retained scene context remain recovery links internally; Event projections have no active scene, retain independently owned data and resolve the last inherited context. Restoration reconnects the original IDs. No Event is cascade-deleted.

Scene location is now heading-owned, superseding manual Scene location overrides in ADR-055; Event location overrides remain writer-owned. Heading binding must not rename a Location used as an explicit Event override when a heading changes place. Existing canonical parent/sub-location organization and writer confirmation remain authoritative.

Timeline display is an optional UserPreferences field. Semantic icons are shared with the story rail and indexes. Plot colours remain Plot-owned; the central palette assigns an unused available colour when possible, and existing theme/custom colours remain supported.

**Reason:** Entering a fact once must propagate through canonical relationships, while story occurrence, screenplay disclosure and writer overrides remain distinct and recoverable. No screenplay content, revisions, pagination, AI operations or roadmap phase status changes.


## ADR-063: Tracks reads canonical Plot effects

**Decision:** This follow-up supersedes ADR-062's editable progression labels in Tracks and its Icon only preference. Tracks accepts no story mutation callback and contains no relationship editors. Event.plotEffects optionally stores an effect per assigned Plot ID, edited in the Event form; options are Introduced, Developed, Complicated, Revealed and Resolved. Existing SceneStory.plotRoles stores effects only for explicit Scene-to-Plot associations and is edited in Scene Details. Effective Scene effects project those owning links with source IDs so List/Tracks can navigate to the correct editor. Event effects are never copied into Scene metadata or Track-specific records. Removing an Event-to-Plot link or deleting a Plot removes its effect.

Older schema-v1 records remain valid. Existing Scene labels on derived Plot associations and legacy Character/Location Track labels remain recoverable but are not treated as canonical effects. No ambiguous legacy Scene label is automatically reassigned to an Event. Character and Location Tracks derive appearance/reference labels from canonical activity.

Timeline display offers only Icon + name (default) and Name only. A saved legacy Icon only value is normalized to the default at read time. The type key order is Scene, Event, Major event, Plot, Character, Location, using shared icons. List retains Scene → Events → Plots → Characters → Location.

The shared Event-to-Scene projection suppresses a Revealed entry whose scene ID equals the Event occurrence scene ID. Existing stored links remain recoverable, and later/elsewhere Revealed links remain active. Editors prevent selecting the occurrence scene as a redundant revelation. This display rule neither invents additional event records nor changes story occurrence chronology.

**Reason:** Writers enter relationship effects once at their canonical source. Tracks is a visualization, and occurrence must remain distinct from later disclosure.


## ADR-064: Source-owned Timeline hierarchy and optional occurrence timing

**Decision:** List and Tracks render Scene → Event relationship → affected Plot links. Event links never become sibling Scene effects. Direct Scene Plot effects remain separate; a legacy direct link whose Plot and effect match an Event link in that Scene is suppressed for display only. Canonical metadata is retained, and multiple Events affecting one Plot remain distinct. Show applies to List only. Event Tracks omits the standalone occurrence summary when an active Scene owns that occurrence; an unassociated occurrence shows No scene and its own context.

StoryEvent.occurrenceTiming optionally refines the one occurrence with exact time, start/end range (including overnight), duration in minutes, or a configured daypart. Absence inherits existing Scene context for new Events; legacy independent chronology is preserved. Explicit inherit returns to live Scene time. Date/day remain Scene-owned for linked Events. Reference/revelation entries retain their containing Scene chronology. Explicitly timed occurrences sort chronologically within the timed slots, preserving untimed Event order. Scene Chronology optionally supports endTime. No duplicate Track chronology is saved.

Scene-linked Event rows display only explicitly entered occurrence timing; they do not repeat the Scene date, time or duration. Unassociated occurrence context may show its own day/date. Merged Character labels append merge-source names in parentheses without changing the editable canonical name or screenplay cues.

**Reason:** Enter once → inherit/display everywhere, while ownership, chronology and later disclosure remain distinguishable. Storage adapters, entity IDs, revisions and roadmap status remain unchanged.


## ADR-065: Linked Story/Screenplay comparison is a shared read projection

**Decision:** Timeline List offers Story, Screenplay and Compare ordering. Story uses canonical occurrence chronology, including precise occurrence refinements; Screenplay retains document/Scene order and distinct typed Event appearances. Compare's Story pane includes each occurrence once, while its Screenplay pane retains Occurs, Revealed, Referenced, Investigated, New evidence and Reinterpreted relationships. Unassociated occurrences are not invented as earlier screenplay appearances; an Event without any screenplay appearance is explicitly labelled. Both panes use the same view projection and renderer, with stable typed appearance keys and entity IDs for matching. This supersedes the old List Sort menu; it does not change screenplay structure or stored chronology. Consistent existing Day/date anchors may align date-only entries for ordering, without saving inferred Days or guessing across conflicting calendars.

Hover highlights matching identities without scrolling. A deliberate click selects the occurrence and the chosen appearance and scrolls only the opposite pane to its centre, opening collapsed ancestors when needed. Previous/next follows multiple screenplay appearances while preserving the selected occurrence. Ordinary scrolling is independent. Scrolling targets pane containers rather than scrollIntoView, so the clicked pane and shared dialog ancestors do not move. Keyboard selection uses the same matching and reduced-motion settings are respected.

Day/date, period/time and Scene collapse state is transient presentation state. Collapse all and Expand all retain compact Scene headers. Density (Compact, Standard, Expanded) is separate from icon/name display; Compact defers secondary Character/Location information, Expanded exposes available relationships. Compare remains deliberately compact. Order, density and display use additive optional fields on the existing UserPreferences record; List Show remains intact while switching to Tracks. Tracks remains read-only and retains its own entity selectors.

Elapsed-time labels are derived only from compatible known story days/calendar dates or exact clock times. Dayparts and estimated durations never become precise hour gaps. Exact ranges use their end, including midnight crossings. Calendar-month labels require matching actual month boundaries; zero/backward/unknown gaps are omitted. No extra temporal or relationship metadata, warnings, AI judgements, providers, dependencies or roadmap changes are introduced. Event→Plot hierarchy, display-only legacy duplicate suppression, canonical icons, location overrides, merged Character labels, stable IDs and revision safety remain intact.

**Reason:** The writer can distinguish occurrence from audience presentation and deliberately locate the corresponding moment while maintaining one canonical source for every fact.

## ADR-066: Worlds extend canonical story identity with reusable snapshots

Worlds are optional additive fields on StoryRecord schema v1. Project Worlds own generic World entities, relationship periods and diagram view configuration; People and Places refer to existing Character/Location IDs. Rank/grade and Position definitions use generic organisational entries with configurable labels; memberships reference their IDs separately and optionally reference a reporting Character. Organisation units and physical Locations remain distinct. Core queries and validation are storage-neutral and require no AI connectivity.

World Library masters live separately beneath References through the desktop repository boundary (with a browser preview adapter). A Project World import creates independent World, entity, relationship and diagram IDs, retains source-to-copy provenance and never subscribes to master updates. Known source UUIDs already present in the target project retain canonical Character/Location identity; names never trigger automatic merging. Explicit identity merges redirect World memberships, generic relationships and occurrences and record enough provenance for separation. Packages include canonical People/Places dependencies, Location ancestors and validated image assets. External Scene/Event/Plot and history anchors remain unresolved recovery references in a different project, rather than being guessed or silently discarded. Advanced synchronisation, selective merge and AI continuity remain deferred.

World effective periods reuse StoryPoint Scene/Event chronology and existing Chronology day/date/time, with an optional stable screenplay ID for episode boundaries. Bounds are start-inclusive/end-exclusive. Historical queries distinguish active, inactive and incomparable boundaries; unknown relationships are not presented as historical fact. Current views show non-archived open periods. Transfers add a new relationship and end the old period; they do not overwrite identity or move independently related Objects/Rules. Diagrams are generated from entities and relationships. Saved diagrams own only root, filter and branch presentation settings.

Screenplay occurrences refer to canonical entity IDs, stable screenplay/scene IDs and optionally element IDs plus offsets. Scene links and exact-text links are distinct. Writer edits map anchors through accepted editor transactions; removed anchors retain original text and recovery references with a review marker. World indicators and quick cards are optional decorations outside compilation, clipboard text and pagination. Reusable wording insertion requires explicit invocation, uses Exact wording, respects scene locks and refuses Dialogue insertion without an existing Dialogue context. It uses ordinary writer edit history and autosave; no AI rewrite is performed.

Project World data shares the existing story metadata save queue, undo and backup stream. Library saves have independent snapshots. Reference assets reuse the project image adapter; validated packages carry assets for portability. Footer pins/display settings are project workspace UI data in an optional worldUi field; they never become screenplay elements. Reference overlays retain the mounted editor, selection and scroll state.

This requested build brings forward manual Worlds support without changing broader roadmap phase completion or introducing cloud services, automatic canon inference, automatic correction or separate Character/Location/Event systems.

World organisation entries distinguish unit, rank and position roles by stable internal keys; writer-facing unit/rank terminology does not determine those roles. The generic entity representation also reserves a custom type key and reuses fields, relationships and history; this build adds no speculative custom-type designer. Canonical Scene-level Plot, Character reference and Event links from the contextual menu remain on their existing Scene/Event owners. Exact-text occurrences provide additional structural anchoring without writing reverse copies. Explicit canonical entity deletion removes its World links while preserving other entities; archive remains reversible.

## ADR-067: Editable organisation structure and shared role assignments

World organisation structure has dedicated child-unit creation and existing-unit placement controls. Each placement remains an effective `part of` relationship, allowing one shared team to appear under multiple parents without duplicating its identity. The editor and diagrams project the same acyclic graph; ending or archiving a placement retains history.

Rank and position definitions retain organisationRole keys and now support optional writer-entered abbreviation, rankGroup and numeric rankLevel. Canonical Character profile editors and Worlds edit the same membership record, including rankId, positionId and reporting links. Timeline Character labels project only effective rank/position abbreviations at the Scene or occurrence context; organisation abbreviations are reserved for compact World footer pins. Long names and screenplay cues remain unchanged. No predefined police hierarchy or rank taxonomy becomes product logic.

Generic custom fields optionally store typed stable fieldLinks alongside their text value. Linked Character and Location profiles expose the same owning field value for editing without a reverse copy. World packages include referenced canonical People/Places; snapshot copies remap internal references, preserve external recovery anchors and identity merges record link redirection for separation. Canonical deletion removes the typed link while retaining the field text. Existing schema-v1 records remain compatible through optional fields.

World creation controls use visible inline forms, including rank, position, custom-field and diagram-view naming; they no longer depend on native browser prompts in the embedded preview.

## ADR-068: Organisations own distinct internal structures and personnel definitions

This correction supersedes ADR-066/067 only where those decisions represented units, ranks and positions as Organisation entries. World entities now distinguish `organisation`, `structure`, `rank` and `position` while retaining the shared entity, relationship, image and reference infrastructure. Actual Organisations remain in the Organisations index. Internal structures have one owning organisationId, a writer-controlled structureType, optional hierarchyLevel and independent displayOrder. Separate Organisations continue to use effective `part of` relationships; internal structures use ownership plus optional effective parent/reporting relationships. No fixed nesting depth or police-specific taxonomy is encoded.

Membership remains a single WorldRelationship: `to` identifies the Organisation and optional `unitId` identifies the internal structure; rankId, positionId, reportsToId and effective periods remain independent. Character profiles, quick cards, World views, timeline role labels and diagrams project this same record. Transfers end the previous period and add the new assignment. Linked Locations/Objects/Vehicles/Rules/Notes retain their canonical entity IDs and relationship ownership. Structure bulk actions never copy or edit personnel, notes or linked content.

Organisation categories inherit through unambiguous active parent paths unless explicitly overridden. Conflicting parent categories remain unassigned rather than guessed. Organisation-owned units inherit their owner's category. Rank/position terminology remains configurable on each Organisation. Rank and position definitions can be Organisation-scoped or shared legacy definitions, and cannot become organisational chart nodes.

The Structure editor belongs inside its Organisation and supports single creation, list/numbered bulk previews, optional explicit abbreviation patterns, level buttons, parent changes, peer reordering, moving structures with descendants and reversible archive. Bulk-created entries each receive independent stable IDs. Explicit parent/reporting links determine diagram nesting; a numeric level can supply a display parent only when there is one unambiguous lower-level root. Otherwise level groups remain peers. This display projection is never saved as a new reporting fact or Diagram data. Generated diagrams combine the structural and personnel layers and retain historical membership queries and footer access.

World structureModelVersion 1 marks the revised semantics within the existing schema-v1 story/package envelope. Legacy rank/position roles migrate to distinct kinds with the same IDs. Legacy unit entries migrate only when a recognised unit label or clear structural name has one parent path to an identifiable owning Organisation. Ambiguous entries remain Organisations and have an explicit conversion control. All relationship periods, field/image values, generic references, pins, anchored occurrences and saved diagram references are retained or redirected by stable identity. The repository's existing recovery snapshots preserve earlier representations. No world data is deleted, no screenplay is changed, and roadmap phase status remains unchanged.

## ADR-069: Permanent Worlds deletion is reference-aware and distinct from Archive

Status: Accepted. Worlds entries, role definitions, saved diagrams, relationships, custom fields and whole Worlds expose explicit confirmed deletion. The confirmation inspects current and historical links, typed fields, screenplay occurrences and diagrams. World deletion requires typing its name and identifies canonical Characters/Locations that remain. Archive continues to preserve historical reconstruction; deletion removes records and all applicable references from the active project/library model at every time slice.

Deleting containers never deletes independent linked Characters, Locations, Objects, Rules or separate child Organisations. Child structural units require an explicit choice: keep/reparent them (choose another surviving Organisation when deleting their owner), or delete the listed structural descendants. Shared surviving structural parents are retained. Deleting a role definition clears role assignments while retaining membership periods. Deleting an individual canonical Person/Place explicitly deletes its project-wide profile and metadata links; the confirmation identifies that broader scope. No operation edits screenplay documents or text.

Confirmed deletion clears prior metadata Undo history so Undo and identity separation cannot restore deleted records. Existing recovery/backup snapshots remain governed by the storage/revision safety rules; this is removal from the active model, not erasure of recovery files. Library deletion uses the same serialized, atomic storage and backup queue as Library saves. Failed deletion remains visible and retryable; Project copies and Library sources stay independent. Roadmap status is unchanged.

## ADR-070: Character Profiles and Organisation member editors share canonical membership history

Status: Accepted. Full Character Profiles have a dedicated Worlds tab with current/contextual membership summaries and per-World membership history. Profile editing, Organisation/unit People/Members controls, promotions, transfers and generated diagrams all edit/read the same WorldRelationship record. No Organisation, unit, rank, position, reporting or period values are copied onto Character profiles. Multiple concurrent memberships are supported. End membership preserves its record; confirmed deletion removes only that relationship. World Library editing remains independent of project canon.

Transfers and role changes append a new period and end the earlier period at the start of the new assignment. Start-inclusive/end-exclusive bounds remain unchanged; episode-only history can display the last included episode (a transfer at Episode 5 displays Episode 1 through Episode 4). Invalid cross-Organisation unit/definition choices and non-member/self reporting targets are rejected; existing historical reporting references remain editable. Writer-configured rank/position terminology follows the owning Organisation. Character creation uses the canonical story collection; matching names/cues suggest explicit reuse rather than automatically merging identities or creating a separate World person.

Character cards derive concise rank/position and unit/Organisation lines at their source Scene, or current membership without context. Source screenplay identity can be resolved directly from the live document even when SceneStory metadata is absent. Optional characterWorldFields on ProfilePreferences independently controls Organisation, Team/Unit, Rank and Position visibility; it stores presentation choices only. Existing generic World references, profile features, screenplay content, revision/storage boundaries and roadmap status remain unchanged.

## ADR-071: Organisation rank hierarchy supplies contextual reporting defaults

Status: Accepted. Rank definitions use the existing rankLevel: higher numbers are more senior, equal numbers are peers. Organisation personnel sections own hierarchy editing and descriptions; membership forms select ranks and units without editing rank groups or levels. Definitions and their creation/edit forms remain within their rank or position section.

Automatic reporting is derived from active canonical memberships at the viewed story point. It selects all members at the nearest occupied higher rank in the same World, Organisation and exact internal unit (including organisation-wide memberships with no unit). No cross-unit or cross-Organisation reporting is inferred. Missing rank hierarchy produces no automatic reporting. Diagrams and summaries use this same resolver, so subsequent staffing changes are reflected without creating duplicate relationships.

Optional reportsToIds records an explicit selection, including an empty selection. Absence means automatic reporting; legacy reportsToId remains an explicit single-person assignment for compatibility. New explicit selections are validated against eligible higher-ranked members. Multiple references survive storage, package copies, identity merge/separation and reference-aware deletion. The writer can return to automatic reporting with Use rank hierarchy. Screenplay content and roadmap status remain unchanged.

## ADR-072: Level 1 is the most senior across all hierarchies

Status: Accepted at the writer’s request. This supersedes the numeric direction in ADR-071. Rank and internal-unit hierarchies both use 1 as the most senior level; higher numbers are more junior and equal numbers are peers. Rank lists sort by ascending level. More senior decreases the level (stopping at 1); less senior increases it. Automatic reporting chooses the nearest occupied more senior rank, meaning the largest level number smaller than the member’s own level, within the same Organisation and unit.

Existing writer-entered numbers, identities, assignments, descriptions and membership periods remain unchanged. Their ordering and automatic reporting now follow the requested convention. No police-specific ordering or role names are inferred, and screenplay content is unchanged.

## ADR-073: Worlds forms describe each category while sharing canonical links and history

Status: Accepted. A shared configuration defines fields, labels, selector choices and specialist sections for People, Places, Objects, Vehicles, Rules, Lore and Notes. People and Places update existing canonical profile fields; no second profile model is introduced. Existing field keys and exact Lore wording are preserved. Custom types can be reused from existing records, and custom relationship labels are remembered by endpoint kinds within their World.

Custom selector choices are also remembered in optional per-World fieldOptions, so switching the last record to another type does not remove a writer-added choice. Standard configured choices are not duplicated there. This registry is included in independent packages and copies.

Contextual Add organisation/character/place/world item controls create one WorldRelationship visible and editable from both endpoints, including Character Profiles. Organisation and internal-unit choices progressively follow the effective hierarchy. Functional Positions remain distinct from Ranks and optionally constrain allowed ranks and units. Membership validation enforces these restrictions while retaining existing historical records for editing.

Object and vehicle appearance/condition changes use optional additive history entries with existing start-inclusive/end-exclusive story points. New dated changes close earlier ongoing state periods; original field values and descriptions remain intact. Independent World copies remap eligibility references and assign independent history IDs. Deletion clears eligibility references. No screenplay text, inferred story canon, storage abstraction or roadmap status changes.
