'use babel';

import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {initData} from './constant';

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {host, port, sessionId, clientId} = props;
    this.sessionId = sessionId;
    this.clientId = clientId;

    this.ws = new WebSocket(`ws:\/\/${host}:${port}`);
    this.ws.on('open', this.init.bind(this));
    this.files = {};
  }

  init () {
    this.sendSocketMsg(JSON.stringify(initData(this.props)));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);
  }

  sendSocketMsg(msg) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    }
  }

  subscribe(sessionId, path) {
    this.files[path] = connection.get(sessionId, path);
    this.files[path].subscribe(function(err) {
      if (err) throw err;
      var element = document.querySelector('textarea');
      var binding = new StringBinding(element, doc);
      binding.setup();
    });
  }
}
