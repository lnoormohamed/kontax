# Admin Broadcast Playbook

## Purpose

Keep admin broadcasts consistent, reviewable, and safe under time pressure.

## Recommended workflow

1. Start from a template when the message is a release note, incident, billing
   notice, or maintenance window.
2. Set audience filters before editing copy so the preview reflects the intended
   cohort.
3. Run **Preview audience** before any scheduled or immediate send.
4. Read the audience summary and safety warnings:
   - broad default audience sends should be rare
   - schedules must be at least 5 minutes in the future
5. Use **Save draft** when a second operator should review the copy first.
6. Use **Duplicate as new** when reusing a past message. Do not edit sent or
   retracted history in place.
7. Use **Retract** only when the message should no longer remain visible.

## Template guidance

### Release note

- announce one clear improvement
- keep the body to what changed and why it matters
- prefer a changelog or feature destination link

### Incident

- name the affected provider or workflow
- say user data is safe when true
- promise a follow-up update rather than an uncertain resolution time

### Billing notice

- focus on the required user action
- link directly to the relevant settings surface when possible

### Maintenance

- include the time window
- set expectations for delayed sync or temporary degradation

## Safety notes

- Broad default audience sends should have an intentional operator confirmation.
- Scheduled sends should leave enough time for cancellation or correction.
- Retraction dismisses still-visible in-app notices for impacted recipients.
