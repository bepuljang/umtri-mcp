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
    name: 'seasons-human-only',
    uri: 'umtri://rules/seasons-human-only',
    file: 'seasons-human-only.md',
    title: 'Seasons are human-only',
    description: 'AI tools must not create seasons. Defaults and exceptions explained.',
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
