// ТЗ 1.0.2, пакеты 5-7: таблица агентов в README, навык agentkeygate, плагин Claude Code и server.json.
// Статические проверки без сети и без публикаций.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

// ---- Пакет 5: README и навык ----

test('README: таблица агентов с колонкой Checked live', () => {
  const readme = read('README.md');
  for (const a of ['Claude Code', 'Codex', 'Cursor', 'VS Code', 'Gemini', 'Hermes', 'OpenClaw', 'Claude Desktop', 'ChatGPT']) {
    assert.ok(readme.includes(a), a);
  }
  assert.match(readme, /Checked live/, 'есть колонка Checked live');
  // у всех агентов значение no
  const rows = readme.split('\n').filter((l) => /^\| [A-Z]/.test(l) && /\|\s*no\s*\|/.test(l));
  assert.ok(rows.length >= 9, `строк таблицы с no: ${rows.length}`);
});

test('README: ограничения Claude Desktop (mcp-remote) и ChatGPT (OAuth)', () => {
  const readme = read('README.md');
  assert.match(readme, /mcp-remote/, 'Claude Desktop через mcp-remote');
  assert.match(readme, /ChatGPT[^\n]*OAuth|OAuth[^\n]*ChatGPT/, 'ChatGPT: MCP требует OAuth');
});

test('SKILL.md: имя совпадает с папкой, описание не длиннее 1024 символов', () => {
  const skill = read('skills/agentkeygate/SKILL.md');
  assert.match(skill, /^name: agentkeygate$/m);
  const desc = skill.match(/^description:\s*(.+)$/m)?.[1] ?? '';
  assert.ok(desc.length > 0 && desc.length <= 1024, `описание ${desc.length} символов`);
  assert.ok(fs.existsSync(path.join(root, 'skills/agentkeygate/scripts/gw.sh')), 'хелпер gw.sh на месте');
});

// Навык только через MCP для хабов Hermes и ClawHub: их сканеры блокируют curl с токеном из env.
test('skills/agentkeygate-mcp: имя совпадает с папкой, без скриптов, curl и переменных окружения', () => {
  const skill = read('skills/agentkeygate-mcp/SKILL.md');
  assert.match(skill, /^name: agentkeygate-mcp$/m);
  const desc = skill.match(/^description:\s*(.+)$/m)?.[1] ?? '';
  assert.ok(desc.length > 0 && desc.length <= 60, `описание ${desc.length} символов (лимит Hermes 60)`);
  assert.deepEqual(fs.readdirSync(path.join(root, 'skills/agentkeygate-mcp')), ['SKILL.md'], 'только SKILL.md');
  assert.doesNotMatch(skill, /\bcurl\b|\bwget\b|printenv|process\.env|os\.environ/, 'нет сетевых команд и чтения env');
  assert.doesNotMatch(skill, /\$\{?[A-Z_]*(TOKEN|KEY|SECRET)/, 'нет подстановки секретов из env');
  for (const t of ['list_services', 'request_access', 'check_request', 'call']) assert.ok(skill.includes('`' + t + '`'), t);
});

test('skills/agentkeygate/README.md: пути установки навыка и переменные окружения', () => {
  const sr = read('skills/agentkeygate/README.md');
  for (const p of ['~/.claude/skills', '~/.agents/skills', '~/.cursor/skills', '~/.copilot/skills', '~/.gemini/skills', '~/.hermes/skills']) {
    assert.ok(sr.includes(p), p);
  }
  assert.ok(sr.includes('AGENTKEYGATE_URL') && sr.includes('AGENTKEYGATE_TOKEN'), 'переменные окружения');
});

// ---- Пакет 6: плагин Claude Code ----

test('marketplace.json: name, owner и запись плагина с source', () => {
  const mp = json('.claude-plugin/marketplace.json');
  assert.equal(mp.name, 'agentkeygate');
  assert.ok(mp.owner && typeof mp.owner === 'object' && mp.owner.name, 'owner задан');
  assert.equal(mp.plugins[0].name, 'agentkeygate');
  assert.equal(mp.plugins[0].source, './plugins/agentkeygate');
});

test('plugin.json: name, версия из package.json, license, repository', () => {
  const pl = json('plugins/agentkeygate/.claude-plugin/plugin.json');
  const version = json('package.json').version;
  assert.equal(pl.name, 'agentkeygate');
  assert.equal(pl.version, version, 'версия плагина равна версии package.json');
  assert.equal(pl.license, 'Apache-2.0');
  assert.match(pl.repository, /github\.com\/maximskorohod\/agentkeygate/);
});

// Каталог Anthropic отклоняет плагин, если url MCP-сервера содержит ${...}: у self-hosted шлюза фиксированного адреса нет,
// поэтому плагин без .mcp.json и userConfig, шлюз подключается командой claude mcp add
test('плагин без встроенного MCP-сервера и userConfig', () => {
  const pl = json('plugins/agentkeygate/.claude-plugin/plugin.json');
  assert.ok(!('userConfig' in pl), 'userConfig нет');
  assert.ok(!('mcpServers' in pl), 'mcpServers нет');
  assert.ok(!fs.existsSync(path.join(root, 'plugins/agentkeygate/.mcp.json')), '.mcp.json нет');
});

test('README плагина: не короче 40 слов, команды установки и подключения шлюза', () => {
  const readme = read('plugins/agentkeygate/README.md');
  assert.ok(readme.split(/\s+/).length >= 40, `слов: ${readme.split(/\s+/).length}`);
  assert.ok(readme.includes('claude plugin marketplace add maximskorohod/agentkeygate'));
  assert.ok(readme.includes('claude plugin install agentkeygate@agentkeygate'));
  assert.ok(readme.includes('claude mcp add --transport http agentkeygate'), 'команда подключения шлюза');
  assert.ok(!/gwa_[A-Za-z0-9_-]{10,}/.test(readme), 'нет настоящих токенов');
});

// Каталог Anthropic держит плагин, если навык читает ключ из окружения: в плагине навык работает только через MCP-инструменты
test('навык плагина: то же имя и описание, только MCP-инструменты, без env и скриптов', () => {
  const front = (t) => t.split('---')[1];
  const pluginSkill = read('plugins/agentkeygate/skills/agentkeygate/SKILL.md');
  assert.equal(front(pluginSkill), front(read('skills/agentkeygate/SKILL.md')), 'frontmatter совпадает');
  for (const tool of ['list_services', 'request_access', 'check_request', 'call']) assert.ok(pluginSkill.includes(`\`${tool}\``), tool);
  assert.ok(!/AGENTKEYGATE_(URL|TOKEN)|\$[A-Z_]{3,}|curl /.test(pluginSkill), 'нет переменных окружения и curl');
  assert.ok(!fs.existsSync(path.join(root, 'plugins/agentkeygate/skills/agentkeygate/scripts')), 'нет scripts/ в плагине');
});

test('plugin.json: поля каталога (homepage, icon, privacyPolicyUrl) и иконка PNG на месте', () => {
  const pl = json('plugins/agentkeygate/.claude-plugin/plugin.json');
  for (const k of ['homepage', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl']) assert.match(pl[k], /^https:\/\//, k);
  const icon = fs.readFileSync(path.join(root, 'plugins/agentkeygate', pl.icon));
  assert.ok(icon.subarray(1, 4).toString() === 'PNG', 'иконка PNG');
  assert.ok(icon.readUInt32BE(16) >= 512 && icon.readUInt32BE(16) === icon.readUInt32BE(20), 'квадрат от 512 px');
});

// ---- Пакет 7: server.json для реестра MCP (публикацию выполняет заказчик) ----

test('server.json: имя, версия из package.json, описание до 100 символов, repository, актуальная $schema', () => {
  const sj = json('server.json');
  const version = json('package.json').version;
  assert.equal(sj.name, 'io.github.maximskorohod/agentkeygate');
  assert.equal(sj.version, version);
  assert.ok(sj.description.length > 0 && sj.description.length <= 100, `описание ${sj.description.length} символов`);
  assert.match(sj.repository.url, /github\.com\/maximskorohod\/agentkeygate/);
  assert.equal(sj.repository.source, 'github');
  assert.match(sj.$schema, /^https:\/\/static\.modelcontextprotocol\.io\/schemas\/\d{4}-\d{2}-\d{2}\/server\.schema\.json$/);
});

test('server.json: один remote streamable-http с переменной host и секретным заголовком Authorization', () => {
  const sj = json('server.json');
  assert.equal(sj.remotes.length, 1);
  const rem = sj.remotes[0];
  assert.equal(rem.type, 'streamable-http');
  assert.equal(rem.url, 'https://{host}/mcp');
  assert.equal(rem.variables.host.isRequired, true);
  assert.ok(rem.variables.host.description, 'описание переменной host');
  const hdr = rem.headers.find((h) => h.name === 'Authorization');
  assert.ok(hdr, 'заголовок Authorization');
  assert.equal(hdr.isRequired, true);
  assert.equal(hdr.isSecret, true);
  assert.ok(!('value' in hdr) || hdr.value === undefined, 'значения заголовка в файле нет');
});
