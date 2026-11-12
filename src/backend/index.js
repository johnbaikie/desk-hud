require('dotenv').config()
const express = require('express')
const path = require('path')
const livereload = require("livereload");
const connectLiveReload = require("connect-livereload");
const http = require('http');
const { Server } = require("socket.io");
const Config = require('./Config.js');
const storage = require('node-persist');
const DistanceService = require('./services/DistanceService.js');
const SysMonitorService = require('./services/SysMonitorService.js');
const services = require('../widgets/services.js');
const SocketLogger = require('./SocketLogger.js');

(async () => {
  await storage.init()
  
  const app = express()
  const server = http.createServer(app);
  const io = new Server(server);

  const config = new Config(new SocketLogger(io))
  await config.load()

  const port = config.getProp('core.port')
  // The kiosk browser runs on the same machine, so by default nothing else on
  // the network can reach the page, the socket (which takes service commands
  // and streams the backend log) or livereload. Set core.host to "0.0.0.0" to
  // open them to the LAN.
  let host = '127.0.0.1'
  try {
    host = config.getProp('core.host')
  } catch(err) {
    host = '127.0.0.1'
  }
  config.coreLogger.log("Desk HUD started")

  // livereload has no host option: build its server (which also serves
  // livereload.js) without listening, then make it listen on `host`
  const liveReloadServer = livereload.createServer({ noListen: true });
  const liveReloadHttp = liveReloadServer.config.server
  const listenLiveReload = liveReloadHttp.listen.bind(liveReloadHttp)
  liveReloadHttp.listen = (lrPort) => listenLiveReload(lrPort, host)
  liveReloadServer.listen();
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
  
  app.use(connectLiveReload());
  app.use(express.static(path.join(__dirname, 'www')))
  
  const serviceInstances = services.map((Def) => new Def(config, io, app))
  serviceInstances.push(new DistanceService(config, io))
  serviceInstances.push(new SysMonitorService(config, io))
 
  let watchDog
  try{
    const servicesStartingTime  = performance.now()
    watchDog = setInterval(() => {
      const startingDuration = Math.round((performance.now() - servicesStartingTime) / 1000)
      const notStarted = serviceInstances.filter(s => !s.started)
      notStarted.forEach(s => config.coreLogger.warn(`Service ${s.id} did not start after ${startingDuration} seconds`))

    }, 5000)

    await Promise.all(serviceInstances.map(s => new Promise(async (resolve, reject) => {
      try {
        await s.start()
        s.started = true
        resolve()
      } catch(err) {
        reject(err)
      }
    }
    )))
  } catch(err) {
    config.coreLogger.error('Unable to start services')
    config.coreLogger.error(err)
  } finally {
    if(watchDog) clearInterval(watchDog)
  }
  io.on('connection', async (socket) => {

    const logHistory = config.coreLogger.getHistory()
    config.coreLogger.emit(logHistory)

    config.coreLogger.log("Client connected")
    // the TIME screen marks home on its world map (weather location; optional)
    let location = null
    try {
      location = { lat: Number(config.getProp('weather.lat')), lon: Number(config.getProp('weather.lon')) }
    } catch(err) {
      location = null
    }
    await socket.emit('config', {
      widgets: {
        dateTime: { ...config.getProp('dateTime'), location },
      }
    })
    await Promise.all(serviceInstances.map(s => s.welcomeClient(socket)))
    socket.on('service', async ({serviceId, payload}) => {
      const service = serviceInstances.find(s => s.id === serviceId)
      if(service) {
        await service.onMessage(payload)
      }
    })
  });
  
  server.listen(port, host, () => {
    config.coreLogger.log(`app listening on ${host}:${port}`)
  })
  
})()
