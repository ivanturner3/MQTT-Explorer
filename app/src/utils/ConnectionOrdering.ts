import { ConnectionOptions } from '../model/ConnectionOptions'

export type ConnectionSortMode =
  | 'custom'
  | 'name-asc'
  | 'name-desc'
  | 'host-asc'
  | 'host-desc'
  | 'port-asc'
  | 'port-desc'

export interface ConnectionOrderSettings {
  sortMode: ConnectionSortMode
  customOrder: string[]
}

export const defaultConnectionOrderSettings: ConnectionOrderSettings = {
  sortMode: 'custom',
  customOrder: [],
}

const sortModes: ConnectionSortMode[] = [
  'custom',
  'name-asc',
  'name-desc',
  'host-asc',
  'host-desc',
  'port-asc',
  'port-desc',
]

const compareText = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })

const compareFallback = (left: ConnectionOptions, right: ConnectionOptions) =>
  compareText(left.name || left.host || left.id, right.name || right.host || right.id) || compareText(left.id, right.id)

export function normalizeConnectionOrderSettings(
  settings: Partial<ConnectionOrderSettings> | undefined,
  connections: { [s: string]: ConnectionOptions }
): ConnectionOrderSettings {
  const ids = Object.keys(connections)
  const requestedMode = settings && settings.sortMode
  const sortMode = requestedMode && sortModes.includes(requestedMode) ? requestedMode : 'custom'
  const requestedOrder = settings && Array.isArray(settings.customOrder) ? settings.customOrder : []
  const validIds = new Set(ids)
  const seen = new Set<string>()
  const customOrder = requestedOrder.filter(id => {
    if (!validIds.has(id) || seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })

  ids.forEach(id => {
    if (!seen.has(id)) {
      customOrder.push(id)
    }
  })

  return { sortMode, customOrder }
}

export function getOrderedConnections(
  connections: { [s: string]: ConnectionOptions },
  settings: ConnectionOrderSettings
): ConnectionOptions[] {
  const normalized = normalizeConnectionOrderSettings(settings, connections)

  if (normalized.sortMode === 'custom') {
    return normalized.customOrder.map(id => connections[id]).filter((connection): connection is ConnectionOptions => !!connection)
  }

  const result = Object.values(connections).slice()
  result.sort((left, right) => {
    switch (normalized.sortMode) {
      case 'name-asc':
        return compareText(left.name || '', right.name || '') || compareFallback(left, right)
      case 'name-desc':
        return compareText(right.name || '', left.name || '') || compareFallback(left, right)
      case 'host-asc':
        return compareText(left.host || '', right.host || '') || compareFallback(left, right)
      case 'host-desc':
        return compareText(right.host || '', left.host || '') || compareFallback(left, right)
      case 'port-asc':
        return Number(left.port) - Number(right.port) || compareFallback(left, right)
      case 'port-desc':
        return Number(right.port) - Number(left.port) || compareFallback(left, right)
      default:
        return compareFallback(left, right)
    }
  })

  return result
}

export function reorderCustomConnections(
  connections: { [s: string]: ConnectionOptions },
  settings: ConnectionOrderSettings,
  sourceId: string,
  targetId: string
): ConnectionOrderSettings {
  const normalized = normalizeConnectionOrderSettings(settings, connections)
  if (sourceId === targetId || !connections[sourceId] || !connections[targetId]) {
    return { ...normalized, sortMode: 'custom' }
  }

  const nextOrder = normalized.customOrder.filter(id => id !== sourceId)
  const targetIndex = nextOrder.indexOf(targetId)
  nextOrder.splice(targetIndex < 0 ? nextOrder.length : targetIndex, 0, sourceId)

  return {
    sortMode: 'custom',
    customOrder: nextOrder,
  }
}
