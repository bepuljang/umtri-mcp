# Rule: Plan nodes are a node-based brief

In Umtri the human can express intent **as structure, not as a prompt**. In
Plan mode they draw the IA they want — nodes marked `plan` (the response shows
`plan: true` on such nodes; they render dashed/grayscale in the UI). That plan
subtree **is your brief**: where things should live (structure), what they are
(type/label), and what they should do (description).

Umtri itself does not edit code. You (the AI agent) are the executor: read the
brief here, build the real code with your own tools, then record what you built
back onto the nodes. The human commits when satisfied.

## The loop

1. **Read the brief.** Treat every `plan` node as an instruction. Use its
   `description` as the intent detail (fetch `view="full"` when you need the
   complete description, not just the excerpt).
2. **Realize.** Write the actual code in the repository with your own tools.
3. **Record (required).** On each plan node you realized, attach
   `metadata.implements` = the real source path(s) you wrote
   (e.g. `["server/routes/foo.js"]`, or `"path#identifier"` for multi-export
   files) via `update_node`. **This is mandatory** — a plan node with no
   `implements` cannot be committed later, so without it your work is not
   considered realized.
4. **New detail stays plan.** If realizing a brief requires nodes the human
   didn't draw (child leaves/veins, an extra twig), create them with
   `metadata.plan = true` too — everything you add stays reviewable until the
   human commits. Do not create finalized (non-plan) nodes during realization.
5. **Commit when realized.** Promote a plan node to the real tree with
   `commit_plan` — it clears `metadata.plan`. The tool **rejects the commit
   unless the node already has `metadata.implements`** (step 3), so attach the
   source paths first. The human can also commit from the UI. If you are unsure
   the realization is complete, leave it as plan and ask the human rather than
   committing.
6. **Record the commit (CI/CD form record).** When the code lands in git, the
   commit is recorded onto the nodes it touched via `record_commit`
   (sha + changed files → appended to each matching node's `metadata.commits`).
   Normally a GitHub Action / CI step does this automatically on merge; you may
   also call `record_commit` directly when you know the sha and files.

## Boundaries

- Plan is independent of seasons; you still cannot create or modify seasons
  (see umtri://rules/seasons-human-only).
- The brief is still an information-structure diagram, not a work log
  (see umtri://rules/vocabulary) — realize the structure the human intends,
  and name nodes as what they are.
- If the brief is ambiguous or seems wrong, ask the human rather than guessing —
  the point of a node-based brief is a tight, reviewable contract.
