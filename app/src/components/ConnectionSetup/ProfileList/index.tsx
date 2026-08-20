import ConnectionItem from './ConnectionItem'
import React from 'react'
import { AddButton } from './AddButton'
import { AppState } from '../../../reducers'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { connectionManagerActions } from '../../../actions'
import { ConnectionOptions } from '../../../model/ConnectionOptions'
import {
  ConnectionOrderSettings,
  ConnectionSortMode,
  getOrderedConnections,
} from '../../../utils/ConnectionOrdering'
import { KeyCodes } from '../../../utils/KeyCodes'
import { IconButton, List, Menu, MenuItem } from '@material-ui/core'
import Sort from '@material-ui/icons/Sort'
import { Theme, withStyles } from '@material-ui/core/styles'
import { useGlobalKeyEventHandler } from '../../../effects/useGlobalKeyEventHandler'

interface Props {
  classes: any
  selected?: string
  connections: { [s: string]: ConnectionOptions }
  orderSettings: ConnectionOrderSettings
  actions: typeof connectionManagerActions
}

function getEffectiveBackgroundColor(element: HTMLElement): string {
  let current: HTMLElement | null = element
  while (current) {
    const backgroundColor = window.getComputedStyle(current).backgroundColor
    if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      return backgroundColor
    }
    current = current.parentElement
  }
  return 'transparent'
}

function setConnectionDragImage(event: React.DragEvent<HTMLDivElement>) {
  const source = event.currentTarget
  const bounds = source.getBoundingClientRect()
  const dragImage = source.cloneNode(true) as HTMLElement

  // Chromium can occasionally capture surrounding Material-UI list content for the
  // default drag ghost. Use an explicit clone of only the connection row instead.
  dragImage.removeAttribute('draggable')
  dragImage.style.position = 'fixed'
  dragImage.style.left = '-10000px'
  dragImage.style.top = '-10000px'
  dragImage.style.width = `${bounds.width}px`
  dragImage.style.height = `${bounds.height}px`
  dragImage.style.margin = '0'
  dragImage.style.pointerEvents = 'none'
  dragImage.style.opacity = '1'
  dragImage.style.backgroundColor = getEffectiveBackgroundColor(source)
  document.body.appendChild(dragImage)

  const offsetX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width))
  const offsetY = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))
  event.dataTransfer.setDragImage(dragImage, offsetX, offsetY)

  // The element must exist during dragstart, but can be removed immediately after
  // Chromium has captured it as the drag image.
  window.setTimeout(() => {
    if (dragImage.parentNode) {
      dragImage.parentNode.removeChild(dragImage)
    }
  }, 0)
}

function ProfileList(props: Props) {
  const { actions, classes, connections, orderSettings, selected } = props
  const [sortAnchor, setSortAnchor] = React.useState<HTMLElement | null>(null)
  const [draggedId, setDraggedId] = React.useState<string | undefined>(undefined)
  const orderedConnections = getOrderedConnections(connections, orderSettings)
  const isCustomOrder = orderSettings.sortMode === 'custom'

  const selectConnection = (dir: 'next' | 'previous') => (event: KeyboardEvent) => {
    if (!selected) {
      return
    }
    const indexDirection = dir === 'next' ? 1 : -1
    const selectedIndex = orderedConnections.map(connection => connection.id).indexOf(selected)
    const nextConnection = orderedConnections[selectedIndex + indexDirection]
    if (nextConnection) {
      actions.selectConnection(nextConnection.id)
    }
    event.preventDefault()
  }

  useGlobalKeyEventHandler(KeyCodes.arrow_down, selectConnection('next'))
  useGlobalKeyEventHandler(KeyCodes.arrow_up, selectConnection('previous'))

  const selectSortMode = (sortMode: ConnectionSortMode) => {
    actions.setConnectionSortMode(sortMode)
    setSortAnchor(null)
  }

  const handleDrop = (targetId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (isCustomOrder && draggedId && draggedId !== targetId) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const position = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before'
      actions.reorderConnections(draggedId, targetId, position)
    }
    setDraggedId(undefined)
  }

  const createConnectionButton = (
    <div className={classes.header}>
      <div className={classes.headerTitle}>
        <AddButton action={actions.createConnection} />
        Connections
      </div>
      <IconButton
        className={classes.sortButton}
        size="small"
        aria-label="Sort connections"
        title="Sort connections"
        onClick={event => setSortAnchor(event.currentTarget)}
      >
        <Sort fontSize="small" />
      </IconButton>
      <Menu anchorEl={sortAnchor} keepMounted open={Boolean(sortAnchor)} onClose={() => setSortAnchor(null)}>
        <MenuItem selected={orderSettings.sortMode === 'custom'} onClick={() => selectSortMode('custom')}>
          Custom order
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'name-asc'} onClick={() => selectSortMode('name-asc')}>
          Name: A → Z
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'name-desc'} onClick={() => selectSortMode('name-desc')}>
          Name: Z → A
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'host-asc'} onClick={() => selectSortMode('host-asc')}>
          Host: A → Z
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'host-desc'} onClick={() => selectSortMode('host-desc')}>
          Host: Z → A
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'port-asc'} onClick={() => selectSortMode('port-asc')}>
          Port: Low → High
        </MenuItem>
        <MenuItem selected={orderSettings.sortMode === 'port-desc'} onClick={() => selectSortMode('port-desc')}>
          Port: High → Low
        </MenuItem>
      </Menu>
    </div>
  )

  return (
    <List style={{ height: '100%' }} component="nav" subheader={createConnectionButton}>
      <div className={classes.list}>
        {orderedConnections.map(connection => (
          <div
            key={connection.id}
            draggable={isCustomOrder}
            className={isCustomOrder ? classes.draggable : undefined}
            onDragStart={event => {
              setDraggedId(connection.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', connection.id)
              setConnectionDragImage(event)
            }}
            onDragEnd={() => setDraggedId(undefined)}
            onDragOver={event => {
              if (isCustomOrder) {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }
            }}
            onDrop={handleDrop(connection.id)}
          >
            <ConnectionItem connection={connection} selected={selected === connection.id} />
          </div>
        ))}
      </div>
    </List>
  )
}

const styles = (theme: Theme) => ({
  header: {
    padding: '8px 16px',
    display: 'flex' as 'flex',
    alignItems: 'center' as 'center',
  },
  headerTitle: {
    display: 'flex' as 'flex',
    alignItems: 'center' as 'center',
    flex: 1,
  },
  sortButton: {
    padding: theme.spacing(0.5),
  },
  draggable: {
    cursor: 'grab' as 'grab',
  },
  list: {
    marginTop: theme.spacing(1),
    height: `calc(100% - ${theme.spacing(6)})`,
    overflowY: 'auto' as 'auto',
  },
})

const mapDispatchToProps = (dispatch: any) => {
  return {
    actions: bindActionCreators(connectionManagerActions, dispatch),
  }
}

const mapStateToProps = (state: AppState) => {
  return {
    connections: state.connectionManager.connections,
    orderSettings: state.connectionManager.orderSettings,
    selected: state.connectionManager.selected,
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(withStyles(styles)(ProfileList))
