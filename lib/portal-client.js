'use babel';

import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {initAction, ACTION_TYPES} from './constant';
import EventHandler from './event-handler'
import ShareHandler from './share-handler.js'

ShareDB.types.register(otText.type);

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {host, port, portalId, userId, emitter} = props;
    this.portalId = portalId;
    this.userId = userId;
    this.emitter = emitter;
    this.docs = {};
    this.eventHandlers = {};
    this.shareHandlers = {};

    this.ws = new WebSocket(`ws:\/\/${host}:${port}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('close', this.wsClose.bind(this));
  }

  init () {
    this.sendSocketMsg(initAction(this.portalId, this.userId));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);
  }

  onMessage(msg) {
    const data = JSON.parse(msg);
    if (data.a !== 'meta') return;
    this.emitter.emit(data.type);
    switch (data.type) {
      case ACTION_TYPES.CHANGE_ACTIVE:
      case ACTION_TYPES.CLOSE_FILE:
      case 'socketClose':
        this.emitter.emit('systemWideEvent', data)
        break;
      case ACTION_TYPES.OPEN_FILE:
        this.listenToRemoteFileChange(data.path)
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

  async addEventHandler(path, editor, self) {
    // this.docs[path] = this.connection.get(this.portalId, path);
    const handler = new EventHandler(this.docs[path], editor, path, this);
    this.eventHandlers[path] = handler;
    console.log('subscribed ' + path);
    self.subscriptions.add(...(handler.listen()));
  }

  addShareHandler(path, editor) {
    this.docs[path] = this.connection.get(this.portalId, path)
    if (!this.shareHandlers[path]) this.shareHandlers[path] = new ShareHandler(this.docs[path], path, editor)
    else if (editor) {
      this.shareHandlers[path].applyEditor(editor)
    }
  }

}
