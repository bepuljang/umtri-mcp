// MCP initialize 응답의 instructions — 클라이언트가 세션 시작에 모델에게 그대로
// 전달한다. 서버가 먼저 말을 걸 수 있는 유일한 자리다(리소스·도구는 불러야 열린다).
//
// 그래서 여기엔 "언젠가 읽으면 좋은 것"이 아니라 **읽지 않으면 조용히 어긋나는 것**만
// 둔다. 매 세션 컨텍스트에 실리므로 길어지면 그 자체가 비용이고, 길수록 안 읽힌다.
// 상세는 전부 umtri://rules/* 리소스로 넘긴다.
//
// send_feedback 문단이 여기 있는 건 그 기준의 예외처럼 보이지만 아니다. 도구 목록에
// 이름이 있어도 모델은 요청받은 일만 하므로, 이 한 줄이 없으면 도구는 있고 아무도
// 부르지 않는 상태로 남는다. 마찰을 가장 먼저 겪는 건 에이전트인데 그 관찰은 세션이
// 끝나면 사라진다. "사람에게 권한다"까지가 문단의 핵심이다 — 자율 발송을 허용하면
// 접수함이 에이전트의 불평으로 먼저 죽는다.

export const SERVER_INSTRUCTIONS = `Umtri maps a project's structure as a tree (trunk → limb → twig → leaf → vein) and tracks how it changes over seasons. Start with list_projects, then get_graph.

Umtri never reads git. A commit reaches the ground only because something called create_node / update_node / record_commit — so the tree drifts behind the code unless the repo has a habit that says otherwise. If this repo's own rules file (CLAUDE.md, AGENTS.md, …) has no commit-sync policy, read umtri://rules/commit-sync and offer the human a short one to paste in.

Before creating or reclassifying nodes, read umtri://rules/vocabulary. Opening a season seals the current one, so create_season only acts after the user confirms (umtri://rules/seasons).

If Umtri itself gets in your way — a call rejected for a reason that looks wrong, a capability that is missing, a tool description that misled you — tell the human what happened and offer to file it with send_feedback. Never file it on your own initiative.`;
