import { Dispatch } from 'redux'
import * as path from 'path'
import { Subscription } from 'mqtt-explorer-backend/src/DataSource/MqttSource'
import { makeOpenDialogRpc } from '../../../events/OpenDialogRequest'
import { AppState } from '../reducers'
import { clearLegacyConnectionOptions, loadLegacyConnectionOptions } from '../model/LegacyConnectionSettings'
import {
  ConnectionOptions,
  createEmptyConnection,
  makeDefaultConnections,
  CertificateParameters,
} from '../model/ConnectionOptions'
import {
  ConnectionDropPosition,
  ConnectionOrderSettings,
  ConnectionSortMode,
  defaultConnectionOrderSettings,
  getOrderedConnections,
  normalizeConnectionOrderSettings,
} from '../utils/ConnectionOrdering'
import { default as persistentStorage, StorageIdentifier } from '../utils/PersistentStorage'
import { showError } from './Global'
import { ActionTypes, Action } from '../reducers/ConnectionManager'
import { connectionsMigrator } from './migrations/Connection'
import { rendererRpc, readFromFile } from '../eventBus'

export interface ConnectionDictionary {
  [s: string]: ConnectionOptions
}
const storedConnectionsIdentifier: StorageIdentifier<ConnectionDictionary> = {
  id: 'ConnectionManager_connections',
}
const storedConnectionOrderIdentifier: StorageIdentifier<ConnectionOrderSettings> = {
  id: 'ConnectionManager_orderSettings',
}

export const loadConnectionSettings = () => async (dispatch: Dispatch<any>, getState: () => AppState) => {
  let connections
  try {
    await ensureConnectionsHaveBeenInitialized()
    connections = await persistentStorage.load(storedConnectionsIdentifier)

    // Apply migrations
    if (connections && connectionsMigrator.isMigrationNecessary(connections)) {
      connections = connectionsMigrator.applyMigrations(connections)
      await persistentStorage.store(storedConnectionsIdentifier, connections)
    }
  } catch (error) {
    dispatch(showError(error))
  }

  if (!connections) {
    return
  }

  dispatch(setConnections(connections))

  let orderSettings = normalizeConnectionOrderSettings(defaultConnectionOrderSettings, connections)
  try {
    const storedOrderSettings = await persistentStorage.load(storedConnectionOrderIdentifier)
    orderSettings = normalizeConnectionOrderSettings(storedOrderSettings, connections)
    // Persist the normalized shape so added/deleted connections and older settings self-heal.
    await persistentStorage.store(storedConnectionOrderIdentifier, orderSettings)
  } catch (error) {
    dispatch(showError(error))
  }

  dispatch(setConnectionOrderSettings(orderSettings))
  const firstConnection = getOrderedConnections(connections, orderSettings)[0]
  if (firstConnection) {
    dispatch(selectConnection(firstConnection.id))
  } else {
    // No connections exist - create a default one
    dispatch(createConnection() as any)
  }
}

export type CertificateTypes = 'selfSignedCertificate' | 'clientCertificate' | 'clientKey'
export const selectCertificate =
  (type: CertificateTypes, connectionId: string) => async (dispatch: Dispatch<any>, getState: () => AppState) => {
    try {
      const certificate = await openCertificate()
      dispatch(
        updateConnection(connectionId, {
          [type]: certificate,
        })
      )
    } catch (error) {
      dispatch(showError(error))
    }
  }

async function openCertificate(): Promise<CertificateParameters> {
  const rejectReasons = {
    noCertificateSelected: 'No certificate selected',
    certificateSizeDoesNotMatch: 'Certificate size larger/smaller then expected.',
  }

  const openDialogReturnValue = await rendererRpc.call(makeOpenDialogRpc(), {
    properties: ['openFile'],
    securityScopedBookmarks: true,
  })

  const selectedFile = openDialogReturnValue.filePaths && openDialogReturnValue.filePaths[0]
  if (!selectedFile) {
    throw rejectReasons.noCertificateSelected
  }

  const data = await rendererRpc.call(readFromFile, { filePath: selectedFile })
  if (data.length > 16_384 || data.length < 64) {
    throw rejectReasons.certificateSizeDoesNotMatch
  }

  return {
    data: data.toString('base64'),
    name: path.basename(selectedFile),
  }
}

export const saveConnectionSettings = () => async (dispatch: Dispatch<any>, getState: () => AppState) => {
  try {
    console.log('store settings')
    await persistentStorage.store(storedConnectionsIdentifier, getState().connectionManager.connections)
  } catch (error) {
    dispatch(showError(error))
  }
}

export const saveConnectionOrderSettings = () => async (dispatch: Dispatch<any>, getState: () => AppState) => {
  try {
    const state = getState().connectionManager
    const normalized = normalizeConnectionOrderSettings(state.orderSettings, state.connections)
    await persistentStorage.store(storedConnectionOrderIdentifier, normalized)
  } catch (error) {
    dispatch(showError(error))
  }
}

export const updateConnection = (connectionId: string, changeSet: Partial<ConnectionOptions>): Action => ({
  connectionId,
  changeSet,
  type: ActionTypes.CONNECTION_MANAGER_UPDATE_CONNECTION,
})

export const addSubscription = (subscription: Subscription, connectionId: string): Action => ({
  connectionId,
  subscription,
  type: ActionTypes.CONNECTION_MANAGER_ADD_SUBSCRIPTION,
})

export const deleteSubscription = (subscription: Subscription, connectionId: string): Action => ({
  connectionId,
  subscription,
  type: ActionTypes.CONNECTION_MANAGER_DELETE_SUBSCRIPTION,
})

export const createConnection = () => (dispatch: Dispatch<any>, getState: () => AppState) => {
  const newConnection = createEmptyConnection()
  dispatch(addConnection(newConnection))
  dispatch(selectConnection(newConnection.id))
  dispatch(saveConnectionOrderSettings() as any)
}

export const setConnections = (connections: { [s: string]: ConnectionOptions }): Action => ({
  connections,
  type: ActionTypes.CONNECTION_MANAGER_SET_CONNECTIONS,
})

export const selectConnection = (connectionId: string): Action => ({
  selected: connectionId,
  type: ActionTypes.CONNECTION_MANAGER_SELECT_CONNECTION,
})

export const addConnection = (connection: ConnectionOptions): Action => ({
  connection,
  type: ActionTypes.CONNECTION_MANAGER_ADD_CONNECTION,
})

export const setConnectionOrderSettings = (orderSettings: ConnectionOrderSettings): Action => ({
  orderSettings,
  type: ActionTypes.CONNECTION_MANAGER_SET_ORDER_SETTINGS,
})

export const setConnectionSortMode = (sortMode: ConnectionSortMode) => (dispatch: Dispatch<any>) => {
  dispatch({
    sortMode,
    type: ActionTypes.CONNECTION_MANAGER_SET_SORT_MODE,
  })
  dispatch(saveConnectionOrderSettings() as any)
}

export const reorderConnections =
  (sourceId: string, targetId: string, position: ConnectionDropPosition) => (dispatch: Dispatch<any>) => {
    dispatch({
      sourceId,
      targetId,
      position,
      type: ActionTypes.CONNECTION_MANAGER_REORDER_CONNECTIONS,
    })
    dispatch(saveConnectionOrderSettings() as any)
  }

export const toggleAdvancedSettings = (): Action => ({
  type: ActionTypes.CONNECTION_MANAGER_TOGGLE_ADVANCED_SETTINGS,
})

export const toggleCertificateSettings = (): Action => ({
  type: ActionTypes.CONNECTION_MANAGER_TOGGLE_CERTIFICATE_SETTINGS,
})

export const deleteConnection = (connectionId: string) => (dispatch: Dispatch<any>, getState: () => AppState) => {
  const stateBeforeDelete = getState().connectionManager
  const orderedConnectionIds = getOrderedConnections(stateBeforeDelete.connections, stateBeforeDelete.orderSettings).map(
    connection => connection.id
  )
  const connectionIdLocation = orderedConnectionIds.indexOf(connectionId)
  const remainingIds = orderedConnectionIds.filter(id => id !== connectionId)
  const nextSelectedConnectionIndex = Math.min(remainingIds.length - 1, Math.max(0, connectionIdLocation))
  const nextSelectedConnection = remainingIds[nextSelectedConnectionIndex]

  dispatch({
    connectionId,
    type: ActionTypes.CONNECTION_MANAGER_DELETE_CONNECTION,
  })
  dispatch(saveConnectionOrderSettings() as any)

  if (nextSelectedConnection) {
    dispatch(selectConnection(nextSelectedConnection))
  }
}

async function ensureConnectionsHaveBeenInitialized() {
  let connections = await persistentStorage.load(storedConnectionsIdentifier)
  const requiresInitialization = !connections
  if (requiresInitialization) {
    const migratedConnection = loadLegacyConnectionOptions()
    const defaultConnections = makeDefaultConnections()
    connections = {
      ...migratedConnection,
      ...defaultConnections,
    }
    await persistentStorage.store(storedConnectionsIdentifier, connections)

    clearLegacyConnectionOptions()
  }
}
