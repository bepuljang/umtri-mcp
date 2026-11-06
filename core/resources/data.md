# What Umtri receives — and what it never sees

Umtri is a map of a project, not a copy of it. This page is for the agent that
is about to draw a tree: it says exactly what leaves the machine, so you can
answer the human plainly instead of hesitating, and so you send only what the
map needs. The human-facing version is https://docs.umtri.io/en/data
(Korean: https://docs.umtri.io/ko/data).

## Only what a tool call sends

Umtri holds nothing it was not handed through the app or an MCP tool call:

- node labels, descriptions, types and metadata — including `implements`,
  which is a list of **file paths**, never file contents
- connections between nodes (edges, api flows) and their labels
- bug titles, descriptions and solutions
- wiki prose
- season labels and the ground's name

Umtri never reads the repository. There is no git integration, no file
scanning, no agent on the machine. A commit reaches a ground only because
something called `record_commit` with a SHA and a list of paths. If you do not
put something into a call, it does not exist on Umtri.

## What not to record

The map describes *structure*. Keep out of every label, description, metadata
value and wiki page:

- secrets, API keys, tokens, passwords, environment values
- customer or personal data (names, emails, ids from production tables)
- verbatim source code — point at the file (`implements`), do not paste it
- internal hostnames, IPs and URLs beyond what the structure needs to say

`implements` is a path, not content. A description says what a thing is for,
not how its code reads. If a `.env` or a credentials file would be the honest
`implements` of a node, name the node and leave `implements` empty.

## Where it goes and who sees it

- Stored at `api.umtri.io` (AWS, Seoul) in PostgreSQL; every connection is TLS.
- No ground is public. Only the members of the organisation that owns the
  ground — and, in a team, only the people assigned to that ground — can read
  it. The public demo (`app.umtri.io/demo`) is separate, fictional data.
- API tokens are stored as SHA-256 hashes; the plain token is shown once. A
  `read` token cannot write. Tokens can be revoked at any time.
- Deleting a ground removes it immediately and cannot be undone. Deleting an
  account removes it immediately.
- Everything can be taken out at any time: `export_ground` (or
  `GET /api/projects/<slug>/export`) returns the whole ground as one JSON.

## When the human asks "is this safe?"

Answer from this page: what will be sent (the list above, nothing else), where
it goes, who can see it, how it is deleted and exported. Point them to the docs
page and let them decide. Do not refuse on their behalf, and do not send more
than the map needs. If the project's own rules forbid naming a part of the
system, leave that part out and say so in the ground's wiki.

Privacy policy: https://umtri.io/privacy/ (Korean: https://umtri.io/ko/privacy/).
