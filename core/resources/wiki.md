# Writing a Ground's Wiki

The tree holds structure. The wiki holds what the tree cannot: the conventions a
project settled on, the decisions it made and why, the vocabulary it uses, what
an investigation concluded.

Two things to remember. The first is the shape of a page:

> **A page is named after a thing, and its revisions are that thing's life.**
> Revision 1 is the plan. Later revisions are what it became. The newest
> revision is what is true now.

The second is what a page *is*:

> **A page is a description, not a log.**
> It tells a reader how something works right now. It does not narrate what
> happened to it.

Everything below follows from those two.

## Write reference, not a diary

This is the mistake that actually happens. An agent finishes some work, opens
the page, and appends a paragraph about what it just did. Do that a few times
and the page is a pile of session summaries that nobody can read as an
explanation of anything.

**The page should read like an encyclopedia entry for the thing, in the present
tense.** Someone who arrives knowing nothing should finish it understanding how
the thing works. They should not have to reconstruct the current state by
replaying a timeline.

| Log — do not write this | Description — write this |
| --- | --- |
| "Added retry logic to the webhook handler today." | "The webhook handler retries three times with backoff. Toss redelivers on any non-2xx, so a slow database would otherwise double-charge." |
| "## 2026-08-27 — split the auth middleware" | "Auth runs in two stages: session or bearer resolution, then scope check. They are separate because MCP loopback needs the second without the first." |
| "Phase 1 done, Phase 2 in progress" | (belongs in bugs or plan nodes, not here) |
| "## Change history" / "## 변경 이력" | (delete it — that is what revisions are for) |

Concretely, a page should not contain:

- **Date headings** or dated entries of any kind
- **Progress checklists** — "Phase 2 완료", "- [x] W3", "TODO: …"
- **Sentences about the act of working** — "we added", "이번에 …했다", "next I will"
- **A changelog section**

### Why this is not a loss

The temporal record already exists, in better places:

| What you want to record | Where it belongs |
| --- | --- |
| What this page said before | revisions (`list_wiki_revisions`) |
| Who changed what, when | the ground's history (`list_events`) |
| Which commit touched which code | `record_commit` → the node's `metadata.commits` |
| What still needs doing | bugs (`create_bug`) or plan nodes |
| What you plan to do | revision 1 of the page, written *before* you build |

**Because the history lives in the revisions, the body is free to be purely
present-tense.** That is the whole point of versioning the page: you never have
to keep an old paragraph around just to preserve the record of it. Rewrite the
sentence to say what is true now, and the previous wording stays readable in the
revision underneath.

A page that logs is doing, badly, a job four other things already do well — and
failing at the one job only it can do.

### The exception: what "why" survives

Present tense does not mean stripping the reasoning. "The webhook handler
retries because Toss redelivers on any non-2xx" is present tense and is exactly
the sentence worth keeping. The test is not *is this about the past* but **would
someone changing this code get it wrong without knowing it** — see "What stays
on the page" below.

Past events belong in a page only when the event is *itself* a live constraint:
"the `apex` type was renamed to `leaf` in 2026-05; old exports may still carry
it." That is not a diary entry, it is a hazard a reader needs.

## Name the thing, not the document

A page is called `mcp`, `billing`, `impact-analysis` — the subject it is about.

Never name a page after what it currently *is*: `prd-mcp`, `mcp-spec`,
`mcp-notes-v2`, `mcp-final`. Those names are accurate for a week. The page that
begins life as a plan for MCP and ends as the description of the MCP you built
is the same page the whole time, and `prd-mcp` becomes a lie the moment the
first line of it ships.

Use lowercase letters, digits and hyphens. Say what a maintainer would say out
loud: `deploy`, not `deployment-process-documentation`.

If a name turns out wrong, use `write_wiki`'s **`rename`**. Do not create a new
page and delete the old one — that throws away every revision, which is the part
of the page that was worth keeping. A rename on its own adds no revision; a
revision records content, and the name is not content.

## Revision 1 is the plan

Before building something, write the page. What you are about to do, why this
way, what you decided against. That is revision 1, and it is a real deliverable:
another agent picking up the work reads it instead of guessing.

This replaces keeping design docs in the repo. A plan in a repo file goes stale
silently — nothing makes anyone revisit it, and six months later no one can tell
whether it describes the code or someone's old intention. A plan that is
revision 1 of a living page cannot rot the same way, because the page keeps
being updated and the plan stays readable underneath as history.

Plan nodes and this page do different jobs and work together: the plan nodes say
*where* in the structure something goes, the page says *what and why*. See
`umtri://rules/plan`.

## Write back what you actually built — with `newRevision: true`

When the thing exists, come back and make the page describe it. Not "the plan
plus a note that it's done" — the page should now read as a description of what
is there.

**Pass `newRevision: true` on that write.** This matters more than it looks.
Writes fold together when they come from the same author within about half an
hour, so that eight passes of polishing leave one revision instead of eight.
That folding cannot tell "still drafting the plan" from "the plan has become the
thing" — clock and author look identical in both cases. Without the flag, an
agent that plans and then builds in one sitting overwrites its own plan, and
revision 1 is gone.

Use it whenever the page crosses a boundary: plan → built, v1 → v2, one approach
abandoned for another. Skip it while you are still working on the same stage.

## What stays on the page, what becomes history

The page is the current state. But "current state" is not just the mechanics —
**a live reason is part of the current spec.**

| Stays on the page | Becomes history |
| --- | --- |
| How it works now | How it used to work |
| The constraint that makes it work this way | A constraint that no longer applies |
| A decision you would repeat, and why | The full argument that led to a reversed decision |
| The conclusion of a reversal: "we tried A, moved to B, because —" | The prose written while A was still true |

The test: **would someone about to change this code get it wrong without
knowing this?** If yes, it belongs on the page, however old it is.

A rule like "team org keeps `plan='free'` because plan describes that org's own
subscription and a team org has none" is not history. It is a live trap, and a
page that files it away as an old decision will get rewritten wrong.

A page that strips out every reason becomes a manual, and a manual is exactly
the thing the tree could have held. Do not optimize the wiki into uselessness.

## One page per thing

Split when a page starts answering two questions a reader would arrive with
separately. Merge — or never split — when the answer to one requires the other.

Do not split by document type. `mcp` and `mcp-architecture` are not two pages;
they are one page at two points in its life. Do not create a page per file, per
sprint, or per meeting. A ground with forty one-paragraph pages is harder to
read than the code.

## Choosing how to write

| | |
| --- | --- |
| The thing changed | `mode="replace"` — **read the page first** (`get_wiki`) |
| The page is missing a whole topic you can add as its own section | `mode="append"` |
| Crossing into a new stage | add `newRevision: true` |
| A write went wrong | `list_wiki_revisions`, then `mode="restore"` with the rev |
| You read, thought, then wrote, and someone else may have written meanwhile | add `baseRev` — the write is refused instead of clobbering |

**`append` is the narrow case, not the default.** It is for adding a section
that was genuinely absent — a new subsystem the page never covered. It is not
for tacking on what you just did. If your addition would only make sense to
someone who knows what happened this week, you want `replace`: fold the new fact
into the sentence that was already there.

After any write, look at what came back. `previousBodyChars` is how long the
body was before you wrote. If it is much larger than what you just wrote, you
replaced someone's work — check `list_wiki_revisions` before moving on. Nothing
is lost, but nobody will tell you later.

## Attaching to nodes

A page can hang off a node or float free. Floating is normal and expected early:
knowledge arrives before structure, and a page that has to wait for a node is a
page that never gets written.

Once the tree has grown, list the unattached pages (`list_wiki` with
`node="none"`) and attach the ones that now have a home. Deleting a node
detaches its pages rather than deleting them.

## Deleting

Almost never. Deleting removes the page **and its entire revision history** —
unlike an overwrite, it cannot be undone.

A stale page is not a reason to delete. Rewrite it, and let the old state live
in its revisions. Delete only a page that should never have existed: a
duplicate, a test, something filed under the wrong ground.

## What does not belong here

- **Structure** — that is what nodes are for. Do not maintain a prose copy of
  the tree; it will drift within a week.
- **Defects** — use bugs. A wiki page is not a to-do list.
- **Requirements dumped in a ground's description** — that field is a one-line
  summary, not a spec. Move it here.
- **Secrets** — tokens, keys, passwords. The wiki is prose, not a vault.
