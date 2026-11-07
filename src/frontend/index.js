import WidgetContainer from "./WidgetContainer.js";
import FontFaceObserver from 'fontfaceobserver'
import DemoSocket from "./demo/DemoSocket.js";
import widgets from "../widgets/widgets.js";
import { useWidgetAccent, useBaseAccent } from "./theme.js";

const getDemoMode = () => {
  if(typeof(BUILD_DEMO_MODE) !== 'undefined' && (BUILD_DEMO_MODE === 'true' || BUILD_DEMO_MODE === true)) {
    return true
  } else {
    return (window.location.hash === '#demo');
  }
}

const DEMO_MODE = getDemoMode()
const LOG_PREFIX = '[core]';
if(DEMO_MODE) {
  console.log(LOG_PREFIX, "DEMO MODE is turned on")
}

(async () => {
  async function loadFont(name) {
    var font = new FontFaceObserver(name)
    await font.load()
    console.log(LOG_PREFIX, `Font "${name}" has been loaded`)
  }

  console.groupCollapsed(`${LOG_PREFIX} Loading fonts....`)
  await loadFont('weathericons-regular-webfont')
  await loadFont('ShareTechMono')
  await loadFont('Material Symbols Outlined')
  console.groupEnd()

  const socket = DEMO_MODE ? new DemoSocket() : io()
  
  const app = new PIXI.Application({
      width: 1480,
      height: 320,
      antialias: true,
      useContextAlpha: false
  })
  document.body.appendChild(app.view)
  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR;
  document.getElementById('loading').style.display = 'none'

  // possibility to clone containers to increase load for perf tests
  const widgetContainers = Array(1).fill(1).map(_ => new WidgetContainer())
  for(let widgetContainer of widgetContainers) {
    if(DEMO_MODE) {
      widgetContainer.infoMessage.emptyText = '[Demo Mode]'
    }
    
    app.stage.addChild(widgetContainer)
    
    // in rainbow mode each widget is built with its own accent colour
    const widgetsInstances = widgets.map((Def, i) => {
      useWidgetAccent(i)
      return new Def()
    })
    useBaseAccent()
    
    widgetsInstances.forEach((w) => {
      widgetContainer.addWidget(w)
      w.on('service', (msg) => {
        socket.emit('service', msg)
      })
    })
    
    if(DEMO_MODE) {
      // lets scripts/capture-screenshots.mjs open any widget and tab
      window.deskHud = {
        show(widgetId, tab = 0) {
          const widget = widgetsInstances.find(w => w.id === widgetId)
          if(!widget) return false
          if(widgetContainer._widgetList.indexOf(widget) !== 0) widgetContainer._activate(widget)
          widget.main.activateTab(tab)
          return true
        },
        widget: (widgetId) => widgetsInstances.find(w => w.id === widgetId),
      }
    }

    widgetContainer.online = socket.connected
    socket.on('connect', () => {
      console.log(`${LOG_PREFIX} Socket connected`)
      widgetContainer.online = true
    })
    socket.on('disconnect', () => {
      console.log(`${LOG_PREFIX} Socket disconnected`)
      widgetContainer.online = false
    })
    
    socket.on('widget', function(data) {
      console.groupCollapsed(`[${data.widgetId || 'core'}] Socket message "widget"`)
      console.log(`[${data.widgetId || 'core'}] Socket message "widget":`, data)
      const {
        widgetId,
        payload
      } = data
    
      widgetContainer.routeMessage(widgetId, payload)
      console.groupEnd()
    })
    socket.on('distance', async (payload) => {
      if(payload.action) {
        console.log(`[distance] Socket message "distance":`, payload)
      } else {
        console.debug(`[distance] Socket message "distance":`, payload)
      }
      if(payload.action === 'goSleep') {
        widgetContainer.goSleep()
      } else if(payload.action === 'wakeUp') {
        widgetContainer.wakeUp()
      } 
      if(payload.distance !== undefined) {
        widgetContainer.distance = payload.distance
      }
    })
    socket.on('system', async (payload) => {
      console.debug(`[system] Socket message "system":`, payload)
      widgetContainer.cpuLoad = payload.cpuLoad
      widgetContainer.memLoad = payload.memLoad
      widgetContainer.cpuTemp = payload.cpuTemp
      widgetContainer.cpuFanRpm = payload.cpuFanRpm ?? null
      widgetContainer.cpuFanLevel = payload.cpuFanLevel ?? null
    })
    socket.on('log', async (payloads) => {
      const allowedMethods = {
        error: true,
        warn: true,
        log: true,
        info: true,
        debug: true,
      }
      for(let payload of payloads) {
        if(allowedMethods[payload.level]) {
          const timestamp = new Date(payload.timestamp).toISOString().split("T").pop().replace('Z', '')
          console[payload.level](`%c[${payload.moduleName}](${timestamp})`, 'background-color:yellow;font-weight:bold', ...payload.args)
        } else {
          console.debug(`${LOG_PREFIX} Socket message "log":`, payload)
        }
      }
    })
    socket.on('config', function(data) {
      console.log(`${LOG_PREFIX} Socket message "config":`, data)
      const {widgets} = data
      const keys = Object.keys(widgets)
      for(let key of keys) {
        widgetContainer.routeConfig(key, widgets[key])
      }
    });
    widgetContainer.on('reload', (mode) => {
      const msg = {
        serviceId: 'system', 
        payload: {
          action: 'kill'
        }
      }
      socket.emit('service', msg)
    })
  }
})()
