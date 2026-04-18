# Archive-runner workflow

Archive runners do the L3 work that the L0 and L1 rungs (public web
+ PAIA) cannot do on their own: they go in person to the repository,
sit with the finding aids, and request physical files. South African
archives are often unindexed at the item level — the truth is in the
boxes, not the search bar.

This workflow covers the repositories the platform currently
targets. Operators add local repositories (municipal, provincial,
church, school, regimental) as their cases demand.

## Repositories

- **NARSSA** — National Archives and Records Service of South
  Africa, Pretoria. The NAAIRS finding aid is a starting index, not
  the whole holding.
- **TRC / SAHA** — South African History Archive holds the TRC
  collection and significant apartheid-era records; Wits
  Historical Papers holds related collections.
- **Provincial archive depots** — Cape Town Archives, Pietermaritzburg
  Archives, Free State Provincial Archives, Mpumalanga, Northern
  Cape, Eastern Cape depots. Holdings differ by province.
- **SAPS archives and records** — accessed via PAIA to SAPS; on-site
  inspection negotiated case-by-case.
- **DoD Documentation Centre** — Pretoria; military service records,
  unit records.
- **NLSA** — National Library of South Africa (Pretoria and Cape
  Town). Newspaper runs, government gazettes, books. Critical for
  anchoring dates.
- **DoJ inquest records** — regional magistrate's court archives;
  access via court registrar and, where refused, via PAIA.
- **Municipal archives** — deeds, rates, building plans; useful for
  anchoring a specific address at a specific date.
- **Deaths registrations** — Department of Home Affairs.
- **War graves / memorials** — South African War Graves Project,
  regimental associations, municipal cemetery records.

## Before the visit

- [ ] Case brief read. You know which `Question` this visit is
      trying to answer and which `MethodAttempt` will be logged.
- [ ] Finding aid pre-scanned online (NAAIRS, institutional
      catalogues, SAHA finding aids, Wits Historical Papers).
- [ ] Call ahead. Confirm opening hours, reading-room rules, what
      ID is needed, whether laptops / cameras / phones are
      permitted, and whether a pre-order is required.
- [ ] Bring: photo ID, case-reference card from the operator,
      pencil (no pens — pens are prohibited in many reading
      rooms), notebook, laptop or tablet if permitted, paper bag
      or clear pouch for belongings.
- [ ] Reserve items in advance where the reading room supports it;
      some archives only retrieve from the stacks twice a day.
- [ ] Budget: day rate, travel, photocopy fees (archives charge
      per page and per image). Keep receipts — logged against the
      case.

## In the reading room

- [ ] Sign the register. Record your platform identity — not a
      fake name.
- [ ] Respect the rules. No pens. No food. No phone calls in the
      reading room. No photography where prohibited.
- [ ] For each box / file requested:
  - Record the full reference (fond, series, box, file).
  - Record the physical condition (intact, damaged, loose pages,
    missing pages, redactions, repairs, archival stamps).
  - Record page count. If the finding aid says "100 pages" and the
    box contains 87, **that is a finding** — see "Missing records"
    below.
- [ ] Capture: where photography is permitted, photograph every
      relevant page flat, in-focus, with the reference slip visible.
      Where photography is not permitted, transcribe or request a
      certified copy.
- [ ] Do not remove anything. Do not annotate originals. Do not
      attempt to reshelve.

## Cross-referencing

Archival work lives or dies by cross-referencing. The case graph
is how the platform avoids losing leads:

- Names → check all alternate spellings (Afrikaans / English /
  vernacular), maiden names, nicknames.
- Places → check older place names and district boundaries
  (pre-1994 magisterial districts vs current municipalities).
- Dates → triangulate against newspapers (NLSA), gazettes, weather
  records, public events.
- Institutions → a unit that moved, a station that renamed, a
  department that restructured (SAP → SAPS, ISU dissolved 1995).
- Service numbers, docket numbers, case numbers, inquest numbers.

Every cross-reference attempted becomes a `MethodAttempt` record in
the platform. Every hit becomes an `Evidence` record with the full
archival reference.

## Missing records

If records that *should* exist are not in the box:

- Record the fact carefully — reference, expected content, what is
  actually there, what is missing.
- Photograph the gap where possible (numbered pages with a jump).
- Note whether there is a withdrawal slip, a reference to a
  transfer, or a note about destruction.
- Flag to the case custodian. This may promote the case's
  relevant `Claim` to `destroyed-or-missing-record-suspected`
  under ADR-0002. That is a publishable finding in itself.

## After the visit

- [ ] Upload all captured material within 48 hours.
- [ ] Hash each file; create `ChainOfCustodyEntry` records per
      `chain-of-custody.md`.
- [ ] Create / update `Evidence` records citing the full
      archival reference.
- [ ] Create `MethodAttempt` records for every search tried —
      including the ones that found nothing. The method-
      effectiveness scoreboard needs the nulls.
- [ ] Write a short visit summary: what was requested, what was
      found, what was missing, what the next visit should try.

## Non-negotiables (archive-specific)

- No removal of originals. Ever.
- No damage. No writing on documents. No unfolding brittle items
  beyond what the reading-room supervisor allows.
- No false identity on the reading-room register.
- No attempt to bribe, pressure, or befriend archival staff into
  bypassing the rules.
- No publication from a single archival source without cross-
  referencing and a reviewer's sign-off.
