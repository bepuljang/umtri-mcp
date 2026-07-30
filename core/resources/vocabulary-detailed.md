# Umtri Vocabulary — Detailed Guidance

Read this only when you are restructuring an existing tree, auditing legacy
data, or wrestling with a borderline classification. The core rules live in
`umtri://rules/vocabulary`; this resource expands them.

## Hierarchy rules (convention, not schema-enforced)

| Parent role | Allowed child role(s)         | Note                                                       |
| ----------- | ----------------------------- | ---------------------------------------------------------- |
| structure (trunk/limb/twig) | structure / object | can hold each other or jump straight to a `leaf`           |
| object (`leaf`)             | action (`vein`) only | a leaf cannot branch back into structure                 |
| action (`vein`)             | —                  | **vein is terminal — no children**                         |

The schema accepts any combination. The MCP warns when violated but lets
the data through (legacy migration, experimental use). For new authoring,
follow the table strictly.

**Skip-level traversal is allowed within structure**: `trunk → leaf`,
`limb → leaf`, even `trunk → twig` are valid. The full descent
`trunk → limb → twig → leaf → vein` is canonical, not mandatory.

## Trunk = system-unit, not domain

A `trunk` must be a **deployable system or independent service** — something
you could point at, deploy, or replace as a whole. Apps, databases, servers,
external services. Examples that fit: `user-app`, `api-server`, `iot-server`,
`db`, `www`, `kiosk-app`.

Domains or feature areas (auth, payments, reservations, dashboard, …) are
**`limb`**, not trunk. They live inside a trunk. "Authentication is a domain
that spans the user-app and admin trunks" — fine. "Authentication is a
trunk" — no.

Naming convention (recommended, not enforced):
- Apps: `<name>-app` (e.g. `user-app`, `kiosk-app`)
- Servers: `<name>-server` (e.g. `api-server`, `iot-server`)
- Infra: short single words (`db`, `www`, `cdn`)

## Leaf vs vein — extended heuristics

`leaf` (object) and `vein` (action) look adjacent but carry opposite intents:

- **leaf** — the thing that exists. A component, class, domain entity,
  screen, card. Noun phrase.
- **vein** — what the object *does*: a method, function, or operation that
  exists on it. Verb phrase naming a standing **capability** — not a task,
  patch, migration step, or change that was performed. A vein is `환불 처리`
  ("processes refunds"), never `환불 버그 수정` (a completed task).

Korean label patterns:

| Pattern                                                              | Type | Example                                                  |
| -------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| Noun-final / domain model                                            | leaf | `예약 카드`, `결제 정책`, `사용자 메뉴`                  |
| UI components (모달·카드·페이지·대시보드·패널·화면·표·뷰)            | leaf | `랜딩 페이지`, `매출 대시보드`, `공지 이미지 리사이저`   |
| Verb-final capability (`…충전`·`…차감`·`…환불`·`…조회`·`…발송`·`…등록`·`…검증`·`…동기화`·`…집계`) | vein | `포인트 충전`, `세션 검증`, `방문 집계`                  |
| Handlers / methods / crons / jobs (standing capabilities)           | vein | `레슨 자동 완료 cron`, `방문 집계 핑`                    |

Note the boundary with the work-log rule: a vein names an operation the
object *performs* (a capability that stays true tomorrow), not the act of
fixing/adding/migrating it. `정적 파일 캐시 버스팅` (a capability the build
has) is a vein; `캐시 버스터 추가` (work done) is not a node at all.

**Vein litmus — one vein ≈ one locatable code unit.** A vein earns its place
when you can point to where it lives (a function, guard, calculation, cron) —
it should carry `metadata.implements`. Reserve veins for the *non-obvious,
worth-finding-again* logic: business invariants, security, money math
(`코트·시간대 중복 예약 방지`, `보너스 포인트 FIFO 차감`, `휴대폰 AES-256-GCM
암호화`). Do **not** explode every endpoint into CRUD veins, and do **not**
turn a requirement or rule you can't point to in code into a vein — that
belongs in the leaf's `description`, or as a `bug`/plan node. A good tree uses
veins sparingly (often <10% of nodes); a forest of veins under every leaf is
the over-veining smell.

## Reclassification policy (for AI auditors)

When migrating or auditing legacy data, AI tools **may reclassify** a `leaf`
node to `vein` (or vice-versa) **only if both** hold:

1. The label clearly fits the opposite category by the heuristics above.
2. The node has **no children** (vein cannot have children).

Always make reclassification edits **one node at a time**, with the label
visible in the diff. Bulk regex sweeps over labels are explicitly disallowed
— the Korean heuristics are advisory, not deterministic. When unsure, leave
the node alone and surface it as a question.

## Build order — leaf-driven, depth-first

The canonical descent `trunk → limb → twig → leaf → vein` describes the
*shape* of a finished tree. It is **not** an instruction to build the tree
breadth-first (all trunks, then all limbs, then all leaves). Building that
way produces a skeleton of empty structure and forces you to guess the IA
top-down before you know what actually lives in it.

**Author one leaf at a time, depth-first.** The leaf (or vein) is the only
node that names a thing that genuinely exists; trunk/limb/twig exist solely
to hold leaves. So let the leaf pull its ancestors into being:

```
for each information unit you want to record (a leaf or vein):
    path = [trunk, limb, twig?] it belongs under
    create_node for each ancestor in path that does NOT exist yet  (reuse the rest)
    create_node for the leaf, with metadata.implements
    create_node for each vein the leaf owns
```

Worked example — recording two screens in a `user-app`:

1. First leaf `예약 카드` lives under `user-app › 예약 › 예약 화면`.
   - `user-app` (trunk) missing → create it.
   - `예약` (limb) missing → create it.
   - `예약 화면` (twig) missing → create it.
   - create leaf `예약 카드`.
2. Next leaf `결제 버튼` lives under `user-app › 결제 › 결제 화면`.
   - `user-app` already exists → reuse.
   - `결제` (limb) missing → create it.
   - `결제 화면` (twig) missing → create it.
   - create leaf `결제 버튼`.

Each new leaf reuses the ancestors earlier leaves already built and only
creates structure where the path diverges.

**Why depth-first by leaf beats breadth-first by layer:**

- **No dormant scaffolding.** Every trunk/limb/twig gets its first leaf in
  the same pass, so the `structure-without-children` warning fires only for
  genuinely-intended placeholders — not for half-built layers.
- **Structure is earned, not guessed.** You decide a `limb` exists *because*
  a concrete leaf needs a home, not by sketching an org chart first. This is
  also when the twig-vs-skip-to-leaf decision (next section) is actually
  answerable — you can see how many siblings the concept really has.
- **Recoverable if interrupted.** Stop after any leaf and the tree is a set
  of complete branches, not a headless skeleton.

A trunk or limb with no leaf descendant *during authoring* is the signal
you've slipped back into layer-by-layer mode. Add its first leaf before
moving on, or don't create the structure node yet.

## Twig vs jump straight to leaf

`twig` is for **information groups** — a cluster of related leaves under a
shared concept. Use it only when you have (or expect to soon have) multiple
sibling `leaf` nodes that belong together.

If the concept boils down to *one* component, file, or object, **skip twig
and put the leaf directly under the limb**.

| Case                                                                                       | Use                                                  |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| One React component, one file, one service                                                 | `limb → leaf` directly. No twig.                     |
| Several leaves that share a clear theme (e.g. design system = Button, Modal, Field, …)     | `limb → twig → leaf+`                                |
| Several components composing one flow (e.g. auth = SignIn, Login, SignUp)                  | `limb → twig → leaf+`                                |
| A single file that decomposes into multiple meaningful units                               | Multiple leaves with `metadata.implements` carrying `path#identifier` (see system-structure) |

A twig with no leaves is dormant. Skipping twig when only one object lives
underneath keeps the tree readable.

The MCP `create_node` tool emits a `structure-without-children` info
warning when you create a `limb` or `twig`, reminding you that the node
renders dormant until a leaf/vein appears.

## Tree shape — bushy is fine, don't over-nest

A healthy Umtri tree is **bushy, not deep**: most nodes sit at the middle
levels (limbs and their leaves), and the full `trunk → limb → twig → leaf →
vein` descent is reached only where the detail genuinely warrants it. Depth
is *earned by content*, not added for tidiness.

The biggest pressure toward unnecessary depth is the urge to group siblings
that merely share a name. **Sharing a label prefix is not, by itself, a
reason to create a twig.** Korean domain labels naturally share prefixes
(`예약 생성` / `예약 취소`, `포인트 충전` / `포인트 환불`) — two or three such
siblings under a limb are perfectly legible as-is. Insert a twig only when a
parent is genuinely crowded (≈4+ leaves) *and* a real sub-theme groups
several of them. Wrapping every pair in a twig makes the tree taller and
harder to read, not easier.

`get_graph` (summary) returns a `shape` block — `maxDepth`, nodes per level,
and `wideBranches` — plus a `childCount` on each branch node. Use it to judge
the tree before restructuring: mass concentrated at mid-levels with a shallow
`maxDepth` is the goal, not a smell. Over-wide trunks are usually fine (a
trunk's children are top-level domains); an over-wide **limb** (many direct
leaves) is the case the `junk-drawer-limb` / `sibling-cluster` hints flag.

## Promotion signals — when a twig should be a limb

Some concepts start as twigs nested inside a domain limb but actually
deserve sibling-limb status. Treat these as **promotion signals** when
authoring or restructuring:

| Signal                                                  | Example                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| Route-independent global shell                          | A sidebar shown on every screen, a global header                 |
| Distinct entry flow (splash → continuation)             | Login + signup pages reached before the main app                 |
| Globally reusable assets                                | Design tokens + shared components + global toasts                |
| Domain limb growing into a "junk drawer" (>5 unrelated twigs) | A `dashboard` limb absorbing sidebar + auth + UI + pages   |

When any apply, create the unit as a **limb sibling** of the original
domain limb rather than burying it as a twig.

The MCP `create_node` and `update_node` tools emit a
`twig-promotion-candidate` info warning when a twig's `description`
mentions promotion signals (전역, 라우트 비종속, 스플래시, 재사용 자산,
global, route-independent, splash, …).

## Labels as information units (anti-patterns)

A label should name the thing a user or external observer perceives, not
the code construct implementing it.

| Anti-pattern label                                  | Problem                                  | Better                                                |
| --------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `Bugs router`, `Auth middleware`, `Webhook handler` | names the Express artifact                | `Bug log API`, `Request authorization`, `Provider webhooks` |
| `API layer`, `Service tier`, `Data store`           | layer/tier/store = architectural plumbing | split by domain, name the surface                     |
| `store.js`, `middleware/auth.js`, `index.jsx`       | filenames belong in `metadata.implements` | `Persistence`, `Auth guard`, `Graph root`             |
| `Helper`, `Manager`, `Bootstrap`, `Wrapper`         | generic dev nouns, no info content        | the actual responsibility it carries                  |

The `file-as-leaf` warning also catches the **redundant-child antipattern**:
a twig whose only child is a leaf named after the same concept's file is
just one node split into two. Absorb the file into the twig's
`metadata.implements` and remove the leaf. The twig itself *is* the
information unit; the file is its implementation.

Apply these on existing data only when a node's label clearly violates the
rule. Coordinated bulk renames go one node at a time with the diff visible.

## Dormant cleanup — group by branch

When proposing dormant cleanup, group by parent so the user can decide on
whole branches at once rather than one node at a time. Common reasons a
node is dormant:

- Placeholder for upcoming work (intentional outline)
- A plan sketched before any code landed
- A stale outline that was never filled in (cleanup candidate)

If a node's season is `past` and the label is vague, the user may choose
to soft-delete. Nodes with `metadata.placeholder = true` are excluded —
respect that marker and do not flag them.

## Back-filling historical projects (`sproutedAt`)

When importing a project that existed **before Umtri** — past commits,
migrated trees, archaeological work on legacy code — the node's "creation
moment" is the original event, not the moment the record landed in Umtri.

`create_node` (and `update_node`) accept an optional `sproutedAt` field
(ISO 8601 with offset, e.g. `"2024-03-15T09:00:00Z"`). When set, **the
visualization timeline follows this value** — sibling order, season
visibility masking, and the events feed all use `sproutedAt` as the
effective creation moment. The system audit timestamp (`created_at`,
which records when the row landed in the database) stays untouched and is
not surfaced in graph responses.

Guidelines:

- **Default behavior is correct for live work.** Omit `sproutedAt` for any
  node created in the present — the system timestamp is the truth.
- **Use only for back-fill.** Importing past commit history, recovering a
  deleted project, migrating from another tool, dogfooding a project's
  history into Umtri. Do not back-date "for clarity" on live work.
- **Order matters.** When importing many nodes, set `sproutedAt` to their
  real historical timestamps so sibling order and season visibility line
  up. Random or batch-identical timestamps produce a deformed timeline.
- **Pair with `season`.** Place each back-filled node in the season that
  was active at its `sproutedAt`. Otherwise the slider will hide nodes
  whose season has not yet started at T = `sproutedAt`.
- **Clearing.** `update_node` with `patch.sproutedAt = null` clears the
  override; the node falls back to its system timestamp.
- **Cannot back-fill `removed_at` or `grown_at`.** These follow the system
  clock; only the *birth* of a node can be antedated.

Past-season nodes are still rejected from new `create_node` calls (the
"cannot create node in past season" rule). For full back-fill of an
archived season, set the target season to `now` first, import, then
human-promote it back to `past` via the seasons UI.
