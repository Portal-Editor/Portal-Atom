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
    const {text} = this.props;
    return (<div class='flex'>
      <TextEditor ref='textEditor'
                  mini={true}
                  placeholderText='input here...'/>
      <button ref='joinButton' class='btn'
              onClick={this.joinPortal.bind(this)}>Go</button>
    </div>)
  }

  joinPortal() {
    const sessionId = this.refs.textEditor.getText();
    console.log(sessionId);
    this.emitter.emit('JOIN_PORTAL', {sessionId})
  }

  update() {
    return etch.update(this);
  }

}
