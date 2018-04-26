'use babel';

import PortalButtonView from './portal-button-view';
import { CompositeDisposable } from 'atom';

module.exports = class Portal {
  constructor(props) {
    const {toolTipManager, config, workspace, notificationManager} = props;

    this.toolTipManager = toolTipManager;
    this.config = config;
    this.workspace = workspace;
    // this.notificationManager = notificationManager;
  }

  activate(state) {
    // this.portalButtonView = new PortalButtonView(state.portalViewState);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'portal:toggle': () => this.toggle()
    }));
  }

  consumeStatusBar(statusBar) {
    this.portalButton = new PortalButtonView({
      statusBar,
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
      portalViewState: this.portalButtonView.serialize()
    };
  }

  toggle() {
    console.log('Portal was toggled!');
  }

};
