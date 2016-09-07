const env = process.env;

module.exports = {
  app: {
    name: 'svc-agent-reader',
    version: env.VI_VERSION || console.log('WARN: env.VI_VERSION not set unknown'),
    simulator: {
      uuid: '000',
      machinePort: 7879,
      filePort: 8080,
      maxDelay: 3000,
      inputFile: "./public/vmc_10di.txt"
    },
    agent: {
      pingInterval: env.VI_PING_INTERVAL || 1000,
      deviceSearchInterval: 10000,
      agentPort: 7000,
      bufferSize: 10,
      checkPointIndex: 1000,
      path: '/vmc_10di.xml',
    },
  },
  logging: {
    logLevel: env.VI_LOG_LEVEL || 'warn',
    logDir: env.VI_LOG_DIR,
  },
};
