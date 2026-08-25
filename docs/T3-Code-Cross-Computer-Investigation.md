# T3 Code remote-functionality investigation

## Bottom line

Theo’s central claim is substantially true: T3 Code now provides one client interface for coding-agent sessions whose T3 servers, repositories, terminals, and provider CLIs live on other computers.

However, several important qualifications are missing:

- `npx t3 connect` is a real command, but it configures T3’s account-linked relay; it is not by itself the long-running remote-agent daemon.
- The actual workload process is `t3 serve`, or the server embedded in the desktop app.
- Remote agents continue when the controlling laptop disconnects, but only while the remote computer, T3 server, and provider process remain running.
- Automatic boot-time service management is officially supported only on Linux with systemd.
- T3 Connect is brokered through T3/Clerk and a managed Cloudflare Tunnel. Tailscale and direct-LAN modes avoid the T3 Connect relay.
- Worktrees and desktop previews exist, but they are not yet a polished remote development-server orchestration system.
- T3 Code is still explicitly described by its developers as very early software. The current stable release is v0.0.32, released 7 August 2026, with rapidly changing nightlies. [Official repository](https://github.com/pingdotgg/t3code), [current releases](https://github.com/pingdotgg/t3code/releases).

My recommendation: suitable now for technically comfortable beta use, especially with a Linux server and Tailscale. Not yet dependable enough to make it the sole control plane for unattended, cross-platform overnight work.

## 1. What actually runs on each computer

Every agent-hosting computer runs a T3 Code server. That server owns:

- Provider CLI processes such as Codex or Claude Code
- Provider credentials on that computer
- Projects and worktrees
- Git and filesystem operations
- Terminals
- Thread history and agent output
- The HTTP/WebSocket API used by the controlling interfaces

The controller can be the desktop app, web interface, iOS app, or Android app. It does not need the provider CLI or repository locally.

The server is normally one of:

- `npx t3@latest` — server plus local web UI
- `npx t3@latest serve` — explicit server mode
- The server embedded in the desktop app
- A Linux background service installed with `t3 service install`
- A temporary server launched through the desktop app’s SSH connection flow

The architecture is documented in T3’s [remote-environment internals](https://github.com/pingdotgg/t3code/blob/main/docs/internals/remote.md) and [remote-access guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md).

## 2. Correction to `npx t3 connect`

The transcript command is not a transcription error. The safer, version-explicit form is:

```sh
npx t3@latest connect
```

That starts interactive T3 Connect onboarding. The explicit relay commands are:

```sh
npx t3@latest connect login
npx t3@latest connect link
npx t3@latest connect status
npx t3@latest connect unlink
npx t3@latest connect logout
```

A normal headless sequence is:

```sh
npx t3@latest connect link
npx t3@latest serve
```

`connect link` authenticates the computer, installs T3’s pinned `cloudflared` connector if necessary, and records durable intent to publish that environment. `serve` starts the actual T3 server and reconciles the saved relay connection. [T3 Connect internals](https://github.com/pingdotgg/t3code/blob/main/docs/internals/t3-connect.md).

Therefore:

- `t3 connect` alone is not the persistent agent daemon.
- `t3 serve` is a foreground process unless managed by the desktop app or service manager.
- Closing its terminal or logging out normally terminates it.
- The Connect link configuration survives, but a server still needs to start after reboot.

For direct LAN or Tailscale pairing, T3 also provides:

```sh
npx t3@latest pair
npx t3@latest pair --tailscale
```

## 3. Connection methods

| Method           | Discovery and traffic path                                                                   |             Inbound port required? | External T3 service? |
| ---------------- | -------------------------------------------------------------------------------------------- | ---------------------------------: | -------------------: |
| Local network    | Client connects directly to server HTTP/WebSocket on TCP 3773                                | Yes, on the LAN interface/firewall |                   No |
| Direct Tailscale | Client connects to the server’s `100.x` or MagicDNS address on TCP 3773                      |      Tailscale-only access to 3773 |  No T3 account/relay |
| Tailscale Serve  | Tailscale publishes HTTPS/WSS, normally on TCP 443 within the tailnet                        |               No router forwarding |          No T3 relay |
| T3 Connect       | T3 account discovers the environment; traffic reaches it through a managed Cloudflare tunnel |                    No inbound port |                  Yes |
| Desktop SSH      | Desktop app uses SSH and a local port forward                                                |               SSH, normally TCP 22 |                   No |

### Direct LAN

A typical endpoint is:

```text
http://192.168.1.50:3773
```

This is HTTP plus WebSocket and is not TLS-encrypted. Use it only on a trusted LAN. Pairing authentication still applies.

No public router port should be opened unless you deliberately expose T3 to the internet, which I do not recommend.

### Tailscale

Direct binding:

```sh
npx t3@latest serve --host "$(tailscale ip -4)"
```

PowerShell equivalent:

```powershell
$t3TailnetIp = tailscale ip -4
npx t3@latest serve --host $t3TailnetIp
```

For the hosted browser interface, use HTTPS through Tailscale Serve:

```sh
npx t3@latest serve --tailscale-serve
```

The default advertised endpoint is approximately:

```text
https://machine-name.tailnet-name.ts.net/
```

The hosted web app at [app.t3.codes](https://app.t3.codes) cannot connect to a plain `http://` or `ws://` backend because browsers block mixed content. The desktop and mobile applications can use a direct tailnet HTTP endpoint.

Tailscale requires no router port forwarding and works through NAT. Its payload transport is WireGuard-encrypted. It normally uses Tailscale’s coordination infrastructure, so “no T3 external service” is true, but “no external service of any kind” is not strictly true unless using a self-hosted coordination arrangement. For a completely local setup, use direct LAN mode and the server’s own local web interface.

### T3 Connect

T3 Connect works through NAT without inbound ports. It uses:

- Clerk for T3 account authentication
- T3’s relay/control service for environment registration and credential brokering
- A managed Cloudflare Tunnel for actual application traffic

The relay Worker does not proxy all terminal and agent traffic itself; it provisions credentials and a tunnel hostname. Traffic then goes through the Cloudflare tunnel endpoint.

Relevant egress requirements include:

- HTTPS/TCP 443 for authentication and control APIs
- Cloudflare Tunnel TCP or UDP 7844, using HTTP/2 or QUIC
- DNS resolution

Cloudflare documents the tunnel egress requirements in its [firewall guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/).

### SSH

The desktop app can connect to `user@host`, launch or reuse a remote T3 server, and create an SSH port forward.

Important limitation: the launcher expects a non-interactive Unix `sh` environment and writes under:

```text
~/.t3/ssh-launch/<host-key>/
```

It is consequently a natural fit for Linux and macOS targets, not native Windows targets.

If the desktop SSH launcher started the server, disconnecting that environment also stops its launcher-managed server. For unattended continuation, start the remote server independently or use the Linux service.

## 4. Persistence and cross-device behaviour

### Does work continue after the controller disconnects?

Yes—if the agent is running on another computer.

Closing or sleeping the MacBook controller does not inherently cancel a Codex or Claude process running on Windows or Linux. The controlling client is just an HTTP/WebSocket client.

Work stops or becomes inaccessible when the remote side:

- Sleeps or powers off
- Loses network access
- Terminates `t3 serve`
- Restarts for an update
- Reboots without automatic startup
- Has its provider process killed or reaped

An active turn should not be assumed to survive a remote-server restart. A reported bug shows restarted servers leaving active threads stuck as “Working”; this is different from an ordinary client disconnection. [Server-restart issue](https://github.com/pingdotgg/t3code/issues/4584).

### History after reconnection

Thread messages, activity, agent output, and session metadata are stored on the machine running that environment. The client receives snapshots and replays event sequences after reconnecting.

The default server state is normally under T3’s home/state area, commonly:

```text
~/.t3/userdata
```

This includes T3’s database and related state. Provider-native state may additionally remain in `~/.codex`, `~/.claude`, and equivalent provider directories.

### Desktop/web synchronisation

This is not a single global cloud database:

- Projects and threads live on each environment’s T3 server.
- Connecting two clients to the same environment exposes the same server-side history.
- Saved direct/Tailscale/SSH environment entries are client-local.
- The hosted web client stores its known environment list in browser storage.
- T3 Connect can rediscover environments linked to the same account.
- Unsent drafts and some UI/runtime selections remain local and do not fully synchronise.

The same thread can be opened on two clients. There is no documented collaborative-editor lock or conflict protocol, so I would treat a live agent thread as single-writer: view it from several devices, but avoid sending competing instructions simultaneously.

## 5. Sidebar and inbox across machines

The new sidebar supports:

- Active, snoozed, and settled threads
- Pins
- Conversation-content search
- Project filtering
- Auto-settle behaviour related to PR state and inactivity
- A merged view of saved environments

Pinned and thread lifecycle state is stored by the relevant server, so it appears on other clients connected to that environment. The client can aggregate multiple connected environments into one sidebar. See the [thread-sidebar documentation](https://github.com/pingdotgg/t3code/blob/main/docs/user/thread-sidebar.md).

Limitations:

- This is aggregation of several servers, not universal account-level thread storage.
- Direct environments must be paired or saved on each controlling device.
- Machine identification in Sidebar V2 is incomplete. An open issue reports remote projects lacking a clear environment indicator and being unable to create some remote threads directly from the sidebar. [Multi-environment sidebar issue](https://github.com/pingdotgg/t3code/issues/5475).
- Search supports conversation content and project filtering, but I found no mature machine-centric grouping/filter dashboard.
- PR auto-settle can mis-associate sequential PRs because association is branch-derived. [PR auto-settle issue](https://github.com/pingdotgg/t3code/issues/5717).
- Notifications exist for completion, errors, and requests for input, but complex subagent workflows have produced false completion notifications. [Notification issue](https://github.com/pingdotgg/t3code/issues/5518). There is no strong documented guarantee of server-side push delivery while every controller is offline.

## 6. Authentication and security

T3 uses one-time pairing credentials that are exchanged for authenticated sessions. Access can be inspected and revoked with:

```sh
npx t3@latest auth --help
```

The authorization model contains scopes including:

- `orchestration:read`
- `orchestration:operate`
- `terminal:operate`
- `review:write`
- `access:read`
- `relay:read`

Long-lived HTTP credentials obtain short-lived WebSocket tickets so the principal bearer credential does not need to appear in the socket URL. The documented default WebSocket ticket lifetime is five minutes. Relay credentials use DPoP key binding. [Environment-authentication model](https://github.com/pingdotgg/t3code/blob/main/docs/internals/environment-auth.md).

### Encryption

- Direct LAN: authenticated but plain HTTP/WebSocket unless you add TLS.
- Direct Tailscale: WireGuard-encrypted.
- Tailscale Serve: WireGuard plus HTTPS/WSS.
- SSH: encrypted through SSH.
- T3 Connect: HTTPS/WSS through Cloudflare Tunnel.

T3 Connect is transport-encrypted, but I found no claim that it is provider-blind end-to-end encryption in which Cloudflare/T3 infrastructure is cryptographically unable to observe traffic. Do not treat it as such.

### Credential storage

- Provider credentials are stored by each provider CLI on the agent-hosting computer.
- T3 server sessions and environment identity live in the server’s state directory.
- Browser authentication uses session cookies and local client connection metadata.
- T3 Connect CLI stores an OAuth public-client credential; it uses PKCE and contains no OAuth client secret.
- T3 documents encrypted Clerk-token persistence in the Electron application.
- The official user documentation does not promise a stable pathname or OS-keychain protection scheme for every CLI/session credential, so those details should be considered implementation-specific.

### Account-compromise impact

A compromised T3 Connect account is high impact.

An attacker controlling the account could potentially obtain access to its linked, online environments. Normal environment credentials include orchestration and terminal-operation rights. That can amount to shell access as the operating-system user running T3, plus access to source code and whatever credentials that user’s agent processes can reach.

DPoP protects against replay of a merely stolen relay token, but it does not protect against an attacker who has taken over the account and can legitimately mint new credentials.

Recommended controls:

- Use strong MFA on the T3/Clerk account.
- Prefer Tailscale ACLs and direct pairing for sensitive machines.
- Run T3 as a dedicated, unprivileged OS user.
- Keep provider and deployment secrets out of broadly inherited environments.
- Revoke unused sessions and pairing links.
- Never expose TCP 3773 directly to the public internet.

## 7. Supported operating systems

| Platform                      | Status                                                                    | Main limitations                                                  |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| macOS Intel and Apple Silicon | Official desktop and CLI support; v0.0.32 includes x64 and arm64 packages | No official headless boot service                                 |
| Windows                       | Official desktop and Node CLI support                                     | No official Windows background service; some Connect and WSL bugs |
| Linux                         | CLI/server; desktop packaging varies                                      | Best remote-host option; official systemd service                 |
| WSL                           | Usable in principle                                                       | Current packaged WSL backend has boot/path and preview issues     |
| iOS/iPadOS                    | Released controller app                                                   | iOS/iPadOS 18+                                                    |
| Android                       | Released controller app                                                   | New and still receiving connection/auth fixes                     |

The current macOS release includes an Intel `x64.dmg`, so an Intel Mac is covered by the release artifacts. Exact minimum macOS-version compatibility is not clearly published. [Release assets](https://github.com/pingdotgg/t3code/releases).

Mobile is no longer merely planned:

- [T3 Code for iPhone/iPad](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824)
- [T3 Code for Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code)

Some repository mobile documentation still says the app is not distributed; that page is stale.

### Native Windows versus WSL

Use native Windows first.

Native Windows is supported and avoids an open WSL backend problem involving slow startup and resources loaded through `/mnt/c`. [WSL backend issue](https://github.com/pingdotgg/t3code/issues/4535).

Choose WSL only if the project and provider toolchain genuinely need Linux. If so:

- Keep repositories inside WSL’s Linux filesystem, such as `~/src`, not `/mnt/c`.
- Expect preview URL, loopback, certificate, CORS, and cookie problems when crossing Windows/WSL boundaries. [WSL preview issue](https://github.com/pingdotgg/t3code/issues/3938).
- Do not assume T3’s official Linux systemd service will work in every WSL configuration.

## 8. Exact installation and Windows-to-Mac setup

### MacBook controller

```sh
brew install --cask t3-code
```

Install Tailscale and sign the Mac into the same tailnet as Windows.

No provider CLI is required on the Mac unless you also want to run agents locally.

### Windows agent host

Install Node satisfying:

```text
^22.16 || ^23.11 || >=24.10
```

Install T3 desktop if desired:

```powershell
winget install T3Tools.T3Code
```

Install and authenticate every provider on Windows. The exact auth commands currently documented by T3 are:

```text
codex login
claude auth login
agent login
grok login
opencode auth login
```

For Cursor, T3 looks for the `cursor-agent` binary, but the documented login command is `agent login`. Provider authentication must happen on Windows, not on the Mac. [Installation and provider requirements](https://github.com/pingdotgg/t3code/blob/main/docs/user/install.md).

### Recommended private Tailscale connection

On Windows PowerShell:

```powershell
$t3TailnetIp = tailscale ip -4
npx t3@latest serve --host $t3TailnetIp
```

T3 prints a pairing URL/token. On the Mac:

1. Open T3 Code.
2. Open Settings → Connections.
3. Add an environment.
4. Paste the pairing URL, or enter the tailnet host and token.
5. Add the Windows project from the command palette.

If Windows Firewall blocks access, allow inbound TCP 3773 only from the Tailscale interface/tailnet. Do not create an unrestricted public firewall rule.

For web-browser access:

```powershell
npx t3@latest serve --tailscale-serve
```

Then pair [app.t3.codes](https://app.t3.codes) using the advertised HTTPS address.

### T3 Connect alternative

On Windows:

```powershell
npx t3@latest connect link
npx t3@latest serve
```

Sign into the same T3 account on the Mac/web/mobile client and select the linked environment.

There are current open reports of Connect provisioning failures and what appears to be an undocumented three-environment account cap. Treat those as observed bugs, not guaranteed policy. [Provisioning failure](https://github.com/pingdotgg/t3code/issues/5612), [reported environment cap](https://github.com/pingdotgg/t3code/issues/5729).

## 9. Automatic startup and network changes

### Linux: officially supported

```sh
npx t3@latest service install
npx t3@latest service status
npx t3@latest service update
npx t3@latest service uninstall
```

The service starts at boot and remains after logout. This currently requires systemd. [Official background-service guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/background-service.md).

### Windows: no official service yet

A practical workaround is Windows Task Scheduler:

1. Run `where.exe npx` and note the full `npx.cmd` path.
2. Create a task for the same Windows user that owns the provider credentials.
3. Trigger: at startup or user logon.
4. Program: the discovered `npx.cmd`.
5. Arguments: `t3@latest serve`.
6. Enable restart-on-failure.
7. Configure Windows not to sleep while unattended.

This is a workaround, not an official T3-managed service. Test it after a real reboot before relying on overnight work.

### macOS

The desktop app can be added to System Settings → General → Login Items. There is no official `launchd`-managed T3 headless service. Quitting the app/server ends local Mac-hosted agents.

### After changing networks

- Tailscale MagicDNS addresses normally remain stable; reconnect should happen automatically once both machines regain tailnet connectivity.
- T3 Connect’s tunnel hostname is intended to remain stable across network changes and NAT.
- A saved numeric LAN address may need to be updated if DHCP assigns a new address.
- Existing pairing sessions generally remain valid; changing the route does not itself require re-authentication.
- If the server restarted, ensure the service/task actually relaunched it.
- Finish active work before server updates, because updates briefly restart the server.

## 10. Worktrees, parallel agents, and previews

| Capability                            | Current assessment                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Create Git worktrees                  | Yes, built into new-thread workflows                                                               |
| Separate branches/directories         | Yes, each thread can carry a branch and worktree path                                              |
| Parallel agents in separate worktrees | Yes, conceptually supported                                                                        |
| Several agents in one thread          | Not a mature supported model                                                                       |
| Run setup/dev commands                | Project actions and worktree setup scripts can run commands                                        |
| Automatically start every dev server  | No universal automatic orchestration                                                               |
| Detect ports                          | Desktop has local-server/port-scanning support, but not a reliable cross-machine process inventory |
| Proxy arbitrary remote preview ports  | No general T3 Connect reverse proxy                                                                |
| HTTPS/WebSocket previews              | Work if the browser can directly reach the URL and certificates/origins permit                     |
| Tailscale previews                    | Yes, when the dev server is bound to a reachable tailnet interface and its port is allowed         |
| Port collision prevention             | Not guaranteed; the underlying command/app must select a unique port                               |
| Exclude every browser-blocked port    | Not verified in public code/docs                                                                   |
| Automatic process cleanup             | Not guaranteed for arbitrary child/grandchild processes                                            |
| Worktree/process/port dashboard       | No mature unified dashboard found                                                                  |
| Stop an individual process            | Terminal or session controls can stop it, but child-process cleanup is not guaranteed              |

T3 supports project actions with a command and preview URL. The schema says preview URLs are desktop-only. A current bug reports that “open preview automatically” is saved but has no active runtime consumer, requiring the user to open the preview manually. [Preview action bug](https://github.com/pingdotgg/t3code/issues/5221).

T3 Connect tunnels the T3 server endpoint, not arbitrary Vite, Next.js, or other development ports. To preview a server running on Windows or Linux from the Mac, expose that development server on its Tailscale address or another private reachable interface, then open its URL directly.

I could not verify a product-level guarantee that T3’s port allocator excludes the complete Chromium blocked-port list. Theo’s anecdote may concern internal preview tooling or a specific recently patched selection path; it should not be treated as a general user-facing guarantee.

Worktree handling also has active reports of threads reusing an existing worktree, creating in the wrong checkout, or failing when a generated worktree already exists. [Worktree reuse issue](https://github.com/pingdotgg/t3code/issues/4356), [wrong-checkout issue](https://github.com/pingdotgg/t3code/issues/2179), [worktree-exists issue](https://github.com/pingdotgg/t3code/issues/5721).

Abandoned agent, server, or development processes can remain running. There is also an open report of orphaned `t3 serve` processes after reconnection. [Orphan-server issue](https://github.com/pingdotgg/t3code/issues/2614).

## Final recommendation

Your proposed arrangement is possible:

- MacBook as the main T3 interface
- Native Windows as an agent host
- Additional Mac or Linux environments
- One aggregated interface
- Continued Windows/Linux work while the Mac is closed
- Later access from desktop, web, iOS, or Android
- Private communication over Tailscale

For regular use, I would deploy it this way:

1. Use native Windows rather than WSL initially.
2. Use direct Tailscale connections as the primary transport.
3. Use T3 Connect only as a secondary convenience path.
4. Keep Windows awake and use Task Scheduler until official service support lands.
5. Put future always-on workloads on Linux with the official systemd service.
6. Keep each parallel agent in a separate Git worktree.
7. Assign dev-server ports explicitly and expose them directly over Tailscale.
8. Do not rely yet on auto-preview, auto-settle, process cleanup, or overnight notifications without checking the results.
9. Maintain a direct SSH/Tailscale fallback in case T3 Connect fails.

That makes T3 Code useful today as a promising beta control surface. It does not yet merit being treated as a fully reliable, security-hardened, multi-machine agent operations platform.
