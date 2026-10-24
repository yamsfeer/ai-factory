# Issue tracker

**Local markdown.** Issues live as files under `.scratch/<feature>/` in this repo.

## Conventions

- Spec: `.scratch/<feature>/spec.md`
- Tickets: `.scratch/<feature>/tickets/NNN-slug.md`
- Each ticket carries front-matter: `status` (open | in-progress | done), `blocked-by` (list of ticket ids), `branch`.
- Closing a ticket = set `status: done` and record the merge commit in the ticket file.
- No PRs; work lands on the integration branch `feat/ai-factory-clone`.

## Label vocabulary

Triage skill is not installed in this environment; no labels are used. Tickets are dispatched by dependency order instead.
