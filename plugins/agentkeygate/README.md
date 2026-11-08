# AgentKeyGate plugin for Claude Code

The plugin ships the `agentkeygate` skill: step-by-step instructions for the tools of your self-hosted [AgentKeyGate](https://github.com/maximskorohod/agentkeygate) gateway, `list_services`, `request_access`, `check_request` and `call`. With them Claude Code asks for a time-limited pass instead of your API key, and the key itself never leaves the gateway. The skill reads no environment variables or files.

The gateway runs on your own server, so its address is different for every owner. The plugin does not bundle an MCP server: you connect your gateway once with `claude mcp add`.

## Install

Add the marketplace and install the plugin:

```bash
claude plugin marketplace add maximskorohod/agentkeygate
claude plugin install agentkeygate@agentkeygate
```

Connect your gateway over Streamable HTTP at `/mcp`. Replace the address with your own and `<agent-token>` with the agent token (`gwa_...`) that the owner created in the gateway web UI under Agents. The token is shown once when the agent is created.

```bash
claude mcp add --transport http agentkeygate https://your-domain/mcp --header "Authorization: Bearer <agent-token>"
```

To verify the installation, run `claude mcp list` and look for `agentkeygate`, then ask Claude Code to list the services available through agentkeygate.

To remove it, run `claude plugin uninstall agentkeygate` and `claude mcp remove agentkeygate`, then revoke the agent in the gateway web UI.
