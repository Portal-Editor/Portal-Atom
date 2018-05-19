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
      <div class='userName'>{portalClient.userId}</div>
      Connecting to
      <input ref='portalIdShowbox' class='input input-text tc f6' disabled={true} value={portalClient.portalId}/>
      <button ref='copyButton' class='btn' onClick={this.copyPortalId.bind(this)}>Copy</button>
      <button ref='closeButton' class='btn mh3' onClick={this.closePortal.bind(this)}>Close</button>
    </div> :
    <div>
      <div class='flex'>
        <TextEditor ref='userIdEditor' mini={true} placeholderText='User ID'/>
        <div>
          <label class='mv0'>Share
            <input ref='shareToggler' class='input-toggle' checked={false}
                 type='checkbox' onClick={this.initPortal.bind(this)} />
          </label>
        </div>
      </div>
      <div class='flex'>
        <TextEditor ref='portalIdEditor' mini={true} placeholderText='Portal ID'/>
        <button ref='joinButton' class='btn' onClick={this.joinPortal.bind(this)}>Go</button>
      </div>
    </div>
  }

  initPortal() {
    const userId = this.refs.userIdEditor.getText();
    this.emitter.emit('joinPortal', {portalId: null, userId})
  }

  joinPortal() {
    const userId = this.refs.userIdEditor.getText();
    const portalId = this.refs.portalIdEditor.getText();
    console.log(portalId);
    this.emitter.emit('joinPortal', {portalId, userId})
  }

  closePortal() {
    this.update({portalClient: null})
    this.emitter.emit('closePortal')
  }

  copyPortalId() {
    atom.clipboard.write(this.props.portalClient.portalId)
  }

  // pastePortalId() {
  //   const text = atom.clipboard.readWithMetadata()
  //   if (text.length === 36) {
  //     this.refs.portalIdEditor.setText(text)
  //   }
  // }

  update(newProps) {
    if (newProps.portalClient && newProps.portalClient !== this.props.portalClient) {
      this.props.portalClient = newProps.portalClient;
    }
    return etch.update(this);
  }

}
