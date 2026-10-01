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

// Trunk kinds — umtri://rules/trunk-kinds. Recorded in trunk metadata.kind.
// A trunk that fits none of these keeps kind unset; the agent asks the human whether to
// suggest a new kind via send_feedback (never files it on its own).
export const TRUNK_KINDS = ['front', 'server', 'database', 'library', 'device'];

// Suffixes that repeat what the trunk kind already says ("예약 API", "Reservation tables").
// Matched at the end of a limb label directly under a trunk.
const KIND_SUFFIX_PATTERN = /(\s|·)?(api|apis|응답|테이블|table|tables|관리|admin|management|endpoints?|엔드포인트)$/i;

// Technical-layer limb names — how code is arranged, not what the system is made of.
// Whole-label match (after trimming) so "상태 관리 화면" or "Store locator" don't trip it.
const LAYER_LIMB_LABELS = [
  'state', 'state management', 'store', 'stores', 'utils', 'util', 'utilities', 'helpers',
  'hooks', 'routes', 'routing', 'router', 'middleware', 'middlewares', 'models',
  'services', 'controllers', 'components', 'handlers', 'lib', 'core', 'http routes',
  'data store', 'app bootstrap', 'bootstrap',
  '상태 관리', '상태', '유틸', '유틸리티', '헬퍼', '훅', '라우트', '라우팅', '미들웨어',
  '모델', '서비스', '컨트롤러', '컴포넌트', '핸들러',
];

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

// trunk에 kind가 없거나 다섯 유형 밖이면 알린다. 거부하지 않는다 — 기존 나무가 대부분 kind 없이 있다.
export function trunkKindCheck(type, metadata) {
  if (type !== 'trunk') return null;
  const kind = metadata?.kind;
  const fallback = 'If none of the five fits, leave kind unset, tell the human which trunk did not fit and why, and offer to suggest a new kind with send_feedback (kind "improvement") — do not file it on your own. See umtri://rules/trunk-kinds.';
  if (kind == null || kind === '') {
    return {
      rule: 'trunk-kind-missing',
      severity: 'info',
      message: `Trunk has no metadata.kind. Set one of ${TRUNK_KINDS.join(' / ')} — the kind decides how its limbs split. ${fallback}`,
    };
  }
  if (!TRUNK_KINDS.includes(kind)) {
    return {
      rule: 'trunk-kind-unknown',
      severity: 'info',
      message: `metadata.kind "${kind}" is not one of ${TRUNK_KINDS.join(' / ')}. ${fallback}`,
    };
  }
  return null;
}

// trunk 바로 아래 limb의 이름 규칙 — 접미사 금지, 레이어 이름 금지, 공통 limb는 하나.
// parentKind: 부모 trunk의 metadata.kind(없으면 null). siblingCommonCount: 같은 trunk 아래
// 이 노드를 뺀 metadata.common=true limb 수.
export function limbUnderTrunkChecks({ type, label, parentType, parentKind, metadata, siblingCommonCount = 0 }) {
  const out = [];
  if (type !== 'limb' || parentType !== 'trunk' || !label) return out;
  const trimmed = label.trim();

  const isLayer = LAYER_LIMB_LABELS.includes(trimmed.toLowerCase());
  // 레이어 이름("상태 관리")은 접미사 문제가 아니라 축 문제라 layer 경고 하나만 낸다.
  if (!isLayer && KIND_SUFFIX_PATTERN.test(trimmed) && trimmed.replace(KIND_SUFFIX_PATTERN, '').trim()) {
    out.push({
      rule: 'limb-domain-suffix',
      severity: 'info',
      message: `Limb "${label}" ends in a kind suffix. Name the domain alone ("${trimmed.replace(KIND_SUFFIX_PATTERN, '').trim()}") and reuse the exact label other trunks use for it — the trunk already says what kind of thing it is. See umtri://rules/trunk-kinds.`,
    });
  }

  if (isLayer) {
    const axis = {
      front: 'user-facing features or flows (or pages for a public site)',
      server: 'domains / resources',
      database: 'domains, named like the server',
      library: 'capabilities or concepts',
      device: 'physical parts or screen regions',
    }[parentKind] ?? "the trunk kind's axis (umtri://rules/trunk-kinds)";
    out.push({
      rule: 'limb-layer-axis',
      severity: 'warn',
      message: `Limb "${label}" names a technical layer. Split this trunk by ${axis}; put what this would hold into the feature/domain limb it serves, or into the trunk's one common limb.`,
    });
  }

  if (metadata?.common === true && siblingCommonCount > 0) {
    out.push({
      rule: 'common-limb-duplicate',
      severity: 'warn',
      message: 'This trunk already has a common limb (metadata.common=true). Keep one per trunk — make this a twig of that limb, or a real feature/domain limb.',
    });
  }
  return out;
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

// ── wiki 본문 ────────────────────────────────────────────────────────
// 위키 판정(로그 형태 + 백과사전 뼈대)은 서버 server/data/wikiLint.js에 있고 쓰기 응답의
// warnings[]로 온다. 여기 두면 REST로 쓴 문서는 판정을 안 받고, stdio 사용자는 패키지를
// 새로 받을 때까지 옛 판정에 묶인다.

// ── 도구 호출 마크업 유출 ────────────────────────────────────────────
// 인자가 필드로 쪼개지지 못하고 첫 필드에 통째로 들어오는 사고가 실제로 있었다
// (feedback #1: create_bug을 세 번 부르는 동안 세 번 다 solution이 description 꼬리에
// 문자열로 붙고 solution은 null로 저장됐다). 긴 산문 필드 둘이 나란히 오면 특히 잦다.
//
// 저장 자체는 성공하므로 아무도 모른 채 지나가고, 사람이 앱에서 볼 때에야 드러난다.
// 그래서 쓰기 응답에 그 자리에서 신호를 준다.
//
// **거부하지 않고 경고만 한다.** 도구 포맷을 *설명하는* 산문이 이 조각들을 정상적으로
// 담기 때문이다 — 하필 이 프로젝트의 위키가 그런 글을 쓴다. 대신 코드펜스와 인라인
// 코드를 걷어내고 검사한다: 설명하는 글은 따옴표 안에 넣고, 진짜 유출은 맨몸으로 온다.
// 이 구분이 오탐을 거의 없앤다.
const TOOL_MARKUP_RES = [
  /<\/?(?:antml:)?parameter\b/i,
  /<\/?(?:antml:)?invoke\b/i,
  /<\/?(?:antml:)?function_calls\b/i,
  /<\/(?:description|solution|body|title|label|note|metadata)>/i,
];

function withoutCode(text) {
  return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
}

// fields: { 필드이름: 값 } — 문자열이 아닌 값은 건너뛴다.
export function toolMarkupCheck(fields) {
  const out = [];
  for (const [name, value] of Object.entries(fields || {})) {
    if (!value || typeof value !== 'string') continue;
    const bare = withoutCode(value);
    if (!TOOL_MARKUP_RES.some((re) => re.test(bare))) continue;
    out.push({
      rule: 'tool-markup-leaked',
      severity: 'warn',
      message: `The "${name}" value contains raw tool-call markup (e.g. "</${name}>" or "<parameter name=...>"). That means this call's arguments were not split into fields: the text meant for the next parameter was appended to this one, and that parameter was almost certainly saved empty. Read the record back and re-send the values as separate arguments — nothing else will report this. (Writing *about* tool-call syntax is fine: put it in a code fence or inline code, which this check ignores.)`,
    });
  }
  return out;
}

// ── bug lifecycle ────────────────────────────────────────────────────
// Bug Codex reads status as three states: open=wild, in_progress=chasing,
// resolved|closed=resolved. The recommended path is wild → chasing → resolved:
// flip to in_progress the moment work starts, then resolve when it lands.
//
// Why this matters beyond tidiness: in_progress is the only signal that someone
// is already on a bug. An agent that fixes and resolves in one call never shows
// "chasing", so a second agent (or the human) has no way to see the work in
// flight and may start the same fix. The jump also collapses the two timestamps
// the codex uses to tell "found → started" from "started → shipped".
const RESOLVED_STATUSES = new Set(['resolved', 'closed']);

export function bugStatusTransitionCheck(from, to) {
  if (!from || !to || from === to) return null;

  // wild → resolved, skipping chasing.
  if (from === 'open' && RESOLVED_STATUSES.has(to)) {
    return {
      rule: 'bug-skips-chasing',
      severity: 'info',
      message: `Bug goes straight from "open" (wild) to "${to}", skipping "in_progress" (chasing). Recommended flow: set status="in_progress" when you start the fix, then "${to}" once it lands. in_progress is the only marker that someone is already on this bug — without it a parallel agent can't tell the work is in flight, and the codex loses the found → started → shipped timeline. If the fix was genuinely instant, this is fine as-is.`,
    };
  }

  // Re-opening a resolved bug — not wrong, but worth naming so it isn't a silent regression.
  if (RESOLVED_STATUSES.has(from) && to === 'open') {
    return {
      rule: 'bug-reopened',
      severity: 'info',
      message: `Bug moves from "${from}" back to "open" (wild) — it escaped. If you are resuming work rather than reporting a regression, "in_progress" (chasing) says so more precisely. If it is a regression, note what shipped and broke it in the description.`,
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
export function validateNode({ type, label, parentType, parentKind = null, siblingCommonCount = 0, description, metadata, siblingLeafCount, siblingLeafLabels, phase = 'create' }) {
  const warnings = [];
  let rejectReason = null;

  const h = hierarchyCheck(parentType, type);
  if (h) {
    if (h.severity === 'error') rejectReason = h.message;
    else warnings.push(h);
  }

  // 테이블 leaf(metadata.table)의 라벨은 테이블의 논리명이다 — "버그" 테이블은 bugs 레코드가 아니라
  // 그 레코드를 담는 테이블이라 예약어와 이름이 같아도 정당하다(umtri://rules/trunk-kinds).
  let r = type === 'leaf' && metadata?.table ? null : reservedDomainCheck(label);
  // 유형이 정해진 trunk 바로 아래 limb는 도메인 이름이다 — Umtri 자신의 server·db에는 "버그" 도메인이
  // 있다. 그 코드 영역을 가리키는 거라면 정당하니 info로 낮추고 그 뜻을 말해 준다.
  if (r?.rule === 'reserved-domain' && type === 'limb' && parentType === 'trunk' && TRUNK_KINDS.includes(parentKind)) {
    r = {
      rule: 'reserved-domain',
      severity: 'info',
      message: `"${label}" is also a first-class record (bugs/apis/seasons/edges). As a limb under a ${parentKind} trunk it is fine if it names the code that handles that domain — not individual records.`,
    };
  }
  if (r) warnings.push(r);

  const t = trunkNamingCheck(type, label);
  if (t) warnings.push(t);

  const tk = trunkKindCheck(type, metadata);
  if (tk) warnings.push(tk);

  warnings.push(...limbUnderTrunkChecks({ type, label, parentType, parentKind, metadata, siblingCommonCount }));

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
