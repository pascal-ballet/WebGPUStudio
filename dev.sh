#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

port="${1:-8000}"

if command -v py >/dev/null 2>&1; then
  python_cmd=(py)
elif command -v python3 >/dev/null 2>&1; then
  python_cmd=(python3)
elif command -v python >/dev/null 2>&1; then
  python_cmd=(python)
else
  echo "No Python executable found (py/python3/python)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Please install Node.js/npm." >&2
  exit 1
fi

npm_pid=""
python_pid=""

cleanup() {
  set +e
  if [[ -n "${python_pid}" ]] && kill -0 "${python_pid}" 2>/dev/null; then
    kill "${python_pid}" 2>/dev/null || true
  fi
  if [[ -n "${npm_pid}" ]] && kill -0 "${npm_pid}" 2>/dev/null; then
    kill "${npm_pid}" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

(
  cd "${root_dir}/system-agent"
  npm start
) &
npm_pid=$!

"${python_cmd[@]}" -m http.server "${port}" &
python_pid=$!

wait "${npm_pid}" "${python_pid}"
