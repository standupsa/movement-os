# Chain of custody

Every physical or digital artefact gathered in the field carries a
chain-of-custody record. The audit log of `movement-os` is
hash-chained for a reason: if any part of the platform's output is
ever tested in an inquest re-opening, a review, a tribunal, or a
court, the platform must be able to prove exactly where an item
came from, who handled it, and that it has not been altered.

This form is an operational stub. Operators in legal-sensitive
deployments will want to extend it to match their lawyers'
requirements.

## What is an artefact

Anything collected in the field that the platform will store or
reason about:

- Audio recording of an interview.
- Video recording of an interview.
- A scan of an affidavit.
- A photograph of an archival document.
- A certified copy of a record.
- A physical letter received from a source (receipt logged;
  original retained in operator's records officer's care).
- A digital file received from a source (email attachment, shared
  link contents, messaging-app export).
- A dataset produced by the platform from the above (a generated
  timeline, a contradiction report, a draft dossier).

## The entry — fields

For each artefact, create a `ChainOfCustodyEntry` with:

- `artifactId` — ULID assigned by the platform.
- `caseRef` — platform case reference.
- `kind` — one of the types above.
- `sha256` — content hash computed at the earliest point the
  artefact enters a digital system. For a physical original, the
  scan is hashed at scan time.
- `collectedAt` — ISO-8601 timestamp (SAST).
- `collectedBy` — the platform identity of the field worker.
- `collectedFrom` — source's platform identity, or a case-reference
  pointer where identity is withheld.
- `collectedWhere` — suburb / town / repository, not street-level
  unless consented.
- `consent` — pointer to the consent record (`ConsentRecord`) that
  authorised the collection.
- `lawfulBasis` — POPIA basis the artefact was collected under
  (mirrors `IntakeSchema`).
- `condition` — intact / damaged / redacted-at-source / partial.
- `notes` — free-text observations relevant to reliability.

Subsequent handling appends a transfer entry:

- `transferredAt`
- `transferredFrom` (custodian)
- `transferredTo` (custodian)
- `reason` — why the transfer happened (e.g. "to case custodian
  for triage", "to records officer for lodgement", "to reviewer
  for challenge lane").
- `sha256Verified` — the receiving custodian re-hashes and checks
  the hash matches the entry hash. Mismatch is a critical incident.

## The rules

- **Hash early.** An artefact is hashed as soon as it enters a
  digital system. Hashing before transfer is the whole point.
- **Verify on receipt.** The receiving custodian re-hashes. If the
  hash has changed, the artefact is not accepted — an integrity
  incident is logged instead.
- **One canonical copy.** The platform holds the canonical digital
  copy. Working copies for analysis reference the canonical hash;
  no reasoning is done against an unhashed copy.
- **Originals are originals.** Physical originals never leave the
  operator's records officer's care. If a Commissioner of Oaths,
  an attorney, or a statutory body needs a physical original, a
  transfer entry is made and the original is returned as soon as
  possible.
- **Every step is an `AuditEvent`.** Collection, transfer,
  derivation (e.g. "timeline derived from these 12 affidavits"),
  publication, and withdrawal each append to the hash-chained log.
- **Withdrawal is a transfer.** If a source withdraws consent, the
  artefact is transferred into a withdrawn state — it is not
  deleted from the audit record. It is flagged as no longer
  usable for new purposes.
- **Legal-sensitive transfers** to attorneys or statutory bodies
  are logged with the receiving party's full name, designation,
  address, and date, not just a platform identity.

## Derivations

Derivations — a timeline, a contradiction map, a draft dossier —
are themselves artefacts. They get their own `ChainOfCustodyEntry`,
with an additional field:

- `derivedFrom` — list of `sha256` hashes of the source artefacts
  used.

This is how a reviewer can reproduce a derivation: take the same
sources, run the same pipeline, and expect the same output hash. If
it does not match, something in the pipeline drifted and the
derivation is unsafe.

## Incidents

The following are integrity incidents and are escalated to the
case custodian and the operator's information officer the same day:

- Hash mismatch on transfer.
- Discovery that an artefact's source identity was recorded
  incorrectly.
- Discovery that consent was not recorded as stated.
- Loss of a physical original.
- Unauthorised access to an artefact.
- Evidence of tampering.

Incidents are logged as `AuditEvent` entries with severity and a
remediation note. They are retained indefinitely per the platform's
audit-retention policy.
