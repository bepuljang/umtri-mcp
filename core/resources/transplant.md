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
- **Add or edit nodes in any season, including past seasons.** The usual
  "cannot create/move into a past season" and "grown (past-season) nodes are
  immutable" rules are lifted, so you can reconstruct the project's history
  season by season.
- **Hard-delete import mistakes.** `delete_node` accepts `hard: true` and the
  active-descendant guard is lifted (subtree cascades). Use this to remove
  wrongly-imported nodes for good. Soft delete is still the default; reach for
  `hard` only to clean up genuine mistakes — it is irreversible.

You MAY NOT:
- **Create or modify seasons.** Seasons are always human-only
  (see umtri://rules/seasons-human-only). The human lays down the historical
  seasons; you fill nodes into them.
- **Root (settle) a ground.** Ending transplant is human-only — done from the
  UI ("Root this ground"). You cannot root via MCP.

## Re-opening transplant (`reopen_transplant`)

A rooted ground can be put back into transplant with the `reopen_transplant`
tool — but **only when the user explicitly asks for it** (e.g. "switch this
ground to transplanting", "옮겨심기로 바꿔줘"). This removes safety guardrails,
so you must **never** decide to re-open on your own initiative, however
convenient it would be for a restructuring task. No explicit request → do not
call it; instead tell the user the ground is rooted and ask whether they want
to re-open transplant. After re-opening, the user roots it again from the UI
when the work is done.

## Audit stamp

Every node you create while the ground is transplanting is automatically
stamped `metadata.transplanted = true`. The stamp persists after rooting so a
human can later see which nodes entered during the unsettled period. Do not
remove it.

## After rooting (`transplanting = false`)

All normal guards return: past seasons reject new/moved nodes, grown nodes are
immutable, `delete_node` is soft-only and refuses nodes with active children.
Treat the tree as settled — small, observable changes only
(see umtri://about/vision).

## How to behave

- Use the relaxed window to get the **structure** right — it is still an
  information-structure diagram, not a work log (see umtri://rules/vocabulary).
  Reconstruct what the project *is*, not the history of commits.
- Prefer soft delete; reserve `hard` for clear mistakes.
- When the shape looks settled, tell the human it's ready to root — don't keep
  operating in transplant mode longer than needed.
