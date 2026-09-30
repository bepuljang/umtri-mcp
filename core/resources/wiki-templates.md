# Wiki Templates

A ground's wiki is read front to back: an overview at the top, chapters under
it, entries under those. These are recommended tables of contents by project
type. Pick the one closest to the project, adapt it, and grow into it.

**Use a template as a map, not a stub generator.** Create a page when you have
something true to write in it — an empty page reads the same as a page nobody
has written yet, and a table of contents full of them hides the ones that
matter. The overview and chapter pages come first; entries arrive as knowledge
does.

How to read the tables:

- Indentation is the tree (`parent`), order is `position`.
- Titles are plain nouns in the reader's language. Each entry shows an English
  and a Korean title; use the one that matches the people reading the wiki.
- `kind` decides the skeleton (see `umtri://rules/wiki`): `overview` needs only
  a lead, `concept` / `component` need `## Spec`, `rule` needs `## Rules`,
  `glossary` is a term table.
- Skip what the project does not have. Add what it has that is not listed.

## Web service

A server-backed product used in the browser: frontend, API server, database,
deployed somewhere.

| Page | 제목 | kind | What it holds |
| --- | --- | --- | --- |
| Overview | 개요 | overview | What the product is, who uses it, the stack in one table, how to read this wiki |
| &nbsp;&nbsp;Concepts | 개념 | overview | The domain model a newcomer must learn before the code makes sense |
| &nbsp;&nbsp;&nbsp;&nbsp;*one page per core concept* | | concept | The entities and rules of the domain (e.g. order, account, workspace) |
| &nbsp;&nbsp;Architecture | 구성 | overview | How the system is put together; one sentence per part below |
| &nbsp;&nbsp;&nbsp;&nbsp;Server | 서버 | component | Request pipeline, routing, error shape, where business logic lives |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Authentication | 인증 | component | Sessions/tokens, who can call what |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*one page per server domain* | | component | e.g. billing, notifications, search |
| &nbsp;&nbsp;&nbsp;&nbsp;Database | 데이터베이스 | component | Tables, ownership, migrations, invariants the schema enforces |
| &nbsp;&nbsp;&nbsp;&nbsp;Frontend | 프론트엔드 | component | Routing, state, design system, i18n |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*one page per major screen or flow* | | component | |
| &nbsp;&nbsp;&nbsp;&nbsp;Integrations | 외부 연동 | component | Payment, mail, third-party APIs — contracts and failure modes |
| &nbsp;&nbsp;Operations | 운영 | overview | How the product is shipped and kept running |
| &nbsp;&nbsp;&nbsp;&nbsp;Deployment | 배포 | rule | Environments, order of steps, what must never be skipped |
| &nbsp;&nbsp;&nbsp;&nbsp;*conventions* | | rule | e.g. commit sync, code review, copy and i18n, secrets |
| &nbsp;&nbsp;Glossary | 용어 | glossary | Product vocabulary and names that mean something specific here |

## App service

A mobile or desktop app, usually with a backend it talks to.

| Page | 제목 | kind | What it holds |
| --- | --- | --- | --- |
| Overview | 개요 | overview | What the app does, platforms, the stack, how to read this wiki |
| &nbsp;&nbsp;Concepts | 개념 | overview | The domain model |
| &nbsp;&nbsp;&nbsp;&nbsp;*one page per core concept* | | concept | |
| &nbsp;&nbsp;Architecture | 구성 | overview | App, backend and the boundary between them |
| &nbsp;&nbsp;&nbsp;&nbsp;App | 앱 | component | Navigation, state, offline behaviour, platform differences |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*one page per major screen or flow* | | component | |
| &nbsp;&nbsp;&nbsp;&nbsp;Backend | 백엔드 | component | API the app calls, auth, sync |
| &nbsp;&nbsp;&nbsp;&nbsp;Device features | 기기 기능 | component | Push, permissions, camera, storage — what the OS allows and when |
| &nbsp;&nbsp;Operations | 운영 | overview | |
| &nbsp;&nbsp;&nbsp;&nbsp;Release | 릴리스 | rule | Build, signing, store review, versioning, staged rollout |
| &nbsp;&nbsp;&nbsp;&nbsp;*conventions* | | rule | |
| &nbsp;&nbsp;Glossary | 용어 | glossary | |

## Library

A package other code depends on: SDK, framework, CLI, shared module.

| Page | 제목 | kind | What it holds |
| --- | --- | --- | --- |
| Overview | 개요 | overview | What it solves, who depends on it, supported runtimes |
| &nbsp;&nbsp;Concepts | 개념 | overview | The mental model users must hold |
| &nbsp;&nbsp;&nbsp;&nbsp;*one page per core concept* | | concept | |
| &nbsp;&nbsp;Public API | 공개 API | overview | The surface other code relies on |
| &nbsp;&nbsp;&nbsp;&nbsp;*one page per module or entry point* | | component | Behaviour, guarantees, errors |
| &nbsp;&nbsp;Internals | 내부 구조 | component | How it works inside; what may change without notice |
| &nbsp;&nbsp;Operations | 운영 | overview | |
| &nbsp;&nbsp;&nbsp;&nbsp;Releases | 릴리스 | rule | Versioning, compatibility promises, deprecation, publishing |
| &nbsp;&nbsp;&nbsp;&nbsp;*conventions* | | rule | |
| &nbsp;&nbsp;Glossary | 용어 | glossary | |
