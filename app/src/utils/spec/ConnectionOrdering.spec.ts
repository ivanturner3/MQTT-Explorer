import { expect } from 'chai'
import 'mocha'
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
  it('preserves existing order for installations without saved ordering settings', () => {
    const settings = normalizeConnectionOrderSettings(defaultConnectionOrderSettings, connections)
    expect(settings.sortMode).to.eq('custom')
    expect(settings.customOrder).to.deep.eq(['z', 'a', 'm'])
    expect(getOrderedConnections(connections, settings).map(item => item.id)).to.deep.eq(['z', 'a', 'm'])
  })

  it('sorts names case-insensitively in both directions', () => {
    const ascending = getOrderedConnections(connections, { sortMode: 'name-asc', customOrder: [] })
    const descending = getOrderedConnections(connections, { sortMode: 'name-desc', customOrder: [] })

    expect(ascending.map(item => item.name)).to.deep.eq(['alpha', 'Mike', 'Zulu'])
    expect(descending.map(item => item.name)).to.deep.eq(['Zulu', 'Mike', 'alpha'])
  })

  it('sorts ports numerically', () => {
    const ascending = getOrderedConnections(connections, { sortMode: 'port-asc', customOrder: [] })
    const descending = getOrderedConnections(connections, { sortMode: 'port-desc', customOrder: [] })

    expect(ascending.map(item => item.port)).to.deep.eq([1883, 8883, 9001])
    expect(descending.map(item => item.port)).to.deep.eq([9001, 8883, 1883])
  })

  it('reorders custom entries before a target and switches to custom mode', () => {
    const reordered = reorderCustomConnections(
      connections,
      { sortMode: 'name-asc', customOrder: ['z', 'a', 'm'] },
      'm',
      'z',
      'before'
    )

    expect(reordered.sortMode).to.eq('custom')
    expect(reordered.customOrder).to.deep.eq(['m', 'z', 'a'])
  })

  it('can move a connection after the final target', () => {
    const reordered = reorderCustomConnections(
      connections,
      { sortMode: 'custom', customOrder: ['z', 'a', 'm'] },
      'z',
      'm',
      'after'
    )

    expect(reordered.customOrder).to.deep.eq(['a', 'm', 'z'])
  })

  it('removes stale ids and appends newly discovered connections', () => {
    const normalized = normalizeConnectionOrderSettings(
      { sortMode: 'custom', customOrder: ['missing', 'm', 'm', 'z'] },
      connections
    )

    expect(normalized.customOrder).to.deep.eq(['m', 'z', 'a'])
  })
})
