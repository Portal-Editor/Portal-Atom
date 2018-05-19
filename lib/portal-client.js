'use babel';

import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {
  initAction,
  changeActiveStatus,
  normalizePath,
  openFileAction,
  ACTION_TYPES} from './constant';
import EventHandler from './event-handler';
import Share from './share';
import streamifier from 'streamifier';
import unzip from 'unzip';
import fs from 'fs'
import archiver from 'archiver'
import {promisify} from 'bluebird'

ShareDB.types.register(otText.type);

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {host, port, portalId, userId, projectPath, projectDir, emitter, portal} = props;
    this.portalId = portalId;
    this.userId = userId;
    this.projectPath = projectPath;
    this.projectDir = projectDir;
    this.emitter = emitter;
    this.portal = portal;

    this.docs = {};             // shareDB snapshots
    this.eventHandlers = {};    // listen to atom editor events and send
    this.shares = {};           // shareDB remote OT handler
    this.users = {}             // users
    this.files = {}             // other states of files

    this.ws = new WebSocket(`ws:\/\/${host}:${port}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('close', this.wsClose.bind(this));
  }

  init () {
    this.sendSocketMsg(initAction(this.portalId, this.userId));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);
    this.uploadZippedProjectFile();

    // systemWideEvent listener
    this.portal.subscriptions.add(atom.workspace.observeTextEditors( editor => {
      console.log('local open file');
      let editorPath = editor.getPath();
      if (editorPath.startsWith(this.projectPath)) {
        let path = atom.project.relativizePath(editorPath)[1];
        this.share(path, editor, this.portal, false)
        this.sendSocketMsg(openFileAction(path, editor.getGrammar().scopeName))
      }
    }));

    this.portal.subscriptions.add(atom.workspace.onDidChangeActivePaneItem( item => {
      console.log('active changed');
      if (!this.syncTab || !atom.workspace.isTextEditor(item)) {
        return;
      }
      const {isProjectFile, relativePath} = this.isProjectFile(item.getPath());
      if (isProjectFile){
        this.sendSocketMsg(changeActiveStatus(relativePath));
      }
    }));
  }

  onMessage(msg) {
    const data = JSON.parse(msg);
    if (data.a !== 'meta') return;
    // this.emitter.emit(data.type);
    switch (data.type) {
      case ACTION_TYPES.CHANGE_ACTIVE:
      case ACTION_TYPES.CLOSE_FILE:
        this.emitter.emit('systemWideEvent', data)
        break;
      case ACTION_TYPES.INIT:
        this.users = data.users
        this.files = data.files
        if(!data.data) break;
        try {
          streamifier.createReadStream(Buffer.from(data.data))
                .pipe(unzip.Extract({path: this.projectPath}));
        } catch (e) {
          console.log(e);
        }
        break;
      case ACTION_TYPES.SOCKET_CLOSE:
        atom.notifications.addInfo(data.userId + ' left.');
        for (let handler in this.eventHandlers.values()) {
          handler.resetMarker(data.userId);
        }
        break;
      case ACTION_TYPES.OPEN_FILE:
        console.log('remote open file ', data.path);
        this.share(data.path, null, this, true)
        break;
      case ACTION_TYPES.USER_JOINED: {
        atom.notifications.addInfo(`${data.user.name} joined the portal.`)
        this.users[data.user.id] = data.user
        break;
      }
      case ACTION_TYPES.USER_LEFT: {
        const user = this.users[data.userId]
        atom.notifications.addInfo(`${user.name} left the portal.`)
        delete this.users[user.id]
        break;
      }
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

  async uploadZippedProjectFile() {
    if (!this.projectDir) return;
    // create a file to stream archive data to.
    let outputPath = `${this.projectPath}\/.portal.zip`
    let output = fs.createWriteStream(outputPath);
    let archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    const self = this;
    const readFile = promisify(fs.readFile)
    const deleteFile = promisify(fs.unlink)
    const readZipFile = new Promise((resolve, reject) => {
      output.on('close', resolve)
    })

    output.on('end', function() {
      console.log('Data has been drained');
    });

    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });

    archive.on('error', function(err) {
      throw err;
    });

    archive.pipe(output);
    const entries = this.projectDir.getEntriesSync()
    for (let i in entries) {
      const entry = entries[i]
      if (entry.getBaseName() === '.portal.zip') continue;
      entry.isDirectory() ?
        archive.directory(entry.getPath(), entry.getBaseName()) :
        archive.file(entry.getPath(), {name: entry.getBaseName()})
    }
    archive.finalize();
    await readZipFile;
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
    const bytes = await readFile(outputPath);
    await this.sendSocketMsg(bytes);
    atom.notifications.addSuccess('Workplace files are sent to the server. Portal Start!');
    await deleteFile(outputPath)
  }

  // async addEventHandler(path, editor, self) {
  //   // this.docs[path] = this.connection.get(this.portalId, path);
  //   const handler = new EventHandler(this.docs[path], editor, path, this);
  //   this.eventHandlers[path] = handler;
  //   console.log('subscribed ' + path);
  //   self.subscriptions.add(...(this.shares[path].listen()));
  // }

  share(path, editor, self, isBackground) {
    this.docs[path] = this.connection.get(this.portalId, path)
    if (!this.shares[path]) this.shares[path] = new Share(this, path, editor)
    else if (editor) {
      this.shares[path].applyEditorBuffer(editor)
    }

    if (!isBackground) {
      const handler = new EventHandler(this.docs[path], editor, path, this);
      this.eventHandlers[path] = handler;
      console.log('subscribed ' + path);
      self.subscriptions.add(...(this.shares[path].listen()));
    }
  }

  // stopShare(path) {
  //   this.shares[path]
  // }

  isProjectFile(absolutePath) {
    const paths = atom.project.relativizePath(absolutePath);
    return {
      isProjectFile: this.projectPath === paths[0],
      relativePath: normalizePath(path[1])
    };
  }

}
