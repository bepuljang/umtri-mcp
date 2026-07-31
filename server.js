#!/usr/bin/env node
// Umtri MCP — stdio transport entry. 도구/리소스/정책은 ./core/ 에서 import.
//
// 이 디렉토리(server/mcp/)는 npm 패키지 `umtri-mcp`의 루트이자 공개 미러 리포의
// 원본이다. 배포되지 않을 파일은 여기 두지 않는다 — sync·publish가 "통째로 복사"로
// 단순해지는 대신, 내부 문서를 여기 두면 그대로 공개된다.
//
// Env
//   UMTRI_API_TOKEN  — required. `umtri_pat_…` from app.umtri.io → Settings → API Tokens.
//   UMTRI_API_BASE   — optional, defaults to https://api.umtri.io.
//
// stdout is reserved for the JSON-RPC protocol — never log to console.log; use console.error.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createApiClient } from './core/api-client.js';
import { registerTools } from './core/tools.js';
import { registerResources } from './core/resources.js';
import { SERVER_INSTRUCTIONS } from './core/instructions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = join(__dirname, 'core', 'resources');

// 버전은 package.json 단일 출처. 여기 상수로 박아두면 publish한 버전과
// 클라이언트가 보고하는 버전이 조용히 어긋난다.
// (import attributes 대신 createRequire — Node 20~22에서 문법이 갈리지 않는다.)
const { version: VERSION } = createRequire(import.meta.url)('./package.json');

const API_BASE = process.env.UMTRI_API_BASE || 'https://api.umtri.io';
const API_TOKEN = process.env.UMTRI_API_TOKEN;

if (!API_TOKEN) {
  console.error('[umtri-mcp] UMTRI_API_TOKEN is required. Generate one at app.umtri.io → Settings → API Tokens.');
  process.exit(1);
}

const api = createApiClient({
  baseUrl: API_BASE,
  getToken: () => API_TOKEN,
});

const server = new McpServer({
  name: 'umtri-mcp',
  version: VERSION,
}, { instructions: SERVER_INSTRUCTIONS });

registerTools(server, { api });
registerResources(server, { resourcesDir: RESOURCES_DIR });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[umtri-mcp] connected via stdio');
