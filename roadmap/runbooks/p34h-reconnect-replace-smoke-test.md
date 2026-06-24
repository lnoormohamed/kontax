# P34H Reconnect / Replace Smoke Test

## Goal

Validate the reconnect-versus-replace flow end to end after Phases 34G and 34H.

## Preconditions

- A user with at least one historical `DISCONNECTED` CardDAV sync account
- The disconnected row should have:
  - existing sync jobs
  - existing sync links
  - a known `connectionId`
- The user should be below or at the sync-account plan cap depending on the case

## Test Matrix

1. Reconnect an existing disconnected connection
   - Open `/sync`
   - Open `Add sync account`
   - Enter the same CardDAV `label` and `baseUrl` as the disconnected row
   - Confirm the chooser appears
   - Keep `Reconnect existing connection` selected
   - Submit
   - Verify:
     - the old row id is restored
     - the old `connectionId` is preserved
     - the connection appears in the active rail
     - prior settings remain intact
     - prior sync history remains intact
     - activity shows a reconnect event, not a new connection event

2. Create a new connection and retire the old one
   - Repeat the same add-account attempt against a disconnected row
   - Choose `Create new connection and retire old one`
   - Submit
   - Verify:
     - a new active row is created
     - the new row has a different row id
     - the new row has a different `connectionId`
     - the old row is marked `RETIRED`
     - replacement lineage links point both directions
     - the user lands in the new connection detail view

3. Retired row visibility
   - Confirm the retired row does not appear in the active sync-account section
   - Confirm the retired row does appear in `Past connections`
   - Open the retired row detail
   - Verify the detail copy explains that it is no longer active
   - Verify the detail points to the replacement connection in plain language

4. Activity copy
   - Verify user-facing activity text uses plain language:
     - `<label> reconnected`
     - `<label> connection retired`
     - `New <label> connection created`

5. Plan-cap accounting
   - Verify `DISCONNECTED` rows do not consume sync-account slots
   - Verify `RETIRED` rows do not consume sync-account slots
   - Verify reconnecting an existing historical row still respects the plan cap correctly
   - Verify replacing an old row with a new one does not double-count the slot after retirement

6. Guardrails
   - Verify retired rows cannot be restored through the normal reconnect path
   - Verify reconnect preserves links/history instead of creating duplicates
   - Verify replacement does not expose the retired row as active again

## Verification Surfaces

- `/sync`
- activity feed
- sync recovery export

## Notes

- Customer-facing UI should not expose raw row ids or `connectionId`.
- Support/debug tooling should confirm row id versus `connectionId` in exported recovery data.
