# umtri-mcp

MCP server for [Umtri](https://umtri.io) — give your AI coding agent a persistent map of your
project's structure, dependencies, and bugs.

Your agent re-derives your codebase from scratch every session. Umtri stores the structure once and
hands it back through MCP: a tree of what the system is made of, the calls and dependencies between
its parts, and the bugs eroding it. Ask "what breaks if I change this?" and get an answer traced
through recorded connections rather than guessed from a grep.

## Quick start

The fastest path is the hosted endpoint at `https://mcp.umtri.io` — nothing to install. Generate a
token at [app.umtri.io](https://app.umtri.io) → Settings → API Tokens, then:

```bash
claude mcp add --transport http umtri https://mcp.umtri.io \
  --header "Authorization: Bearer umtri_pat_xxxxxxxxxxxxxxxx"
```

Any MCP client that takes a config object uses the same shape:

```json
{
  "mcpServers": {
    "umtri": {
      "type": "http",
      "url": "https://mcp.umtri.io",
      "headers": { "Authorization": "Bearer umtri_pat_xxxxxxxxxxxxxxxx" }
    }
  }
}
```

## Run it yourself (stdio)

Use this package when you want to pin a version or point at a self-hosted API:

```bash
claude mcp add umtri \
  -e UMTRI_API_TOKEN=umtri_pat_xxxxxxxxxxxxxxxx \
  --transport stdio \
  -- npx -y umtri-mcp
```

| Variable | Required | Default |
| --- | --- | --- |
| `UMTRI_API_TOKEN` | yes | — |
| `UMTRI_API_BASE` | no | `https://api.umtri.io` |

The token is not validated at setup time, so a bad token connects but every call fails. If tools
appear and then error, re-check the token and its scope — `read` tokens cannot call any write tool.

## Tools

**Read** — `get_graph`, `get_bug`, `get_impact`, `list_projects`, `list_bugs`, `list_seasons`,
`list_events`

**Write** — `create_project`, `create_node`, `update_node`, `delete_node` (a subtree only with
`cascade: true`), `create_edge`, `delete_edge`, `create_api`, `update_api`, `delete_api`,
`create_bug`, `update_bug`, `delete_bug`, `create_season` (acts only after the user confirms)

**Plan loop** — `commit_plan`, `record_commit`

**Wiki** — `list_wiki`, `get_wiki`, `list_wiki_revisions`, `write_wiki`, `delete_wiki`. The ground's
encyclopedia: pages form a table of contents (`parent`, `position`) read from an overview down,
each has a kind, and every write comes back with warnings when a page strays from the skeleton.

**Feedback** — `send_feedback` files a suggestion or defect about Umtri itself.

`get_graph` returns a slice, not a dump: scope by subtree (`rootId`), by layer (`maxType`), by role,
or by season, and control description weight separately. A large tree stays cheap to read.

## Resources

Ten read-only documents the agent can pull for domain rules — the plant vocabulary
(trunk/limb/twig/leaf/vein), what counts as a node and what does not, how seasons work, how plan
nodes are meant to be realized, how a ground behaves while transplanting, keeping the tree in step
with commits, and how to write and organize the wiki.

```
umtri://rules/vocabulary            umtri://rules/plan
umtri://rules/vocabulary-detailed   umtri://rules/commit-sync
umtri://rules/system-structure      umtri://rules/wiki
umtri://rules/seasons               umtri://templates/wiki
umtri://rules/transplant            umtri://about/vision
```

## Links

- Docs — <https://docs.umtri.io>
- App — <https://app.umtri.io>
- Site — <https://umtri.io>

## License

Apache-2.0. See [LICENSE](./LICENSE).
