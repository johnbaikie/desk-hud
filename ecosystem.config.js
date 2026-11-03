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
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
