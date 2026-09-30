# Writing a Ground's Wiki

The tree holds structure. The wiki is **the project's encyclopedia**: it holds
what the tree cannot — how each part works, the rules the project keeps, the
concepts it is built on, the words it uses.

Four things to remember.

> **The wiki is read front to back.** It is a tree — an overview at the top,
> chapters under it, entries under those. Someone who reads it in order should
> come out understanding the project.

> **One page is one entry.** It is named after a thing, and its body is that
> thing's current spec and rules.

> **Background goes in footnotes.** How it came to be, what was tried before,
> side notes — `[^name]`, not body text.

> **Revisions are the page's life.** Revision 1 is the plan, later revisions
> are what it became, the newest is what is true now. The body never narrates
> that history.

## The table of contents

Every page has a place in the tree: a `parent` page and a `position` among its
siblings. The app draws the table of contents from it, numbers the entries, and
links each page to the previous and next one in reading order.
`list_wiki` with `order="tree"` returns the same order.

- **One overview at the top.** It says what the project is, who it is for, the
  stack at a glance, and how the wiki is laid out. Only `overview` pages stand
  at the top level; any other page without a parent is flagged.
- **Chapters under it** — usually Concepts, Architecture, Operations, Glossary.
  A chapter page is an `overview` too: a lead and one sentence per page under it.
- **Entries under the chapters**, nested where one thing is part of another
  (Authentication under Server, Write policy under MCP).
- **Order teaches.** Put what a newcomer needs first before what depends on it:
  the core concept before its details, the server before its domains.

Starting a wiki, or reorganizing one with no clear shape: read
`umtri://templates/wiki` and pick the table of contents for the project type.
Grow into it — create a page when there is something true to put in it, not as
an empty placeholder.

## Titles

A title is **a plain noun for the thing, in the reader's language**: `조직`,
`배포`, `영향 분석` for a Korean-speaking team; `Organizations`, `Deployment`,
`Impact analysis` for an English one. Product vocabulary and proper names stay
as they are (`MCP`, `Season`).

The table of contents is made of titles; it only reads as a structure when each
line is a name. So no description after a dash or colon, no parenthetical, no
sentence. "Organizations — tenancy, teams and who pays" belongs in the lead,
not the title. The write warns about titles that look like that.

## Kinds

Every page has a `kind`. It decides which sections the page needs.

| kind | For | Needs |
| --- | --- | --- |
| `overview` | The top page and chapter pages — what is under them and why in that order | a lead only |
| `concept` | A product or domain concept, a model (node roles, the plan loop) | `## Spec` |
| `component` | How one part of the system works (MCP, organizations, billing) | `## Spec` |
| `rule` | A convention that must be kept (commit sync, deploy order) | `## Rules` |
| `glossary` | The project's vocabulary | nothing — a table or list |

Pick by what a reader arrives asking. "What is X?" is a concept. "How does X
work / how do I change it?" is a component. "What must I always / never do?" is
a rule. If a page answers two of these, it is probably two pages — or one
component page with a strong Rules section.

## The skeleton

```
Lead paragraph — what this is, in 1–3 sentences.

## 스펙 (Spec)
How it works now. Break it down with ### headings.

## 규칙 (Rules)
What you get wrong if you don't know it: invariants, prohibitions, required order.

[^name]: Background, history, rejected alternatives, side notes.
```

- **The lead comes first**, as a paragraph. Not a heading, not a `> Status:`
  banner, not a list. A reader who stops after it should know what the thing is.
- **Only two top-level sections**: `## 스펙` / `## Spec` and `## 규칙` /
  `## Rules`. Everything else is a `###` under one of them. (`overview` and
  `glossary` pages are free-form after the lead.)
- **Spec** is descriptive: how it works. **Rules** is normative: what must hold.
  "Tokens are hashed with SHA-256" is spec. "Never log a raw token" is a rule.
- Write the body in the language the project uses; the section names are
  recognised in Korean and English.

## Footnotes: where background lives

An encyclopedia entry is not stripped of reasons — but it is careful about
*which* reasons sit in the text.

**The test: would someone about to change this code get it wrong without
knowing this?**

- **Yes** → it is part of the spec or a rule. Keep it in the body. "The webhook
  handler retries three times, because Toss redelivers on any non-2xx" — the
  "because" stops someone from removing the retry.
- **No** → it is background. Put it in a footnote. How the decision was
  reached, the approach that came before, who asked for it, a caveat worth
  knowing but not acting on.

```
Team orgs keep `plan='free'`.[^plan]

[^plan]: `plan` describes the org's own subscription. An earlier draft billed
teams through the owner's personal plan; that was dropped when billing moved to
the team itself.
```

Footnote syntax is `[^name]` in the text and `[^name]: …` on its own line,
usually at the end. The app renders references as superscripts and collects the
definitions into a notes list at the bottom. Every reference needs a
definition, and every definition needs a reference.

## Write reference, not a diary

This is the mistake that actually happens. An agent finishes some work, opens
the page, and appends a paragraph about what it just did. Do that a few times
and the page is a pile of session summaries that nobody can read as an
explanation of anything.

| Log — do not write this | Entry — write this |
| --- | --- |
| "Added retry logic to the webhook handler today." | "The webhook handler retries three times with backoff." (+ the reason, in the body or a footnote) |
| "## 2026-08-27 — split the auth middleware" | "Auth runs in two stages: session or bearer resolution, then scope check." |
| "> Status: Phase 1–3 implemented" | (nothing — progress lives in bugs and plan nodes) |
| "Decision ⑦: tokens capped at 3" | A rule: "A user holds at most 3 active write tokens." |
| "## Change history" / "## 변경 이력" | (delete it — that is what revisions are for) |

A page does not contain dated headings, status or source banners, progress
checklists, sentences about the act of working ("we added", "이번에 …했다"),
or a changelog section. A numbered decision log is the same mistake in a
different shape: turn each live decision into a spec sentence or a rule, and
move how it was decided into a footnote.

The temporal record already exists, in better places:

| What you want to record | Where it belongs |
| --- | --- |
| What this page said before | revisions (`list_wiki_revisions`) |
| Who changed what, when | the ground's history (`list_events`) |
| Which commit touched which code | `record_commit` → the node's `metadata.commits` |
| What still needs doing, what is undecided | bugs (`create_bug`) or plan nodes |
| What you plan to do | revision 1 of the page, written *before* you build |

Past events belong in the body only when the event is *itself* a live
constraint: "the `apex` type was renamed to `leaf`; old exports may still carry
it." That is not a diary entry, it is a hazard.

## The write tells you what is off

`write_wiki` answers with `warnings[]` when the saved page strays from the
skeleton: no kind, no parent (outside the table of contents), a title that is
not a plain noun, no lead, a status banner, a dated heading, a checklist, a
change-history section, a top-level section other than Spec/Rules, a missing
required section, or a footnote without its pair. The write is saved either
way. Read the warnings, fix the page, write again.

## Name the thing, not the document

The page slug (its URL name) is called `mcp`, `billing`, `impact-analysis` —
the subject it is about, in lowercase English even when the title is Korean.

Never name a page after what it currently *is*: `prd-mcp`, `mcp-spec`,
`mcp-notes-v2`, `mcp-final`. The page that begins as a plan for MCP and ends as
the description of the MCP you built is the same page the whole time.

Use lowercase letters, digits and hyphens. Say what a maintainer would say out
loud: `deploy`, not `deployment-process-documentation`.

If a name turns out wrong, use `write_wiki`'s **`rename`**. Do not create a new
page and delete the old one — that throws away every revision.

## Revision 1 is the plan

Before building something, write the page: what you are about to do, why this
way, what you decided against. That is revision 1, and another agent picking up
the work reads it instead of guessing. A plan is the one revision allowed to be
in the future tense.

This replaces keeping design docs in the repo. A plan in a repo file goes stale
silently; a plan that is revision 1 of a living page stays readable underneath
as history.

Plan nodes and the page work together: the plan nodes say *where* in the
structure something goes, the page says *what and why*. See
`umtri://rules/plan`.

## Write back what you built — with `newRevision: true`

When the thing exists, rewrite the page so it describes it. Not "the plan plus
a note that it's done" — an entry for what is there.

**Pass `newRevision: true` on that write.** Writes by the same author within
about half an hour fold into one revision. That folding cannot tell "still
drafting the plan" from "the plan has become the thing"; without the flag, an
agent that plans and builds in one sitting overwrites its own plan.

Use it whenever the page crosses a boundary: plan → built, v1 → v2, one
approach abandoned for another.

## One page per thing

Split when a page starts answering two questions a reader would arrive with
separately. Do not split by document type — `mcp` and `mcp-architecture` are
one page at two points in its life. Do not create a page per file, per sprint,
or per meeting.

## Choosing how to write

| | |
| --- | --- |
| The thing changed | `mode="replace"` — **read the page first** (`get_wiki`) |
| The page lacks a whole topic you can add as its own `###` | `mode="replace"` with it folded in; `append` only if it truly stands alone at the end |
| Crossing into a new stage | add `newRevision: true` |
| A write went wrong | `list_wiki_revisions`, then `mode="restore"` with the rev |
| Someone else may have written meanwhile | add `baseRev` — the write is refused instead of clobbering |

After any write, check `previousBodyChars`. If it is much larger than what you
just wrote, you replaced someone's work — look at `list_wiki_revisions`.

## Attaching to nodes

A page can hang off a node or float free. Floating is normal early: knowledge
arrives before structure. Once the tree has grown, list the unattached pages
(`list_wiki` with `node="none"`) and attach the ones that now have a home.
`list_wiki` with `kind="none"` lists the pages not yet classified.

## Deleting

Almost never. Deleting removes the page **and its entire revision history**.
A stale page is not a reason to delete — rewrite it. Delete only a page that
should never have existed: a duplicate, a test, something filed under the wrong
ground.

## What does not belong here

- **Structure** — that is what nodes are for. Do not keep a prose copy of the tree.
- **Defects and open questions** — use bugs.
- **Reports and archives** — an investigation's conclusion becomes spec or rules
  on the page it is about; the report itself is not an entry.
- **Secrets** — tokens, keys, passwords.
