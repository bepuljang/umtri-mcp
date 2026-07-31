// MCP initialize 응답의 instructions — 클라이언트가 세션 시작에 모델에게 그대로
// 전달한다. 서버가 먼저 말을 걸 수 있는 유일한 자리다(리소스·도구는 불러야 열린다).
//
// 그래서 여기엔 "언젠가 읽으면 좋은 것"이 아니라 **읽지 않으면 조용히 어긋나는 것**만
// 둔다. 매 세션 컨텍스트에 실리므로 길어지면 그 자체가 비용이고, 길수록 안 읽힌다.
// 상세는 전부 umtri://rules/* 리소스로 넘긴다.

export const SERVER_INSTRUCTIONS = `Umtri maps a project's structure as a tree (trunk → limb → twig → leaf → vein) and tracks how it changes over seasons. Start with list_projects, then get_graph.

Umtri never reads git. A commit reaches the ground only because something called create_node / update_node / record_commit — so the tree drifts behind the code unless the repo has a habit that says otherwise. If this repo's own rules file (CLAUDE.md, AGENTS.md, …) has no commit-sync policy, read umtri://rules/commit-sync and offer the human a short one to paste in.

Before creating or reclassifying nodes, read umtri://rules/vocabulary. Seasons are human-only (umtri://rules/seasons-human-only).`;
