'use babel';

// import fs from 'fs'
// import archiver from 'archiver'
// import {promisify} from 'bluebird'
import crypto from 'crypto'
import PortalButtonView from './portal-button-view';
import PortalClient from './portal-client';
import { CompositeDisposable, Emitter} from 'atom';
import {
  changeActiveStatus,
  normalizePath,
  openFileAction,
  ACTION_TYPES } from './constant';

module.exports = class Portal { 
  constructor(props) {
    const {toolTipManager, workspace, notificationManager} = props;

    this.toolTipManager = toolTipManager;
    this.workspace = workspace;
    this.emitter = new Emitter();
    this.notificationManager = notificationManager;
    this.config = {
      serverAddress: {
        type: 'string',
        default: '118.24.149.123:9090',
        order: 1
      },
      githubAuthorizationKey: {
        type: 'string',
        default: crypto.randomBytes(5).toString('hex'),
        order: 2
      },
      lineEnding: {
        type: 'string',
        default: 'CRLF',
        enum: ['CRLF', 'LF'],
        order: 3
      }
    }
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

    this.emitter.on('systemWideEvent', data => {
      switch (data.type) {
        case ACTION_TYPES.CHANGE_ACTIVE:
          this.syncTab = false;
          let targetUri = path.join(this.coeditor.projectPath, data.uri);
          atom.workspace.open(targetUri).then( () => {
            this.syncTab = true;
          });
          break;
        case ACTION_TYPES.CLOSE_FILE:
          // let targetPath = data.path;
          // atom.workspace.getTextEditors().forEach( item => {
          //   let itemPath = item.getPath();
          //   let paths = atom.project.relativizePath(itemPath);
          //   paths[1] = normalizePath(paths[1]);
          //   if (itemPath && paths[1] === targetPath) {
          //     let pane = atom.workspace.paneForItem(item);
          //     pane.destroyItem(item);
          //     return;
          //   }
          // });
          break;
      }
    })
  }

  async connect({portalId, userId}) {
    this.initProjectPath();
    if (!this.projectPath) return;
    this.portalClient = new PortalClient({
      portalId,
      userId,
      projectPath: this.projectPath,
      projectDir: this.projectDir,
      emitter: this.emitter,
      portal: this
    });
    // this.uploadZippedProjectFile()
    await this.portalButton.toolTipComponent.update({portalClient: this.portalClient});
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
