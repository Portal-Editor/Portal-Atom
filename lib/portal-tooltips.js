'use babel';
/** @jsx etch.dom */
const etch = require('etch')
const $ = etch.dom
const {TextEditor} = require('atom')

export default class PortalTooltips{
  constructor(props) {
    this.props = props;
    const {emitter} = props;
    this.emitter = emitter;
    etch.initialize(this);
  }

  render() {
    const {portalClient} = this.props;
    return portalClient ?
    <div>
      Connected to {portalClient.portalId}
    </div> :
    <div>
      <TextEditor ref='clientIdEditor' mini={true} placeholderText='Client ID'/>
      <div class='flex'>
        <TextEditor ref='portalIdEditor' mini={true} placeholderText='Portal ID' tabIndex='0'/>
        <button ref='joinButton' class='btn' onClick={this.joinPortal.bind(this)}>Go</button>
      </div>
    </div>
  }

  joinPortal() {
    const clientId = this.refs.clientIdEditor.getText();
    const portalId = this.refs.portalIdEditor.getText();
    console.log(portalId);
    this.emitter.emit('JOIN_PORTAL', {portalId, clientId})
  }

  update(newProps) {
    if (newProps.portalClient !== this.props.portalClient) {
      this.props.portalClient = newProps.portalClient;
    }
    return etch.update(this);
  }

}
