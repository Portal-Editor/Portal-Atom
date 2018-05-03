'use babel';

import PortalButtonView from './portal-button-view';
import PortalClient from './portal-client';
import { CompositeDisposable, Emitter} from 'atom';

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

    this.emitter.on('JOIN_PORTAL', props => {
      this.connect(props);
      if (!this.portalClient) return;
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
          this.portalClient.subscribe(atom.project.relativizePath(editorPath)[1], editor);
        }
      }).bind(this)
    ));
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
