# P34J Provider Capability QA Runbook

## Purpose

Verify that provider-limited fields stay canonical in Kontax and in stronger
providers, while weaker providers only receive the fields they actually support.

This runbook covers the mixed-capability cases introduced in Phase 34I and made
legible in Phase 34J.

## Fixture contacts

Use these canonical fixtures in staging:

1. `Dr. Ngoc Thu Nguyen MBA`
2. `Ms. Eleanor Grace Hart`
3. `Dr. Layla Hassan Al Kilani`
4. `Li Xiaochen`

Recommended script variants may keep native-script versions in the remote
provider:

- Vietnamese: `Dr. Ngọc Thu Nguyễn MBA`
- Arabic: `د. ليلى حسن الكيلاني`
- Mandarin: `李小晨`

## Minimum field coverage per fixture

Each fixture should include:

- birthday
- anniversary
- lunar birthday or another custom date label
- multiple phone numbers with standard and custom labels
- multiple email addresses with standard and custom labels
- multiple websites with standard and custom labels
- multiple addresses with standard and custom labels
- notes

## Provider expectations

### iCloud

Expected to preserve:

- birthday
- anniversary
- lunar birthday / custom extra dates
- multilingual text
- custom labels for phones, emails, websites, and addresses

### Fastmail

Expected to preserve:

- birthday
- multilingual text
- custom labels for phones, emails, websites, and addresses

Expected not to store:

- anniversary
- lunar birthday
- other extra significant-date variants beyond birthday

These values must stay canonical in Kontax and remain available to stronger
providers like iCloud.

## Required scenarios

### 1. iCloud -> Kontax -> Fastmail

1. Start with the full fixture in iCloud.
2. Run iCloud sync into Kontax.
3. Link the same workspace to Fastmail and run outbound sync.
4. Verify:
   - Fastmail receives birthday.
   - Fastmail does not receive anniversary or lunar birthday.
   - Kontax still shows anniversary and lunar birthday.
   - A later Fastmail sync does not remove those extra dates from Kontax.

### 2. Fastmail -> Kontax -> iCloud

1. Edit a supported field in Fastmail, such as mobile phone or work email.
2. Run Fastmail sync into Kontax.
3. Run outbound sync to iCloud.
4. Verify:
   - The supported field updates in Kontax.
   - The supported field reaches iCloud.
   - Existing iCloud-only extra dates remain intact.

### 3. Stronger-provider edit round trip

1. Edit anniversary and lunar birthday in iCloud.
2. Sync iCloud -> Kontax.
3. Sync Kontax -> Fastmail.
4. Verify:
   - Fastmail still omits those extra dates.
   - Kontax keeps them.
   - A later Fastmail sync does not erase them.

### 4. Weaker-provider edit round trip

1. Edit birthday in Fastmail.
2. Sync Fastmail -> Kontax.
3. Sync Kontax -> iCloud.
4. Verify:
   - Birthday updates in Kontax.
   - Birthday updates in iCloud.
   - Anniversary and lunar birthday remain unchanged.

## UX checks

For a provider that does not support extra significant dates, verify:

- sync detail view shows calm explanatory copy
- sync settings view repeats the same explanation
- conflict review does not imply unsupported fields were deleted
- activity history can describe provider-limited cases as "kept in Kontax"

## Sign-off checklist

- [ ] Vietnamese fixture passes mixed-provider date preservation
- [ ] English fixture passes mixed-provider date preservation
- [ ] Arabic fixture passes mixed-provider date preservation
- [ ] Mandarin fixture passes mixed-provider date preservation
- [ ] iCloud retains extra dates after Fastmail resync
- [ ] Fastmail-supported fields still round-trip correctly
- [ ] No unsupported-field case is presented as a deletion or destructive conflict
