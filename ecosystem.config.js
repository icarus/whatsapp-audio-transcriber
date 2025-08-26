module.exports = {
  apps: [{
    name: 'whatsapp-transcriber',
    script: 'main.js',
    watch: false,
    autorestart: true,
    max_memory_restart: '1G',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_file: './logs/combined.log',
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production'
    }
  }]
};