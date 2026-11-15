#!/usr/bin/env bash
# Run in a trusted terminal; never put the password in command arguments or files.
set +x
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
owner_password=''
owner_confirm=''
trap 'unset owner_password owner_confirm' EXIT
trap 'printf "\nСоздание отменено.\n" >&2; exit 130' INT

node --input-type=module <<'JS'
import {openStore} from './server/store.mjs';
const db = openStore();
const exists = Boolean(db.prepare('SELECT id FROM owner').get());
db.close();
if (exists) {
  console.error('Владелец уже создан. Используйте свой пароль для входа; эта команда его не заменяет.');
  process.exit(1);
}
JS

printf 'Создание единственного владельца CMS. Email и логин не требуются.\n'
printf 'Сохраните новый пароль в своём менеджере паролей.\n'
read -r -s -p 'Новый пароль (14–256 символов): ' owner_password
printf '\n'
read -r -s -p 'Повторите пароль: ' owner_confirm
printf '\n'
if [[ "$owner_password" != "$owner_confirm" ]]; then
  printf 'Пароли не совпадают. Владелец не создан; запустите команду заново.\n' >&2
  exit 1
fi
CMS_OWNER_PASSWORD="$owner_password" npm run admin:create
printf 'Готово. Откройте административную панель и введите выбранный пароль.\n'
