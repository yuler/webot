#!/usr/bin/env bash
# ==============================================================================
# WeBot 本地紧急部署（Actions 排队卡住时用）
#
# 对齐 .github/workflows/deploy.yml：
#   1. 构建 linux/amd64 镜像
#   2. 推送到 ghcr.io/yuler/webot:{main,sha-<short>}
#   3. 调用 Dokploy application.deploy 拉起新镜像
#
# 用法:
#   bun run deploy
#   bash scripts/deploy.sh
#   bash scripts/deploy.sh --ref HEAD          # 部署当前检出，而不是 origin/main
#   bash scripts/deploy.sh --redeploy-only     # 只触发 Dokploy（镜像已推过）
#
# 需要:
#   - docker + buildx
#   - .env 里 DOKPLOY_URL / DOKPLOY_API_KEY / DOKPLOY_APPLICATION_ID
#   - 推镜像用的 token（write:packages）：GHCR_TOKEN 或 GITHUB_TOKEN，
#     或已 login 的 docker；gh auth token 若缺 packages 权限会失败
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE="${IMAGE:-ghcr.io/yuler/webot}"
PLATFORM="${PLATFORM:-linux/amd64}"
REF="origin/main"
REDEPLOY_ONLY=0
SKIP_LOGIN=0

info()  { printf '\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m⚠\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REF="${2:-}"
      [[ -n "$REF" ]] || error "--ref 需要一个 git ref"
      shift 2
      ;;
    --redeploy-only)
      REDEPLOY_ONLY=1
      shift
      ;;
    --skip-login)
      SKIP_LOGIN=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      error "未知参数: $1（见 --help）"
      ;;
  esac
done

load_dotenv() {
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  # 不覆盖已经 export 过的变量
  local key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#\'}"
    val="${val%\'}"
    val="${val#\"}"
    val="${val%\"}"
    # 已有非空值不覆盖；空字符串视为未设置（便于修本地误 export）
    if [[ -n "$key" && -z "${!key:-}" ]]; then
      export "${key}=${val}"
    fi
  done < "$env_file"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || error "缺少命令: $1"
}

ghcr_token() {
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    printf '%s' "$GHCR_TOKEN"
    return
  fi
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    printf '%s' "$GITHUB_TOKEN"
    return
  fi
  if command -v gh >/dev/null 2>&1; then
    gh auth token 2>/dev/null || true
  fi
}

docker_login_ghcr() {
  [[ "$SKIP_LOGIN" -eq 1 ]] && return 0
  local token
  token="$(ghcr_token)"
  [[ -n "$token" ]] || error "没有可用的 GHCR token。请在 .env 设置 GHCR_TOKEN（或 GITHUB_TOKEN），需含 write:packages"
  info "登录 ghcr.io…"
  printf '%s' "$token" | docker login ghcr.io -u "${GHCR_USER:-yuler}" --password-stdin >/dev/null
  ok "ghcr.io 已登录"
}

build_and_push() {
  require_cmd docker
  docker buildx version >/dev/null 2>&1 || error "需要 docker buildx"

  info "fetch $REF…"
  if [[ "$REF" == origin/* ]]; then
    git fetch origin "${REF#origin/}" --quiet
  fi

  local sha short time
  sha="$(git rev-parse "$REF")"
  short="$(git rev-parse --short=7 "$REF")"
  time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  info "构建并推送 ${IMAGE}:main + ${IMAGE}:sha-${short}"
  info "  GIT_SHA=${sha}"
  info "  BUILD_TIME=${time}"
  info "  PLATFORM=${PLATFORM}"

  docker buildx build \
    --platform "$PLATFORM" \
    --provenance=false \
    --sbom=false \
    --build-arg "GIT_SHA=${sha}" \
    --build-arg "BUILD_TIME=${time}" \
    -t "${IMAGE}:main" \
    -t "${IMAGE}:sha-${short}" \
    --push \
    "$ROOT_DIR"

  ok "镜像已推送: ${IMAGE}:main / ${IMAGE}:sha-${short}"
}

dokploy_deploy() {
  local url key app_id
  url="${DOKPLOY_URL:-}"
  key="${DOKPLOY_API_KEY:-}"
  app_id="${DOKPLOY_APPLICATION_ID:-}"

  [[ -n "$url" ]] || error "缺少 DOKPLOY_URL（写在 .env）"
  [[ -n "$key" ]] || error "缺少 DOKPLOY_API_KEY（写在 .env）"
  [[ -n "$app_id" ]] || error "缺少 DOKPLOY_APPLICATION_ID（Dokploy 应用页 URL 里的 id）"

  url="${url%/}"
  info "触发 Dokploy 部署 (applicationId=${app_id})…"

  local code
  code="$(curl -sS -o /tmp/webot-dokploy-deploy.json -w '%{http_code}' \
    -X POST \
    -H "x-api-key: ${key}" \
    -H 'Content-Type: application/json' \
    -d "{\"applicationId\":\"${app_id}\"}" \
    "${url}/api/application.deploy")"

  [[ "$code" == "200" ]] || {
    warn "响应: $(cat /tmp/webot-dokploy-deploy.json 2>/dev/null || true)"
    error "Dokploy deploy 失败 (HTTP ${code})"
  }
  ok "Dokploy 已接受部署请求"

  info "等待应用就绪…"
  local i status
  for i in $(seq 1 36); do
    status="$(curl -sS -H "x-api-key: ${key}" \
      "${url}/api/application.one?applicationId=${app_id}" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("applicationStatus",""))' 2>/dev/null || true)"
    printf '  [%02d] status=%s\n' "$i" "${status:-?}"
    case "$status" in
      done|idle)
        ok "Dokploy 状态: ${status}"
        return 0
        ;;
      error)
        error "Dokploy 部署失败 (status=error)，请到面板查看日志"
        ;;
    esac
    sleep 5
  done
  warn "等待超时；请到 Dokploy 面板确认最终状态"
}

verify_site() {
  local origin="${PUBLIC_ORIGIN:-https://webot.yuler.dev}"
  origin="${origin%/}"
  info "探测 ${origin}/api/health …"
  if curl -skf --max-time 15 "${origin}/api/health" >/dev/null; then
    ok "站点存活: ${origin}"
  else
    warn "健康检查未通过（可能仍在拉镜像）；稍后打开 ${origin}"
  fi
}

main() {
  require_cmd curl
  require_cmd python3
  require_cmd git
  load_dotenv

  if [[ "$REDEPLOY_ONLY" -eq 0 ]]; then
    docker_login_ghcr
    build_and_push
  else
    warn "跳过构建推送，仅 redeploy"
  fi

  dokploy_deploy
  verify_site
  ok "完成。生产: ${PUBLIC_ORIGIN:-https://webot.yuler.dev}/"
}

main
