# Runbook: Contact Photo & Profile Picture QA

**Subsystem:** Contact photos across create/edit, list/detail rendering, public card, and provider-origin sync  
**Audience:** QA, support, engineering

---

## Scope

This checklist covers the shipped contact-photo behavior in Kontax:

- contact photo URLs saved through the create/edit forms
- provider-origin contact photos already present on synced contacts
- rendering consistency across:
  - contacts list
  - desktop contact detail
  - mobile contact detail
  - public card where a photo is present
- fallback initials behavior when no photo exists

Use the image-heavy fixture in:

- [tests/fixtures/provider-fixtures/contact-photo-fixture.json](/Users/lnoormohamed/ChatGPT/Kontax/tests/fixtures/provider-fixtures/contact-photo-fixture.json)

---

## Expected behavior

- A valid `avatarUrl` displays as a cropped circle in contact list rows.
- The same photo displays on desktop and mobile contact detail surfaces.
- The public card shows the configured photo when public-card visibility allows it.
- If no `avatarUrl` exists, the UI falls back to deterministic initials/avatar colors.
- Invalid or missing image URLs should fail gracefully without breaking the page layout.

---

## Test matrix

| ID | Test | Expected result |
|---|---|---|
| CPHOTO-01 | Create a contact with a photo URL in the full create form | Contact saves successfully and the photo appears in the list + detail view. |
| CPHOTO-02 | Edit an existing contact and add a photo URL in the mobile sheet | Contact saves successfully and the photo appears after refresh. |
| CPHOTO-03 | Replace an existing photo URL | The newer image replaces the older one across list/detail/public surfaces. |
| CPHOTO-04 | Clear the photo URL | Initials fallback returns across list/detail/public surfaces. |
| CPHOTO-05 | Open desktop contact detail for a contact with photo | The hero avatar is cropped correctly and favorite badge still overlays cleanly. |
| CPHOTO-06 | Open mobile contact detail for a contact with photo | The hero avatar is cropped correctly and action pills still align. |
| CPHOTO-07 | View the same contact in the contacts list | The row avatar uses the image rather than initials. |
| CPHOTO-08 | View a public card backed by a visible photo | The public card avatar shows the image with circular crop. |
| CPHOTO-09 | Use a provider-origin contact photo on a synced contact | The synced contact renders the provider photo without needing manual edits. |
| CPHOTO-10 | Use a broken image URL | The page layout remains stable; investigate console/network behavior if image fails. |

---

## Manual smoke flow

1. Create a new contact with:
   - first name / last name
   - email
   - phone
   - photo URL
2. Confirm the photo in the contacts list.
3. Open the contact detail on desktop and confirm crop/favorite badge overlap.
4. Open the same contact on mobile and confirm crop/action row spacing.
5. Replace the photo URL and repeat the list/detail checks.
6. Clear the photo URL and confirm initials fallback everywhere.
7. If the contact has a public card, confirm the public card avatar matches the saved photo.

---

## Notes

- Contact photos currently use URL-based media rather than a dedicated contact-image upload flow.
- Account profile photos have their own separate QA path in:
  - [full-smoke-test-and-field-edit-audit.md](/Users/lnoormohamed/ChatGPT/Kontax/roadmap/runbooks/full-smoke-test-and-field-edit-audit.md)
