require('dotenv').config()

module.exports = {
  apps: [
    {
      name: "desk-hud",
      script: "src/backend/index.js",
      // restart on backend code changes only; watching "." also caught the
      // services' own data files (.node-persist), restarting every 20 minutes
      watch: ["src/backend", "src/widgets"],
      ignore_watch: ["node_modules", ".node-persist", "src/backend/www"],
      env: {
        DHUD_ENV: "development",
      },
      env_production: {
        DHUD_ENV: "production",
      },
    },
  ],

  deploy: {
    production: {
      user: "deskhud",
      host: "10.168.168.159", // DHCP-reserved; deskhud.local (mDNS) does not resolve on this network
      ref: "origin/main",
      repo: "https://github.com/johnbaikie/desk-hud.git",
      path: "/var/www",
      "pre-deploy-local": "",
      // no build here: the compiled frontend (src/backend/www/js/app.js) is
      // committed, and running npm install + webpack on the 2 GB Pi next to
      // Chromium coincided with freezes and watchdog reboots. Only runtime
      // dependencies are installed, at low priority.
      "post-deploy":
        "nice -n 19 npm install --omit=dev --no-audit --no-fund && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
