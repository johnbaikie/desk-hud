require('dotenv').config()

module.exports = {
  apps: [
    {
      name: "desk-hud",
      script: "src/backend/index.js",
      watch: ".",
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
      host: "deskhud.local",
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
