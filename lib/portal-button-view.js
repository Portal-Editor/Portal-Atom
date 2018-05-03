'use babel';
import PortalTooltips from './portal-tooltips';

export default class PortalButtonView {

  constructor(props) {
    this.props = props;
    const {toolTipManager, emitter, portalClient} = props;
    this.toolTipManager = toolTipManager;
    this.toolTipComponent = new PortalTooltips({
      emitter,
      portalClient
    });
    this.element = buildElement();
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  attach() {
    this.tile = this.props.statusBar.addRightTile({item: this.element, priority: 100});
    this.toolTip = this.toolTipManager.add(this.element, {
      item: this.toolTipComponent,
      class: 'portal-tooltips',
      trigger: 'click',
      placement: 'top'
    });
  }

}

const buildElement = props => {
  const element = document.createElement('a');
  element.classList.add('portal');
  element.classList.add('inline-block');
  element.classList.add('icon');
  element.textContent = 'Portal';
  return element;
}
