import { expect } from 'chai'
import { ConnectionOptions } from '../../model/ConnectionOptions'
import {
  defaultConnectionOrderSettings,
  getOrderedConnections,
  normalizeConnectionOrderSettings,
  reorderCustomConnections,
} from '../ConnectionOrdering'

const connection = (id: string, name: string, host: string, port: number): ConnectionOptions => ({
  configVersion: 1,
  type: 'mqtt',
  id,
  host,
  protocol: 'mqtt',
  port,
  name,
  encryption: false,
  certValidation: true,
  subscriptions: [],
})

const connections = {
  z: connection('z', 'Zulu', 'z.example.com', 9001),
  a: connection('a', 'alpha', 'a.example.com', 1883),
  m: connection('m', 'Mike', 'm.example.com', 8883),
}

describe('ConnectionOrdering', () => {
  it('preserves existing order when no ordering settings are stored', () => {
    const settings = normalizeConnectionOrderSettings(defaultConnectionOrderSettings, connections)
    expect(settings.sortMode).to.eq('custom')
    expect(settings.customOrder).to.deep.eq(['z', 'a', 'm'])
  })

  it('sorts names case-insensitively in both directions', () => {
    const ascending = getOrderedConnections(connections, { sortMode: 'name-asc', customOrder: [] })
    const descending = getOrderedConnections(connections, { sortMode: 'name-desc', customOrder: [] })

    expect(ascending.map(item => item.name)).to.deep.eq(['alpha', 'Mike', 'Zulu'])
    expect(descending.map(item => item.name)).to.deep.eq(['Zulu', 'Mike', 'alpha'])
  })

  it('sorts hosts in both directions', () => {
    const ascending = getOrderedConnections(connections, { sortMode: 'host-asc', customOrder: [] })
    const descending = getOrderedConnections(connections, { sortMode: 'host-desc', customOrder: [] })

    expect(ascending.map(item => item.host)).to.deep.eq(['a.example.com', 'm.example.com', 'z.example.com'])
    expect(descending.map(item => item.host)).to.deep.eq(['z.example.com', 'm.example.com', 'a.example.com'])
  })

  it('sorts ports numerically', () => {
    const ascending = getOrderedConnections(connections, { sortMode: 'port-asc', customOrder: [] })
    const descending = getOrderedConnections(connections, { sortMode: 'port-desc', customOrder: [] })

    expect(ascending.map(item => item.port)).to.deep.eq([1883, 8883, 9001])
    expect(descending.map(item => item.port)).to.deep.eq([9001, 8883, 1883])
  })

  it('supports custom before and after placement', () => {
    const before = reorderCustomConnections(
      connections,
      { sortMode: 'custom', customOrder: ['z', 'a', 'm'] },
      'm',
      'z',
      'before'
    )
    const after = reorderCustomConnections(connections, before, 'm', 'a', 'after')

    expect(before.customOrder).to.deep.eq(['m', 'z', 'a'])
    expect(after.customOrder).to.deep.eq(['z', 'a', 'm'])
  })

  it('removes stale ids, duplicates, and appends new connections', () => {
    const normalized = normalizeConnectionOrderSettings(
      { sortMode: 'custom', customOrder: ['missing', 'm', 'm', 'z'] },
      connections
    )

    expect(normalized.customOrder).to.deep.eq(['m', 'z', 'a'])
  })
})
