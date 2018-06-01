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
      const {userId, portalId} = props
      if (userId.length < 2 || portalId.length < 2) {
        atom.notifications.addWarning('The User Id and Portal Id should be more than 2 letters. Please check your input.')
        return;
      }
      this.connect(props);
      if (!this.portalClient) {
        atom.notifications.addError('Failed in creating portal. Please try again.')
      }
    })

    let notificationManager = this.notificationManager
    let self = this

    this.emitter.on("closePortal", (() => {
      this.portalClient.disconnect()
      delete this.portalClient
      if (this.projectDirDOM) this.projectDirDOM.style.color = 'unset'
      this.portalButton.toolTipComponent.update({portalClient: null})
    }).bind(this))
  }

  async connect({portalId, userId, initNewPortal}) {
    this.initProjectPath();
    if (!this.projectPath) return;
    this.portalClient = new PortalClient({
      portalId,
      userId,
      projectPath: this.projectPath,
      projectDir: this.projectDir,
      treeView: this.treeView,
      emitter: this.emitter,
      portal: this,
      initNewPortal
    });
    await this.portalButton.toolTipComponent.update({portalClient: this.portalClient});
  }

  initProjectPath() {
    const dirs = atom.project.getDirectories();
    switch (dirs.length) {
      case 0:
        this.notificationManager.addError('Please add a project folder to Atom before you join portal.')
        return;
      case 1:
        this.projectPath = dirs[0].path;
        this.projectDir = dirs[0];
        break;
      default:
        this.projectPath = dirs[0].path;
        this.projectDir = dirs[0];
    }
    this.projectDirDOM = this.treeView.entryForPath(this.projectPath).firstElementChild
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

  consumeTreeView(treeView) {
    this.treeView = treeView
  }

  deactivate() {
    this.portalButton.destroy();
    this.subscriptions.dispose();
    this.portalButtonView.destroy();
    this.portalClient && this.portalClient.disconnect();
  }

  serialize() {
    return {
    };
  }

  toggle() {
    console.log('Portal was toggled!');
  }

};
