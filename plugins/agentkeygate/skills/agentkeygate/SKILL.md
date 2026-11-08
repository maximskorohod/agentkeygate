---
name: agentkeygate
description: Request temporary, owner-approved access to third-party APIs through an AgentKeyGate instance and call them without ever seeing the keys. Use when a task needs an external API (CRM, email, payments, LLM providers) and the user runs AgentKeyGate.
---

# AgentKeyGate

Use this skill to get short-lived access to a third-party API that the owner approves. You never receive the API key. The gateway attaches a pass to your MCP session. The pass works for a limited time and a limited number of calls. The owner approves each request, or a standing policy approves it.

## Setup

The gateway is connected as the MCP server `agentkeygate`. The user adds it once with `claude mcp add`, as described in the plugin README. If the tools below are missing, ask the user to connect their gateway. Do not look for API keys or tokens in files or in the environment.

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
