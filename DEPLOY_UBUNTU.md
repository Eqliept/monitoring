# Развёртывание на Ubuntu с PM2

Проект запускается тремя процессами:

- `ratinglist-api` — Fastify API на `127.0.0.1:3000`;
- `ratinglist-web` — Next.js на `127.0.0.1:3001`;
- `ratinglist-panel` — собранная Vite-админка на `127.0.0.1:3002`.

Снаружи приложения публикуются через Nginx. Примеры ниже рассчитаны на Ubuntu 22.04/24.04 и три домена: `example.com`, `api.example.com`, `admin.example.com`.

## 1. Установка системных компонентов

```bash
sudo apt update
sudo apt install -y curl nginx postgresql redis-server

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

node --version
npm --version
pm2 --version
```

## 2. Копирование проекта и настройка окружения

```bash
sudo mkdir -p /var/www/ratinglist
sudo chown -R "$USER":"$USER" /var/www/ratinglist
cd /var/www/ratinglist
```

Скопируйте или клонируйте сюда содержимое проекта. Затем создайте env-файлы:

```bash
cp ratinglist_backend/.env.example ratinglist_backend/.env
cp ratinglist_frontend/.env.production.example ratinglist_frontend/.env.production
cp ratinglist_panel/.env.production.example ratinglist_panel/.env.production

nano ratinglist_backend/.env
nano ratinglist_frontend/.env.production
nano ratinglist_panel/.env.production
```

Замените `example.com` на реальные домены. Публичные переменные `NEXT_PUBLIC_*` и `VITE_*` встраиваются во фронтенд во время сборки, поэтому после их изменения нужно снова запустить deploy-скрипт.

Секреты можно сгенерировать командой:

```bash
openssl rand -hex 32
```

## 3. PostgreSQL

Пример создания базы и пользователя:

```bash
sudo -u postgres psql
```

```sql
CREATE USER ratinglist WITH ENCRYPTED PASSWORD 'СЛОЖНЫЙ_ПАРОЛЬ';
CREATE DATABASE ratinglist OWNER ratinglist;
\q
```

Укажите эти данные в `ratinglist_backend/.env`. Redis по умолчанию доступен по адресу `redis://127.0.0.1:6379`.

## 4. Первый запуск и последующие обновления

```bash
cd /var/www/ratinglist
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Скрипт выполняет `npm ci`, собирает три приложения, применяет TypeORM-миграции и запускает либо мягко перезагружает процессы PM2.

Если миграции нужно временно пропустить:

```bash
SKIP_MIGRATIONS=1 ./deploy/deploy.sh
```

Полезные команды:

```bash
pm2 status
pm2 logs
pm2 logs ratinglist-api
pm2 restart ratinglist-api
curl http://127.0.0.1:3000/health
```

## 5. Автозапуск PM2 после перезагрузки

```bash
pm2 startup
```

PM2 выведет команду с `sudo` — скопируйте и выполните её, затем:

```bash
pm2 save
```

PM2 должен запускаться от обычного пользователя проекта, не от `root`.

## 6. Nginx

Откройте `deploy/nginx-ratinglist.conf`, замените все `example.com` на свои домены, затем:

```bash
sudo cp deploy/nginx-ratinglist.conf /etc/nginx/sites-available/ratinglist
sudo ln -s /etc/nginx/sites-available/ratinglist /etc/nginx/sites-enabled/ratinglist
sudo nginx -t
sudo systemctl reload nginx
```

После настройки DNS добавьте HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d example.com \
  -d www.example.com \
  -d api.example.com \
  -d admin.example.com
```

Разрешите в firewall только SSH и Nginx. Порты `3000–3002`, PostgreSQL и Redis наружу открывать не нужно:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Обновление проекта

После загрузки новой версии:

```bash
cd /var/www/ratinglist
git pull
./deploy/deploy.sh
```

Если три каталога хранятся в отдельных Git-репозиториях, выполните `git pull` в каждом из них, затем запустите общий deploy-скрипт.
