# Umtri Vocabulary — Plant Metaphor (Core)

A project grows from the ground upward. Each node has a `type` from the
plant metaphor; `role` is derived. The schema does not enforce parent/child
type rules; clients should follow them.

## What the tree is

The tree is the project's **information-structure (IA) diagram** — a map of
the parts that make up the system and what each part does. Every node is a
**structural element**: an object (a class, component, screen, service — a
concrete code entity) or an action it performs (a method, function,
operation). Recording real code entities is exactly the point — that is the
content the tree is made of.

The one hard line: the tree is **not a work log**. A node records what
*exists* now, never what was *done* to get there — no `…수정`, `…추가`,
`2월 작업`, "fixed X". History lives in seasons, `created_at`, commits, and
bugs (see "Record results, not a work log" below). Naming polish — naming a
node as the information unit rather than a raw filename — is a *softer*
guideline; see `umtri://rules/system-structure`.

## Types & Roles

| Type    | Role      | What it represents                                                 |
| ------- | --------- | ------------------------------------------------------------------ |
| `trunk` | structure | A deployable system or independent service (app, server, DB).       |
| `limb`  | structure | A domain or feature area inside a trunk (auth, payments, dashboard).|
| `twig`  | structure | A cluster of related leaves (a module, a feature group).            |
| `leaf`  | object    | The thing itself — class, component, screen, entity. Noun phrase.   |
| `vein`  | action    | A capability the object performs — a method/function that exists now. Verb phrase. NOT a task or a change that was made. |

Canonical descent: `trunk → limb → twig → leaf → vein`. **Default to inserting
a `twig` when a `limb` is about to hold ≥3 sibling leaves that share a theme**
— twig is the level that *exposes* the project's IA, the shape a human reads
at a glance. Skip-level (`limb → leaf` direct) is only for limbs with a single
object underneath. `vein` is terminal — no children. `ground` (y=0) is
implicit; it is not a node.

`leaf` and `vein` nodes should carry `metadata.implements: string[]` pointing
at source files (e.g. `["server/data/store.js"]`, or `"path#identifier"` for
multi-export files). Without it the graph cannot answer "where does this
live?" — and the convention is followed on essentially every leaf in a
healthy ground.

## Build order — lead with leaves, not layers

The descent above is the *shape* of the finished tree, **not the order you
build it in**. Do **not** create every trunk, then every limb, then every
leaf (breadth-first). Build **one leaf at a time, depth-first**:

1. Pick the next concrete thing to record — a `leaf` (object) or `vein`
   (action). That is the unit that actually exists; structure only exists to
   hold it.
2. Walk the path it needs from the root (`trunk → limb → twig`) and create
   **only the ancestors that don't exist yet**. Reuse any that do.
3. Create the leaf under that path, then any `vein`s it owns.
4. Move to the next leaf. Most of its ancestors already exist from earlier
   leaves — you only create structure where the path diverges.

Why: every structure node is then justified by a real leaf, so you never
leave dormant scaffolding (`structure-without-children`) sitting empty. You
also reason about observable units instead of guessing the skeleton top-down.
A trunk/limb with no leaf under it yet is a smell that you're building
layer-by-layer — add its first leaf before moving on, or don't create it.

## Record results, not a work log

The tree captures **what the project IS right now** — the structure and
capabilities that currently exist — not **what was done** to get there.
This matters most for `vein`s, which drift into task entries.

- ✅ A `vein` names a capability that exists: `포인트 충전`, `예약 생성`,
  `세션 검증`. It is the operation the object performs today.
- ❌ Do **not** create nodes for work performed: `포인트 충전 기능 추가`,
  `결제 버그 수정`, `로그인 리팩터링`, `2월 스프린트 작업`. Those are
  activity-log entries, not parts of the system.

Litmus test: if the label only makes sense as a sentence about *a change*
("added…", "fixed…", "refactored…", or ends in `…작업 / 수정 / 개선 / 추가`),
it is a work-log entry — keep it out of the tree. If it names a thing or a
capability that stays true after the work is forgotten, it belongs. So a
vein is `환불 처리` ("the object processes refunds" — a standing capability),
never `처리한 환불 작업` (a completed task).

Where history actually lives — don't duplicate it as nodes:
- **When** something grew → `season` + `created_at` (the time slider).
- **What changed / by whom** → `metadata.created_by_commit`,
  `replaces` / `replaced_by`, `role_change_reason`.
- **What's broken or in progress** → `bugs` (status open/in_progress).
- A finished task leaves a *result* in the tree (a new or updated leaf/vein);
  it does not leave a task node behind.

## First-class citizens — do NOT make them nodes

These live in their own tables and have dedicated tools. Encoding them as
nodes (in `type` or `label`) is the most common mistake.

- Bug / error / issue → `bugs` table — use `create_bug`
- API / endpoint / integration → `apis` table — use `create_api`
- Season / sprint / epoch → human-only, see `umtri://rules/seasons-human-only`
- Dependency / data flow → `edges` table — use `create_edge`

## Bug lifecycle — one step at a time

The Bug Codex reads `status` as three states:

| status | codex | meaning |
|---|---|---|
| `open` | wild | found, nobody is on it |
| `in_progress` | chasing | someone is fixing it right now |
| `resolved` / `closed` | catched | it landed |

Move one step at a time: **wild → chasing → catched**.

- Starting a fix? Set `status="in_progress"` **before** you work, not after.
- Landed it? Then `status="resolved"` (optionally with
  `metadata.resolvedVersion`).

`in_progress` is the only signal that a bug is already being worked. Fixing and
resolving in a single `update_bug` call means the bug is never visibly
"chasing" — a parallel agent has no way to tell the work is in flight and may
start the same fix. It also collapses the two timestamps the codex uses to
separate *found → started* from *started → shipped*.

Jumping `open → resolved` is a warning, not a rejection: when the fix really was
instant, one step is honest. Going `resolved → open` is also flagged — if you
are resuming work say `in_progress`; if it truly regressed, record what shipped
and broke it in the description.

## Time & soft delete

- `season` — a deliberate growth epoch, created only by humans.
- Visibility at moment T: `created_at ≤ T && (removed_at IS NULL OR removed_at > T)`.
- `DELETE` sets `removed_at`; rows are kept so past states stay reconstructible.

## Label rules

A label names what a user or observer perceives — not the code construct.

- **Avoid implementation jargon**: `router`, `handler`, `controller`,
  `middleware`, `wrapper`, `manager`, `bootstrap`, `helper`, `util`,
  `factory`, `layer`, `tier`, `store`. Name the responsibility.
- **Avoid filenames as labels**. Put the path in `metadata.implements`
  (e.g. `"server/data/store.js"`) and name the leaf after the concept.
- **Korean leaf-vs-vein default** (classify by the *final* morpheme):
  - Noun-final or domain entity (`예약 카드`, `결제 정책`, `사용자 메뉴`) → `leaf`
  - Verb-final 한자어 (`…충전 / 차감 / 환불 / 연장 / 조회 / 발송 / 등록 /
    수정 / 처리 / 동기화 / 검증 / 생성 / 삭제 / 적용 / 분리 / 마이그레이션 /
    업로드 / 갱신 / 만료 / 집계 / 복구`) → `vein`
  - Handler/method/cron names (`레슨 자동 완료 cron`, `방문 집계 핑`) → `vein`

## Dormant nodes

A structure node (trunk/limb/twig) with no leaf/vein descendant is **dormant**
— the UI dims it (opacity 0.4). Dormant is a state, not an error.

- **Never auto-delete** dormant nodes. Surface them; let the user decide.
- `metadata.placeholder = true` means "intentionally empty" — respect it.

## Warnings the MCP may return on create/update

If you see one of these in the response, read it before proceeding:

| Rule                          | Meaning                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `parallel-leaves-need-twig`   | Limb already has ≥3 leaf children. Insert a twig to group them.   |
| `missing-implements`          | leaf/vein created without `metadata.implements` (source paths).   |
| `leaf-vs-vein-heuristic`      | Leaf label ends in a Korean verb stem — likely belongs as vein.   |
| `implementation-jargon`       | Label contains coding-artifact terms (see Label rules).           |
| `file-as-leaf`                | Leaf label looks like a filename or path.                         |
| `structure-without-children`  | New limb/twig will render dormant until a leaf/vein appears.      |
| `twig-promotion-candidate`    | Twig description suggests it should be a sibling limb.            |
| `redundant-child`             | A twig and its only leaf duplicate the same concept.              |

## Further reading (read only when relevant)

- `umtri://rules/system-structure` — metadata key conventions, file→leaf mapping
- `umtri://rules/vocabulary-detailed` — promotion signals, reclassification
  policy, twig-vs-leaf decision matrix, redundant-child antipattern details
