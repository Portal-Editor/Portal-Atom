'use babel';

import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {
  initAction,
  addTabAction
} from './constant';
import EventHandler from './event-handler'

ShareDB.types.register(otText.type);

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {host, port, portalId, clientId, emitter} = props;
    this.portalId = portalId;
    this.clientId = clientId;
    this.emitter = emitter;
    this.docs = {};
    this.eventHandlers = {};

    const self = this;
    this.ws = new WebSocket(`ws:\/\/${host}:${port}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('close', this.wsClose.bind(this));
  }

  init () {
    this.sendSocketMsg(initAction(this.portalId, this.clientId));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);
  }

  onMessage(msg) {
    const data = JSON.parse(msg);
    if (data.a !== 'meta') return;
    this.emitter.emit(data.type);
    switch (data.type) {
      case 'activePaneItemChanged':
      case 'editorClosed':
      case 'socketClose':
        this.emitter.emit('systemWideEvent', data)
        break;
      default:
        const handler = this.eventHandlers[data.path];
        handler && handler.on(data);
    }
  }

  wsClose() {
    // this.ws.close()
  }

  disconnect() {
    for (let doc in this.docs) {
      doc.destroy()
    }
    this.ws.close()
    this.portalClient.disconnect()
  }

  async sendSocketMsg(msg) {
    if (this.ws.readyState === WebSocket.OPEN) {
      await this.ws.send(JSON.stringify(msg));
    }
  }

  async subscribe(path, editor, self) {
    this.docs[path] = this.connection.get(this.portalId, path);
    const handler = new EventHandler(this.docs[path], editor, path, this);
    this.eventHandlers[path] = handler;
    console.log('subscribed ' + path);
    self.subscriptions.add(...(handler.listen()));
  }
}
