import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { FormControl, List, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material'
import { Theme } from '@mui/material/styles'
import { withStyles } from '@mui/styles'
import ConnectionItem from './ConnectionItem'
import { AddButton } from './AddButton'
import { AppState } from '../../../reducers'
import { connectionManagerActions } from '../../../actions'
import { ConnectionOptions } from '../../../model/ConnectionOptions'
import {
  ConnectionOrderSettings,
  ConnectionSortMode,
  getOrderedConnections,
} from '../../../utils/ConnectionOrdering'
import { KeyCodes } from '../../../utils/KeyCodes'
import { useGlobalKeyEventHandler } from '../../../effects/useGlobalKeyEventHandler'

const ConnectionItemAny = ConnectionItem as any

interface Props {
  classes: any
  selected?: string
  connections: { [s: string]: ConnectionOptions }
  orderSettings: ConnectionOrderSettings
  actions: typeof connectionManagerActions
}

function ProfileList(props: Props) {
  const { actions, classes, connections, orderSettings, selected } = props
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

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    actions.setConnectionSortMode(event.target.value as ConnectionSortMode)
  }

  const handleDrop = (targetId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (isCustomOrder && draggedId && draggedId !== targetId) {
      actions.reorderConnections(draggedId, targetId)
    }
    setDraggedId(undefined)
  }

  const connectionListHeader = (
    <div className={classes.header}>
      <div className={classes.headerTitle}>
        <AddButton action={actions.createConnection} />
        <span>Connections</span>
      </div>
      <FormControl fullWidth size="small">
        <Select value={orderSettings.sortMode} onChange={handleSortChange} aria-label="Connection sort order">
          <MenuItem value="custom">Custom order</MenuItem>
          <MenuItem value="name-asc">Name: A → Z</MenuItem>
          <MenuItem value="name-desc">Name: Z → A</MenuItem>
          <MenuItem value="host-asc">Host: A → Z</MenuItem>
          <MenuItem value="host-desc">Host: Z → A</MenuItem>
          <MenuItem value="port-asc">Port: Low → High</MenuItem>
          <MenuItem value="port-desc">Port: High → Low</MenuItem>
        </Select>
      </FormControl>
      {isCustomOrder && (
        <Typography className={classes.dragHint} variant="caption">
          Drag connections to reorder
        </Typography>
      )}
    </div>
  )

  return (
    <List style={{ height: '100%' }} component="nav" subheader={connectionListHeader}>
      <div className={classes.list}>
        {orderedConnections.map(connection => (
          <div
            key={connection.id}
            draggable={isCustomOrder}
            onDragStart={() => setDraggedId(connection.id)}
            onDragEnd={() => setDraggedId(undefined)}
            onDragOver={event => {
              if (isCustomOrder) {
                event.preventDefault()
              }
            }}
            onDrop={handleDrop(connection.id)}
            className={isCustomOrder ? classes.draggable : undefined}
          >
            <ConnectionItemAny connection={connection} selected={selected === connection.id} />
          </div>
        ))}
      </div>
    </List>
  )
}

const styles = (theme: Theme) => ({
  header: {
    padding: '8px 16px 4px',
    backgroundColor: theme.palette.background.default,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  dragHint: {
    display: 'block',
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  draggable: {
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  list: {
    marginTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
  },
})

const mapDispatchToProps = (dispatch: any) => ({
  actions: bindActionCreators(connectionManagerActions, dispatch),
})

const mapStateToProps = (state: AppState) => ({
  connections: state.connectionManager.connections,
  orderSettings: state.connectionManager.orderSettings,
  selected: state.connectionManager.selected,
})

export default connect(mapStateToProps, mapDispatchToProps)(withStyles(styles)(ProfileList) as any)
