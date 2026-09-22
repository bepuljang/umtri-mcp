// MCP resource 등록 — transport-agnostic.
//
// 사용: registerResources(mcpServer, { resourcesDir })
//   resourcesDir에 아래 RESOURCES의 file 전부가 있어야 한다. 파일은 읽기 시점에
//   열리므로(등록 시점 아님) 누락은 등록이 아니라 첫 호출에서 터진다.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RESOURCES = [
  {
    name: 'vocabulary',
    uri: 'umtri://rules/vocabulary',
    file: 'vocabulary.md',
    title: 'Umtri vocabulary (plant metaphor) — core',
    description: 'Node types (trunk/limb/twig/leaf/vein), first-class citizens, label rules, dormant policy, warning catalog. Read before creating or describing nodes. For restructuring/auditing, also read vocabulary-detailed.',
  },
  {
    name: 'vocabulary-detailed',
    uri: 'umtri://rules/vocabulary-detailed',
    file: 'vocabulary-detailed.md',
    title: 'Umtri vocabulary — detailed guidance',
    description: 'Reclassification policy, twig vs leaf decision matrix, twig promotion signals, redundant-child antipattern, Korean label heuristics. Read only when restructuring an existing tree or wrestling with a borderline classification.',
  },
  {
    name: 'seasons',
    uri: 'umtri://rules/seasons',
    file: 'seasons.md',
    title: 'Seasons need the human\'s word',
    description: 'create_season exists but is gated: the first call only reports what would be sealed, and creation needs confirm:true after the user agrees. Read before opening a season, or when unsure which season a node belongs to.',
  },
  {
    name: 'transplant',
    uri: 'umtri://rules/transplant',
    file: 'transplant.md',
    title: 'Transplanting a ground',
    description: 'While a ground is transplanting (project.transplanting=true), past-season edits and hard-delete are allowed for reconstructing an imported project; seasons stay human-only. Read when project.transplanting is true.',
  },
  {
    name: 'plan',
    uri: 'umtri://rules/plan',
    file: 'plan.md',
    title: 'Plan nodes are a node-based brief',
    description: 'Nodes marked plan:true are the human\'s structural brief (intent expressed as nodes, not a prompt). Read them as instructions, realize the code, attach metadata.implements (required), keep new detail as plan, and leave committing to the human. Read when get_graph shows any plan:true node.',
  },
  {
    name: 'commit-sync',
    uri: 'umtri://rules/commit-sync',
    file: 'commit-sync.md',
    title: 'Keep the ground in step with commits',
    description: 'Umtri never reads git — nodes drift unless something records the change. Recommends writing a short commit-sync policy into the repo\'s own agent rules file (CLAUDE.md/AGENTS.md), with a snippet to adapt. Read when setting Umtri up in a repo, or when a commit turns out to have left the tree behind.',
  },
  {
    name: 'wiki',
    uri: 'umtri://rules/wiki',
    file: 'wiki.md',
    title: 'How to write a ground\'s wiki',
    description: 'A wiki page is named after a thing, and its revisions are that thing\'s life: rev 1 is the plan, later revisions are what it became, the newest is what is true now. Covers naming (the subject, never "prd-x"), writing the plan first, marking the plan→built boundary with newRevision, what stays on the page versus what becomes history (a live reason is current spec, not history), when to split pages, replace/append/restore/baseRev, attaching to nodes, and why deleting is almost never right. Read before writing or reorganizing wiki pages.',
  },
  {
    name: 'system-structure',
    uri: 'umtri://rules/system-structure',
    file: 'system-structure.md',
    title: 'Nodes represent information structures',
    description: 'Modelling principle: nodes are user-visible units, not code files. Metadata key conventions.',
  },
  {
    name: 'vision',
    uri: 'umtri://about/vision',
    file: 'vision.md',
    title: 'About Umtri',
    description: 'Project archaeology — track growth, trace dependencies, locate origins. Tone guidance for AI tools.',
  },
];

export function registerResources(server, { resourcesDir }) {
  for (const r of RESOURCES) {
    server.registerResource(
      r.name,
      r.uri,
      { title: r.title, description: r.description, mimeType: 'text/markdown' },
      async (uri) => {
        const text = await readFile(join(resourcesDir, r.file), 'utf8');
        return { contents: [{ uri: uri.href ?? uri.toString(), mimeType: 'text/markdown', text }] };
      },
    );
  }
}
