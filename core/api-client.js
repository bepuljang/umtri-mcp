// Transport-agnostic HTTP client for the Umtri REST API.
// stdio CLI과 HTTP MCP 라우터 둘 다 같은 시그니처로 사용.
//
// getToken은 동기/비동기 fn — stdio는 env 토큰 고정, HTTP는 request-scoped 토큰을 반환.

export function createApiClient({ baseUrl, getToken }) {
  const base = String(baseUrl || '').replace(/\/$/, '');

  // 토큰 없는 연결(HTTP 익명 discovery)에서 도구를 부르면 여기서 멈춘다. 연결은 되고 호출만
  // 실패하는 모양이라, 이 문구가 사람에게 닿는 유일한 안내다 — 발급 위치와 넣는 자리를 한 번에.
  async function authHeader() {
    const token = await getToken();
    if (!token) {
      throw new Error(
        'This connection has no API token, so tools cannot run. Sign in at app.umtri.io, generate a personal access token in Settings → API Tokens, ' +
        'then send it as "Authorization: Bearer umtri_pat_…" (remote https://mcp.umtri.io) or set UMTRI_API_TOKEN (npx umtri-mcp). ' +
        'Guide: https://docs.umtri.io/en/token',
      );
    }
    return `Bearer ${token}`;
  }

  // 서버가 "이 사용자가 MCP로 연결해 본 적 있음"을 기록하는 표시 — stdio·HTTP 공용.
  async function headers() {
    return { Authorization: await authHeader(), 'X-Umtri-Client': 'mcp' };
  }

  async function get(path) {
    const res = await fetch(`${base}${path}`, {
      headers: await headers(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GET ${path} → ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  async function mutate(method, path, body) {
    const init = {
      method,
      headers: await headers(),
    };
    if (body != null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 403) {
        // 403은 한 가지가 아니다 — write scope 없음과 admin 전용 경로(feedback 관리 등)가 같이 온다.
        // 서버가 준 이유를 버리고 토큰 안내로 덮으면, 관리자 경로에서 막힌 사람이 멀쩡한 토큰을
        // 다시 발급하러 간다. 이유를 그대로 싣고, 스코프 문제일 때만 발급 안내를 덧붙인다.
        const reason = text.slice(0, 200) || 'forbidden';
        const hint = /scope/i.test(text) ? " Generate a 'write' token in Settings → API Tokens." : '';
        throw new Error(`${method} ${path} → 403: ${reason}${hint}`);
      }
      throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return { ok: true };
    return res.json();
  }

  return {
    get,
    post: (path, body) => mutate('POST', path, body),
    put: (path, body) => mutate('PUT', path, body),
    patch: (path, body) => mutate('PATCH', path, body),
    delete: (path) => mutate('DELETE', path, null),
  };
}
