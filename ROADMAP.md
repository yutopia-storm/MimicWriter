Development Roadmap

Purpose

This roadmap controls sequencing.

Features listed in later phases should inform architecture but should not be implemented early without explicit instruction.

The roadmap may be changed as development progresses.

Phase 0: Project Foundation

Create and maintain:

AGENTS.md

PROJECT.md

ARCHITECTURE.md

DATA_MODEL.md

BUILD_RULES.md

ROADMAP.md

DECISIONS.md

Establish repository conventions.

No product feature should be inferred merely from documentation creation.

Phase 1: Desktop Application Foundation

Primary objective:

Create a stable desktop application foundation.

Includes:

application shell;

first-run experience;

owner/configuration architecture;

branding configuration;

terminology architecture;

feature flags;

user preferences;

Admin foundation;

editable content architecture;

local storage selection;

storage verification;

basic backup architecture;

secure credential architecture;

project creation;

Feature and Series project concepts.

Avoid premature AI functionality.

Phase 2: Screenplay Core

Includes:

screenplay domain model;

scene model;

stable scene IDs;

screenplay elements;

scene navigation;

continuous screenplay view;

scene editing;

scene creation;

scene deletion;

scene reordering;

autosave;

lock/unlock;

revision foundation;

project compilation.

Goal:

The application should already be useful as screenplay software without AI.

Phase 3: Import and Export

Includes:

Fountain import;

Fountain export;

FDX import;

FDX export;

PDF import;

import review;

professional PDF export;

title-page handling;

screenplay parser validation.

PDF complexity may require staged implementation.

Phase 4: AI Foundation

Includes:

provider abstraction;

capability architecture;

secure BYO API credentials;

provider connection testing;

initial provider adapter;

configurable model assignments;

structured AI responses;

failure handling;

usage measurement;

prompt versioning foundation.

AI must remain optional for ordinary writing.

Phase 5: Basic Project Brain

Includes initial structured extraction of:

characters;

locations;

relationships;

basic story facts;

scene summaries;

basic character state;

provenance.

Include confirmation mechanisms where interpretation is uncertain.

Do not yet implement every future intelligence system.

Phase 6: Style Engine

Includes:

reference screenplay import for analysis;

Style DNA;

deterministic style measurements;

AI semantic style analysis;

custom style profiles;

built-in style profiles;

writer style analysis;

project style;

scene style overrides.

Phase 7: Rewrite Engine

Includes:

rewrite scene;

action only;

dialogue only;

action and dialogue;

atmosphere;

prose;

description;

tension;

pacing;

perspective;

style strength;

rewrite intensity;

preservation settings;

rewrite modes;

protected beats;

original/current source selection;

compare;

accept;

reject;

revision creation.

Phase 8: Advanced Story Intelligence

Potential features:

richer timeline;

character knowledge;

character voice;

relationship intelligence;

story threads;

setup/payoff;

character journey;

change impact;

continuity analysis;

Ask Project.

Implement individually rather than as one giant feature.

Phase 9: Production and Notes Intelligence

Potential features:

production-awareness modes;

production-impact warnings;

writer notes;

producer notes;

network notes;

note-resolution assistance;

draft comparison.

Phase 10: Desktop Beta Hardening

Focus:

real screenplay testing;

import reliability;

revision recovery;

crash recovery;

backup reliability;

large screenplay performance;

AI-provider failure;

offline behaviour;

cloud-synchronised folder behaviour;

schema migration;

installer;

updates;

diagnostics;

privacy;

accessibility;

usability.

Avoid feature expansion unless required by beta evidence.

Phase 11: Desktop Commercial Release

Potential requirements:

licensing;

purchase/activation;

device management;

update system;

support content;

polished onboarding;

final branding;

legal documentation;

privacy documentation.

Commercial specifics remain subject to later decisions.

Phase 12: Hosted Architecture

Only begin after desktop stability is demonstrated.

Includes planning for:

web client;

accounts;

authentication;

authorisation;

hosted project storage;

server backups;

managed AI;

usage metering;

subscription billing;

AI allowances;

downloadable backups;

account/project deletion;

privacy/security;

desktop/cloud project portability.

Phase 13: Hosted Product

Implement the hosted application using the proven core concepts.

Do not assume the hosted interface must exactly reproduce every desktop implementation detail.

Preserve project compatibility where practical.

Roadmap Rule

The current build request may alter sequencing.

When this occurs, update this roadmap deliberately.

Do not silently mark a phase complete because one component of it exists.
## Build 002 scope addition: manual story tracking

The requested manual timeline, event, plot, character and location relationships are implemented within Build 002. This deliberately brings forward structured manual metadata and timeline views from later story-intelligence work. It does not complete Phase 5 or Phase 8, or authorize AI extraction, character knowledge inference, automated continuity checking, or hosted functionality.

Build 002 now also includes deterministic scene-derived defaults requested by the writer: characters, locations, time periods and page-based duration. AI extraction and continuity analysis remain deferred; see ADR-055.
