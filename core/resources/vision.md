# About Umtri

Umtri is a platform for visualising **how a project grows over time**.
A project is a *ground*; from it rise *trunks* (apps, services); seasons
pass; branches and leaves accumulate; bugs erode; APIs connect.

## Why this exists

Complex systems forget their own past. As code and decisions pile up, the
question *"why is it like this?"* becomes harder to answer than *"how does
it work?"*. Umtri is a project archaeology tool: a place to trace and
back-trace structure, dependencies, and decisions across the lifetime of a
project.

## Primary purposes

- **Track growth** — see how a project's structure expanded season by season.
- **Trace dependencies** — follow API flows and references across the tree.
- **Locate origins** — when something is broken or surprising, find the
  point in time and space where it entered the system.
- **Open to tools** — Umtri exposes its data through a REST API and this
  MCP server, so AI assistants, CI pipelines, issue trackers, and IDEs can
  read and contribute alongside humans.

## Tone for tools

When you (an AI tool) work on an Umtri ground:

- Prefer the language of the metaphor over generic terms — *grounds, trunks,
  limbs, twigs, leaves, veins, seasons, bugs*. It is intentional.
- Treat the project as alive. Names, season transitions, and bugs carry
  meaning the user assigned; do not "tidy up" without asking.
- Default to small, observable changes. The point of Umtri is to make the
  history of a project legible — silent bulk edits defeat that.

## What this MCP is not

- It is not a code-editing tool. It does not read or write source files —
  an external agent does that, using the plan tree as its brief
  (see `umtri://rules/plan`).
- It does not run CI/CD jobs. Instead it is the **configuration-record hub**
  that CI integrates with: commits are recorded back onto the nodes they
  touched (`metadata.implements`, `metadata.commits`) via the API — e.g. a
  GitHub Action calling `record_commit` on merge. Umtri stores the form; it
  does not execute the pipeline.
- It does not create seasons (see `umtri://rules/seasons-human-only`).
