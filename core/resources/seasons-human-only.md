# Rule: Seasons Are Created by Humans Only

**AI tools and automation MUST NOT create new seasons.**

## What a season is

A `season` is a deliberate growth epoch declared by a human — for example
"Q3 2026", "v2 redesign", "post-launch hardening". It is the unit by which
project owners *consciously break time* in their ground.

## Why this rule exists

Seasons carry intent. They mark moments where a person decides "this chapter
is done, the next one begins." If an AI agent silently opens a new season
when it can't decide which existing one to use, the metaphor collapses and
the project's timeline becomes meaningless noise.

## What this means in practice

- The MCP tool `create_season` is intentionally **not exposed**.
- When creating a new node and unsure which season it belongs to:
  - Default to the most recent existing `season` whose state is `now`.
  - If no `now` season exists, ask the user which season to attach to.
- Never call `POST /api/projects/:slug/seasons` from automation.
- A user explicitly saying "create a new season called X" is the only valid
  trigger. Even then, prefer to confirm before acting.

## What is allowed

- Reading seasons (`list_seasons`).
- Attaching new nodes to existing seasons via `season` field.
- Suggesting to the user that a new season *might* be useful — but waiting
  for them to create it.
