#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECOSYSTEM_FILE="${ROOT_DIR}/ecosystem.config.cjs"

for command_name in node npm pm2; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Ошибка: команда '${command_name}' не установлена." >&2
    exit 1
  fi
done

required_env_files=(
  "${ROOT_DIR}/ratinglist_backend/.env"
  "${ROOT_DIR}/ratinglist_frontend/.env.production"
  "${ROOT_DIR}/ratinglist_panel/.env.production"
)

for env_file in "${required_env_files[@]}"; do
  if [[ ! -f "${env_file}" ]]; then
    echo "Ошибка: отсутствует ${env_file}" >&2
    echo "Создайте его из соответствующего файла *.example и заполните значения." >&2
    exit 1
  fi
done

install_and_build() {
  local app_dir="$1"
  echo "==> Установка зависимостей: ${app_dir}"
  npm --prefix "${ROOT_DIR}/${app_dir}" ci

  echo "==> Production-сборка: ${app_dir}"
  npm --prefix "${ROOT_DIR}/${app_dir}" run build
}

install_and_build "ratinglist_backend"
install_and_build "ratinglist_frontend"
install_and_build "ratinglist_panel"

if [[ "${SKIP_MIGRATIONS:-0}" != "1" ]]; then
  echo "==> Миграции PostgreSQL"
  NODE_ENV=production npm --prefix "${ROOT_DIR}/ratinglist_backend" run db:run:prod
else
  echo "==> Миграции пропущены (SKIP_MIGRATIONS=1)"
fi

echo "==> Запуск/перезагрузка PM2"
pm2 startOrReload "${ECOSYSTEM_FILE}" --update-env
pm2 save

echo
echo "Готово. Состояние процессов:"
pm2 status
