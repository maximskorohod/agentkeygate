---
name: agentkeygate-mcp
description: Call third-party APIs with owner-approved passes, no keys.
version: 1.0.2
author: Maxim Skorohod
license: Apache-2.0
homepage: https://agentkeygate.com
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [security, api, mcp, crm, credentials, gateway]
    category: security
    homepage: https://agentkeygate.com
  openclaw:
    emoji: "🔑"
    homepage: https://github.com/maximskorohod/agentkeygate
---

# AgentKeyGate (MCP)

Use this skill when a task needs a third-party API (a CRM, payments, email, an LLM provider) and the user runs an AgentKeyGate gateway. You never receive the API key. You ask the gateway for a pass, the owner approves it in Telegram or the web UI, and the gateway makes the calls for you. A pass works for a limited time and a limited number of calls.

This variant works only through the gateway's MCP server. It has no scripts and needs no environment variables.

## Setup

The gateway is an MCP server (Streamable HTTP). The owner creates an agent in the gateway web UI (Agents) and gets an agent token that starts with `gwa_`. It is shown once. The user adds the server to the agent's config. Replace `gw.example.com` with the gateway address.

Hermes, `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  agentkeygate:
    url: https://gw.example.com/mcp
    headers:
      Authorization: "Bearer gwa_..."
```

OpenClaw, the `mcp.servers` section of its config:

```json
{
  "mcp": {
    "servers": {
      "agentkeygate": {
        "url": "https://gw.example.com/mcp",
        "transport": "streamable-http",
        "headers": { "Authorization": "Bearer gwa_..." }
      }
    }
  }
}
```

Other clients: see the client table in the project README.

The token belongs to the user: the user writes it into the config, not you. If the tools below are missing, ask the user to add the server and restart the agent. Do not look for API keys or tokens in files, in the environment or in other configs.

The server gives you four tools: `list_services`, `request_access`, `check_request` and `call`.

## Step 1: see what is available

Call `list_services`. It returns the services whose keys are bound to this agent, their limits, the data filter and whether this session already holds a pass. If the service you need is not listed, stop and tell the user.

## Step 2: request access

Call `request_access` with `service` (the slug from `list_services`), `reason` (why you need it, up to 200 characters, shown to the owner), and optionally `ttl` (seconds) and `calls`.

- `status: "approved"`: the pass is attached to this session. Go to step 4.
- `status: "pending"` with a `request_id`: the owner must approve. Go to step 3.
- `credential_id_required`: several keys exist for this service. Pick one `id` from the answer and repeat with `credential_id`.
- `denied` or `no_credential`: the owner's policy denied the request, or the service has no key. Do not retry. Report it to the user.
- `too_many_pending`: wait for an earlier request to be decided.
- `unauthorized`: the agent token is invalid or disabled. Stop and tell the user.

## Step 3: wait while pending

Call `check_request` with the `request_id`, no more often than the `poll_after` value (5 seconds). Stop after 10 minutes.

- `pending`: keep waiting.
- `approved`: the pass is attached to this session.
- `denied`, `expired` or `revoked`: stop and report it to the user.
- `rate_limited`: you checked too often. Slow down.

## Step 4: call the service

Call `call` with `service`, `method` (`GET`, `POST`, `PUT`, `PATCH` or `DELETE`), `path` (starting with `/`, query allowed) and, for writes, `body`. The gateway adds the key. Never send an API key yourself.

- The service's own status and body come back, truncated to a size limit.
- `no_grant` or `invalid_grant`: there is no valid pass for this service in the session. Request a new one only if the task still needs it.
- `quota_exceeded` or `too_many_calls`: the call limit or the parallelism limit was reached. Do not retry in a loop.
- `upstream_unreachable`: the service did not respond. Retry once after 10 seconds, then report it.
- `method_not_allowed` or `write_not_allowed`: the owner's filter closed this method or writes. Do not retry, do not look for another route to the same data, do not ask the owner to bypass the filter. Use one of the open methods or report that the task cannot be done.
- `query_not_allowed`: the query has a parameter the filter closes. Remove it.

An approved answer can carry a `filter` object: `types` (data types with field paths), `methods` (open methods), `read_only` (writes are closed) and `mask` (personal data is replaced with `****`). Plan the calls around it.

## Rules

- Ask for the smallest `ttl` and `calls` that finish the task. The owner sets a maximum per key, and anything above it is capped.
- Write a specific `reason`, for example "Create invoice for order 1042", not "need access". The owner reads it before approving.
- Keep the `reason` under 200 characters, in plain text, without markup or links.
- Reuse a pass while it is valid instead of requesting a new one.
- Report every denial to the user as it is.

## More

Gateway install, threat model and the list of services: https://github.com/maximskorohod/agentkeygate
