'use babel';

import PortalView from './portal-view';
import { CompositeDisposable } from 'atom';

export default {

  portalView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.portalView = new PortalView(state.portalViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.portalView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'portal:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.portalView.destroy();
  },

  serialize() {
    return {
      portalViewState: this.portalView.serialize()
    };
  },

  toggle() {
    console.log('Portal was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
