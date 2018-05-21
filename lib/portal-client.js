'use babel';

import {CompositeDisposable} from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {
  initAction,
  changeActiveStatus,
  normalizePath,
  openFileAction,
  createFileAction,
  deleteFileAction,
  ACTION_TYPES} from './constant';
import EventHandler from './event-handler';
import Share from './share';
import streamifier from 'streamifier';
import unzip from 'unzip';
import fs from 'fs'
import archiver from 'archiver'
import {promisify} from 'bluebird'
import chokidar from 'chokidar'

ShareDB.types.register(otText.type);

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {portalId, userId, projectPath, projectDir, emitter, portal} = props;
    this.portalId = portalId;
    this.userId = userId;
    this.projectPath = projectPath;
    this.projectDir = projectDir;
    this.emitter = emitter;
    this.portal = portal;

    this.docs = {};             // shareDB snapshots
    this.eventHandlers = {};    // listen to atom editor events and send
    this.shares = {};           // shareDB remote OT handler
    this.push = {}
    this.users = {}             // users
    this.files = {}             // other states of files
    this.fileSubscriptions = {}

    this.ws = new WebSocket(`ws:\/\/${atom.config.get('Portal.serverAddress')}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('close', this.wsClose.bind(this));
  }

  init () {
    this.sendSocketMsg(initAction(this.portalId, this.userId));
    this.connection = new ShareDB.Connection(this.ws);
    atom.notifications.addSuccess('Connected to: ' + this.ws.url);
    // this.uploadZippedProjectFile();

    // systemWideEvent listener
    this.portal.subscriptions.add(atom.workspace.observeTextEditors( editor => {
      console.log('local open file');
      let path = this.getNomalizedRelativePath(editor.getPath());
      if (path) {
        this.share(path, {editor, isBackground: false})
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

  startFileTreeWatcher() {
    this.watcher = chokidar.watch(this.projectPath, {
      ignored: 'node_module/*',
      ignoreInitial: '.',
      persistent: true
    })
    this.watcher
      .on('all', (event, fullPath, stats) => {
        const path = this.getNomalizedRelativePath(fullPath)
        if (!path) return;
        switch (event) {
          case 'add':
            console.log('create file:', path)
            this.sendSocketMsg(createFileAction(path, false, stats.size ? fs.readFileSync(fullPath) : null))
            break;
          case 'addDir':
            this.sendSocketMsg(createFileAction(path, true, null))
            break;
          case 'unlink':
            this.clearFileCache(path)          
          case 'unlinkDir':
            this.sendSocketMsg(deleteFileAction(path, event === 'unlinkDir'))
        }
      })
  }

  async onMessage(msg) {
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
        if (!this.portalId && data.portalId) {
          this.portalId = data.portalId
          this.portal.portalButton.toolTipComponent.update({portalId: data.portalId})
          await this.uploadZippedProjectFile()
          this.startFileTreeWatcher()
        } else if (data.data) {
          try {
            const unzipStream = unzip.Extract({path: this.projectPath})
            unzipStream.on('close', this.startFileTreeWatcher.bind(this))
            streamifier.createReadStream(Buffer.from(data.data))
                  .pipe(unzipStream);
          } catch (e) {
            console.log(e);
          }
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
        this.share(data.path)
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
      case ACTION_TYPES.CREATE_FILE: {
        // TODO: folder not exists
        const {path, isFolder, buffer, isOpen, reject} = data
        const fullPath = `${this.projectPath}\/${path}`
        if (fs.existsSync(fullPath)) return;
        if (isFolder) {
          fs.mkdir(fullPath, e => console.log(e))
        } else {
          if (reject && reject.error === 'FILE_IS_OCCUPIED') {
            atom.notifications.addError(`The file ${path} is occupied by other users.`)
          }
          let bytes = buffer && Buffer.from(buffer) || ''
          fs.writeFileSync(fullPath, bytes, e => console.log(e))
          isOpen && this.share(path, {forceNew: true})
        }
        break;
      }
      case ACTION_TYPES.SAVE_FILE: {
        const {path} = data;
        if (!this.eventHandlers[path]) {
          this.shares[path].saveFileInBackground()
        } else {
          this.eventHandlers[path].on(data)
        }
        break;        
      }
      case ACTION_TYPES.DELETE_FILE: {
        const {path, isFolder} = data;
        const filePath = `${this.projectPath}\/${path}`
        if (!fs.existsSync(filePath)) return;
        if (isFolder) {
          fs.rmdir(filePath, e => console.log(e))
        } else {
          try {
            fs.unlinkSync(filePath)
          } catch (e) {
            console.log(e)
            return;
          }
          this.clearFileCache(path)
        }
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

  clearFileCache(path) {
    if (this.fileSubscriptions[path]) {
      this.fileSubscriptions[path].dispose()
      this.fileSubscriptions[path] = null
    }
    if (this.shares[path]) {
      this.shares[path].close()
      this.shares[path] = null
    }
    if (this.eventHandlers[path]) {
      this.eventHandlers[path] = null
    }
    if (this.docs[path]) {
      this.docs[path].unsubscribe()
      this.docs[path].data = undefined
      this.docs[path].destroy()
    }
    this.docs[path] = null
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

  share(path, opt) {
    const {editor=null, isBackground=true, forceNew=false} = opt || {};
    this.docs[path] = this.connection.get(this.portalId, path)
    if (!this.shares[path] || forceNew) this.shares[path] = new Share(this, path, editor)
    else if (editor) {
      this.shares[path].applyEditorBuffer(editor)
    }

    if (!isBackground) {
      this.eventHandlers[path] = new EventHandler(editor, path, this);
      console.log('subscribed ' + path);
      this.fileSubscriptions[path] = new CompositeDisposable();
      this.fileSubscriptions[path].add(...(this.shares[path].listen()))
    }
  }

  isProjectFile(absolutePath) {
    const paths = atom.project.relativizePath(absolutePath);
    return {
      isProjectFile: this.projectPath === paths[0],
      relativePath: normalizePath(path[1])
    };
  }

  
  getNomalizedRelativePath = fullPath => {
    const paths = atom.project.relativizePath(fullPath)
    return this.projectPath === paths[0] && normalizePath(paths[1])
  }

}
