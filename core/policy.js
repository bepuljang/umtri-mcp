// MCP write-tool policy checks.
// Source of truth for the rules described in resources/vocabulary.md.
// The schema does NOT enforce these — the tool layer does (reject for hard rules, warn for heuristics).

const STRUCTURE_TYPES = new Set(['trunk', 'limb', 'twig']);
const OBJECT_TYPE = 'leaf';
const ACTION_TYPE = 'vein';

// Reserved domain tokens — these are first-class citizens (apis/bugs/seasons/edges tables),
// not node labels.
const RESERVED_DOMAINS = ['api', 'bug', 'season', 'edge', 'endpoint',
                          '버그', '시즌', '엣지', '엔드포인트'];

// Verb endings (Korean) that suggest a label describes an *action*, not an object.
// Used in the leaf-vs-vein heuristic. Extended 2026-05-25 with Sino-Korean action stems
// observed in real AI-authored datasets (충전/차감/환불/연장/조회/만료/갱신/…).
const VERB_ENDINGS = ['수정', '적용', '마이그레이션', '분리', '등록', '발송',
                      '핸들링', '생성', '삭제', '추가', '변환', '검증',
                      '동기화', '전송', '처리', '계산', '리사이즈', '동작',
                      '충전', '차감', '환불', '연장', '조회', '만료',
                      '갱신', '진입', '노출', '집계', '차단', '복구',
                      '업로드', '다운로드', '발급'];

// Trunk naming pattern: <name>-app / <name>-server / single lowercase word (db, www).
const TRUNK_PATTERN = /^[a-z][a-z0-9-]*(-app|-server|-service|-job|-cdn)$|^[a-z]{2,8}$/;

// Promotion signals — when a twig's description contains these, it might belong at limb level.
// Derived from sidebar/auth/ui-system limb promotions on 2026-05-21.
const PROMOTION_KEYWORDS = [
  '전역',
  '라우트 비종속',
  '모든 라우트',
  '전 화면',
  '스플래시',
  '전역 재사용',
  '재사용 자산',
  'global',
  'route-independent',
  'splash',
];

// Implementation jargon — code-structure words that describe HOW, not the user-facing WHAT.
// A node label should name the information unit (e.g. "Bug log API"), not the code role
// ("Bugs router"). Surfaced via reserved-domain-substring? No — those are separate domain
// reservations. This rule catches generic code-architecture words.
const IMPLEMENTATION_JARGON = [
  'router', 'handler', 'controller', 'middleware', 'wrapper',
  'manager', 'bootstrap', 'helper', 'util', 'utils', 'factory',
  'layer', 'tier', 'store',
];

// File-extension patterns that signal a leaf is named after a filename instead of an info unit.
const FILE_EXTENSION_PATTERN = /\.(js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|swift|sql|css|scss|html)$/i;
// Slash in a label suggests a file path, not a concept.
const PATH_SEPARATOR_PATTERN = /\//;

export function roleOf(type) {
  if (STRUCTURE_TYPES.has(type)) return 'structure';
  if (type === OBJECT_TYPE) return 'object';
  if (type === ACTION_TYPE) return 'action';
  return 'structure'; // unknown type — conservative fallback
}

// ── individual checks ─────────────────────────────────────────────────

export function reservedDomainCheck(label) {
  if (!label) return null;
  const lower = label.trim().toLowerCase();

  // Exact match — strong warning.
  if (RESERVED_DOMAINS.includes(lower)) {
    return {
      rule: 'reserved-domain',
      severity: 'warn',
      message: `Label "${label}" is a reserved domain. Record it as an entry in the apis/bugs/seasons/edges table, not as a node label.`,
    };
  }

  // Substring — soft info (could be a UI component named after the domain).
  for (const token of RESERVED_DOMAINS) {
    if (lower.includes(token)) {
      return {
        rule: 'reserved-domain-substring',
        severity: 'info',
        message: `Label contains reserved word "${token}". Confirm this node represents a UI component or system unit, not the domain itself.`,
      };
    }
  }
  return null;
}

export function trunkNamingCheck(type, label) {
  if (type !== 'trunk') return null;
  if (!label) return null;
  if (TRUNK_PATTERN.test(label)) return null;
  return {
    rule: 'trunk-naming',
    severity: 'info',
    message: `Trunk label "${label}" doesn't fit system-unit naming (e.g. user-app, api-server, db). Trunks should be deployable systems, not domains.`,
  };
}

export function leafVsVeinCheck(type, label) {
  if (!label) return null;
  if (type !== 'leaf' && type !== 'vein') return null;
  const tail = label.trim();
  const matchedVerb = VERB_ENDINGS.find(v => tail.endsWith(v));
  if (!matchedVerb) return null;

  if (type === 'leaf') {
    return {
      rule: 'leaf-vs-vein-heuristic',
      severity: 'info',
      message: `Label ends with verb "${matchedVerb}". Consider type "vein" (action) instead of "leaf" (object).`,
    };
  }
  return null;
}

export function dormancyHintCheck(type) {
  // Heads-up at create time: structure-only nodes will render as dormant until a leaf/vein descendant exists.
  // Reminds agents that limb→leaf direct is allowed when the unit is a single component.
  if (type !== 'limb' && type !== 'twig') return null;
  return {
    rule: 'structure-without-children',
    severity: 'info',
    message: `${type} is a structure node — it will render as dormant (dim) until it has a leaf or vein descendant. If this represents a single component or object (one React component, one file, one service), type='leaf' directly under structure is allowed (see PRD-node-roles.md §위계 규칙: trunk→leaf, limb→leaf OK).`,
  };
}

export function promotionHintCheck(type, description) {
  // When a twig's description mentions global/route-independent/splash etc., suggest limb instead.
  if (type !== 'twig') return null;
  if (!description) return null;
  const text = description.toLowerCase();
  const matched = PROMOTION_KEYWORDS.find(k => text.includes(k.toLowerCase()));
  if (!matched) return null;
  return {
    rule: 'twig-promotion-candidate',
    severity: 'info',
    message: `Description signal "${matched}" — this may belong at limb level rather than twig. Route-independent shells, distinct entry flows, and globally reused assets typically become sibling limbs (e.g. sidebar, auth, ui-system) rather than twigs nested in a domain limb.`,
  };
}

export function implementationJargonCheck(label) {
  // Catches code-architecture words that describe HOW the node is implemented rather than WHAT it represents.
  // Example: "Bugs router" → the user-facing thing is the bug log, the router is just Express plumbing.
  if (!label) return null;
  const lower = label.toLowerCase();
  // Split on whitespace + hyphen so we catch suffix forms ("api-layer") and standalone ("router").
  const tokens = lower.split(/[\s\-_/]+/).filter(Boolean);
  const matched = IMPLEMENTATION_JARGON.find(jargon => tokens.includes(jargon));
  if (!matched) return null;
  return {
    rule: 'implementation-jargon',
    severity: 'info',
    message: `Label "${label}" contains code-structure word "${matched.replace(/^-/, '')}". Names like router/handler/middleware/layer describe HOW the node is implemented, not WHAT it represents. Prefer the information unit a user would perceive (e.g. "Bug log API" instead of "Bugs router"). See system-structure resource — nodes are information units, not code files.`,
  };
}

export function fileAsLeafCheck(type, label) {
  // Catches leafs labelled as filenames (`store.js`) or paths (`middleware/auth.js`).
  // The file belongs in metadata.implements; the label should name the concept.
  // Also flags the redundant-child antipattern: if a twig already groups a concept and its
  // only child is a leaf named after the file, the twig should absorb the file directly.
  if (type !== 'leaf') return null;
  if (!label) return null;
  const trimmed = label.trim();
  const isFilename = FILE_EXTENSION_PATTERN.test(trimmed);
  const isPath = PATH_SEPARATOR_PATTERN.test(trimmed);
  if (!isFilename && !isPath) return null;
  return {
    rule: 'file-as-leaf',
    severity: 'info',
    message: `Leaf label "${label}" looks like a filename or path. Labels should name the information unit the user perceives; record the file path under metadata.implements. If the parent twig already groups this single concept (twig + single file leaf = redundant), consider absorbing the file into the parent twig's metadata.implements and removing this leaf.`,
  };
}

// 라벨 첫 토큰(접두어) — sibling-cluster(get_graph)와 동일 규칙.
function firstToken(label) {
  const first = (label || '').trim().split(/[\s\-_/]+/)[0];
  return first && first.length >= 2 ? first : null;
}

// 과밀한(직속 leaf ≥4) limb/twig 아래에, 새 leaf 포함 같은 접두어가 ≥3개 모일 때만 발사.
// get_graph의 sibling-cluster 힌트와 임계값·정밀도를 일치 — 평평하지만 그룹지을 근거가 없는
// 묶음(예: doc pages, resources)에는 발사하지 않음. 단순 "leaf 많음"은 신호가 아님.
const NEEDS_TWIG_MIN_LEAVES = 4;     // 과밀 기준(새 leaf 포함 총 직속 leaf)
const NEEDS_TWIG_MIN_CLUSTER = 3;    // 같은 접두어 공유 최소 개수
export function parallelLeavesNeedTwigCheck({ parentType, type, label, siblingLeafLabels }) {
  if (parentType !== 'limb' && parentType !== 'twig') return null;
  if (type !== 'leaf') return null;
  const labels = [label, ...(Array.isArray(siblingLeafLabels) ? siblingLeafLabels : [])];
  if (labels.length < NEEDS_TWIG_MIN_LEAVES) return null;
  const prefix = firstToken(label);
  if (!prefix) return null;
  const shared = labels.filter(l => firstToken(l) === prefix).length;
  if (shared < NEEDS_TWIG_MIN_CLUSTER) return null;
  return {
    rule: 'parallel-leaves-need-twig',
    severity: 'info',
    message: `This ${parentType} already has ${labels.length} direct leaves, and ${shared} share the prefix "${prefix}". Those almost always belong under a twig "${prefix} …" — consider creating it and re-parenting them. (A flat ${parentType} without a shared sub-theme is fine; don't over-nest.)`,
  };
}

export function missingImplementsCheck({ type, metadata }) {
  // leaf/vein은 metadata.implements (파일 경로 배열) 갖는 게 컨벤션 — concept → code 매핑.
  // 의도적 placeholder는 면제.
  if (type !== 'leaf' && type !== 'vein') return null;
  if (metadata?.placeholder === true) return null;
  if (metadata?.implements) return null;
  return {
    rule: 'missing-implements',
    severity: 'info',
    message: `${type} without metadata.implements. Add the source path(s) so the graph maps concept → code. Example: metadata.implements = ["server/data/store.js"] or ["src/Modal.jsx#default"] for multi-export files. Skip only for intentionally-planned work (metadata.placeholder=true).`,
  };
}

export function reparentMetadataHint(patch) {
  // When reparenting via update_node, suggest recording the move in metadata for inspectable history.
  if (!patch) return null;
  if (!('parent' in patch)) return null;
  if (patch.parent === null) return null; // detach-to-root has different semantics
  const meta = patch.metadata || {};
  const hasTrace = 'reparented_at' in meta || 'reparented_to' in meta || 'reparented_from' in meta;
  if (hasTrace) return null;
  return {
    rule: 'reparent-metadata-hint',
    severity: 'info',
    message: 'Reparenting a node — consider adding metadata.reparented_at (ISO date), metadata.reparented_from (prior parent id), and metadata.reparented_to (new parent id) so the restructure history stays inspectable.',
  };
}

// ── bug lifecycle ────────────────────────────────────────────────────
// Bug Codex reads status as three states: open=wild, in_progress=chasing,
// resolved|closed=catched. The recommended path is wild → chasing → catched:
// flip to in_progress the moment work starts, then resolve when it lands.
//
// Why this matters beyond tidiness: in_progress is the only signal that someone
// is already on a bug. An agent that fixes and resolves in one call never shows
// "chasing", so a second agent (or the human) has no way to see the work in
// flight and may start the same fix. The jump also collapses the two timestamps
// the codex uses to tell "found → started" from "started → shipped".
const CATCHED_STATUSES = new Set(['resolved', 'closed']);

export function bugStatusTransitionCheck(from, to) {
  if (!from || !to || from === to) return null;

  // wild → catched, skipping chasing.
  if (from === 'open' && CATCHED_STATUSES.has(to)) {
    return {
      rule: 'bug-skips-chasing',
      severity: 'info',
      message: `Bug goes straight from "open" (wild) to "${to}" (catched), skipping "in_progress" (chasing). Recommended flow: set status="in_progress" when you start the fix, then "${to}" once it lands. in_progress is the only marker that someone is already on this bug — without it a parallel agent can't tell the work is in flight, and the codex loses the found → started → shipped timeline. If the fix was genuinely instant, this is fine as-is.`,
    };
  }

  // Re-opening a caught bug — not wrong, but worth naming so it isn't a silent regression.
  if (CATCHED_STATUSES.has(from) && to === 'open') {
    return {
      rule: 'bug-reopened',
      severity: 'info',
      message: `Bug moves from "${from}" (catched) back to "open" (wild) — it escaped. If you are resuming work rather than reporting a regression, "in_progress" (chasing) says so more precisely. If it is a regression, note what shipped and broke it in the description.`,
    };
  }

  return null;
}

export function validateBugUpdate({ currentStatus, patch }) {
  const warnings = [];
  if (patch && 'status' in patch) {
    const s = bugStatusTransitionCheck(currentStatus, patch.status);
    if (s) warnings.push(s);
  }
  return { warnings };
}

export function hierarchyCheck(parentType, childType) {
  if (!parentType) return null; // root-level
  const parentRole = roleOf(parentType);
  const childRole = roleOf(childType);

  if (parentRole === 'action') {
    return {
      rule: 'hierarchy-vein-terminal',
      severity: 'error',
      message: 'A vein is terminal — it cannot have children. Pick a different parent.',
    };
  }
  if (parentRole === 'object' && childRole === 'structure') {
    return {
      rule: 'hierarchy-leaf-no-branch',
      severity: 'warn',
      message: 'A leaf (object) cannot branch back into structure (trunk/limb/twig). Pick a structure parent.',
    };
  }
  if (parentRole === 'structure' && childRole === 'action') {
    return {
      rule: 'hierarchy-skip-leaf',
      severity: 'warn',
      message: 'A vein is meant to live under a leaf (object), not directly under structure. Consider adding a leaf parent first.',
    };
  }
  return null;
}

// ── composite validators ─────────────────────────────────────────────

// Returns { ok, rejectReason, warnings[] }.
// rejectReason set when any check returns severity='error'.
// phase: 'create' enables dormancy hint (irrelevant on update where children may already exist).
// siblingLeafCount: # of active leaf siblings already under the resolved parent (for parallel-leaves rule).
// metadata: this node's metadata (for missing-implements rule).
export function validateNode({ type, label, parentType, description, metadata, siblingLeafCount, siblingLeafLabels, phase = 'create' }) {
  const warnings = [];
  let rejectReason = null;

  const h = hierarchyCheck(parentType, type);
  if (h) {
    if (h.severity === 'error') rejectReason = h.message;
    else warnings.push(h);
  }

  const r = reservedDomainCheck(label);
  if (r) warnings.push(r);

  const t = trunkNamingCheck(type, label);
  if (t) warnings.push(t);

  const l = leafVsVeinCheck(type, label);
  if (l) warnings.push(l);

  if (phase === 'create') {
    const d = dormancyHintCheck(type);
    if (d) warnings.push(d);

    const pl = parallelLeavesNeedTwigCheck({ parentType, type, label, siblingLeafLabels });
    if (pl) warnings.push(pl);
  }

  const mi = missingImplementsCheck({ type, metadata });
  if (mi) warnings.push(mi);

  const p = promotionHintCheck(type, description);
  if (p) warnings.push(p);

  const j = implementationJargonCheck(label);
  if (j) warnings.push(j);

  const f = fileAsLeafCheck(type, label);
  if (f) warnings.push(f);

  return { ok: !rejectReason, rejectReason, warnings };
}

// Patch-level checks that don't depend on resolved node state (reparent trace, future cross-field hints).
export function validateUpdate({ patch }) {
  const warnings = [];

  const rh = reparentMetadataHint(patch);
  if (rh) warnings.push(rh);

  return { warnings };
}

export function validateEdge({ sourceId, targetId }) {
  if (sourceId === targetId) {
    return {
      ok: false,
      rejectReason: 'Edge source and target cannot be the same node.',
      warnings: [],
    };
  }
  return { ok: true, rejectReason: null, warnings: [] };
}
