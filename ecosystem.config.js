module.exports = {
  apps: [
    {
      name: 'agro_connect_server',
      script: './dist/main.js',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
