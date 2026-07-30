// MCP tool 등록 — transport-agnostic. stdio CLI과 HTTP 라우터 양쪽에서 호출.
//
// 사용: registerTools(mcpServer, { api })
//   - mcpServer: @modelcontextprotocol/sdk McpServer 인스턴스
//   - api: createApiClient(...) 결과 — get/post/put/patch/delete

import { z } from 'zod';
import { validateNode, validateEdge, validateUpdate, validateBugUpdate } from './policy.js';

// LLM이 소비하는 결과 — 들여쓰기는 순수 토큰 낭비라 minify. (큰 그래프에서 ~19% 절감)
function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function errorResult(err) {
  return {
    content: [{ type: 'text', text: `Error: ${err.message}` }],
    isError: true,
  };
}

// description은 보통 50~300자. 200자에서 잘라 LLM 컨텍스트 폭증 방지.
const DESC_LIMIT = 200;
function truncate(s, limit = DESC_LIMIT) {
  if (!s || typeof s !== 'string') return s;
  return s.length > limit ? s.slice(0, limit) + '…' : s;
}

// bug.score 의미 — "변경 위험도(change risk)" = 기능적 영향도 × 수정 난이도.
// LLM이 점수를 일관되게 매기도록 create_bug/update_bug 설명에 주입.
const RISK_RUBRIC = [
  'score = change risk on a 0–8 scale (8 = riskiest). It blends functional impact with fix difficulty (a harder fix is likelier to break things, so it ranks higher within a tier).',
  '0: no risk — idea / memo.',
  '1: no risk — copy / wording edit.',
  '2: no functional error, but may change usability.',
  '3: minor functional issue possible — simple fix. 4: minor — complex fix.',
  '5: significant functional issue possible — simple fix. 6: significant — complex fix.',
  '7: critical functional issue possible — simple fix. 8: critical — complex fix.',
  'Defaults to 4. Urgency is intentionally NOT part of this score.',
].join(' ');

// structure 노드(trunk/limb/twig) 중 자손에 leaf/vein이 없으면 dormant.
// 식물 비유의 "잎 없는 가지" — LLM이 거기에 leaf 채울지 다른 가지 만들지 판단하는 신호.
function computeDormantSet(nodes) {
  const children = new Map();
  for (const n of nodes) {
    if (!n.parent) continue;
    if (!children.has(n.parent)) children.set(n.parent, []);
    children.get(n.parent).push(n);
  }
  const dormant = new Set();
  for (const n of nodes) {
    if (n.role !== 'structure') continue;
    const stack = [...(children.get(n.id) || [])];
    let hasLeafOrVein = false;
    while (stack.length) {
      const c = stack.pop();
      if (c.role === 'object' || c.role === 'action') { hasLeafOrVein = true; break; }
      const cc = children.get(c.id);
      if (cc) stack.push(...cc);
    }
    if (!hasLeafOrVein) dormant.add(n.id);
  }
  return dormant;
}

// 버그 status 필터. 기본(active)은 open/in_progress만 — 해결된(resolved/closed) 침식은
// 트리에서 노이즈. 'all'이면 전부, 특정 status면 그것만.
function filterBugsByStatus(bugs, bugStatus) {
  if (!Array.isArray(bugs) || bugStatus === 'all') return bugs;
  if (bugStatus && bugStatus !== 'active') return bugs.filter((b) => b.status === bugStatus);
  return bugs.filter((b) => b.status !== 'resolved' && b.status !== 'closed');
}

// project.metadata에서 UI 전용 무거운 키(아이콘 base64 등)를 제거 — LLM 컨텍스트엔 무의미.
function stripProjectMeta(project) {
  if (!project || !project.metadata || typeof project.metadata !== 'object') return project;
  const { icon, ...rest } = project.metadata;
  if (icon === undefined) return project;
  return { ...project, metadata: rest };
}

// description은 가변 길이라 응답에서 가장 무거운 필드. descMode로 노출량 제어:
//   'none'    → 아예 제외(가장 가벼운 골격 읽기)
//   'excerpt' → 200자 발췌(기본)
//   'full'    → 원문 그대로(특정 limb를 파고들 때)
function pickDesc(s, descMode) {
  if (descMode === 'none') return undefined;
  if (descMode === 'full') return s || undefined;
  return truncate(s);
}

// graph 응답을 summary 모드로 압축. nodes만 큰 폭으로 줄이고 edges/apis/seasons는 거의 그대로.
// soft-deleted 노드는 제외(www 시간 슬라이더 전용 — MCP엔 불필요).
function compressGraph(graph, { descMode = 'excerpt' } = {}) {
  const allNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodes = allNodes.filter((n) => !n.removedAt);
  const dormant = computeDormantSet(nodes);
  const childCount = new Map();
  for (const n of nodes) {
    if (n.parent != null) childCount.set(n.parent, (childCount.get(n.parent) || 0) + 1);
  }
  const compressedNodes = nodes.map((n) => {
    const out = {
      id: n.id,
      label: n.label,
      type: n.type,
      parent: n.parent ?? null,
    };
    if (n.season) out.season = n.season;
    const desc = pickDesc(n.description, descMode);
    if (desc) out.description = desc;
    if (n.metadata?.implements) out.implements = n.metadata.implements;
    if (n.metadata?.placeholder) out.placeholder = true;
    if (n.metadata?.plan) out.plan = true;  // 사람이 그린 브리프(미확정) — umtri://rules/plan
    if (dormant.has(n.id)) out.dormant = true;
    const cc = childCount.get(n.id);
    if (cc) out.childCount = cc;
    return out;
  });
  const compressedBugs = Array.isArray(graph.bugs) ? graph.bugs.map((b) => {
    const out = { ...b };
    const d = pickDesc(b.description, descMode);
    if (d === undefined) delete out.description; else out.description = d;
    return out;
  }) : graph.bugs;
  const iaHints = computeIaHints(nodes, { edges: graph.edges, apis: graph.apis });
  const shape = computeShape(nodes, childCount);
  return {
    ...graph,
    project: stripProjectMeta(graph.project),
    shape,
    nodes: compressedNodes,
    bugs: compressedBugs,
    ...(iaHints.length > 0 ? { iaHints } : {}),
  };
}

// list_projects summary — 슬라이드 식별·탐색에 필요한 핵심만. icon base64(metadata)·
// preNotes·seedMeta·typeCounts 등 무거운 필드는 생략. description은 descMode로 제어.
function compressProjects(projects, { descMode = 'excerpt' } = {}) {
  if (!Array.isArray(projects)) return projects;
  return projects.map((p) => {
    const out = {
      slug: p.slug,
      name: p.name,
      isActive: p.isActive,
      transplanting: p.transplanting,
      nodeCount: p.nodeCount,
      openBugs: p.openBugs,
      seasonCount: p.seasonCount,
    };
    if (p.nowSeasonLabel) out.nowSeasonLabel = p.nowSeasonLabel;
    if (p.latestActivityAt) out.latestActivityAt = p.latestActivityAt;
    const d = pickDesc(p.description, descMode);
    if (d) out.description = d;
    return out;
  });
}

// list_bugs summary — 스캔에 필요한 핵심만. metadata 생략, description은 descMode로 제어.
function compressBugs(bugs, { descMode = 'excerpt' } = {}) {
  if (!Array.isArray(bugs)) return bugs;
  return bugs.map((b) => {
    const out = {
      id: b.id,
      seq: b.seq,   // 사람이 부르는 번호(#14) — get_bug이 이 값으로도 찾는다
      target: b.target,
      title: b.title,
      score: b.score,
      status: b.status,
    };
    if (b.impactCount != null) out.impactCount = b.impactCount;
    if (b.createdAt) out.createdAt = b.createdAt;
    if (b.resolvedAt) out.resolvedAt = b.resolvedAt;
    const d = pickDesc(b.description, descMode);
    if (d) out.description = d;
    // solution도 가변 길이라 description과 같은 descMode 규칙을 태운다.
    const sol = pickDesc(b.solution, descMode);
    if (sol) out.solution = sol;
    return out;
  });
}

// list_seasons summary — 이미 가벼움(id/label/state/날짜). UI 전용 metadata만 떨궈냄.
function compressSeasons(seasons) {
  if (!Array.isArray(seasons)) return seasons;
  return seasons.map(({ metadata, ...rest }) => rest);
}

// IA 형상 진단 힌트 — get_graph 호출자가 트리를 더 잘 그리도록 자동 첨부.
// (1) missing-implements: leaf/vein 중 metadata.implements 없는 비율이 높을 때
// (2) sibling-cluster: 과밀한 limb/twig(잎 ≥4) 아래 접두어를 ≥3개 공유하는 잎 (twig 후보)
//     — create_node의 parallel-leaves-need-twig와 임계값·정밀도 동일. "leaf 많음"만으론 발사 안 함
//     (평평하지만 그룹 근거 없는 묶음은 정상). 구버전 junk-drawer-limb(무조건 ≥4)는 오발 잦아 제거.
export function computeIaHints(nodes, { edges = [], apis = [] } = {}) {
  const hints = [];
  const children = new Map();
  for (const n of nodes) {
    if (!n.parent) continue;
    if (!children.has(n.parent)) children.set(n.parent, []);
    children.get(n.parent).push(n);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // (1) missing-implements (집계 통계로 1번만)
  const leafVein = nodes.filter((n) => (n.type === 'leaf' || n.type === 'vein') && !n.metadata?.placeholder);
  const missing = leafVein.filter((n) => !n.metadata?.implements);
  if (leafVein.length > 0 && missing.length / leafVein.length > 0.3) {
    hints.push({
      rule: 'missing-implements-coverage',
      total: leafVein.length,
      missingCount: missing.length,
      sampleIds: missing.slice(0, 8).map((n) => n.id),
      suggestion: 'Most leaf/vein nodes lack metadata.implements. Backfill source paths so the graph can answer "where does this live?".',
    });
  }

  // (1b) isolated-leaf-vein — edge/api가 하나도 닿지 않는 leaf/vein의 비율이 높을 때.
  // 연결 없는 그래프는 영향 추적(get_impact)이 불가하다 → 의존/호출을 기록하거나 standalone임을
  // 확인하도록 유도. 임계 50%(missing-implements보다 느슨 — 연결은 모든 노드에 있을 필요는 없음).
  const connectedIds = new Set();
  for (const e of edges) { connectedIds.add(e.source); connectedIds.add(e.target); }
  for (const a of apis) { connectedIds.add(a.start); connectedIds.add(a.end); }
  const isolated = leafVein.filter((n) => !connectedIds.has(n.id));
  if (leafVein.length >= 4 && isolated.length / leafVein.length > 0.5) {
    hints.push({
      rule: 'isolated-leaf-vein',
      total: leafVein.length,
      isolatedCount: isolated.length,
      sampleIds: isolated.slice(0, 8).map((n) => n.id),
      suggestion: 'Over half of leaf/vein nodes have no edge or api touching them, so impact/blast-radius tracing (get_impact) can\'t cross to them. Record real dependencies (create_edge) and calls (create_api), or confirm the node is genuinely standalone.',
    });
  }

  // (2) sibling-cluster — 과밀한(잎 ≥4) limb/twig 아래에서, 같은 접두어를 ≥3개 공유하는 잎.
  // 한글 도메인 라벨은 자연히 접두어를 공유하므로(예: "예약 생성/취소") 느슨한 기준은 오탐·과도한
  // twig화(over-nesting)를 유발 → junk-drawer 수준으로 과밀할 때만, 묶을 만큼(≥3) 모일 때만 제안.
  for (const [parentId, kids] of children) {
    const parent = byId.get(parentId);
    if (!parent || (parent.type !== 'limb' && parent.type !== 'twig')) continue; // trunk 자식(limb)은 twig로 못 묶음
    const leafKids = kids.filter((k) => k.type === 'leaf');
    if (leafKids.length < 4) continue;
    const groups = new Map(); // prefix → labels[]
    for (const k of leafKids) {
      const lbl = (k.label || '').trim();
      const first = lbl.split(/[\s\-_/]+/)[0];
      if (!first || first.length < 2) continue;
      if (!groups.has(first)) groups.set(first, []);
      groups.get(first).push(lbl);
    }
    for (const [prefix, labels] of groups) {
      if (labels.length < 3) continue;
      hints.push({
        rule: 'sibling-cluster',
        parentId,
        parentLabel: parent.label,
        sharedPrefix: prefix,
        labels,
        suggestion: `${labels.length} leaves under an already-crowded "${parent.label}" share prefix "${prefix}". A twig "${prefix} …" would group them. (Don't over-nest sparse parents — sharing a prefix is fine when there are only a few.)`,
      });
    }
  }

  return hints;
}

// 트리 형상 진단 — 호출자가 "깊나/넓나/균형 잡혔나"를 재구성 없이 즉시 알도록 응답에 동봉.
function computeShape(nodes, childCount) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthOf = (n) => {
    let d = 0; let p = n.parent; const seen = new Set();
    while (p != null && byId.has(p) && !seen.has(p)) { seen.add(p); d += 1; p = byId.get(p).parent; }
    return d;
  };
  const byLevel = {};
  let maxDepth = 0;
  for (const n of nodes) {
    const d = depthOf(n);
    byLevel[d] = (byLevel[d] || 0) + 1;
    if (d > maxDepth) maxDepth = d;
  }
  const wideBranches = [...childCount.entries()]
    .filter(([, c]) => c >= 6)
    .map(([id, c]) => ({ id, label: byId.get(id)?.label, type: byId.get(id)?.type, childCount: c }))
    .sort((a, b) => b.childCount - a.childCount)
    .slice(0, 8);
  return {
    nodes: nodes.length,
    maxDepth,
    byLevel,
    ...(wideBranches.length ? { wideBranches } : {}),
  };
}

export function registerTools(server, { api }) {
  server.registerTool(
    'list_projects',
    {
      title: 'List grounds (projects)',
      description: 'Returns all grounds the authenticated user can access, with latest activity timestamp. Use this first to discover slugs for other tools. By default returns a summary view — each ground carries slug, name, isActive, transplanting, nodeCount, openBugs, seasonCount, nowSeasonLabel, latestActivityAt, plus a 200-char description excerpt. Pass view="full" for all fields (preNotes, seedMeta, typeCounts, raw metadata, timestamps); the icon base64 in metadata is always stripped (UI-only).',
      inputSchema: z.object({
        view: z.enum(['summary', 'full']).optional().describe('summary (default) for a compact list; full for every field.'),
      }),
    },
    async ({ view }) => {
      try {
        const projects = await api.get('/api/projects');
        const out = view === 'full'
          ? (Array.isArray(projects) ? projects.map(stripProjectMeta) : projects)
          : compressProjects(projects);
        return jsonResult(out);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'get_graph',
    {
      title: 'Get the graph of a ground',
      description: 'Returns the tree(nodes), edges, apis, seasons, and bugs for one ground. The tree is the project\'s information-structure (IA) diagram — each node is a structural element (an object, or an action it performs), not a work-log entry. Node types follow the plant metaphor: trunk → limb → twig → leaf → vein. See resource umtri://rules/vocabulary. By default returns a summary view — nodes carry id/label/type/parent/season, plus a 200-char description excerpt, metadata.implements, placeholder/dormant flags (soft-deleted nodes are omitted). Pass view="full" only when you need timestamps, full descriptions, all metadata keys, or tags — that response is ~3× larger. For a large tree, read it in slices instead of all at once: rootId (+depth) for one trunk or limb; maxType for a layer (e.g. maxType="twig" = the skeleton without leaves/veins — a cheap overview); role for a cross-section; season for what was born in one season. Filters combine. Node ids come from the graph itself, so the standard drill-down is two calls: first get_graph with maxType="trunk" (or "limb") for a cheap skeleton, find the id you want, then call again with rootId set to it to get just that trunk/limb and its subtree. Control the heaviest field with descriptions: "none" drops descriptions for a pure structural overview, "excerpt" (default) gives a 200-char preview, "full" returns them verbatim when you drill into a limb. The summary response also carries shape (nodeCount, maxDepth, nodes-per-level, over-wide branches) so you can judge whether the tree is too deep or too wide without rebuilding it, a childCount on each branch node, and iaHints flagging structural smells. A bushy tree (mass at mid-levels) is healthy — don\'t over-nest sparse parents into twigs. Bugs default to active (open + in_progress) — pass bugStatus="all" to also see healed (resolved/closed) ones. Nodes may carry plan:true — these are the human\'s node-based brief (intent drawn as structure, not a prompt); read them as instructions and realize them (see umtri://rules/plan). When you slice (rootId/maxType/role/season), a connection with only ONE endpoint inside the slice is still returned, marked boundary:true, and its outside endpoint appears as a lightweight stub in externalNodes (id/label/type/role, external:true) — so cross-branch dependencies and calls never silently vanish from a slice. To follow one, call get_graph again with rootId set to that external id. The response also carries project.transplanting — when true the ground is still being transplanted (see umtri://rules/transplant): you may freely add/edit nodes in any season incl. past, and hard-delete import mistakes.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug (from list_projects).'),
        view: z.enum(['summary', 'full']).optional().describe('summary (default) for compact nodes; full for raw shape with all fields.'),
        rootId: z.string().optional().describe('Scope to this node and its descendants — read one trunk or limb at a time. Get the id from a prior get_graph (e.g. maxType="trunk" for a cheap skeleton). Bugs are scoped to the subtree; edges/apis that cross the subtree boundary are still returned (boundary:true) with their outside endpoint in externalNodes.'),
        depth: z.number().int().min(0).optional().describe('With rootId: how many levels below the root to include (0 = just the root, 1 = root + direct children). Omit for the whole subtree.'),
        maxType: z.enum(['trunk', 'limb', 'twig', 'leaf', 'vein']).optional().describe('Layer ceiling — return only nodes at this level or higher (trunk is highest). maxType="twig" yields the structural skeleton without leaves/veins. Great for a cheap overview before drilling in with rootId.'),
        role: z.enum(['structure', 'object', 'action']).optional().describe('Cross-section by role (structure=trunk/limb/twig, object=leaf, action=vein). Parents may fall outside the result.'),
        season: z.string().optional().describe('Born-in delta — return only nodes that first appeared in this season (season id from list_seasons): what grew that season.'),
        descriptions: z.enum(['none', 'excerpt', 'full']).optional().describe('How much of each node/bug description to include in summary view: none (drop them — lightest structural read), excerpt (200-char preview, default), or full (verbatim). Ignored when view="full" (always verbatim).'),
        bugStatus: z.enum(['active', 'all', 'open', 'in_progress', 'resolved', 'closed']).optional().describe('Which bugs to include. Default "active" = open + in_progress only (resolved/closed are healed erosion — noise on the tree). "all" for every bug, or a specific status. Use list_bugs for richer bug queries.'),
      }),
    },
    async ({ slug, view, rootId, depth, maxType, role, season, descriptions, bugStatus }) => {
      try {
        const qs = [];
        if (rootId) qs.push(`root=${encodeURIComponent(rootId)}`);
        if (depth != null) qs.push(`depth=${encodeURIComponent(depth)}`);
        if (maxType) qs.push(`maxType=${encodeURIComponent(maxType)}`);
        if (role) qs.push(`role=${encodeURIComponent(role)}`);
        if (season) qs.push(`season=${encodeURIComponent(season)}`);
        qs.push('bugImpact=true'); // 임베디드 버그에 impactCount(blast radius 크기) 자동 첨부
        const q = qs.length ? `?${qs.join('&')}` : '';
        const graph = await api.get(`/api/projects/${encodeURIComponent(slug)}/graph${q}`);
        graph.bugs = filterBugsByStatus(graph.bugs, bugStatus || 'active');
        // 아이콘 base64는 UI 전용 — view와 무관하게 제거. full도 stripProjectMeta 적용.
        const out = view === 'full'
          ? { ...graph, project: stripProjectMeta(graph.project) }
          : compressGraph(graph, { descMode: descriptions || 'excerpt' });
        return jsonResult(out);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'get_impact',
    {
      title: 'Trace the blast radius of a node or bug',
      description: [
        'Walks the connection graph (edges + apis) from a start node — or a bug\'s target — to find which other nodes a problem would reach. This is the tool for "if this breaks / I change this, what else do I need to check?" and for QA scoping.',
        'Impact does NOT always flow with the arrow. direction="affected" (default) answers "if the start breaks, who is hurt?" and follows: dependency edges backward (target→source), data_flow edges forward (source→target), apis backward (callee→caller). direction="dependsOn" is the reverse ("what does the start rely on?"). direction="both" unions them. See umtri://rules/system-structure (How problems propagate).',
        'Provide exactly one start: node (a node id) or bug (a bug id — starts from its target node, or both endpoints if the bug is on an api; ground-level bugs are rejected). Traversal is over CURRENT (live) structure only.',
        'Returns reached[] (each with hops distance, the node `from` which it was reached, and the connection `via` it came through — so you can reconstruct the chain), bugs[] (active bugs sitting on any reached node/api, worst score first), and coverage. IMPORTANT: the result is a list of nodes to CHECK, not a proven failure set — it is only as complete as the connections recorded. coverage.startsWithoutConnections flags when the start has no connections at all: an empty result then means "nothing recorded," not "nothing affected" — record edges/apis first.',
      ].join(' '),
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        node: z.string().optional().describe('Start node id. Provide this OR bug.'),
        bug: z.string().optional().describe('Start from this bug\'s target. Provide this OR node.'),
        direction: z.enum(['affected', 'dependsOn', 'both']).optional().describe('affected (default): what breaks if the start breaks. dependsOn: what the start relies on. both: union.'),
        maxDepth: z.number().int().min(0).optional().describe('Max hops to traverse. Omit for unbounded.'),
      }),
    },
    async ({ slug, node, bug, direction, maxDepth }) => {
      try {
        const qs = [];
        if (node) qs.push(`node=${encodeURIComponent(node)}`);
        if (bug) qs.push(`bug=${encodeURIComponent(bug)}`);
        if (direction) qs.push(`direction=${encodeURIComponent(direction)}`);
        if (maxDepth != null) qs.push(`maxDepth=${encodeURIComponent(maxDepth)}`);
        const q = qs.length ? `?${qs.join('&')}` : '';
        const out = await api.get(`/api/projects/${encodeURIComponent(slug)}/impact${q}`);
        return jsonResult(out);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'list_bugs',
    {
      title: 'List bugs of a ground',
      description: 'Returns bugs (issues eroding the ground). Optional status filter. Each bug has a score (0–8 change-risk; 8 = riskiest). Targets: a node, an api, or the ground itself. By default returns a summary view — each bug carries id, target, title, score, status, createdAt/resolvedAt, plus a 200-char description excerpt. Each node/api bug also carries impactCount — how many other nodes its target reaches by blast radius (affected direction), so you can spot wide-blast bugs at a glance; call get_impact on that bug for the full reached list. Pass view="full" for full descriptions and metadata.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional()
          .describe('Filter by status. Omit to return all.'),
        view: z.enum(['summary', 'full']).optional().describe('summary (default) for a compact list; full for verbatim descriptions + metadata.'),
      }),
    },
    async ({ slug, status, view }) => {
      try {
        const qs = ['impact=true']; // 각 버그에 impactCount(blast radius 크기) 자동 첨부
        if (status) qs.push(`status=${encodeURIComponent(status)}`);
        const bugs = await api.get(`/api/projects/${encodeURIComponent(slug)}/bugs?${qs.join('&')}`);
        return jsonResult(view === 'full' ? bugs : compressBugs(bugs));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'get_bug',
    {
      title: 'Get one bug of a ground',
      description: 'Returns a single bug by reference. `ref` accepts either the human-facing number shown in the UI (seq — "14" or #14) or the internal id (bug-<uuid>). Use this when a human names a bug by its number; use list_bugs to scan. The response carries the full description and metadata, plus impact — the blast radius reached from the bug\'s target (reachedCount, the reached nodes with hop distance, and other active bugs sitting in that radius). Numbers are per-ground and never reused, so a deleted bug leaves a gap rather than shifting the others. Returns an error if no bug matches.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        ref: z.union([z.string().min(1), z.number().int().positive()])
          .describe('Bug number (seq, e.g. 14) or internal id (bug-<uuid>).'),
      }),
    },
    async ({ slug, ref }) => {
      try {
        const bug = await api.get(
          `/api/projects/${encodeURIComponent(slug)}/bugs/${encodeURIComponent(String(ref))}?impact=true`,
        );
        return jsonResult(bug);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'list_seasons',
    {
      title: 'List seasons of a ground',
      description: 'Returns the seasons (time epochs) of a ground in chronological order. Seasons are created only by humans — do not attempt to create them via this MCP. See umtri://rules/seasons-human-only. By default returns a summary view (id, label, state, startedAt, grownAt). Pass view="full" to also include metadata.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        view: z.enum(['summary', 'full']).optional().describe('summary (default) drops UI-only metadata; full includes it.'),
      }),
    },
    async ({ slug, view }) => {
      try {
        const seasons = await api.get(`/api/projects/${encodeURIComponent(slug)}/seasons`);
        return jsonResult(view === 'full' ? seasons : compressSeasons(seasons));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'list_events',
    {
      title: 'List change history of a ground',
      description: 'Returns the append-only change history (most recent first) of a ground: node/edge/api/bug create, update (with a field-level diff {from,to}), delete, and plan_commit. Each event carries the actor ("user:<id>" for humans, "token:<id>" for agents/automation), a summary label, and for updates a diff. Use it to answer "what changed, when, and by whom" — e.g. a bug\'s status transitions or a node\'s edits over time. Filter with entityType/entityId to get a single entity\'s timeline. Note: git commits recorded via record_commit live in a node\'s metadata.commits, not here.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        limit: z.number().int().positive().max(200).optional().describe('Max events to return (default 50, cap 200).'),
        before: z.string().optional().describe('ISO timestamp — return events strictly older than this (keyset pagination).'),
        entityType: z.enum(['node', 'edge', 'api', 'bug']).optional().describe('Filter to one entity type.'),
        entityId: z.string().optional().describe('Filter to one entity\'s timeline (usually paired with entityType).'),
      }),
    },
    async ({ slug, limit, before, entityType, entityId }) => {
      try {
        const qs = [];
        if (limit) qs.push(`limit=${limit}`);
        if (before) qs.push(`before=${encodeURIComponent(before)}`);
        if (entityType) qs.push(`entityType=${encodeURIComponent(entityType)}`);
        if (entityId) qs.push(`entityId=${encodeURIComponent(entityId)}`);
        const path = `/api/projects/${encodeURIComponent(slug)}/events${qs.length ? `?${qs.join('&')}` : ''}`;
        return jsonResult(await api.get(path));
      } catch (e) { return errorResult(e); }
    },
  );

  // ─── write tools ───
  // Requires a token with scope='write'. Read-scope tokens get a clear 403 message.

  server.registerTool(
    'create_bug',
    {
      title: 'Report a bug on a ground',
      description: [
        'Creates a new bug (issue eroding the target).',
        'target.kind = "node" or "api" requires target.id of an existing node/api in the ground.',
        'target.kind = "ground" attaches the bug to the project itself (no id).',
        RISK_RUBRIC,
        'status defaults to "open".',
        'solution is the fix: at report time it is the plan ("this is probably how we fix it"), and by the time the bug is resolved it should describe what was actually applied. Same field — overwrite it as understanding changes; project_events keeps the diff. Leave it empty rather than guessing.',
        'For a node/api bug, the response auto-attaches impact (the affected blast radius from the target): reachedCount, the reached nodes with hop distance and the connection each was reached through, other active bugs sitting in that radius, and a coverage note. Use it to scope what else to check/QA. If the target has no recorded connections the radius is empty — that means nothing is recorded, not that nothing is affected (record edges/apis).',
        'Requires a write-scope token. See umtri://rules/vocabulary for bug semantics.',
      ].join(' '),
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        title: z.string().min(1).max(200).describe('Short summary of the bug. Required.'),
        target: z.object({
          kind: z.enum(['node', 'api', 'ground']).describe('Where the bug attaches.'),
          id: z.string().optional().describe('Required when kind is "node" or "api".'),
        }).describe('Bug target. Use {kind:"ground"} when the bug is about the project as a whole.'),
        description: z.string().optional().describe('Longer details on what is wrong (markdown allowed).'),
        solution: z.string().optional().describe('How to fix it. At report time this is the plan/idea; update it to what was actually applied when you resolve. Markdown allowed. Omit if you do not know yet.'),
        score: z.number().int().min(0).max(8).optional().describe('Change risk 0–8 (8 = riskiest: critical impact × complex fix). Defaults to 4. See tool description for the rubric.'),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional()
          .describe('Defaults to "open".'),
      }),
    },
    async ({ slug, title, target, description, solution, score, status }) => {
      try {
        const body = { title, target };
        if (description !== undefined) body.description = description;
        if (solution !== undefined) body.solution = solution;
        if (score !== undefined) body.score = score;
        if (status !== undefined) body.status = status;
        const created = await api.post(`/api/projects/${encodeURIComponent(slug)}/bugs`, body);
        // 영향권 자동 첨부 — 이 버그가 어디까지 번지는지(affected). ground 대상은 출발 노드가 없어 생략.
        // 영향권 조회가 실패해도 버그 생성 자체는 성공으로 반환한다(부가 정보이므로).
        if (target?.kind !== 'ground' && created?.id) {
          try {
            const imp = await api.get(`/api/projects/${encodeURIComponent(slug)}/impact?bug=${encodeURIComponent(created.id)}&direction=affected`);
            created.impact = {
              reachedCount: imp.reachedCount,
              reached: imp.reached,
              bugs: imp.bugs,
              coverage: imp.coverage,
            };
          } catch { /* 영향권 부가 정보 실패는 무시 */ }
        }
        return jsonResult(created);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create a new ground (project)',
      description: 'Creates a new ground. Slug must match /^[a-z0-9][a-z0-9-]{0,49}$/ and be unique. The authenticated user owns it. Requires a write-scope token.',
      inputSchema: z.object({
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/).describe('URL slug. Lowercase letters, digits, hyphens; 1–50 chars.'),
        name: z.string().min(1).max(200).describe('Display name.'),
        description: z.string().optional(),
        visibility: z.enum(['private', 'unlisted', 'public']).optional().describe('Defaults to private.'),
      }),
    },
    async ({ slug, name, description, visibility }) => {
      try {
        const body = { slug, name };
        if (description !== undefined) body.description = description;
        if (visibility !== undefined) body.visibility = visibility;
        return jsonResult(await api.post('/api/projects', body));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'create_node',
    {
      title: 'Create a node in a ground',
      description: [
        'Creates a node. Follows the plant vocabulary protocol — see umtri://rules/vocabulary.',
        'type ∈ trunk · limb · twig · leaf · vein. Role is derived (structure / object / action).',
        'Build leaf-first: when adding a leaf/vein, create only the missing trunk/limb/twig ancestors on its path, then the leaf — do NOT pre-build every trunk, then every limb, then leaves (see Build order in umtri://rules/vocabulary).',
        'Aim for a faithful, COMPLETE map of the project, not a summary: every meaningful module/screen/endpoint/table/integration should become a node (grouped at the information-unit grain, not one-per-file). A real project yields many leaves — under-capturing to a few nodes is the more common mistake. See Completeness in umtri://rules/system-structure.',
        'parent ∈ existing node id; omit to create a root-level node.',
        'season ∈ existing season id; omit to use the active "now" season. Past seasons are normally rejected, but allowed while the ground is transplanting (project.transplanting=true) — nodes added then are auto-stamped metadata.transplanted=true for audit. See umtri://rules/transplant.',
        'The tool validates against protocol policies. Hierarchy violations are rejected. Soft issues (reserved-domain labels, leaf↔vein heuristic, trunk naming) come back as warnings in the response — reconsider before continuing if warnings appear.',
        'After creating a leaf/vein, consider its connections: if it calls/feeds another node add an api (create_api), if it depends on/is built on another add an edge (create_edge). The response carries a connectionCheck reminder. See umtri://rules/system-structure (Connections).',
        'Creating seasons via MCP is forbidden — see umtri://rules/seasons-human-only.',
        'When realizing a human-drawn plan brief, any detail nodes you add should carry metadata.plan=true and the realized node needs metadata.implements — see umtri://rules/plan.',
      ].join(' '),
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        type: z.string().min(1).describe('Node type. Use trunk/limb/twig/leaf/vein per the metaphor.'),
        label: z.string().min(1).max(200).describe('Node label, visible in the tree.'),
        parent: z.string().optional().describe('Parent node id. Omit for root-level (a new trunk).'),
        season: z.string().optional().describe('Season id. Omit to use the active "now" season.'),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.any()).optional().describe('Free-form metadata. For `leaf` and `vein`, set `metadata.implements` to an array of file paths (or `path#identifier` for multi-export files) — this is how the graph maps concept → code and is expected on essentially every leaf/vein. Use `metadata.placeholder=true` for intentionally-empty structure.'),
        sproutedAt: z.string().datetime({ offset: true }).optional().describe('Effective creation time (ISO 8601 with offset, e.g. "2024-03-15T09:00:00Z"). Omit to use the current moment. Use only when back-filling history of a project that existed before Umtri — e.g. importing past commits or migrating a tree. The visualization timeline (sibling order, season visibility, events) follows this value.'),
      }),
    },
    async ({ slug, type, label, parent, season, description, tags, metadata, sproutedAt }) => {
      try {
        let parentType = null;
        let siblingLeafLabels;
        if (parent) {
          const graph = await api.get(`/api/projects/${encodeURIComponent(slug)}/graph`);
          const parentNode = (graph.nodes || []).find(n => n.id === parent);
          if (!parentNode) throw new Error(`Parent node "${parent}" not found in ground "${slug}".`);
          parentType = parentNode.type;
          siblingLeafLabels = (graph.nodes || [])
            .filter(n => n.parent === parent && n.type === 'leaf')
            .map(n => n.label);
        }

        const { ok, rejectReason, warnings } = validateNode({
          type, label, parentType, description, metadata, siblingLeafLabels,
        });
        if (!ok) throw new Error(`Rejected by protocol: ${rejectReason}`);

        const body = { type, label };
        if (parent !== undefined) body.parent = parent;
        if (season !== undefined) body.season = season;
        if (description !== undefined) body.description = description;
        if (tags !== undefined) body.tags = tags;
        if (metadata !== undefined) body.metadata = metadata;
        if (sproutedAt !== undefined) body.sproutedAt = sproutedAt;

        const created = await api.post(`/api/projects/${encodeURIComponent(slug)}/nodes`, body);
        const out = warnings.length ? { ...created, warnings } : { ...created };
        // 연결 고민 넛지 — leaf/vein은 보통 다른 노드를 호출/의존하므로 매번 확인 유도.
        if (type === 'leaf' || type === 'vein') {
          out.connectionCheck = 'Does this node call/feed another (→ create_api) or depend on another (→ create_edge)? Add the connection now if so; skip if genuinely standalone. See umtri://rules/system-structure (Connections).';
        }
        return jsonResult(out);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'update_node',
    {
      title: 'Update a node',
      description: 'Partial update of a node. Patchable fields: label, type, parent, season, description, tags, metadata, sproutedAt. Type change reclassifies role; parent change recomputes the ltree path automatically. On a grown (past-season) node, only the tree\'s shape and timeline are locked — parent, season, type and sproutedAt are rejected. Content fields (label, description, metadata, tags) stay editable, so you can keep metadata.implements current when code moves without reopening transplanting. Moving any node into a `past` season is rejected. Both restrictions lift while the ground is transplanting (project.transplanting=true), so historical structure can be reconstructed (see umtri://rules/transplant). Same protocol validation as create_node — reject on hierarchy violations, warn on soft issues.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        id: z.string().min(1).describe('Node id.'),
        patch: z.object({
          label: z.string().min(1).max(200).optional(),
          type: z.string().min(1).optional(),
          parent: z.string().nullable().optional().describe('New parent id, or null to detach to root.'),
          season: z.string().nullable().optional().describe('New season id, or null to detach from any season. Past seasons are rejected.'),
          description: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
          metadata: z.record(z.any()).optional(),
          sproutedAt: z.string().datetime({ offset: true }).nullable().optional().describe('Effective creation time (ISO 8601 with offset). Set to null to clear and fall back to the system timestamp. Use only for back-filling historical projects.'),
        }).describe('Only the fields you want to change.'),
      }),
    },
    async ({ slug, id, patch }) => {
      try {
        let warnings = [];

        const patchResult = validateUpdate({ patch });
        warnings = warnings.concat(patchResult.warnings);

        if (patch.type !== undefined || patch.parent !== undefined || patch.label !== undefined) {
          const graph = await api.get(`/api/projects/${encodeURIComponent(slug)}/graph`);
          const current = (graph.nodes || []).find(n => n.id === id);
          if (!current) throw new Error(`Node "${id}" not found in ground "${slug}".`);

          const newType = patch.type ?? current.type;
          const newLabel = patch.label ?? current.label;
          const newParentId = patch.parent !== undefined ? patch.parent : current.parent;
          const newDescription = patch.description !== undefined ? patch.description : current.description;
          const newMetadata = patch.metadata !== undefined ? patch.metadata : current.metadata;
          const parentType = newParentId
            ? (graph.nodes || []).find(n => n.id === newParentId)?.type ?? null
            : null;

          const result = validateNode({
            type: newType,
            label: newLabel,
            parentType,
            description: newDescription,
            metadata: newMetadata,
            phase: 'update',
          });
          if (!result.ok) throw new Error(`Rejected by protocol: ${result.rejectReason}`);
          warnings = warnings.concat(result.warnings);
        }

        const updated = await api.put(`/api/projects/${encodeURIComponent(slug)}/nodes/${encodeURIComponent(id)}`, patch);
        return jsonResult(warnings.length ? { ...updated, warnings } : updated);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'delete_node',
    {
      title: 'Soft-delete a node',
      description: 'Sets removed_at on the node. By policy this tool rejects deletion if the node has any active descendant — delete children explicitly first to avoid accidental cascades. (The underlying REST API would cascade; the MCP layer guards against silent loss.) EXCEPTION — while the ground is transplanting (project.transplanting=true), the active-descendant guard is lifted (subtree cascade allowed) and you may pass hard=true to permanently remove import mistakes, including grown (past-season) nodes. Once the human roots the ground, normal guards return.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        id: z.string().min(1).describe('Node id.'),
        hard: z.boolean().optional().describe('Permanently delete (incl. descendants via FK cascade) instead of soft-delete. Only honored while the ground is transplanting; irreversible — use for import cleanup.'),
      }),
    },
    async ({ slug, id, hard }) => {
      try {
        const graph = await api.get(`/api/projects/${encodeURIComponent(slug)}/graph`);
        const target = (graph.nodes || []).find(n => n.id === id);
        if (!target) throw new Error(`Node "${id}" not found in ground "${slug}".`);

        const transplanting = graph.project?.transplanting === true;

        // 옮겨심는 중이면 cascade 허용(가드 해제). 평상시엔 활성 자손 있으면 거부.
        if (!transplanting) {
          const children = (graph.nodes || []).filter(n => n.parent === id && !n.removedAt);
          if (children.length > 0) {
            const list = children.slice(0, 5).map(c => `${c.id}("${c.label}")`).join(', ');
            const more = children.length > 5 ? ` (+${children.length - 5} more)` : '';
            throw new Error(`Node has ${children.length} active child node(s). Delete them first. Children: ${list}${more}`);
          }
        }

        const useHard = hard === true && transplanting;
        const path = `/api/projects/${encodeURIComponent(slug)}/nodes/${encodeURIComponent(id)}${useHard ? '?hard=true' : ''}`;
        const res = await api.delete(path);
        return jsonResult(res);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'reopen_transplant',
    {
      title: 'Re-open transplant on a ground',
      description: 'Re-opens the transplant window on a rooted ground (sets project.transplanting=true), relaxing guards so historical/structural reconstruction can resume: add/edit nodes in any season incl. past, and hard-delete mistakes. CRITICAL: only call this when the user has EXPLICITLY asked to switch the ground into transplanting (e.g. "put this ground back in transplant", "옮겨심기로 바꿔줘"). Never decide to re-open transplant on your own judgment — it removes safety guardrails. Rooting it back (settling) is human-only via the UI. See umtri://rules/transplant.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
      }),
    },
    async ({ slug }) => {
      try {
        const res = await api.post(`/api/projects/${encodeURIComponent(slug)}/root`, { rooted: false });
        return jsonResult(res);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'commit_plan',
    {
      title: 'Commit a realized plan node',
      description: 'Promotes a plan node (metadata.plan=true) to the real tree by clearing the plan flag. VERIFICATION GATE: the node must already carry metadata.implements (the source path(s) you wrote) — without it the commit is rejected, because an uncommitted plan node with no implements is not considered realized. Call this only after you have actually written the code and recorded implements via update_node. See umtri://rules/plan.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        id: z.string().min(1).describe('Plan node id to commit.'),
      }),
    },
    async ({ slug, id }) => {
      try {
        const res = await api.post(`/api/projects/${encodeURIComponent(slug)}/nodes/${encodeURIComponent(id)}/commit`, {});
        return jsonResult(res);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'record_commit',
    {
      title: 'Record a git commit onto the nodes it touched',
      description: 'Configuration record (CI/CD). Given a commit SHA and the files it changed, finds nodes whose metadata.implements include any of those files and appends the commit (sha + timestamp + optional message) to their metadata.commits (deduped by sha). Returns the matched node ids. When one commit touches several nodes that are NOT yet connected, the response also carries coChangeCandidates[] ({a, aLabel, b, bLabel}) — nodes that change together are dependency candidates; review them and add a create_edge/create_api where a real relation exists (not auto-created; suppressed for large multi-node commits). Umtri does not run jobs or read git itself — a GitHub Action / CI step or an agent supplies the sha+files. See umtri://rules/plan.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        sha: z.string().min(1).describe('Commit SHA (short or full).'),
        files: z.array(z.string()).min(1).describe('Repo-relative paths changed by the commit, matched against nodes\' metadata.implements.'),
        message: z.string().optional().describe('Commit message (optional, stored with the record).'),
      }),
    },
    async ({ slug, sha, files, message }) => {
      try {
        const res = await api.post(`/api/projects/${encodeURIComponent(slug)}/record-commit`, { sha, files, message });
        return jsonResult(res);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'create_edge',
    {
      title: 'Create an edge between two nodes',
      description: 'Creates a directed edge (source → target) for a STRUCTURAL relation: type "dependency" (A is built on / needs B) or "data_flow" (data moves A → B outside a request). Use for module/library deps, a route depending on the data store, a job writing a table. For a runtime request/call/integration use create_api instead, not an edge. Reserve connections for relations a maintainer would trace — don\'t wire everything. type ∈ project.edge_types; same source and target is rejected. See umtri://rules/system-structure (Connections).',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        source: z.string().min(1).describe('Source node id.'),
        target: z.string().min(1).describe('Target node id.'),
        type: z.string().optional().describe('Edge type. Backend defaults if omitted.'),
        label: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    },
    async ({ slug, source, target, type, label, metadata }) => {
      try {
        const { ok, rejectReason } = validateEdge({ sourceId: source, targetId: target });
        if (!ok) throw new Error(`Rejected by protocol: ${rejectReason}`);

        const body = { source, target };
        if (type !== undefined) body.type = type;
        if (label !== undefined) body.label = label;
        if (metadata !== undefined) body.metadata = metadata;

        return jsonResult(await api.post(`/api/projects/${encodeURIComponent(slug)}/edges`, body));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'delete_edge',
    {
      title: 'Delete an edge',
      description: 'Removes an edge from the ground. Use to retire dependencies/flows that no longer reflect reality.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        id: z.string().min(1).describe('Edge id.'),
      }),
    },
    async ({ slug, id }) => {
      try {
        return jsonResult(await api.delete(`/api/projects/${encodeURIComponent(slug)}/edges/${encodeURIComponent(id)}`));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'create_api',
    {
      title: 'Create an API flow between two nodes',
      description: 'Records an API flow (start → end) for a RUNTIME request / call / data flow: a screen calling an endpoint, an endpoint hitting a table, an external integration (payment, SMS, webhook). Direction is caller → callee. APIs are first-class (apis table), not generic edges — for a build-time/structural reliance use create_edge (dependency) instead. Add the flows a maintainer would trace; don\'t wire everything. start/end must be existing node ids. See umtri://rules/system-structure (Connections).',
      inputSchema: z.object({
        slug: z.string().min(1).describe('Ground slug.'),
        start: z.string().min(1).describe('Source node id.'),
        end: z.string().min(1).describe('Target node id.'),
        label: z.string().optional(),
        description: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    },
    async ({ slug, start, end, label, description, metadata }) => {
      try {
        const { ok, rejectReason } = validateEdge({ sourceId: start, targetId: end });
        if (!ok) throw new Error(`Rejected by protocol: ${rejectReason}`);

        const body = { start, end };
        if (label !== undefined) body.label = label;
        if (description !== undefined) body.description = description;
        if (metadata !== undefined) body.metadata = metadata;

        return jsonResult(await api.post(`/api/projects/${encodeURIComponent(slug)}/apis`, body));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'update_api',
    {
      title: 'Update an API entry',
      description: 'Partial update of an API. Patchable fields: label, description, metadata, start, end.',
      inputSchema: z.object({
        slug: z.string().min(1),
        id: z.string().min(1).describe('API id.'),
        patch: z.object({
          label: z.string().optional(),
          description: z.string().nullable().optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          metadata: z.record(z.any()).optional(),
        }),
      }),
    },
    async ({ slug, id, patch }) => {
      try {
        if (patch.start && patch.end && patch.start === patch.end) {
          throw new Error('Rejected by protocol: API start and end cannot be the same node.');
        }
        return jsonResult(await api.patch(`/api/projects/${encodeURIComponent(slug)}/apis/${encodeURIComponent(id)}`, patch));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'delete_api',
    {
      title: 'Soft-delete an API entry',
      description: 'Sets removed_at on the API. History is preserved — the API can still be seen in past season views via the time slider.',
      inputSchema: z.object({
        slug: z.string().min(1),
        id: z.string().min(1),
      }),
    },
    async ({ slug, id }) => {
      try {
        return jsonResult(await api.delete(`/api/projects/${encodeURIComponent(slug)}/apis/${encodeURIComponent(id)}`));
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'update_bug',
    {
      title: 'Update a bug',
      description: [
        'Partial update of a bug. Most common use: status transition.',
        'Follow the lifecycle one step at a time: open (wild) → in_progress (chasing) → resolved (catched).',
        'Set status="in_progress" the moment you start the fix, not after it lands — it is the only marker that someone is already on this bug, so a parallel agent can see the work in flight instead of duplicating it. Then set "resolved" once it ships.',
        'Skipping straight from open to resolved returns a warning (not a rejection) — acceptable when the fix was genuinely instant.',
        'Other patchable fields: title, description, solution, score (0–8 change-risk), metadata.',
        'When resolving, rewrite solution to what you actually applied — at report time it held the plan, and leaving a stale plan there is worse than leaving it empty.',
        'To mark a bug as fixed, prefer status="resolved" over delete — that preserves the history of what eroded the tree.',
        'When resolving, you may record the shipped release in metadata.resolvedVersion (e.g. "v2.3.1"); metadata is replaced wholesale, so include existing keys you want to keep.',
      ].join(' '),
      inputSchema: z.object({
        slug: z.string().min(1),
        id: z.string().min(1).describe('Bug id.'),
        patch: z.object({
          status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
          score: z.number().int().min(0).max(8).optional().describe('Change risk 0–8 (8 = riskiest). See create_bug for the rubric.'),
          title: z.string().min(1).max(200).optional(),
          description: z.string().nullable().optional().describe('What is wrong.'),
          solution: z.string().nullable().optional().describe('How it is being / was fixed. Rewrite this to the actually-applied fix when you set status="resolved" — a stale plan left behind is worse than an empty field. null clears it.'),
          metadata: z.record(z.any()).optional(),
        }),
      }),
    },
    async ({ slug, id, patch }) => {
      try {
        // status를 바꿀 때만 현재 상태를 확인한다 — 라이프사이클 경고는 from을 알아야 낼 수 있다.
        // 조회 실패는 무시하고 진행한다: 경고는 부가 정보이고, 여기서 막으면 정작 갱신이 죽는다.
        let currentStatus = null;
        if (patch && 'status' in patch) {
          try {
            const cur = await api.get(`/api/projects/${encodeURIComponent(slug)}/bugs/${encodeURIComponent(id)}`);
            currentStatus = cur?.status ?? null;
          } catch { /* 상태 확인 실패 → 경고 없이 진행 */ }
        }
        const updated = await api.patch(`/api/projects/${encodeURIComponent(slug)}/bugs/${encodeURIComponent(id)}`, patch);
        const { warnings } = validateBugUpdate({ currentStatus, patch });
        return jsonResult(warnings.length ? { ...updated, warnings } : updated);
      } catch (e) { return errorResult(e); }
    },
  );

  server.registerTool(
    'delete_bug',
    {
      title: 'Delete a bug (hard delete)',
      description: 'Permanently removes a bug record. Bugs do not have history — once deleted, the record is gone. For "I resolved this", use update_bug with status="resolved" instead, so the tree remembers what was eroded.',
      inputSchema: z.object({
        slug: z.string().min(1),
        id: z.string().min(1),
      }),
    },
    async ({ slug, id }) => {
      try {
        return jsonResult(await api.delete(`/api/projects/${encodeURIComponent(slug)}/bugs/${encodeURIComponent(id)}`));
      } catch (e) { return errorResult(e); }
    },
  );
}
