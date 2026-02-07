#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
NAME="zen"
LOCATION="nbg1"
TYPE="cax11"
IMAGE="ubuntu-24.04"
SSH_KEY="helix"
FIREWALL="ts-only"

echo "Creating server ${NAME}..."
hcloud server create \
  --name "$NAME" \
  --location "$LOCATION" \
  --type "$TYPE" \
  --image "$IMAGE" \
  --ssh-key "$SSH_KEY" \
  --user-data-from-file "${SCRIPT_DIR}/cloud-init.yaml"

IP=$(hcloud server ip "$NAME")
echo "Server ${NAME} created at ${IP}"

echo "Waiting for cloud-init to finish..."
until ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "david@${IP}" "cloud-init status" 2>/dev/null | grep -q "done"; do
  sleep 10
done
echo "Cloud-init done."

echo ""
echo "SSH into the server and run: sudo tailscale up"
echo "  ssh david@${IP}"
echo ""
read -r -p "Press Enter once Tailscale is set up on ${NAME}..."

TS_IP=$(ssh "david@${IP}" "tailscale ip -4")
echo "Tailscale IP: ${TS_IP}"

echo "Creating firewall ${FIREWALL}..."
hcloud firewall create --name "$FIREWALL" 2>/dev/null || true
hcloud firewall add-rule --direction in --protocol udp --port 41641 --source-ips 0.0.0.0/0 --source-ips ::/0 "$FIREWALL" 2>/dev/null || true
hcloud firewall add-rule --direction in --protocol tcp --port 22 --source-ips 100.64.0.0/10 "$FIREWALL" 2>/dev/null || true
hcloud firewall apply-to-resource --type server --server "$NAME" "$FIREWALL"
echo "Firewall ${FIREWALL} applied."

echo ""
echo "Verifying Tailscale SSH..."
ssh -o ConnectTimeout=5 "david@${TS_IP}" "hostname"
echo ""
echo "Done. Connect with: ssh david@${TS_IP}"
