'use babel';

import PortalButtonView from './portal-button-view';
import PortalClient from './portal-client';
import { CompositeDisposable, Emitter} from 'atom';
import { activePaneItemChangedAction, normalizePath } from './constant';

// TODO: move to atom.config
const defaultConfig = {
  host: '118.24.149.123',
  port: 9090,
  clientId: 1
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

    this.emitter.on("closePortal", () => {
      this.portalClient.destroy();
      this.subscriptions.dispose();
      this.portalButton.toolTipComponent.update({portalClient: null})
    })

    this.emitter.on('systemWideEvent', props => {
      switch (props.type) {
        case 'activePaneItemChanged':
          this.syncTab = false;
          let targetUri = path.join(this.coeditor.projectPath, data.uri);
          atom.workspace.open(targetUri).then( () => {
            this.syncTab = true;
          });
          break;
        case 'editorClosed':
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
          atom.notifications.addInfo(data.clientId + ' left.');
          for (let handler in this.eventHandlers.values()) {
            handler.resetMarker(data.clientId);
          }
      }
    })
  }

  async connect({portalId, clientId}) {
    this.initProjectPath();
    if (!this.projectPath) return;
    this.portalClient = new PortalClient({
      ...defaultConfig,
      portalId,
      clientId,
      projectPath: this.projectPath,
      emitter: this.emitter
    });
    await this.portalButton.toolTipComponent.update({portalClient: this.portalClient});

    this.subscriptions.add(atom.workspace.observeTextEditors(
      (editor => {
        let editorPath = editor.getPath();
        if (editorPath.startsWith(this.projectPath)) {
          this.portalClient.subscribe(atom.project.relativizePath(editorPath)[1], editor, this);
        }
      }).bind(this)
    ));

    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem( item => {
      if (!this.portalClient.syncTab || !atom.workspace.isTextEditor(item)) {
        return;
      }
      const {isProjectFile, relativePath} = this.isProjectFile(item.getPath());
      if (isProjectFile){
        this.portalClient.sendSocketMsg(activePaneItemChangedAction(relativePath));
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
