'use babel';

export default class PortalButtonView {

  constructor(props) {
    const {toolTipManager} = props;
    this.toolTipManager = toolTipManager;
    
    this.element = document.createElement('a');
    this.element.classList.add('portal');
    this.element.classList.add('inline-block');
    this.element.classList.add('icon');
    this.element.textContent = 'Portal';
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

  setCount(count) {
    const displayText = `There are ${count} words.`
    this.element.children[0].textContent = displayText;
  }

}
