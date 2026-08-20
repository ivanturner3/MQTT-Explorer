import React, { useState } from 'react'
import Delete from '@material-ui/icons/Delete'
import Edit from '@material-ui/icons/Edit'
import FileCopy from '@material-ui/icons/FileCopy'
import { connectionManagerActions } from '../../actions'
import { ConnectionOptions } from '../../model/ConnectionOptions'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TextField,
  Theme,
  Tooltip,
} from '@material-ui/core'
import { bindActionCreators } from 'redux'
import { withStyles } from '@material-ui/styles'
import { connect } from 'react-redux'
import { QosSelect } from '../QosSelect'
import { QoS, Subscription } from '../../../../backend/src/DataSource/MqttSource'

type SubscriptionEditorMode = 'edit' | 'duplicate'

interface SubscriptionEditorState {
  mode: SubscriptionEditorMode
  index: number
  topic: string
  qos: QoS
}

function nextQos(qos: QoS): QoS {
  if (qos === 0) {
    return 1
  }
  if (qos === 1) {
    return 2
  }
  return 0
}

function Subscriptions(props: {
  classes: any
  connection: ConnectionOptions
  managerActions: typeof connectionManagerActions
}) {
  const { classes, connection, managerActions } = props
  const [editor, setEditor] = useState<SubscriptionEditorState | undefined>(undefined)

  const updateSubscriptions = (subscriptions: Subscription[]) => {
    managerActions.updateConnection(connection.id, { subscriptions })
  }

  const removeSubscription = (index: number) => {
    const subscriptions = connection.subscriptions.slice()
    subscriptions.splice(index, 1)
    updateSubscriptions(subscriptions)
  }

  const editSubscription = (index: number, subscription: Subscription) => {
    setEditor({
      mode: 'edit',
      index,
      topic: subscription.topic,
      qos: subscription.qos,
    })
  }

  const duplicateSubscription = (index: number, subscription: Subscription) => {
    setEditor({
      mode: 'duplicate',
      index,
      topic: subscription.topic,
      qos: nextQos(subscription.qos),
    })
  }

  const saveSubscription = () => {
    if (!editor) {
      return
    }

    const topic = editor.topic.trim()
    if (!topic) {
      return
    }

    const subscriptions = connection.subscriptions.slice()
    const updatedSubscription: Subscription = {
      topic,
      qos: editor.qos,
    }

    if (editor.mode === 'edit') {
      subscriptions[editor.index] = updatedSubscription
    } else {
      subscriptions.splice(editor.index + 1, 0, updatedSubscription)
    }

    updateSubscriptions(subscriptions)
    setEditor(undefined)
  }

  return (
    <>
      <TableContainer component={Paper} className={`${classes.topicList} advanced-connection-settings-topic-list`}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left" className={classes.actionTitleCell}>
                Actions
              </TableCell>
              <TableCell className={classes.tableTitleCell}>Topic</TableCell>
              <TableCell align="right" className={classes.tableTitleCell}>
                QoS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {connection.subscriptions.map((subscription, index) => (
              <TableRow key={`${subscription.topic}_qos_${subscription.qos}_${index}`}>
                <TableCell align="left" className={`${classes.tableCell} ${classes.actionCell}`}>
                  <Tooltip title="Delete subscription">
                    <IconButton onClick={() => removeSubscription(index)} className={classes.actionButton}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit topic or QoS">
                    <IconButton onClick={() => editSubscription(index, subscription)} className={classes.actionButton}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate with another QoS">
                    <IconButton onClick={() => duplicateSubscription(index, subscription)} className={classes.actionButton}>
                      <FileCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>

                <TableCell component="th" scope="row" className={classes.tableCell}>
                  {subscription.topic}
                </TableCell>
                <TableCell align="right" className={classes.tableCell}>
                  {subscription.qos}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(editor)} onClose={() => setEditor(undefined)} maxWidth="xs" fullWidth={true}>
        <DialogTitle>{editor && editor.mode === 'edit' ? 'Edit subscription' : 'Duplicate subscription'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus={true}
            fullWidth={true}
            label="Topic"
            margin="normal"
            value={editor ? editor.topic : ''}
            onChange={event => editor && setEditor({ ...editor, topic: event.target.value })}
          />
          {editor ? <QosSelect label="QoS" selected={editor.qos} onChange={qos => setEditor({ ...editor, qos })} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditor(undefined)}>Cancel</Button>
          <Button color="primary" onClick={saveSubscription} disabled={!editor || !editor.topic.trim()}>
            {editor && editor.mode === 'duplicate' ? 'Duplicate' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const mapDispatchToProps = (dispatch: any) => {
  return {
    managerActions: bindActionCreators(connectionManagerActions, dispatch),
  }
}

const styles = (theme: Theme) => ({
  tableCell: {
    paddingTop: 0,
    paddingBottom: 0,
    wordBreak: 'break-word' as 'break-word',
  },
  tableTitleCell: {
    paddingTop: `${theme.spacing(0.5)}px`,
    paddingBottom: `${theme.spacing(0.5)}px`,
  },
  actionTitleCell: {
    width: '118px',
    paddingTop: `${theme.spacing(0.5)}px`,
    paddingBottom: `${theme.spacing(0.5)}px`,
  },
  actionCell: {
    width: '118px',
    whiteSpace: 'nowrap' as 'nowrap',
  },
  actionButton: {
    padding: '5px',
  },
  topicList: {
    height: '196px',
    overflowY: 'scroll' as 'scroll',
    margin: `${theme.spacing(1)}px ${theme.spacing(1)}px 0 ${theme.spacing(1)}px`,
    backgroundColor: theme.palette.background.default,
    width: 'auto',
  },
})

export default connect(undefined, mapDispatchToProps)(withStyles(styles)(Subscriptions))
