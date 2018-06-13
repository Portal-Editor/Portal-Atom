'use babel';

import {CompositeDisposable} from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import {
  initAction,
  changeActiveStatusAction,
  normalizePath,
  openFileAction,
  createFileAction,
  deleteFileAction,
  changeFileAction,
  getFullPath,
  ACTION_TYPES} from './constant';
import EventHandler from './event-handler';
import Share from './share';
import BadgeView from './badge-view'
import streamifier from 'streamifier';
import unzip from 'unzip';
import fs from 'fs-extra'
import archiver from 'archiver'
import {promisify} from 'bluebird'
import chokidar from 'chokidar'

ShareDB.types.register(otText.type);

/* Connect to shareDB */
export default class PortalClient {
  constructor(props) {
    this.props = props;
    const {portalId, userId, projectPath, projectDir, treeView, emitter, portal, initNewPortal} = props;
    this.portalId = portalId;
    this.userId = userId;
    this.projectPath = projectPath;
    this.projectDir = projectDir;
    this.treeView = treeView;
    this.emitter = emitter;
    this.portal = portal;
    this.initNewPortal = initNewPortal;

    this.eventHandlers = {};    // listen to atom editor events and send
    this.shares = {};           // shareDB remote OT handler
    this.push = {}
    this.users = {}             // users
    this.files = {}             // other states of files
    this.fileSubscriptions = {}

    this.ws = new WebSocket(`ws:\/\/${atom.config.get('portal.serverAddress')}`);
    this.ws.on('open', this.init.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('error', this.wsError.bind(this))
  }

  init () {
    this.sendSocketMsg(initAction(this.portalId, this.userId, this.initNewPortal));
    this.connection = new ShareDB.Connection(this.ws);

    // systemWideEvent listener
    this.globalSubscriptions = new CompositeDisposable()
    this.globalSubscriptions.add(atom.workspace.observeTextEditors( editor => {
      console.log('local open file');
      let path = this.getNomalizedRelativePath(editor.getPath());
      if (path) {
        this.share(path, {editor, isBackground: false})
        this.sendSocketMsg(openFileAction(path, editor.getGrammar().scopeName))
      }
    }));

    this.globalSubscriptions.add(atom.workspace.onDidChangeActiveTextEditor( editor => {
      console.log('active changed');
      if (!editor) return this.sendSocketMsg(changeActiveStatusAction(null))
      const path = this.getNomalizedRelativePath(editor.getPath())
      this.sendSocketMsg(changeActiveStatusAction(path));
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
            this.sendSocketMsg(createFileAction(path, false, stats && stats.size ? fs.readFileSync(fullPath) : null))
            break;
          case 'addDir':
            this.sendSocketMsg(createFileAction(path, true, null))
            break;
          case 'unlink':
          case 'unlinkDir':
            console.log('local delete file:', path)
            this.sendSocketMsg(deleteFileAction(path, event === 'unlinkDir'))
            break;
          case 'change':
            if (this.push[path]) {
              let buffer = fs.readFileSync(fullPath)
              this.sendSocketMsg(changeFileAction(path, buffer))
            } else {
              this.push[path] = true
            }
        }
      })
  }

  async onMessage(msg) {
    const data = JSON.parse(msg);
    if (data.a !== 'meta') return;
    switch (data.type) {
      case ACTION_TYPES.INIT:
        this.users = data.users
        this.files = data.files
        this.currentUser = this.users[this.userId]
        this.currentUserBadge = new BadgeView({user: this.currentUser, showShortcut: false})
        this.portal.projectDirDOM.style.color = this.currentUser.color
        this.portal.projectDirDOM.appendChild(this.currentUserBadge.element)
        if (this.initNewPortal && data.portalId) {
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
        this.resetAllUserBadges();
        this.resetAllLockView();
        break;
      case ACTION_TYPES.INIT_FAILED:
        console.log('Init Failed.')
        atom.notifications.addError(data.msg)
        this.emitter.emit('closePoral');
        break;
      case ACTION_TYPES.SOCKET_CLOSE:
        atom.notifications.addInfo(data.userId + ' left.');
        for (let handler in this.eventHandlers.values()) {
          handler.resetMarker(data.userId);
        }
        break;
      case ACTION_TYPES.OPEN_FILE:
        console.log('remote open file ', data.path);
        const {path, grammar, activeUser} = data
        this.files[path] = {path, grammar, activeUser, isOccupied: true}
        this.share(data.path)
        this.toggleLockView(path, false)
        break;
      case ACTION_TYPES.USER_JOINED: {
        atom.notifications.addInfo(`${data.user.name} joined the portal.`)
        this.users[data.user.id] = data.user
        break;
      }
      case ACTION_TYPES.USER_LEFT: {
        const user = this.users[data.userId]
        atom.notifications.addInfo(`${user.name} left the portal.`)
        user.badge && user.badge.element.remove()
        delete this.users[user.id]
        Object.values(this.eventHandlers).forEach(handler => handler && handler.resetMarker(user.id))
        break;
      }
      case ACTION_TYPES.CLOSE_FILE: {
        const {path, userId} = data;
        const handler = this.eventHandlers[path]
        handler && handler.resetMarker(userId)
      }
      case ACTION_TYPES.CREATE_FILE: {
        const {path, isFolder, buffer, isOpen, reject} = data
        const fullPath = getFullPath(this.projectPath, path)
        if (fs.existsSync(fullPath)) return;
        if (isFolder) {
          fs.mkdir(fullPath, e => console.log(e))
        } else {
          if (reject && reject.error === 'FILE_IS_OCCUPIED') {
            atom.notifications.addError(`The file ${path} is occupied by other users.`)
          }
          let bytes = buffer && Buffer.from(buffer.data) || ''
          fs.ensureFileSync(fullPath, e => console.log(e))
          fs.writeFileSync(fullPath, bytes, e => console.log(e))
          if (isOpen) {
            this.share(path, {forceNew: true})
            this.toggleFileEntryView(path)
          }
        }
        break;
      }
      case ACTION_TYPES.CHANGE_FILE: {
        const {path, buffer} = data;
        const fullPath = getFullPath(this.projectPath, path)
        this.push[path] = false
        fs.writeFile(fullPath, Buffer.from(buffer.data), e => {
          if (e) return console.log(e)
          this.push[path] = true
        })
        this.eventHandlers[path] && this.eventHandlers[path].on(data)
        break;        
      }
      case ACTION_TYPES.DELETE_FILE: {
        const {path, isFolder} = data;
        const filePath = getFullPath(this.projectPath, path)
        if (!fs.existsSync(filePath)) return;
        if (isFolder) {
          fs.remove(filePath, e => console.log(e))
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
      case ACTION_TYPES.CHANGE_ACTIVE: {
        // TODO: update states in this.files
        const {path, oldPath, userId} = data;
        if (oldPath && this.files[oldPath] && this.files[oldPath].activeUser) {
          const activeUser = this.files[oldPath].activeUser
          this.files[oldPath].activeUser = activeUser.filter(id => id !== userId)
        }
        if (path) {
          if (!this.files[path]) this.files[path] = {}
          if (!this.files[path].activeUser) this.files[path].activeUser = []
          this.files[path].activeUser.push(userId)
          const entryDOM = this.treeView.entryForPath(getFullPath(this.projectPath, path))
          this.setUserBadge(entryDOM, userId)
        } else {
          this.users[userId].badge && this.users[userId].badge.element.remove()
        }
        break;
      }
      case ACTION_TYPES.OCCUPIER_CLEARED: {
        let file = this.files[data.path] || {}
        file.isOccupied = false
        this.files[data.path] = file
        this.toggleLockView(data.path, true)
      }
      case ACTION_TYPES.FILE_DELETED: {
        this.clearFileCache(data.path)        
      }
      default:
        const handler = this.eventHandlers[data.path];
        handler && handler.on({...data, user: data.userId && this.users[data.userId]});
    }
  }

  wsError() {
    atom.notifications.addError('Cannot establish Websocket connection. Please check your network or the server configuration.')
    this.emitter.emit('closePortal')
  }

  clearFileCache(path) {
    if (this.file && this.file[path]) {
      this.toggleLockView(path, true)
    }
    delete this.files[path]
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
  }

  disconnect() {
    try {
      Object.values(this.fileSubscriptions).forEach(subscription => subscription.dispose())
      Object.values(this.eventHandlers).forEach(handler => handler && handler.destroy())
      Object.values(this.users).forEach(user => user.badge && user.badge.element.remove())
      Object.values(this.files).forEach(file => file.lockView && file.lockView.remove())
      this.currentUserBadge.element.remove()
      this.globalSubscriptions.dispose()
      this.watcher.close()
      this.connection.close()
      this.ws.close()
    } catch (error) {
      // do nothing
    }
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
    const bytes = fs.readFileSync(outputPath);
    await this.sendSocketMsg(bytes);
    atom.notifications.addSuccess('Workplace files are sent to the server. Portal Start!');
    await fs.unlinkSync(outputPath)
  }

  share(path, opt) {
    const {editor=null, isBackground=true, forceNew=false} = opt || {};
    // this.docs[path] = this.connection.get(this.portalId, path)
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
    return this.projectPath === paths[0] && normalizePath(paths[1]) || null
  }

  resetAllUserBadges() {
    // init active users badges
    for (let path in this.files) {
      const file = this.files[path]
      if (file.activeUser && file.activeUser.length) {
        const entryDOM = this.treeView.entryForPath(getFullPath(this.projectPath, path))
        file.activeUser.filter(userId => userId !== this.userId)
                       .forEach(userId => this.setUserBadge(entryDOM, userId))
      }
    }
  }

  setUserBadge(entryDOM, userId) {
    if (entryDOM.classList.contains('directory')) {
      // in this case, the DOM is the view of a parent folder
      // which means the folder is collapsed in tree view
      entryDOM.firstElementChild.onclick = () => {
        // Why setImmediate:
        // To execute the codes AFTER the default onclick updates are done
        // Refer to Javascript Event Loops for more details
        setImmediate(() => {
          this.resetAllUserBadges();
          this.resetAllLockView();          
          console.log('reset all badges')
        })
      }
    } else {
      const user = this.users[userId]
      if (!user) return
      if (!user.badge) user.badge = new BadgeView({user})
      entryDOM.appendChild(user.badge.element)
    }
  }

  resetAllLockView() {
    for (let path in this.files) {
      if (this.files[path].isOccupied) {
        this.toggleLockView(path, false)
      }
    }
  }

  toggleLockView(path, shouldTurnOff) {
    if (shouldTurnOff) {
      this.files[path].lockView && this.files[path].lockView.remove()
      return;
    }

    // turn on lock
    const entryDOM = this.treeView.entryForPath(getFullPath(this.projectPath, path))
    if (entryDOM.classList.contains('directory')) {
      entryDOM.firstElementChild.onclick = () => {
        setImmediate(() => {
          this.resetAllLockView()
          this.resetAllUserBadges()
          console.log('reset all locking')
        })
      }
    } else {
      if (!this.files[path]) this.files[path] = {}
      const file = this.files[path]
      if (!file.lockView) file.lockView = getLockView();
      entryDOM.appendChild(file.lockView)

    }
  }

  toggleFileEntryView(path) {
    setTimeout(() => {
      this.toggleLockView(path)
      this.resetAllUserBadges()
    }, 30)
  }
}

const getLockView = () => {
  let view = document.createElement('span')
  view.classList.add('icon', 'icon-pin', 'mh2')
  view.style.color = '#ffaf1d'
  view.title = 'This file is opened by other user'
  return view;
}