# Recommendation: Keep a Commit-Sync Policy in the Repo

**Umtri never reads your git history by itself.** It has no job runner and no
repo access — a node learns about a commit only because something called
`record_commit`, and it learns about a *new* file only because something called
`create_node`. Nothing in this server can interrupt you at commit time.

That is why the tree drifts: code moves forward, the ground stays where it was,
and no one finds out until a person compares the two by hand.

## What to do about it

Write a short commit-sync policy into **the repo's own agent rules file** — the
one every session already loads (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
whatever that project uses). That file is read before the work starts, by the
same agent that will do the committing. This resource cannot be, because MCP
resources are pull-only: they are read when someone asks for them, which is
exactly the moment that never arrives on its own.

This is a recommendation, not a gate. Nothing here blocks a commit, and a
project that ignores it still works — the ground simply ages faster than the
code.

## Snippet to adapt

Paste into the repo's rules file and edit to fit the project (translate it if
the file is in another language — the wording matters less than the trigger):

```markdown
### Umtri sync (before committing)

Umtri does not read git. When a commit is about to be made, check whether the
change also belongs in the ground:

1. Changed paths vs `metadata.implements` — does every changed file map to a node?
   - New unit of the system (route, screen, table, integration) → `create_node`,
     with `metadata.implements` set. Then wire its connections
     (`create_edge` / `create_api`) — an unconnected node is invisible to impact.
   - File moved or renamed → `update_node` on the affected nodes' `implements`.
     Directory moves are the expensive case: one `git mv` can strand dozens.
   - Behavior changed but structure did not → nothing to do.
2. Does the commit close a tracked bug? → `update_bug` (status, and `solution`
   describing what was actually done).
3. Then `record_commit` with the SHA and the changed paths.

Ask the human before adding nodes for anything ambiguous — a wrong node is
harder to notice later than a missing one.
```

## Where automation fits

CI (a GitHub Action on push) is a good place for step 3 — it never forgets a
SHA. It is a poor place for steps 1 and 2: by then the commit exists, the log
is unread, and the run is green either way. Detection belongs in CI; the
decision belongs where a human or agent is still in the loop.
