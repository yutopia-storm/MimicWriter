DATA MODEL

1. Purpose

This document defines the conceptual data model for the application.

It includes both current and anticipated entities so that early implementation does not prevent later functionality.

It does NOT require every entity to be implemented immediately.

Only create persisted structures when the current development phase requires them.

2. Identity Principle

Persisted entities should use stable unique identifiers.

Display names, screenplay order and branding must not serve as permanent identity.

3. Project

Represents the highest-level writer project.

Potential fields:

id

project_type

title

description

created_at

updated_at

project_settings

schema_version

Project types initially include:

feature

series

Future types may be added without redesigning the entire model.

4. Series

Represents a television/episodic series within a series project.

Potential fields:

id

project_id

title

description

series_metadata

5. Screenplay

Represents a screenplay document.

Potential fields:

id

project_id

series_id where applicable

title

screenplay_type

current_version

metadata

For feature projects this may represent the feature screenplay.

For series projects an episode may reference a screenplay.

6. Episode

Potential fields:

id

series_id

screenplay_id

episode_number

title

episode_type

order

metadata

Episode number and order are not permanent identity.

7. Scene

Potential fields:

id

screenplay_id

order

heading

location_id

story_time

lock_state

current_revision_id

scene_purpose_id

created_at

updated_at

Scene ID remains stable when scene order changes.

8. ScreenplayElement

Potential fields:

id

scene_id

element_type

order

content

metadata

Potential element types:

scene_heading

action

character

dialogue

parenthetical

transition

dual_dialogue

page_break

other

9. SceneRevision

Potential fields:

id

scene_id

parent_revision_id

origin

content_snapshot

created_at

ai_operation_id

metadata

Potential origins:

import

writer

AI

restore

10. ScenePurpose

Potential fields:

id

scene_id

purpose

source

confirmed_by_writer

11. ProtectedBeat

Potential fields:

id

project_id

scene_id where applicable

character_id where applicable

content/reference

protection_scope

created_at

12. Character

Potential fields:

id

project_id

canonical_name

aliases

description

metadata

13. CharacterTrait

Potential fields:

id

character_id

trait

category

status

provenance

confidence where relevant

14. CharacterState

Represents changing state.

Potential fields:

id

character_id

scene_id or timeline reference

state_type

value

start_reference

end_reference

provenance

15. CharacterLens

Potential fields:

character_id

perceptions

sensitivities

attention_biases

behavioural_patterns

worldview

professional_knowledge

This may initially be represented through related structured records rather than one table.

16. Relationship

Potential fields:

id

project_id

character_a_id

character_b_id

relationship_type

description

status

provenance

Relationships may evolve over time.

17. Location

Potential fields:

id

project_id

canonical_name

aliases

description

production_metadata

18. StoryFact

Potential fields:

id

project_id

statement

status

provenance

created_at

superseded_by

Potential statuses:

confirmed

inferred

possible

rejected

superseded

19. FactProvenance

Potential fields:

id

fact_id

screenplay_id

episode_id

scene_id

element_id

extraction_operation_id

20. ProjectRule

Potential fields:

id

project_id

rule

category

enabled

writer_confirmed

21. StoryThread

Potential fields:

id

project_id

name

description

status

22. SceneStoryThread

Links scenes to story threads.

Potential fields:

scene_id

story_thread_id

relevance

source

23. TimelineEvent

Potential fields:

id

project_id

scene_id

event

story_date

story_day

time_of_day

relative_order

duration

confidence

provenance

24. CharacterKnowledge

Potential fields:

id

character_id

fact_id

state

acquired_at

provenance

Potential states:

knows

believes

suspects

falsely_believes

unknown

25. SetupPayoff

Potential fields:

id

project_id

scene_id

type

description

linked_item_id

writer_confirmed

Potential types:

setup

payoff

motif

incidental

26. StyleProfile

Potential fields:

id

owner_scope

name

description

type

style_data

enabled

created_at

updated_at

Potential types:

built_in

reference

writer

project

custom

27. ReferenceSource

Potential fields:

id

style_profile_id

source_type

source_name

retained_file_reference

analysis_status

created_at

Do not assume reference originals must be permanently retained.

28. SceneStyleSettings

Potential fields:

scene_id

style_profile_id

influence

atmosphere

prose

tension

pacing

description

dialogue

perspective

rewrite_mode

preservation_settings

The exact set must remain extensible.

29. ProjectStyleSettings

Provides project defaults using concepts compatible with scene overrides.

30. RewritePreset

Potential fields:

id

owner_id where relevant

project_id where project-specific

name

settings

31. AIProvider

Represents provider configuration, not secret credentials.

Potential fields:

id

provider_key

display_name

enabled

capabilities

Secrets must remain in secure credential storage.

32. AIModel

Potential fields:

id

provider_id

model_key

display_name

enabled

capabilities

cost_metadata

context_metadata

Model availability changes over time and should not be assumed permanent.

33. AIOperation

Potential fields:

id

project_id

scene_id

capability

provider

model

prompt_version

status

created_at

completed_at

Do not unnecessarily store full screenplay prompts/responses.

34. AIUsage

Potential fields:

operation_id

input_tokens

output_tokens

cached_tokens

estimated_cost

actual_cost where known

35. PromptTemplate

Potential fields:

id

capability

version

content

active

created_at

Previous prompt versions should remain recoverable.

36. AppConfiguration

Stores non-secret application configuration.

Potential categories:

defaults

limits

behaviour

backup

import/export

AI

37. BrandConfiguration

Potential fields/configuration:

product_name

short_name

developer_name

tagline

descriptions

logo references

icon references

colour values

typography

38. TerminologyConfiguration

Maps stable internal keys to configurable display labels.

39. FeatureFlag

Potential fields:

feature_key

enabled

environment/scope

metadata

40. ContentPage

Potential fields:

id

stable_key

title

body

visible

updated_at

41. BackupRecord

Potential fields:

id

project_id

backup_type

destination

created_at

status

schema_version

42. Schema Versioning

Persisted projects must contain a schema version.

Future changes should use explicit migrations.

Never destroy writer data merely because an older project format exists.

43. Implementation Rule

This data model represents conceptual boundaries.

Do not automatically create one database table per heading.

Choose implementation appropriate to the current phase while preserving these conceptual distinctions.
## Build 002D hierarchy

The implemented project hierarchy distinguishes project type from document format:

- Feature Project → Screenplay Document → Scenes
- Short Project → Screenplay Document → Scenes
- Series Project → Season → Episode → Screenplay Document → Scenes
- Project Collection → ordered references to independent Projects

Feature, Short, Series, Season, Episode, Screenplay, Scene, screenplay element and Collection identities are stable and independent of display order or names. Collection records contain membership and ordering only; they do not contain screenplay data. `season` is the neutral internal entity, while configurable terminology displays “Series” by default.

## Build 002 structured story tracking

`StoryRecord` schema v1 is a project-owned sidecar, shared across episodes. Its arrays contain Plot (id, name, description, label, theme/custom colour, archive state), Character and Location (id, name, description, archive state), StoryEvent, and SceneStory links. Every relation uses stable IDs. SceneStory references existing scene and screenplay identities and stores optional chronology, plot IDs, three independent character-role arrays, location ID and notes. It never copies screenplay content.

Chronology supports story day, calendar date, clock time, explicit relative position, chronology type and duration in minutes. Events additionally store name/description, major-event state, an occurrence scene ID and reveal/reference scene IDs. Event chronology and plot memberships are independent from the linked scenes. Views are derived, not persisted. Absent metadata is valid; no cue or heading is automatically promoted into confirmed story data. Removed-scene links remain recoverable. See ADR-054 for migration and persistence policy.

### Scene-derived defaults (ADR-055)

The manual-only extraction statement above is superseded by the writer's request for deterministic automatic defaults. Optional `sourceNames` and `sourceElementIds` on Character/Location records retain source associations independently of display names. Scene links may store last `derived` values and `manualFields` overrides. The story record may store ignored character/location source names and scene IDs whose autofill was explicitly disabled, preventing deleted metadata from reappearing. These optional fields are compatible additions to schema v1.

Chronology now includes an optional `timeOfDay` enum alongside exact clock time. Duration still uses fractional minutes on disk and is edited as minutes plus seconds. Major/Minor event selection uses the existing `major` boolean. Automatic extraction never changes screenplay text, screenplay order, or event plot assignments.

### Story refinement and profiles (ADR-057/058)

The shared StoryRecord now supports event context overrides and participants, separate event reveal/reference lists, plot scope/status/resolution, reversible identity-merge provenance, objective remote speaker links, canonical location parents, optional Character/Location profiles and character relationships. Existing schema-v1 records retain IDs, values and legacy semantics. Optional fields avoid a destructive migration; old independent events remain independent until explicitly switched to inheritance.

### Canonical Event, Plot and Scene relationships (ADR-061)

`StoryEvent.plotIds` is the canonical many-to-many Event-to-Plot relation. `occursInSceneId`, `revealedInSceneIds` and `referencedInSceneIds` are the canonical typed Event-to-Scene relations. `SceneStory.plotIds` stores only explicit additional Scene-to-Plot associations. It is not a reverse copy of Event membership.

Effective Scene Plots are derived from explicit Scene Plot IDs plus Event Plot IDs for Events that occur in or are revealed in the Scene. Referenced Events remain visible to the Scene but do not derive Plot membership. Effective Plot Scenes use the inverse projection of those same facts. Derived links carry source information for display and removal actions, are deduplicated by stable ID, and are never written back into `SceneStory.plotIds`. Existing schema-v1 records require no file migration: existing Scene Plot IDs remain explicit, existing Event Plot IDs remain canonical, and absent Event Plot IDs remain a valid unassigned state.

Profiles own prose, skills, appearances, image references and custom fields. Derived chronology, activity and statistics remain query results. Appearance boundaries reference scene/event IDs or structured Chronology. `sourceNames` represents screenplay identities; profile aliases/nicknames are separately stored. Location hierarchy uses existing location IDs, never a second Area database. Asset bytes are managed separately from story JSON. UserPreferences.profiles contains card and inspector settings, never project data.

Character profiles may store `dateOfBirth` in ISO date form. When a valid birth date is present, the existing optional `age` field is refreshed deterministically from the current date; presentation formats the birth date as day, abbreviated month and year. Character relationships may optionally store a configured type, a biological/adoptive/foster/step/half/in-law modifier, an audience discovery StoryPoint, and per-character discovery StoryPoints. Older free-text labels remain valid. Reciprocal and in-law family connections are derived views identified by their source relationship IDs, not additional saved Relationship records.


### Timeline refinement (ADR-062)

Timeline List groups chronological containers and nests Scene relationships. Tracks project entity progression in screenplay order. Optional Event.sceneInteractions store stable Scene IDs with investigated/new_evidence/reinterpreted roles; optional SceneStory.plotRoles, characterRoles and locationRoles store writer-authored labels by entity ID. All typed Event interactions now derive effective Scene Plot membership, superseding the reference exclusion above, without reverse writeback. Removed Scene projections are opt-in; retained Event context and unresolved recovery links survive scene deletion. Scene heading owns Scene Location; explicit Event Location overrides remain protected. Timeline icon/name preference belongs to UserPreferences.timelineDisplay, and icons/Plot colours are shared across story surfaces. Existing schema-v1 files remain compatible.


### Canonical Plot effects and read-only Tracks (ADR-063)

StoryEvent.plotEffects is an optional map of assigned Plot IDs to Introduced/Developed/Complicated/Revealed/Resolved, edited on the Event-to-Plot relationship. SceneStory.plotRoles is edited only for explicit Scene-to-Plot links; derived Event effects remain on the Event. Shared query projections retain the source Event/Scene ID for navigation. Tracks has no story mutation callback or independent relationship state. Legacy Track labels remain recoverable without guessing Event ownership. These optional fields retain story schema v1 compatibility. Timeline display now supports Icon + name and Name only; legacy Icon only preferences fall back to the named default. Same-scene Occurs suppresses redundant Revealed in the shared projection while retaining stored recovery links and later revelations.

Event occurrence timing is an optional Event-owned refinement (inherit/exact/range/duration/approximate). It applies only to occursInSceneId, never to later references or revelations. Ranges may cross midnight; duration remains minutes. Optional Chronology.endTime supports inherited Scene ranges. Presentation preserves Event→Plot ownership and suppresses equivalent legacy direct Scene effects without modifying data (ADR-064).

Timeline comparison introduces no canonical entities or relationships. Each derived appearance carries a stable Scene/Event identity plus its existing typed Scene relationship for matching. Event occurrence chronology remains distinct from later presentation chronology. UserPreferences optionally stores timelineOrder (story/screenplay/compare) and timelineDensity (compact/standard/expanded); hierarchy collapse and selection are transient UI state. Elapsed gaps derive from compatible known chronology only (ADR-065).

### Worlds (ADR-066)

WorldEntity optionally stores allowedRankIds and unitIds for Position eligibility, and history entries with stable IDs, optional fromPoint/untilPoint and field values. State history preserves original fields and resolves at existing screenplay/story points. A new dated ongoing change closes an earlier ongoing state period at that boundary. WorldRecord optionally remembers contextual relationshipOptions by source/target kind and label. Independent packages remap Position references and history identities; permanent deletion clears references to removed ranks/units. These additions preserve schema-v1 compatibility (ADR-073).

Optional WorldRecord.fieldOptions remembers custom selector values by category and field key, independently of whether a record still uses that value. Standard choices remain defined by the shared form configuration. Independent copies retain their own choices.

Optional StoryRecord.worlds stores WorldRecord schema v1: stable identity, name/description, linked canonical characterIds/locationIds, generic entities, generic relationships, saved diagram presentation and source-copy provenance. Generic kinds are Organisation, Object, Vehicle, Rule, Language/Lore and Note. Writer-owned fields and aliases are extensible; images refer to managed asset UUIDs. Membership relationships separately reference Rank, Position and reporting Character identity.

WorldPoint extends existing StoryPoint with optional screenplayId. Relationship effective intervals are [fromPoint, untilPoint); unknown cross-axis chronology comparisons remain unresolved. Ended/archived relations remain stored. WorldDiagram contains root/filter/collapse configuration, never duplicated canon. WorldOccurrence stores canonical entity reference, optional worldId, screenplay/scene identity, scene/text scope, stable element anchors, original selected text and optional needsReview recovery state. Existing story entities can be contextually linked without first creating a World. worldUi stores only project reference pins and optional indicator visibility.

WorldPackage schema v1 contains format story-world, World data, canonical People/Places dependencies (including Location ancestors) and validated image assets. Library/Project copies retain provenance, remap internal identities and assets, and preserve unresolved external chronology/story anchors. Project Worlds and occurrences round-trip through existing story adapters and snapshots; Library masters use a separate storage API and backup stream. These additions preserve older schema-v1 story files, IDs and screenplay records without destructive migration.

Generic World entities may carry an organisationRole (unit/rank/position) or customType key. Roles are independent of writer-facing labels. Canonical Scene-level Plot/Character/Event links continue to use existing SceneStory/StoryEvent fields; World exact-text occurrences retain their distinct anchor semantics.

### Organisation hierarchy and typed fields

WorldEntity optionally has `abbreviation`, `rankGroup`, `rankLevel` and `fieldLinks: Record<field name, WorldRef>`. OrganisationRole still distinguishes units, ranks and positions. WorldRelationship `part of` represents reusable multi-parent organisation placements; effective periods preserve historical structure. Character organisation/rank/position assignments stay on the existing WorldRelationship membership owner. Character and Location profiles can edit generic fields linked to their canonical IDs without copying field values. Timeline role abbreviations are temporal read projections, and compact footer pins prefer the supplied entity abbreviation.

### Corrected Organisation model (ADR-068)

The shared World entity discriminator now separates Organisation, internal Structure, Rank definition and Position definition. A Structure carries organisationId, structureType, optional hierarchyLevel and independent displayOrder. A membership's Organisation reference and optional unitId share its existing rankId/positionId/reportsToId and effective periods. Organisation category is optional and inherited by query; structure ownership and explicit parent/reporting links generate the chart. Numeric levels are presentation hints and never establish saved reporting canon. Rank/position definitions support optional Organisation scope and remain outside structural charts. structureModelVersion identifies migrated World semantics while retaining the existing story/package schema envelope and stable identifiers.

### Worlds permanent deletion semantics (ADR-069)

Deletion removes World/entity/relationship/diagram records from current and historical read projections. Deleted internal units remove entire memberships whose unitId points at them; deleted rank/position definitions clear only the corresponding assignment. Independent child Organisations survive with parent links removed. Owned structural descendants are explicitly rehomed or explicitly deleted; role-definition scopes are cleared when their Organisation is deleted. Typed field links are removed while authored field text is retained. Saved diagrams survive entity deletion with deleted roots/collapse keys removed; diagram deletion removes associated pins. Whole World deletion removes its occurrences, pin records and identity-merge World references, retaining canonical project Characters/Locations. No new schema envelope or screenplay mutation is introduced.

### Character membership integration (ADR-070)

No membership fields are added to EntityProfile. The existing WorldRelationship owns Organisation reference, unitId, rankId, positionId, reportsToId and effective bounds, including parallel memberships and promotion periods. Both editing surfaces link the same canonical Character ID into World.characterIds. Whole-episode summaries display the last included episode while preserving exclusive stored end bounds. ProfilePreferences optionally adds characterWorldFields (Organisation, unit, rank, position), scoped only to presentation. Existing schema-v1 records and older preferences remain valid.

Organisation rank hierarchy uses rankLevel (1 is most senior; higher numbers are more junior). Membership reporting defaults are derived at the viewed story point from the nearest higher occupied rank in the same Organisation and internal unit. Optional reportsToIds stores explicit reporting selections; an empty array means no reporting targets. Legacy reportsToId remains supported. See ADR-071 and ADR-072.
