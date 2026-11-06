# Trunk Kinds — How Each Kind of Trunk Branches

Every trunk is one of six kinds, and each kind has its own rule for what its
limbs are. Recording the kind lets the same domain line up across trunks —
`Reservations` as a screen area, as endpoints, and as tables — instead of each
trunk being carved along a different axis.

## Record the kind

Set `metadata.kind` on the trunk. Do not leave it to be guessed from the
label: the kind is what the MCP reads to check the limbs under it.

| kind | What it is | Limbs split by | The common limb holds | Leaves are |
| --- | --- | --- | --- | --- |
| `front` | Something people use on a screen — app, web app, admin, static site | User-facing feature or flow (Reservations, My page). A public site splits by page | App shell (layout, routing, boot), design system, shared components | Screens, components |
| `server` | A service that takes requests — API, webhooks, jobs | Domain / resource. Non-domain consumers (external integrations, inbound webhooks) get their own limb | Request handling — authentication, authorization, errors, boot | Endpoint groups (`metadata.endpoints`) |
| `database` | A data store — relational DB, document DB, cache | Domain, **with the same names as the server** | Tables shared by many domains (sessions, audit log) | Tables, labelled by their logical name, with `metadata.table` (the real name) and `metadata.columns` |
| `library` | Shared code or a package that other trunks import | Capability or concept (Money, Signal pipeline) | Shared types and constants | Modules |
| `device` | Physical hardware, an embedded screen, an enclosure | Physical part or screen region | Device-wide parts (power, communication) | Parts, screen elements |
| `tooling` | What the team runs but never ships — build and deploy scripts, store upload automation, simulators and measurement tools, docs generators, convention-checking tests, agent skills | What the tools do (build & deploy / measurement & simulation / docs & conventions / dev environment) | Loaders and helpers the scripts share (a `registerBabel`, a shared CLI harness) | Scripts, skills, generators |

Static sites and admin panels are `front`. A monorepo package that apps import
is `library`. Scripts the team runs against the product — a balance simulator,
a docs generator, a Play upload job, a test that checks the repo's conventions —
are `tooling`: the mirror image of a library (a library is imported by other
trunks; tooling imports or executes them). Do not fold them into the app trunk
they serve — that blurs what the app ships. Inert config and documents are
still not nodes (see `umtri://rules/system-structure`).

### When none of them fits

Do not force it. Leave `metadata.kind` unset, tell the human which trunk did
not fit and why, and **offer** to report it with `send_feedback` (kind
`improvement`) so the kind can be added. Never file that feedback on your own
initiative — the human decides.

## One common limb per trunk

Each trunk has **at most one** common limb, marked `metadata.common: true`.
Its name is free (`Common`, `Shell`, `공통`, `요청 처리` …); what it holds is
defined by the kind (table above). Anything that belongs to no single feature
or domain goes there — as twigs if it grows.

If a second common limb seems necessary, it is either a real feature/domain
limb or a twig of the existing common limb.

**Never split a trunk by technical layer.** `State`, `Utils`, `Hooks`,
`Routes`, `Middleware`, `Store`, `Models`, `Services`, `Components`
(`상태 관리`, `유틸`, `훅`, `라우트`, `미들웨어`, `모델` …) are how the code is
arranged, not what the system is made of. Their contents belong in the feature
or domain limb they serve, or in the common limb.

## Same domain, same name — no suffixes

A domain is named the same in every trunk, without a suffix:

| ✅ | ❌ |
| --- | --- |
| `Reservations` (front) · `Reservations` (server) · `Reservations` (database) | `Reservations API`, `Reservation tables`, `Reservation admin` |
| `예약` · `예약` · `예약` | `예약 API`, `예약 응답`, `예약 테이블`, `예약 관리` |

The trunk already says what kind of thing it is, so a suffix repeats it — and
suffixes drift (`API` in one ground, `응답` in another), which breaks the
alignment the shared name is for. An admin `front` names its limbs by the
resource too: `Members`, not `Member management`.

When adding a limb, look at the other trunks first. If the domain already
exists there, reuse its exact label.

## What earns a limb

A limb is a division the trunk's *user* would make — an area they name and
walk into on its own. Matching names across trunks is not a reason to give
every trunk a limb for every domain. Two rules keep limbs honest:

1. **A trunk's direct children are limbs — never leaves.** A one-object
   domain (`Sessions` as one table, `Tokens` as one endpoint group) is still a
   limb holding that one leaf, unless rule 2 gives it a parent concept to live
   under. Do not put the leaf directly under the trunk: there it reads as an
   unnamed domain, and the graph draws it as long as a limb anyway.
2. **Small domains that share a parent concept are one limb.** When several
   domains in a trunk are small (two objects or fewer, or the parts of a
   single screen) and the trunk's user would call them one thing, they become
   **one limb named for that thing**, and each absorbed domain stays as a
   **twig that keeps its name** (a domain of one object becomes a leaf of the
   limb). The alignment across trunks is by label — a domain that is a limb
   in the front may be a twig of a bigger limb in the server, and the names
   still line up. Name the parent concept the way the user does, never as a
   layer or a grab-bag:

   | kind | the parent concept is | example |
   | --- | --- | --- |
   | `server`, `database` | the resource the small domains hang off | `Seasons`, `Bugs`, `Events` routes → twigs/leaves of `Grounds`; `Auth`, `Tokens`, `Orgs` → `Accounts`; admin and public endpoints → `Operations` |
   | `front` | the screen they appear on together | tree layers, season tabs, the time slider → twigs of `Tree`; invite page → twig of `Accounts` |

   If no honest parent concept exists, leave the small domains as limbs of
   their own, one leaf each — the graph folds a one-leaf limb into a narrow
   slot.

Real grounds that skipped rule 2 ended up with half their limbs holding a
single leaf and a dozen two-leaf limbs for one screen's parts — each one a
level that says nothing. `get_graph` reports that as the `thin-limb` IA hint
(per trunk, when half or more of its limbs are thin): look for the parent
concept those limbs share before adding another.

## Connections between kinds

| From → to | Record as |
| --- | --- |
| front screen → server endpoint | api (`create_api`, caller → callee) |
| server endpoint → database table | edge `data_flow` (writes) or `dependency` (reads) |
| table → table (foreign key) | edge `dependency` (referencing → referenced) |
| any trunk → library module | edge `dependency` |
| tooling script → the trunk it runs or checks | edge `dependency` (tooling → target) |

## Warnings

`create_node` and `update_node` never reject on these — they come back in
`warnings[]`:

| Rule | Meaning |
| --- | --- |
| `trunk-kind-missing` | A trunk has no `metadata.kind`. Pick one of the six, or follow "When none of them fits". |
| `trunk-kind-unknown` | `metadata.kind` is not one of the six. Same advice. |
| `trunk-direct-leaf` | A leaf is created or moved directly under a trunk. Give it a limb (rule 1) or put it under the limb of its parent concept (rule 2). |
| `limb-domain-suffix` | A limb directly under a trunk ends in a kind suffix (`API`, `응답`, `테이블`, `관리`, `Table(s)`, `Admin`, `Management`). Drop it and reuse the domain name. |
| `limb-layer-axis` | A limb is named after a technical layer. Split by the trunk kind's axis instead. |
| `common-limb-duplicate` | The trunk already has a limb with `metadata.common: true`. |
| `common-content-outside-common` | A front limb is named like common content (design system, shared components, app shell, layout), or a limb is named `공통`/`Common`/`Shared` without `metadata.common: true`. Make it a twig of the common limb, or mark it. |

A table leaf (`metadata.table` set) may share its name with a first-class record — a `Bugs` table is not a bug — so `reserved-domain` does not fire on it.

## Reshaping an existing tree

Grounds built before these rules exist. Bring them in line one node at a
time: set each trunk's `kind`, then rename or regroup limbs with the label
change visible, recording `reparented_*` when nodes move (see
`umtri://rules/system-structure`). Ask the human before a large regrouping —
the shape of their tree is theirs to approve.
