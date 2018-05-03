'use babel';

import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {initData} from './constant';

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {host, port, portalId, clientId} = props;
    this.portalId = portalId;
    this.clientId = clientId;
    this.files = {};
    this.buffers = {};

    this.ws = new WebSocket(`ws:\/\/${host}:${port}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
  }

  init () {
    this.sendSocketMsg(JSON.stringify(initData(this.props)));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);

  }

  onMessage(msg) {
    const data = JSON.parse(msg);
    if (data.a !== 'meta') return;
    this.emitter.emit(data.type);
  }

  sendSocketMsg(msg) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    }
  }

  subscribe(path, editor) {
    this.files[path] = this.connection.get(this.portalId, path);
    this.buffers[path] = editor.getBuffer();
    this.files[path].subscribe(error => {
      if (error) throw error;
      if (this.files[path].type === null) {
        this.files[path].create(this.buffer.getText(), 'text');
      } else {
        let data = this.files[path].data;
        this.modify( () => {
          this.buffer.setText(data);
        })
      }

      let data = {
        a: 'meta',
        type: 'addTab',
        uri: path // TextEditor's uri is it's absolute path, when sending data, we send relative path, then when we receive it, we will convert to absolute path
      };
      setTimeout( () => {
        this.sendSocketMsg(JSON.stringify(data));
      }, 0);
    });
    console.log('subscribed ' + path);
  }
}
