# P13-04 Change Propagation Across Family Members

## Purpose
This ticket implements the mechanism by which a change made to a shared contact by one family member becomes visible to all other members — ideally in near real-time, with a reliable polling fallback. Without propagation, the shared address book is effectively write-once-read-never from the perspective of other members until they manually reload. The propagation mechanism must be lightweight, not require a full WebSocket infrastructure, and be upgradeable to real-time in a future iteration if the v1 SSE approach is not feasible.

## Background
Phase 13-03 established that every shared contact mutation touches `GroupContact.updatedAt` and emits ActivityEvent rows for all ACCEPTED group members. The CTag for a GroupAddressBook is derived from the maximum `GroupContact.updatedAt` value in the address book (defined in P13-01). These two building blocks are the foundation of the propagation mechanism: a client can detect that the shared book has changed by comparing the server's current CTag against the last CTag the client received.

Phase 9 established the CTag concept for private address book change detection in the CardDAV server. Phase 13 reuses the same concept but exposes it over a REST endpoint rather than a CardDAV PROPFIND, because the workspace client is a Next.js web app, not a CardDAV client.

The v1 target for propagation is SSE (Server-Sent Events): a long-lived HTTP connection from each connected member's browser to the server, where the server pushes a lightweight "shared book updated" message when the CTag changes. This approach requires no WebSocket infrastructure and works within the Next.js App Router route handler model.

If SSE is not viable in v1 due to serverless deployment constraints (see Risks section), the documented fallback is polling every 30 seconds combined with a "Family book updated — click to refresh" banner.

## Scope

**In scope:**
- `GET /api/family/{groupId}/ctag` endpoint: returns the current CTag for the group's default address book
- SSE endpoint `GET /api/family/{groupId}/events`: streams CTag change signals to connected members
- Client-side SSE connection management in the workspace
- Polling fallback: 30-second interval CTag check with "Family book updated" banner
- ActivityEvent emission for every ACCEPTED member on shared contact changes (fan-out defined in P13-03, this ticket wires it into the workspace refresh)
- Documenting which mechanism ships in v1 and marking the other as deferred

**Out of scope:**
- Full contact data push over the propagation channel — the channel carries signals only, not contact payloads
- WebSocket infrastructure
- Push notifications to mobile devices (Phase 15 or later)
- Real-time conflict detection over the push channel (P13-03 handles concurrent edits)
- Multi-group propagation (v1 is one family group per user)

## Design / Implementation Spec

### CTag REST Endpoint

**API Route:** `GET /api/family/{groupId}/ctag`

**Authentication:** Session cookie (existing Next.js auth middleware)

**Authorization:** Requesting user must be an ACCEPTED GroupMember of this group

**Response:**
```typescript
{
  ctag: string       // ISO 8601 UTC string, or "empty" if no contacts
  groupId: string
  addressBookId: string
}
```

**Implementation:**
```typescript
export async function GET(
  req: Request,
  { params }: { params: { groupId: string } }
) {
  const user = await getAuthenticatedUser(req)
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: params.groupId, userId: user.id, inviteStatus: 'ACCEPTED' }
  })
  if (!membership) return Response.json({ error: 'NOT_A_GROUP_MEMBER' }, { status: 403 })

  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    include: { defaultAddressBook: true }
  })
  if (!group?.defaultAddressBook) return Response.json({ error: 'NO_ADDRESS_BOOK' }, { status: 404 })

  const ctag = await getGroupAddressBookCTag(group.defaultAddressBook.id)
  return Response.json({ ctag, groupId: params.groupId, addressBookId: group.defaultAddressBook.id })
}
```

This endpoint is used by the polling fallback. The SSE endpoint (below) also internally uses this function to detect changes to stream.

### SSE Endpoint

**API Route:** `GET /api/family/{groupId}/events`

Server-Sent Events deliver a stream of change notifications to connected clients. The endpoint holds the connection open and periodically checks whether the CTag has changed since the last check. When a change is detected, it sends a `data:` message and continues holding the connection.

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no   ← important for nginx: disables buffering which would break SSE
```

**SSE message format:**
```
event: shared-book-updated
data: {"ctag":"2025-11-03T14:22:01.000Z","groupId":"clxxx","addressBookId":"clyyyy"}

```

(Note: SSE messages are terminated by two newlines. Each field is `key: value\n`. The event block ends with a blank line.)

**Implementation approach:**

```typescript
export async function GET(
  req: Request,
  { params }: { params: { groupId: string } }
) {
  const user = await getAuthenticatedUser(req)
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: params.groupId, userId: user.id, inviteStatus: 'ACCEPTED' }
  })
  if (!membership) return new Response('Forbidden', { status: 403 })

  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    include: { defaultAddressBook: true }
  })
  if (!group?.defaultAddressBook) return new Response('Not Found', { status: 404 })

  const addressBookId = group.defaultAddressBook.id
  let lastCTag = await getGroupAddressBookCTag(addressBookId)

  const stream = new ReadableStream({
    start(controller) {
      // Send initial CTag immediately so the client knows the baseline
      const initial = `event: connected\ndata: ${JSON.stringify({ ctag: lastCTag, groupId: params.groupId })}\n\n`
      controller.enqueue(new TextEncoder().encode(initial))

      const interval = setInterval(async () => {
        try {
          const currentCTag = await getGroupAddressBookCTag(addressBookId)
          if (currentCTag !== lastCTag) {
            lastCTag = currentCTag
            const msg = `event: shared-book-updated\ndata: ${JSON.stringify({ ctag: currentCTag, groupId: params.groupId, addressBookId })}\n\n`
            controller.enqueue(new TextEncoder().encode(msg))
          }
          // Send a heartbeat every 30 seconds to keep the connection alive
        } catch {
          controller.close()
          clearInterval(interval)
        }
      }, 3000) // Poll DB every 3 seconds for CTag changes

      // Heartbeat every 25 seconds to prevent proxies from closing the connection
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 25000)

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(heartbeatInterval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
```

**DB polling frequency within the SSE handler:** 3 seconds. This means changes propagate to other connected members within 3 seconds of the GroupContact.updatedAt being updated. The 3-second interval is a balance between responsiveness and DB load. With 6 members each holding an SSE connection, the server executes at most 6 CTag queries (each is a fast `MAX(updatedAt)` aggregate with an index) every 3 seconds. This is acceptable for v1.

**Connection limits:** In a serverless (Vercel) deployment, SSE connections are subject to the maximum function execution timeout (typically 60 seconds on Vercel Hobby, up to 300 seconds on Pro). If the deployment platform does not support long-lived connections, SSE is not viable and the polling fallback must be used instead.

**Decision gate for v1:** Before shipping Phase 13, verify that the deployment environment supports long-lived SSE connections. If running on Vercel with a function timeout below 60 seconds, fall back to polling. Document the chosen approach in a comment at the top of the SSE route handler file.

### Polling Fallback

If SSE is not viable in v1, the client polls `GET /api/family/{groupId}/ctag` every 30 seconds and compares the returned CTag against the last known CTag.

**Client-side polling logic (React hook):**

```typescript
function useFamilyBookPolling(groupId: string | null) {
  const [hasUpdates, setHasUpdates] = useState(false)
  const lastCTagRef = useRef<string | null>(null)

  useEffect(() => {
    if (!groupId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/family/${groupId}/ctag`)
        const data = await res.json()
        if (lastCTagRef.current === null) {
          lastCTagRef.current = data.ctag
          return
        }
        if (data.ctag !== lastCTagRef.current) {
          lastCTagRef.current = data.ctag
          setHasUpdates(true)
        }
      } catch {
        // Polling failures are silent — do not show an error banner
      }
    }

    poll() // Initial fetch
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [groupId])

  const dismissUpdates = useCallback(() => setHasUpdates(false), [])
  return { hasUpdates, dismissUpdates }
}
```

**Update banner:**

When `hasUpdates` is true, show a non-blocking banner at the top of the workspace:

```
[Family book updated] One or more shared contacts have changed. [Refresh] [Dismiss]
```

"Refresh" triggers a re-fetch of the shared contacts list and sets `hasUpdates` to false. "Dismiss" sets `hasUpdates` to false without refreshing. After the user dismisses or refreshes, polling continues — the next change will show the banner again.

### Client-Side SSE Connection Management

**React hook for SSE:**

```typescript
function useFamilyBookSSE(groupId: string | null) {
  const [hasUpdates, setHasUpdates] = useState(false)
  const lastCTagRef = useRef<string | null>(null)

  useEffect(() => {
    if (!groupId) return

    const eventSource = new EventSource(`/api/family/${groupId}/events`)

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data)
      lastCTagRef.current = data.ctag
    })

    eventSource.addEventListener('shared-book-updated', (e) => {
      const data = JSON.parse(e.data)
      if (data.ctag !== lastCTagRef.current) {
        lastCTagRef.current = data.ctag
        setHasUpdates(true)
      }
    })

    eventSource.onerror = () => {
      // On SSE error, fall back to polling
      eventSource.close()
    }

    return () => eventSource.close()
  }, [groupId])

  const dismissUpdates = useCallback(() => setHasUpdates(false), [])
  return { hasUpdates, dismissUpdates }
}
```

**SSE with polling fallback pattern:**

The workspace should use SSE when available and fall back to polling on SSE error or when SSE is not supported:

```typescript
function useFamilyBookUpdates(groupId: string | null) {
  const [sseAvailable, setSseAvailable] = useState(true)
  const sseResult = useFamilyBookSSE(sseAvailable ? groupId : null)
  const pollResult = useFamilyBookPolling(!sseAvailable ? groupId : null)

  // If SSE errors out, switch to polling
  // (SSE hook signals unavailability by setting sseAvailable to false internally)

  return sseAvailable ? sseResult : pollResult
}
```

### ActivityEvent-Driven Refresh (Alternative Signal)

In addition to CTag polling, the client can also detect changes by watching the ActivityEvent feed. When the global activity feed has new events with `actor: FAMILY_MEMBER`, the shared contacts may have changed. This is a secondary signal — less precise than CTag (it fires for all family events, including ones that don't change the contact list), but useful as a fallback or supplement.

This integration is optional in v1. If the workspace already has a mechanism for live activity feed updates, it can fire a shared-contacts refresh when it receives new FAMILY_MEMBER events.

### CTag-Triggered Contact Refetch

When the client receives a "shared-book-updated" signal (either from SSE or polling), it must refetch the shared contacts list. The refetch should be targeted — fetch only contacts with `GroupContact.updatedAt > lastFetchTimestamp` — rather than fetching all shared contacts again.

**Incremental fetch endpoint:**

`GET /api/family/{groupId}/contacts?updatedSince={isoTimestamp}`

Returns only GroupContact-linked contacts whose `GroupContact.updatedAt` is greater than the provided timestamp. The client merges these into its local contact list.

This incremental approach is important for families with large shared contact books — a full re-fetch on every CTag change would be expensive.

**API implementation sketch:**

```typescript
export async function GET(req: Request, { params }: { params: { groupId: string } }) {
  const user = await getAuthenticatedUser(req)
  // ... membership check ...

  const url = new URL(req.url)
  const updatedSince = url.searchParams.get('updatedSince')

  const whereClause: Prisma.GroupContactWhereInput = {
    groupAddressBook: { groupId: params.groupId },
    contact: { archivedAt: null }
  }

  if (updatedSince) {
    whereClause.updatedAt = { gt: new Date(updatedSince) }
  }

  const groupContacts = await prisma.groupContact.findMany({
    where: whereClause,
    include: { contact: true },
    orderBy: { updatedAt: 'desc' }
  })

  return Response.json({ contacts: groupContacts.map(gc => gc.contact), fetchedAt: new Date().toISOString() })
}
```

### Documenting the v1 Choice

The file `src/app/api/family/[groupId]/events/route.ts` must contain a comment block at the top:

```typescript
/**
 * FAMILY BOOK CHANGE PROPAGATION — v1 MECHANISM
 *
 * Target: Server-Sent Events (SSE) — this file.
 * Fallback: 30-second polling via GET /api/family/{groupId}/ctag
 *
 * v1 ships with: [SSE | POLLING] ← fill in before release
 *
 * SSE requires long-lived HTTP connections. If deployed on Vercel Hobby (60s
 * function timeout) or similar, SSE connections will be cut at the timeout
 * boundary and clients will reconnect continuously. In that case, switch to
 * the polling fallback by disabling this route and using useFamilyBookPolling()
 * in the workspace client.
 *
 * To upgrade to WebSocket propagation in a future phase: replace this SSE
 * endpoint with a WebSocket upgrade handler. The client hook (useFamilyBookSSE)
 * would need to be replaced, but the CTag signal format and incremental fetch
 * endpoint (GET /api/family/{groupId}/contacts?updatedSince=) remain unchanged.
 */
```

## Acceptance Criteria

- `GET /api/family/{groupId}/ctag` returns the current CTag for the group's default address book; returns 403 for non-members
- CTag changes within 1 second of a GroupContact.updatedAt update (i.e., the CTag derivation query reflects the new updatedAt immediately)
- SSE endpoint `GET /api/family/{groupId}/events` holds the connection open and sends a `shared-book-updated` event when the CTag changes; the event data includes the new CTag value
- SSE connection sends a heartbeat comment every 25 seconds to prevent proxy timeouts
- SSE connection closes cleanly when the client disconnects (AbortSignal fires)
- Client-side SSE hook reconnects automatically on connection error
- Polling fallback hook polls every 30 seconds and sets `hasUpdates` to true when the CTag changes
- "Family book updated" banner appears in the workspace when `hasUpdates` is true (implemented in P13-05, wired here)
- `GET /api/family/{groupId}/contacts?updatedSince={isoTimestamp}` returns only contacts updated after the given timestamp
- ActivityEvent rows with actor: FAMILY_MEMBER appear in all ACCEPTED members' activity feeds after a shared contact mutation
- The v1 mechanism choice (SSE or polling) is documented in a comment block in the SSE route handler file

## Risks and Open Questions

- **Vercel function timeout:** SSE connections on Vercel are subject to the maximum function duration. On Vercel Pro, this is up to 300 seconds (5 minutes). Clients must reconnect after timeout — the `useFamilyBookSSE` hook handles this with the `onerror` fallback to polling. On Vercel Hobby (60 second max), SSE is not viable and the polling fallback must ship as the primary mechanism. Determine the deployment tier before committing to SSE as the v1 default.
- **DB polling frequency inside SSE handler:** Every open SSE connection polls the DB every 3 seconds. With 6 members connected simultaneously, this is 2 queries/second per group, or roughly 120 DB queries/minute for a single family. This is negligible for a PostgreSQL instance at current scale but should be monitored. If many families are active simultaneously, the aggregate polling load may warrant a Redis pub/sub intermediate layer to fan out CTag changes without each connection polling the DB independently.
- **EventSource browser support:** EventSource (SSE) is supported in all modern browsers. It is not supported in Internet Explorer (not a concern for Kontax) and requires polyfilling in some older Safari versions. The `useFamilyBookSSE` hook should catch the case where `EventSource` is undefined in the global scope and fall back to polling.
- **SSE and Next.js App Router edge runtime:** If the SSE route handler is deployed on the Next.js edge runtime (for latency reasons), long-lived connections behave differently. Keep this route on the Node.js runtime explicitly by exporting `export const runtime = 'nodejs'` from the route file.
- **CTag race condition:** If two members edit the same contact simultaneously (within the 3-second SSE polling window), both edits produce a CTag change. The SSE endpoint may only emit one event (the first change detection), causing the second member's browser to miss the second signal until the next 3-second check. This is acceptable — the next poll will catch it. The worst-case delay is 3 seconds (SSE) or 30 seconds (polling).

## Outcome
Changes to the shared family address book propagate to all connected members within 3 seconds via SSE (or within 30 seconds via polling fallback), with a documented and upgradeable propagation architecture.
