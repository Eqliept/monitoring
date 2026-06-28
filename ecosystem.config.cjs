const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "ratinglist-api",
      cwd: path.join(root, "ratinglist_backend"),
      script: "dist/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "750M",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3000,
      },
    },
    {
      name: "ratinglist-web",
      cwd: path.join(root, "ratinglist_frontend"),
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: 3001,
      },
    },
    {
      name: "ratinglist-panel",
      cwd: path.join(root, "ratinglist_panel"),
      script: "serve",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "250M",
      env: {
        PM2_SERVE_PATH: "dist",
        PM2_SERVE_PORT: 3002,
        PM2_SERVE_SPA: "true",
      },
    },
  ],
};
