# Progress Logs

Dated daily logs of finalized work on KmmRepo. One file per active day, named
`YYYY-MM-DD.md`, with timestamped entries (latest at the bottom of each file).

## Convention (the rule)

**After finalizing any piece of work** (verified + committed), before considering the task
done:

1. **Append a timestamped entry** to today's progress log (`docs/progress/YYYY-MM-DD.md`,
   create it if missing) — include the time, what changed, decisions made, the commit hash,
   and how it was verified.
2. **If the work is a feature**, add/update its reference doc under
   [`docs/features/`](../features/).
3. **Update [`DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)** — tick the relevant Phase
   checklist item(s) and make sure the Documentation section links to the new feature and
   progress files.

## Index

- [2026-06-15](2026-06-15.md) — project bootstrap, auth/registration, Swagger docs,
  super-admin console, feature doc, dark/light toggle.
