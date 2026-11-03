#!/usr/bin/env bash
# Starts a throwaway Home Assistant at http://localhost:18123/ with dist/ served as /local/ and
# a dashboard of example cards (lovelace.json), and finishes its onboarding so the page opens
# straight to the dashboard. Its config lives in a scratch folder (first argument, or
# ./.ha-dev), so a run never touches a real Home Assistant. `docker rm -f livex-card-ha` ends it.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
# Git Bash on Windows rewrites `-v a:b` into nonsense; give Docker Windows paths unconverted.
if pwd -W >/dev/null 2>&1; then
  export MSYS_NO_PATHCONV=1
  repo=$(cd "$repo" && pwd -W)
fi
config=${1:-$repo/.ha-dev}
port=18123
image=ghcr.io/home-assistant/home-assistant:stable
origin=http://localhost:$port

mkdir -p "$config/.storage"
cp "$here/configuration.yaml" "$config/configuration.yaml"
cp "$here/lovelace.json" "$config/.storage/lovelace"
docker rm -f livex-card-ha >/dev/null 2>&1 || true
docker run -d --name livex-card-ha -p $port:8123 \
  -v "$config:/config" -v "$repo/dist:/config/www:ro" "$image" >/dev/null

until curl -sf "$origin/manifest.json" >/dev/null; do sleep 2; done
# Once onboarding is done (a second run over the same folder), this answers 404.
if curl -s "$origin/api/onboarding" | grep -q '"step":"user","done":false'; then
  # The owner every Home Assistant needs; the trusted network signs in as it, so its password
  # is random and kept only in the scratch folder.
  password=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
  printf '%s\n' "$password" > "$config/.dev-password"
  code=$(curl -sf -X POST "$origin/api/onboarding/users" -H 'Content-Type: application/json' \
    -d "{\"client_id\":\"$origin/\",\"name\":\"Dev\",\"username\":\"dev\",\"password\":\"$password\",\"language\":\"en\"}" |
    sed -E 's/.*"auth_code":"([^"]+)".*/\1/')
  token=$(curl -sf -X POST "$origin/auth/token" -d "grant_type=authorization_code&code=$code&client_id=$origin/" |
    sed -E 's/.*"access_token":"([^"]+)".*/\1/')
  auth="Authorization: Bearer $token"
  curl -sf -X POST "$origin/api/onboarding/core_config" -H "$auth" >/dev/null
  curl -sf -X POST "$origin/api/onboarding/analytics" -H "$auth" >/dev/null
  curl -sf -X POST "$origin/api/onboarding/integration" -H "$auth" -H 'Content-Type: application/json' \
    -d "{\"client_id\":\"$origin/\",\"redirect_uri\":\"$origin/?auth_callback=1\"}" >/dev/null
fi
echo "$origin/lovelace/masonry"
