# Claude network confirmation prompt: Tailscale, Twingate, and Proxmox

You are Claude Code running on the operator's laptop. Your current task is local-networking setup and diagnosis, not Scena product implementation and not an instruction for Codex to execute infrastructure changes.

## Network context

- Proxmox host: `192.168.1.200`
- This Codex workstation: `192.168.1.65`
- Operator laptop running Claude: `192.168.1.64`
- Tailscale and Twingate are both present.
- Existing guests, containers, bridges, disks, and Proxmox host networking are out of scope.
- Proxmox management port `8006` must not be opened publicly or changed.

## Objective

Safely validate how the laptop and Codex workstation reach approved internal resources through Tailscale, Twingate, or LAN. Identify the active route for each destination and the controlling ACL or firewall policy.

The previously observed Codex path to PVE used the Twingate interface rather than a normal Wi-Fi route. Re-verify this; do not broaden access based on that observation.

## Safety rules

- Diagnostic-only unless the operator explicitly approves a specific configuration change.
- Do not change Tailscale ACLs, Twingate resources, Proxmox firewall rules, Windows firewall rules, routes, DNS, or host networking without showing the exact proposed change first.
- Do not grant broad home-LAN root/sudo access to a container.
- Do not expose Proxmox `8006` to the internet.
- Do not print credentials, keys, or tokens.

## Required checks

Show the command and result for:

1. Local IPv4 addresses and interface names for Wi-Fi, Tailscale, and Twingate.
2. Route selection to `192.168.1.200` from the laptop.
3. TCP reachability to `192.168.1.200:8006`.
4. Tailscale status and advertised routes without exposing auth keys.
5. Twingate connector/resource path and policy through the authenticated admin surface.
6. Whether the active path is LAN, Tailscale, or Twingate.
7. PVE listener response and certificate behavior without changing PVE.

## Storage boundary

Scena may later use a dedicated VM/LXC on Proxmox for private PowerPoint storage. That service must remain separate from PVE management. Authenticated Scena users upload through backend-issued signed URLs. Home-network reachability must not equal storage-admin or container-root access.

If `scena-storage-proposal.md` is missing, report that fact and stop. Do not invent infrastructure commands.

## Required confirmation report

Report the active route, the controlling Tailscale/Twingate resource or ACL, the PVE listener result, and any remaining information needed from the operator. Do not claim a firewall rule is responsible unless the rule was actually inspected.
