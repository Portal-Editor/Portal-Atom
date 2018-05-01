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

    this.emitter.on('JOIN_PORTAL', ({sessionId}) => {
      this.connect(sessionId);
    })
  }

  connect(sessionId, clientId) {
    this.initProjectPath();
    this.portalClient = new PortalClient({
      ...defaultConfig,
      sessionId,
      clientId
    });
  }

  initProjectPath() {
    const paths = atom.project.getPaths();
    switch (paths.length) {
      case 0:
        this.notificationManager.addWarning('Please add a project folder to Atom before you join portal.')
        break;
      case 1:
        this.notificationManager.addSuccess(`Using ${paths[0]} as the portal workplace.`)
        this.path = paths[0];
        break;
      default:
        this.notificationManager.addInfo(`Portal doesn't support multi-directory yet.`)
        console.log('bad');
    }
  }

  consumeStatusBar(statusBar) {
    this.portalButton = new PortalButtonView({
      statusBar,
      emitter: this.emitter,
      toolTipManager: this.toolTipManager
    });
    this.portalButton.attach();
    // this.portalButton = statusBar.addRightTile({item: this.portalButtonView, priority: 100});
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
    this.subscriptions.add(atom.commands.add(this.portalButton.toolTipComponent.textEditor, {
      'core:confirm': () => this.connect('12345'),
      'core:cancel': () => this.portalButton.toolTipComponent.close()
    }));
    console.log('Portal was toggled!');
  }

};
