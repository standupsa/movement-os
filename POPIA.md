# POPIA commitments

`movement-os` handles information about real people — witnesses,
whistleblowers, public officials, members of the public. South Africa's
**Protection of Personal Information Act, 2013 (POPIA)** applies to any
processing of personal information by a responsible party within the
country. This document records the platform's default commitments.
Operators running `movement-os` remain the "responsible party" under POPIA
for their own deployment and must satisfy themselves that their use is
compliant; this document is guidance, not legal advice.

## Responsible party

Each operator identifies a named, contactable "information officer" as
required by POPIA. The platform stores this identity in configuration and
surfaces it in the privacy notice shown to anyone submitting information.

## Lawful basis

Every `Intake` record carries an explicit `lawfulBasis` field
(`consent` | `public-interest` | `legal-obligation`). An intake without
a lawful basis cannot be persisted. This is enforced by
`@wsa/schemas.IntakeSchema`.

## Minimisation

- The platform captures only what is necessary to verify and publish a
  specific public-interest claim.
- Identifying information is separated from the factual claim and stored
  with strict access control.
- Raw intakes marked `never-persist` are processed in memory, summarised
  into non-identifying `Claim` records, and discarded.

## Retention

- Raw intake material: maximum 180 days unless retention is required for
  an ongoing legal proceeding or extended by the data subject's consent.
- Claims and evidence: retained for as long as the public-interest
  purpose persists, with an annual review.
- Audit events: retained indefinitely. The hash-chained log is the
  movement's accountability record and is not subject to deletion.

## Rights of data subjects

Anyone whose personal information is processed has the right, under
POPIA, to:

- Know what information is held about them and for what purpose.
- Request correction or deletion of information.
- Object to processing.
- Complain to the Information Regulator of South Africa.

The operator must expose a contact channel for these requests and honour
them within POPIA's timelines.

## Transfers outside South Africa

If a deployment uses hosted model APIs (for example OpenAI, Anthropic),
personal information may be transferred outside South Africa for
processing. The operator is responsible for ensuring that the destination
country affords adequate protection, or for obtaining the data subject's
consent, as required by POPIA section 72.

## Breach notification

In the event of a reasonable belief that personal information has been
accessed or acquired by an unauthorised person, the operator must
notify the Information Regulator and the affected data subjects as
required by POPIA section 22. The movement-os audit log is the primary
forensic artefact in such an event.

## Defaults shipped in this repo

- No real personal information ships in the public repository. All
  fixtures are synthetic.
- A pre-commit hook (to be added) refuses commits that match obvious
  SA ID-number or RSA mobile-number patterns.
- Agent logs are redacted by default; raw intake bodies never appear in
  log output.

## Contact

Complaints, corrections, or questions about how this specific deployment
handles personal information should be directed to the information
officer named in that deployment's privacy notice.
