# Scena Media Worker

Outbound-only Python service for the Scena Asset processing queue.

## Supported jobs

- `image_ingest`
- `pdf_import`
- `powerpoint_import`

The worker claims one leased job at a time, downloads the private source through a signed URL, processes it under `/var/cache/scena-worker`, uploads immutable outputs through signed upload URLs, and calls the completion or retry endpoint.

## Install on the `scena` Ubuntu VM

```bash
sudo ./install.sh
```

The installer expects `/etc/scena-worker/worker.env` to already exist with a dedicated worker token. It preserves that file and never prints the token.

## Service operations

```bash
sudo systemctl status scena-worker
sudo journalctl -u scena-worker -f
sudo systemctl restart scena-worker
sudo systemctl stop scena-worker
```

Copy `worker.env.example` to `/etc/scena-worker/worker.env`, replace the placeholder token locally, and keep the resulting file at mode `0640` with owner `root` and group `scena`. Never commit the real token.

The test worker is registered as `scena-media-01`, runs with one-job concurrency, and has been verified to authenticate, poll, and restart automatically after a VM reboot. A real source upload through the new Asset API remains the final end-to-end processing gate.
