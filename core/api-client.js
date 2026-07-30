// Transport-agnostic HTTP client for the Umtri REST API.
// stdio CLI과 HTTP MCP 라우터 둘 다 같은 시그니처로 사용.
//
// getToken은 동기/비동기 fn — stdio는 env 토큰 고정, HTTP는 request-scoped 토큰을 반환.

export function createApiClient({ baseUrl, getToken }) {
  const base = String(baseUrl || '').replace(/\/$/, '');

  async function authHeader() {
    const token = await getToken();
    if (!token) throw new Error('No API token available for request.');
    return `Bearer ${token}`;
  }

  async function get(path) {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: await authHeader() },
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
      headers: { Authorization: await authHeader() },
    };
    if (body != null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 403) {
        throw new Error(`${method} ${path} → 403: token lacks write scope. Generate a 'write' token in Settings → API Tokens.`);
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
