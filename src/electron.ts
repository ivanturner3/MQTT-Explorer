import * as log from 'electron-log'
import * as path from 'path'
import ConfigStorage from '../backend/src/ConfigStorage'
import { app, BrowserWindow, Menu, dialog, powerSaveBlocker } from 'electron'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from '../backend/src/index'
// import { electronTelemetryFactory } from 'electron-telemetry'
import { menuTemplate } from './MenuTemplate'
import buildOptions from './buildOptions'
import { waitForDevServer, isDev, runningUiTestOnCi, loadDevTools } from './development'
import { shouldAutoUpdate, handleAutoUpdate } from './autoUpdater'
import { registerCrashReporter } from './registerCrashReporter'
import { makeOpenDialogRpc } from '../events/OpenDialogRequest'
import { addMqttConnectionEvent, backendEvents, backendRpc, getAppVersion, removeConnection } from '../events'

registerCrashReporter()

// if (!isDev() && !runningUiTestOnCi()) {
//   const electronTelemetry = electronTelemetryFactory('9b0c8ca04a361eb8160d98c5', buildOptions)
// }

app.commandLine.appendSwitch('--no-sandbox')

// Keep this test distribution completely separate from a user's normal MQTT
// Explorer configuration so it can be tested side-by-side without overwriting
// existing connections or preferences.
app.setPath('userData', path.join(app.getPath('appData'), 'MQTT Explorer Custom Test'))

app.whenReady().then(() => {
  backendRpc.on(makeOpenDialogRpc(), async request => {
    return dialog.showOpenDialog(BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0], request)
  })
  backendRpc.on(getAppVersion, async () => app.getVersion())
})

autoUpdater.logger = log
log.info('App starting...')

const connectionManager = new ConnectionManager()
connectionManager.manageConnections()

// Keep Windows/macOS/Linux from automatically suspending the system while MQTT
// Explorer is actively monitoring at least one connection. This still permits
// the display to turn off and does not override an explicit user-requested sleep.
const activeConnectionIds = new Set<string>()
let connectionPowerSaveBlockerId: number | undefined

function startConnectionPowerSaveBlocker() {
  if (
    connectionPowerSaveBlockerId === undefined ||
    !powerSaveBlocker.isStarted(connectionPowerSaveBlockerId)
  ) {
    connectionPowerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
    log.info('Preventing automatic system sleep while an MQTT connection is active')
  }
}

function stopConnectionPowerSaveBlocker() {
  if (
    connectionPowerSaveBlockerId !== undefined &&
    powerSaveBlocker.isStarted(connectionPowerSaveBlockerId)
  ) {
    powerSaveBlocker.stop(connectionPowerSaveBlockerId)
    log.info('Allowing automatic system sleep; no MQTT connections are active')
  }
  connectionPowerSaveBlockerId = undefined
}

function updateConnectionPowerSaveBlocker() {
  if (activeConnectionIds.size > 0) {
    startConnectionPowerSaveBlocker()
  } else {
    stopConnectionPowerSaveBlocker()
  }
}

backendEvents.subscribe(addMqttConnectionEvent, event => {
  activeConnectionIds.add(event.id)
  updateConnectionPowerSaveBlocker()
})

backendEvents.subscribe(removeConnection, connectionId => {
  activeConnectionIds.delete(connectionId)
  updateConnectionPowerSaveBlocker()
})

const configStorage = new ConfigStorage(path.join(app.getPath('userData'), 'settings.json'))
configStorage.init()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | undefined

async function createWindow() {
  if (isDev()) {
    await waitForDevServer()
    loadDevTools()
  }

  const iconPath = path.join(__dirname, '..', '..', 'icon.png')
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    webPreferences: {
      ...({ enableRemoteModule: true } as any),
      contextIsolation: false,
      nodeIntegration: true,
      devTools: true,
      sandbox: false,
    },
    icon: iconPath,
  })

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      runningUiTestOnCi() && mainWindow.setFullScreen(true)
      mainWindow.show()
    }
  })

  console.log('icon path', iconPath)

  // Load the index.html of the app.
  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080')
  } else {
    mainWindow.loadFile('app/build/index.html')
  }

  // Emitted when the window is closed.
  mainWindow.on('close', () => {
    connectionManager.closeAllConnections()
    activeConnectionIds.clear()
    stopConnectionPowerSaveBlocker()
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = undefined
    app.quit()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  Menu.setApplicationMenu(menuTemplate)
  createWindow()

  if (shouldAutoUpdate(buildOptions)) {
    handleAutoUpdate()
  }
})

app.on('before-quit', () => {
  activeConnectionIds.clear()
  stopConnectionPowerSaveBlocker()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
