Build Rules

User-facing language

Use plain, friendly language throughout the interface, including labels, help text, confirmations and errors. Explain outcomes in the writer’s terms. Avoid implementation terms such as canonical, metadata, provenance, temporal boundary or exclusive, and shorthand such as “blank = Current”. Keep internal data identifiers unchanged when improving interface wording.

1. Scope

Implement only the requested build.

Do not implement future features merely because they are documented.

2. Preserve Existing Functionality

Do not remove, rename, redesign or replace unrelated working functionality unless explicitly required.

3. Inspect Before Changing

Inspect existing implementation before modifying it.

Do not assume a system is absent merely because its implementation is not immediately obvious.

4. No Unrequested UI

Do not add speculative:

navigation;

dashboard items;

buttons;

panels;

menus;

settings;

workflows.

5. Future Compatibility

Current implementation should remain reasonably compatible with documented future architecture.

Do not build future functionality solely for compatibility.

6. Branding

Do not unnecessarily hard-code the working name MimicWriter.

Use brand configuration.

7. Owner-Changeable Values

Values reasonably expected to change should normally be configurable.

Examples:

branding;

terminology;

defaults;

prompts;

built-in styles;

feature availability;

limits;

editable content.

8. Security Exception

Secrets must not be stored in ordinary configurable settings.

Use secure credential/environment mechanisms.

9. Original Screenplay Safety

Never destructively overwrite the only recoverable original screenplay content.

10. Stable Scene IDs

Scene IDs must remain stable regardless of:

order;

numbering;

heading changes;

location changes.

11. Revision Safety

AI transformations create revisions.

Do not silently replace writer content.

12. Locked Scenes

AI operations must respect locked scenes at the service/domain level, not merely the UI level.

13. Protected Beats

AI transformations must preserve active protected beats unless explicitly authorised otherwise.

14. AI Authority

AI may suggest.

The writer decides.

AI inference must not silently become confirmed canon.

15. AI Provider Independence

Do not place provider-specific AI calls throughout application components.

Use provider adapters and capability services.

16. Storage Independence

Do not tightly couple core screenplay logic to one storage mechanism.

17. Offline Editing

Basic screenplay editing must remain possible without AI connectivity.

18. No Secret Leakage

Never expose API credentials in:

logs;

exports;

backups;

configuration files;

crash reports;

UI where unnecessary.

19. Configuration Export

Configuration exports must exclude secrets.

20. Database Changes

Do not make destructive schema changes without explicit migration.

21. Project Format Changes

Persisted project format changes require schema-version consideration.

22. Import Safety

Do not assume imported screenplay parsing is perfect.

Preserve source information and allow validation where appropriate.

23. Deterministic Before AI

If a value can be calculated reliably using deterministic code, do not unnecessarily use AI.

24. AI Context

Send relevant context, not indiscriminately the entire project for every request.

25. Logging

Do not unnecessarily log screenplay text.

26. Error Isolation

Failure of an AI operation must not corrupt screenplay content.

Failure of backup must not prevent ordinary writing unless data safety requires intervention.

27. No Premature Cloud Implementation

Do not build authentication, subscriptions, hosted storage or managed AI during desktop phases unless explicitly requested.

28. No Premature Optimisation

Do not add complex infrastructure without an actual current requirement.

29. Reuse Existing Patterns

Where the repository already contains an appropriate pattern, extend it rather than creating a parallel system without reason.

30. Testing

Every build should test:

requested functionality;

obvious failure cases;

relevant existing functionality.

31. Documentation

Update documentation when an architectural decision genuinely changes.

Do not rewrite documentation merely to describe incidental implementation details.

32. Decision Conflicts

If a requested implementation contradicts a documented architectural decision, identify the conflict rather than silently overriding it.

33. User Work Comes First

When choosing between convenience for the implementation and protection of writer work, prioritise writer data integrity.

34. Product Principle

The application is screenplay software first.

AI should enhance the writing workflow rather than take control of it.
