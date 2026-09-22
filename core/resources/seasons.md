# Rule: Seasons Need the Human's Word

A `season` is a deliberate growth epoch — "Q3 2026", "v2 redesign", "PoC".
It is the unit by which a project owner *consciously breaks time* in their
ground. You may create one, but never on your own judgment.

## Why this needs confirming

Creating a season is not additive. The ground's current `now` season is sealed
as `past` and every node in it is marked grown, which locks that node's
`parent`, `season`, `type` and `sproutedAt`. A season opened because you could
not decide where a node belonged turns the ground's timeline into noise, and
the lock it leaves behind is not yours to undo.

## The gate

`create_season` refuses to create anything until the human has agreed.

1. Call it with `slug` and `label` and **no** `confirm`. Nothing is created;
   you get back the label you proposed and the season that would be sealed.
2. Put that to the user in your own words — the new season and what closes.
3. Only once they say yes, call again with `confirm: true`.

Passing `confirm: true` on the first call is a protocol violation, even when
the user's request seems to imply it. "Move the pre-April work into a PoC
season" names a season; it does not confirm sealing the current one.

## When not to reach for it at all

Unsure which season a new node belongs to? Do **not** open one.

- Attach it to the existing season whose state is `now`.
- If no `now` season exists, ask the user which season to attach to.

A missing season is a question for the human, not a gap for you to fill.

## What needs no confirmation

- Reading seasons (`list_seasons`).
- Attaching new nodes to existing seasons via the `season` field.
- Suggesting that a new season *might* be useful, and waiting.

## Still human-only

Rooting a ground (ending transplant) stays human-only through the UI, and once
rooted it cannot be re-opened by anyone but an administrator.
See umtri://rules/transplant.
