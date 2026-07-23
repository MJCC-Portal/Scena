#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo --preserve-env=PATH bash "$0" "$@"
fi

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/scena-worker"
ENV_FILE="/etc/scena-worker/worker.env"
SERVICE_FILE="/etc/systemd/system/scena-worker.service"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ "$(hostnamectl --static)" == "scena" ]] || die "Expected the Ubuntu VM hostname scena."
command -v pveversion >/dev/null 2>&1 && die "Run this inside the scena VM, not on the Proxmox host."
id scena >/dev/null 2>&1 || die "The scena service account does not exist."
[[ -r "${ENV_FILE}" ]] || die "${ENV_FILE} is missing or unreadable."

for program in python3 ffmpeg libreoffice pdfinfo pdftoppm; do
  command -v "${program}" >/dev/null 2>&1 || die "Required program is missing: ${program}"
done

install -d -o scena -g scena -m 0750 \
  "${APP_DIR}" \
  /var/lib/scena-worker \
  /var/cache/scena-worker \
  /var/cache/scena-worker/jobs \
  /var/cache/scena-worker/failed \
  /var/log/scena-worker

if [[ ! -x "${APP_DIR}/venv/bin/python" ]]; then
  runuser -u scena -- python3 -m venv "${APP_DIR}/venv"
fi

runuser -u scena -- \
  "${APP_DIR}/venv/bin/python" -m pip install \
  --disable-pip-version-check \
  --upgrade \
  -r "${SOURCE_DIR}/requirements.txt"

rm -rf "${APP_DIR}/scena_worker"
cp -a "${SOURCE_DIR}/scena_worker" "${APP_DIR}/scena_worker"
chown -R scena:scena "${APP_DIR}/scena_worker"
find "${APP_DIR}/scena_worker" -type d -exec chmod 0750 {} +
find "${APP_DIR}/scena_worker" -type f -exec chmod 0640 {} +

install -o root -g root -m 0644 "${SOURCE_DIR}/scena-worker.service" "${SERVICE_FILE}"
systemctl daemon-reload

runuser -u scena -- "${APP_DIR}/venv/bin/python" -m scena_worker check
runuser -u scena -- /bin/bash -c "
  set -a
  source '${ENV_FILE}'
  set +a
  exec '${APP_DIR}/venv/bin/python' -m scena_worker ping
"

systemctl enable --now scena-worker.service
sleep 2
systemctl --no-pager --full status scena-worker.service
