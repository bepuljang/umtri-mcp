# Rule: Transplanting a ground (옮겨심기)

A ground that was **not** born in Umtri — an existing project imported for the
first time — needs heavy restructuring before its shape settles. To allow
that, a freshly created ground starts in a **transplanting** state, where the
normal guardrails are relaxed. When the human is satisfied with the shape they
**root** the ground (뿌리내리기), and the guardrails snap back on.

`get_graph` returns `project.transplanting` (boolean). Check it before doing
anything that the normal rules would block.

## While `transplanting = true`

You MAY:
- **Restructure nodes in any season, including past seasons.** The usual
  "cannot create/move into a past season" rule and the lock on a grown node's
  `parent` / `season` / `type` / `sproutedAt` are lifted, so you can reconstruct
  the project's history season by season. (Content fields on grown nodes are
  editable even without transplanting — see below.)
- **Hard-delete import mistakes.** `delete_node` accepts `hard: true` and the
  active-descendant guard is lifted (subtree cascades). Use this to remove
  wrongly-imported nodes for good. Soft delete is still the default; reach for
  `hard` only to clean up genuine mistakes — it is irreversible.

You MAY NOT:
- **Open a season without asking.** `create_season` exists, but it only acts
  after the user confirms (see umtri://rules/seasons). Laying down historical
  seasons is exactly the case where you propose and they decide.
- **Root (settle) a ground.** Ending transplant is human-only — done from the
  UI ("Root this ground"). You cannot root via MCP.

## Rooting is final

Once a ground is rooted, **nothing re-opens transplant** — not you, not the
person who owns the ground. There is no `reopen_transplant` tool, and
`POST /api/projects/:slug/root` refuses `rooted: false`. Only an administrator
can re-open it, out of band.

This is deliberate. Re-opening unlocks every past season at once, so a window
meant for the first import would otherwise become the standard way around a
guard. If a rooted ground genuinely needs restructuring, say so plainly and
let the human decide whether to take it to an administrator.

Most of what people reach for transplanting to do does not need it — a stale
`metadata.implements` on a past node is editable as it stands (see below).

## Audit stamp

Every node you create while the ground is transplanting is automatically
stamped `metadata.transplanted = true`. The stamp persists after rooting so a
human can later see which nodes entered during the unsettled period. Do not
remove it.

## After rooting (`transplanting = false`)

All normal guards return: past seasons reject new/moved nodes, grown nodes lock
their shape and timeline, `delete_node` is soft-only and refuses nodes with
active children. Treat the tree as settled — small, observable changes only
(see umtri://about/vision).

### What stays editable on a grown node

Rooting does **not** freeze a past node's content. Without transplanting you can
still patch `label`, `description`, `metadata` and `tags`; only `parent`,
`season`, `type` and `sproutedAt` are refused.

The line is whether the change leaves a trail. Content edits are recorded in the
ground's event log with a before/after diff, so history stays recoverable.
Shape and timeline edits rewrite what the tree *was*, which is why they need the
explicit transplanting state.

This matters in practice: when code is refactored and files move, the
`metadata.implements` of past-season nodes goes stale. Fix it in place — do not
ask for transplanting just to correct a path, because that unlocks every past
season at once for a change that needed none of it.

## How to behave

- Use the relaxed window to get the **structure** right — it is still an
  information-structure diagram, not a work log (see umtri://rules/vocabulary).
  Reconstruct what the project *is*, not the history of commits.
- Prefer soft delete; reserve `hard` for clear mistakes.
- When the shape looks settled, tell the human it's ready to root — don't keep
  operating in transplant mode longer than needed.
