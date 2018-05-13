'use babel';

import fs from 'fs'
import archiver from 'archiver'
import {promisify} from 'bluebird'
import PortalButtonView from './portal-button-view';
import PortalClient from './portal-client';
import { CompositeDisposable, Emitter} from 'atom';
import { changeActiveStatus, normalizePath, ACTION_TYPES } from './constant';

// TODO: move to atom.config
const defaultConfig = {
  host: '118.24.149.123',
  port: 9090,
  userId: 1
};

module.exports = class Portal {
  constructor(props) {
    const {toolTipManager, workspace, notificationManager} = props;

    this.toolTipManager = toolTipManager;
    this.workspace = workspace;
    this.emitter = new Emitter();
    this.notificationManager = notificationManager;
  }

  activate(state) {
    // this.portalButtonView = new PortalButtonView(state.portalViewState);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'portal:toggle': () => this.toggle()
    }));

    this.emitter.on('joinPortal', props => {
      this.connect(props);
      if (!this.portalClient) return;
    })

    let notificationManager = this.notificationManager
    let self = this

    this.emitter.on("closePortal", (() => {
      this.subscriptions.clear()
      this.subscriptions.dispose()
    }).bind(this))

    this.emitter.on('systemWideEvent', props => {
      switch (props.type) {
        case ACTION_TYPES.CHANGE_ACTIVE:
          this.syncTab = false;
          let targetUri = path.join(this.coeditor.projectPath, data.uri);
          atom.workspace.open(targetUri).then( () => {
            this.syncTab = true;
          });
          break;
        case ACTION_TYPES.CLOSE_FILE:
          let targetPath = data.path;
          atom.workspace.getPaneItems().forEach( (item) => {
            let itemPath = item.getPath();
            let paths = atom.project.relativizePath(itemPath);
            paths[1] = normalizePath(paths[1]);
            if (typeof itemPath !== 'undefined' && paths[1] === targetPath) {
              let pane = atom.workspace.paneForItem(item);
              pane.destroyItem(item);
              return;
            }
          });
        case 'socketClose':
          atom.notifications.addInfo(data.userId + ' left.');
          for (let handler in this.eventHandlers.values()) {
            handler.resetMarker(data.userId);
          }
      }
    })
  }

  async connect({portalId, userId}) {
    this.initProjectPath();
    if (!this.projectPath) return;
    this.portalClient = new PortalClient({
      ...defaultConfig,
      portalId,
      userId,
      projectPath: this.projectPath,
      emitter: this.emitter
    });
    this.uploadZippedProjectFile()
    await this.portalButton.toolTipComponent.update({portalClient: this.portalClient});

    this.subscriptions.add(atom.workspace.observeTextEditors(
      (editor => {
        let editorPath = editor.getPath();
        if (editorPath.startsWith(this.projectPath)) {
          let path = atom.project.relativizePath(editorPath)[1];
          this.portalClient.addShareHandler(path, editor)
          this.portalClient.addEventHandler(path, editor, this);
        }
      }).bind(this)
    ));

    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem( item => {
      console.log('active changed');
      if (!this.portalClient.syncTab || !atom.workspace.isTextEditor(item)) {
        return;
      }
      const {isProjectFile, relativePath} = this.isProjectFile(item.getPath());
      if (isProjectFile){
        this.portalClient.sendSocketMsg(changeActiveStatus(relativePath));
      }
    }));
  }

  isProjectFile(absolutePath) {
    const paths = atom.project.relativizePath(absolutePath);
    return {
      isProjectFile: this.projectPath === paths[0],
      relativePath: normalizePath(path[1])
    };
  }

  initProjectPath() {
    const dirs = atom.project.getDirectories();
    switch (dirs.length) {
      case 0:
        this.notificationManager.addError('Please add a project folder to Atom before you join portal.')
        break;
      case 1:
        this.projectPath = dirs[0].path;
        this.projectDir = dirs[0];
        this.notificationManager.addSuccess(`Using ${this.projectPath} as the Portal workplace.`)
        break;
      default:
        this.projectPath = dirs[0].path;
        this.projectDir = dirs[0];
        this.notificationManager.addInfo(`Sorry. Portal doesn't support multi-directory yet. Using ${this.projectPath} as the Portal workplace.`)
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

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', function() {
      console.log('Data has been drained');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function(err) {
      throw err;
    });
    // pipe archive data to the file
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
    await self.portalClient.sendSocketMsg(bytes);
    this.notificationManager.addSuccess('Workplace files are sent to the server. Portal Start!');
    await deleteFile(outputPath)
  }

  consumeStatusBar(statusBar) {
    this.portalButton = new PortalButtonView({
      statusBar,
      emitter: this.emitter,
      toolTipManager: this.toolTipManager,
      portalClient: this.portalClient
    });
    this.portalButton.attach();
  }

  deactivate() {
    this.portalButton.destroy();
    this.subscriptions.dispose();
    this.portalButtonView.destroy();
  }

  serialize() {
    return {
      // portalViewState: this.portalButtonView.serialize()
    };
  }

  toggle() {
    console.log('Portal was toggled!');
  }

};
