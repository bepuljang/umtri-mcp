# Rule: Nodes Represent Information Structures, Not Code Files

When modelling a project in Umtri, nodes should be **information units** —
the parts a *user or external tool* can perceive — not implementation files.

## The distinction

- ❌ **Wrong (developer view)**: nodes named after code files
  — `index.jsx`, `NodeLayer.jsx`, `routes/projects.js`.
- ✅ **Right (user view)**: nodes named after the information unit
  — "tree diagram", "header", "node table", "projects API".

A single information unit may be implemented by several files. The mapping
from concept to code lives in `metadata.implements` (array of file paths),
not in the node label.

## Completeness — map the whole project, don't summarise

The "information unit, not file" rule is about **labelling grain, not
coverage.** It tells you *how to name and group* nodes — it does **not** tell
you to leave parts of the project out. The goal is a **faithful, navigable map
of the entire codebase**: every meaningful module, screen, endpoint, table,
external integration, and piece of non-obvious logic should be locatable in the
tree (a node with `metadata.implements`).

- **Cover everything, at the right grain.** Group files into information units
  so it's not one node per file — but do not drop whole capabilities. If a
  maintainer would expect to find feature X in the repo, X must be findable in
  the tree.
- **Don't abstract a project down to a sketch.** A handful of trunks with a few
  leaves each is almost always *under*-captured. Real projects have many leaves;
  a faithful tree is large. Breadth is expected — `get_graph` slicing (rootId /
  maxType / descriptions) exists precisely so a big, complete tree stays cheap
  to read.
- **The restraint rules are not licence to omit.** "Reserve veins" (vocabulary)
  means don't turn *every function* into a vein — not skip the logic worth
  finding. "Bushy is fine, don't over-nest" means don't add empty grouping
  layers — not prune real branches. Group and pick good grain; keep the coverage.
- **Completeness pass.** After modelling, walk the repo and check: is there a
  directory, module, route file, table, or integration with **no** node? If so,
  it's a gap — add it. Aim for "every real part of the system is represented,"
  not "the gist is represented."
- **Completeness has a boundary.** It covers what *runs*, not everything in the
  repo — documents, build output and inert config stay out. See "What is NOT a
  node" below before treating an uncovered path as a gap.

## What is NOT a node — the boundary of completeness

Completeness pushes you to cover everything that *runs*. It is not a licence to
map everything that *exists in the repo*. The tree answers "what is this system
made of," so anything that only **describes** the system stays out.

**The test: if you deleted it, would the system behave differently?** If no, it
is not a node.

Keep out:

- **Internal documents** — PRDs, RFCs/ADRs, READMEs, CHANGELOGs, design notes,
  roadmaps. These are *about* the system. Mixing them in makes the map answer
  two questions at once ("what runs" and "what we wrote down") and it stops
  being a reliable map of either.
- **Build output and vendored code** — `dist/`, `build/`, lockfiles,
  `node_modules/`.
- **Tooling config with no runtime behaviour** — linter/formatter configs,
  editor settings, `.gitignore`.

Point at documents instead of turning them into nodes: put the reference in the
`description` of the node it explains (e.g. "propagation rules:
`PRD-impact-analysis.md`"). The document stays findable exactly where someone
would look for it, without becoming a branch.

**The exception that matters: documentation you ship is a system.** A docs site
served to users (its pages, its i18n, its shell) is a product surface and
belongs in the tree. The line is not "markdown vs code" — it is *served to
users* vs *read by us*.

## Trunk and limb rules

- `trunk` = a big domain (e.g. `www`, `server`, `db`). Pick stable,
  long-lived names — usually matching a top-level code area.
- `limb` = a category inside a trunk (e.g. `graph`, `table`, `dashboard`).
- Do **not** create one limb per time period. Time is expressed through
  `season` and `created_at`, not by carving the tree into temporal slices.
- Infrastructure (servers, DNS) is *not* a trunk — it is the environment the
  system runs in, not a part of the system. For documents, see "What is NOT a
  node" above.

## Useful metadata keys

These conventions let other tools (including this MCP) answer richer
questions about a ground.

| Key                  | Applies to                          | Shape                                              |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| `implements`         | all nodes                           | `string[]` — file paths, optionally `path#identifier` |
| `created_by_commit`  | all nodes                           | `string` — git short hash                          |
| `replaces`           | follow-up node                      | `string[]` — node ids that were absorbed           |
| `replaced_by`        | deprecated node                     | `string[]` — node ids that took over               |
| `endpoints`          | API-domain twigs                    | `{method, path, summary}[]`                        |
| `columns`            | DB-domain twigs                     | `{name, type, pk?, fk?}[]`                         |
| `represents`         | UI twigs reflecting data            | `string` — corresponding DB twig id                |
| `reparented_at`      | reparented nodes                    | `string` — ISO date when the parent changed        |
| `reparented_from`    | reparented nodes                    | `string` — prior parent id                         |
| `reparented_to`      | reparented nodes                    | `string` — new parent id                           |
| `extracted_from`     | nodes decomposed from a parent file | `string` — original node id                        |
| `role_change_at`     | type-changed nodes                  | `string` — ISO date                                |
| `role_change_reason` | type-changed nodes                  | `string` — short prose explaining the shift        |
| `placeholder`        | intentionally-empty structure       | `true` — opts out of dormant cleanup suggestions   |

## One file, multiple nodes

A single source file may legitimately decompose into multiple nodes when it
contains several distinct information units. Example: `AppShell.jsx` exports
`Sidebar`, `NavItem`, `UserMenu`, `Intro`, `MobileDrawer` — each is its own
component and earns its own `leaf` node. The split uses two metadata keys:

- `metadata.implements`: array of `file#identifier` references — e.g.
  `"www/src/components/layout/AppShell.jsx#Sidebar"`. The `#identifier`
  suffix points at the exported function/class within the file.
- `metadata.extracted_from`: id of the node that originally represented the
  whole file. Preserves the decomposition history so the prior shape stays
  inspectable.

Decompose when the units are independently reusable, separately addressable,
or named distinctly by users. Do **not** decompose just because a file has
many internal helpers — pure implementation details stay inside the leaf.

## Restructuring history

Trees evolve. When a node moves to a different parent, record the move in
metadata so the restructure stays inspectable later:

- `metadata.reparented_at` — ISO date (e.g. `"2026-05-21"`)
- `metadata.reparented_from` — prior parent id
- `metadata.reparented_to` — new parent id

The MCP `update_node` tool emits a `reparent-metadata-hint` info warning
when you change `parent` without including these keys. Recording the move
matters because the ltree path silently rewrites on parent change — without
these keys, you can't tell from the current state that the node ever moved.

When the type also changes (twig → leaf, limb → twig, …), add
`role_change_at` and a short `role_change_reason` so the reclassification
stays explainable. Pair with `replaces` / `replaced_by` when one node
absorbs another (e.g. an ad-slot twig absorbing its sole leaf child).

## When adding a node

Ask first: *"What part of the system does this represent for someone using
or maintaining it?"* If the answer is a file, you're probably one level too
deep — go up to the information unit and add the file under
`metadata.implements`. If the answer is a single exported component within
a larger file, the node is still legitimate — use `path#identifier` in
`implements` and add `extracted_from` pointing at the file-level node.

## Connections — consider an edge or api each time you add a node

The tree shows *containment* (what lives under what). It does **not** show how
things relate across branches — that's what edges and apis are for. After you
add a leaf or vein, pause and ask: **does this node call, feed, or depend on
another node?** If so, record the connection — the graph is only half-true
without it.

- **api** (`create_api`) — a **request / call / data flow** between two nodes:
  a screen calling an endpoint, an endpoint hitting a table, an external
  integration (NicePay, SMS, a webhook). First-class because flows are the
  story of how the system runs. Direction is caller → callee (`start` → `end`).
- **edge** (`create_edge`) — a **structural relation**: `dependency` ("A is
  built on / needs B") or `data_flow` ("data moves A → B" outside a request).
  Use for module/library dependencies, a route depending on the data store, a
  job writing to a table. Direction is `source` → `target`.

Rule of thumb: if it's a *runtime request*, it's an api; if it's a *build-time
or structural reliance*, it's a dependency edge. Don't connect everything —
add the connections that a maintainer would actually want to trace (cross-module
calls, external integrations, the few key dependencies). A standalone leaf with
no real relation needs no edge; skipping is fine. But the common failure is the
opposite — adding nodes and never their connections, leaving a tree of isolated
islands.

### How problems propagate along a connection

The arrow records *who calls / depends on whom*. **Impact — which node is hurt
when another breaks — does not always flow with the arrow.** Read each
connection type as follows when tracing a blast radius:

| Connection        | Arrow means                     | A problem propagates                                    |
| ----------------- | ------------------------------- | ------------------------------------------------------- |
| edge `dependency` | `source` is built on / needs `target` | **against the arrow** — if `target` breaks, `source` is affected (target → source) |
| edge `data_flow`  | data moves `source` → `target`  | **with the arrow** — bad data at `source` corrupts `target` (source → target) |
| api (`start`→`end`) | caller → callee               | **against the arrow** — if the callee (`end`) is down, the caller (`start`) fails (end → start) |

So "what is affected if X breaks?" = walk **dependency edges backward** (to their
sources) ∪ **data_flow edges forward** (to their targets) ∪ **apis backward**
(to their callers), transitively. This is the rule the `get_impact` tool
implements.

Two cautions:
- The result is a **list of nodes to check, not a proven failure set** — it is
  only as complete as the connections you have recorded. A sparse graph yields
  a falsely small blast radius; treat an empty result as "nothing recorded,"
  not "nothing affected."
- A connection can carry impact **both ways** in reality (a dependency that also
  passes data back). Record the dominant direction; when in doubt, trace impact
  in both directions rather than trusting a single arrow.

## The file-as-leaf antipattern

A common drift: a twig groups a concept (e.g. `Bug log API`), and its only
child is a leaf named after the implementation file (`bugs.js`). This is
**one information unit split into two nodes** — the twig and the leaf
describe the same thing at different vocabularies.

Symptoms:
- Twig with exactly one leaf child whose label is a filename.
- Leaf label echoes the twig label plus a file extension.
- The leaf carries no additional information the twig doesn't already have.

Fix: absorb the file into the twig's `metadata.implements`, then soft-delete
the leaf. The twig itself becomes the information unit; the file is its
implementation detail, not a separate node. Decompose into multiple leaves
*only* when the file contains several independently-meaningful units (see
"One file, multiple nodes" above).

The MCP `create_node` / `update_node` tools emit a `file-as-leaf` info
warning when a leaf is created with a filename- or path-shaped label, and
an `implementation-jargon` warning when any label uses code-architecture
words (router/handler/middleware/layer/store/...) — both push toward
naming the information unit rather than the implementation.
