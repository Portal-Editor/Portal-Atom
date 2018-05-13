'use babel';

import {Point, Range} from 'atom';
import {
  changeGrammarAction,
  saveAction,
  editorClosedAction,
  highlightAction,
  cursorMovedAction,
  addTabAction
} from './constant'

export default class EventHandler {
  constructor(doc, editor, path, portalClient) {
    this.doc = doc;
    this.editor = editor;
    this.path = path;
    this.portalClient = portalClient;
    this.clientId = this.portalClient.clientId;
    this.push = true;
    this.buffer = this.editor.getBuffer();
    this.indicatorMap = new Map();
    this.highlightMap = new Map();

    this.doc.subscribe( (error) => {
      if (error) throw error;
      if (this.doc.type === null) {
        this.doc.create(this.buffer.getText(), 'text');
      } else {
        let data = this.doc.data;
        this.modify( () => {
          this.buffer.setText(data);
        })
      }

      this.portalClient.sendSocketMsg(addTabAction(path));
    });
  }

  listen() {
    // remote OT events
    this.doc.on('op', (op, source) => {
      if (source) {
        return;
      }
      console.log('on OP:');
      console.log(op);

      var pos = 0;
      for (var i = 0; i < op.length; i++) {
        var component = op[i];
        switch (typeof component) {
          case 'number':
            pos += component;
            break;
          case 'string':
            this.onInsert(pos, component);
            pos += component.length;
            break;
          case 'object':
            this.onRemove(pos, component.d);
            break;
          default:
            break;
        }
      }
    });

    // local events
    let disposables = [];

    disposables.push(this.editor.onDidChangeGrammar( () => {
      this.portalClient.sendSocketMsg(changeGrammarAction(
        this.path,
        this.editor.getGrammar().scopeName
      ));
    }));

    disposables.push(this.editor.onDidSave( (event) => {
      if (!this.push) {
        return;
      }
      this.portalClient.sendSocketMsg(saveAction(this.path));
    }));

    disposables.push(this.editor.onDidDestroy( () => {
      this.portalClient.sendSocketMsg(editorClosedAction(this.path, this.clientId));
    }));

    disposables.push(this.editor.onDidChangeSelectionRange( (event) => {
      if (!this.push) {
        return;
      }
      console.log('on did change selection range');
      this.portalClient.sendSocketMsg(highlightAction(
        this.path,
        event.newBufferRange,
        this.clientId
      ));
    }));

    disposables.push(this.editor.onDidChangeCursorPosition( (event) => {
      console.log('on did change cursor position');
      this.portalClient.sendSocketMsg(cursorMovedAction(
        this.path,
        // atom.config.get('coeditor.indicatorBackgroundColor'),
        '#66ccff',
        event.newBufferPosition,
        this.clientId
      ));

      let position = this.buffer.characterIndexForPosition(event.newBufferPosition);
      let op = [position, {d: 0}];
      this.doc.submitOp(op);
    }));

    disposables.push(this.buffer.onDidChange((event) => {
      if (!this.push) {
        return;
      }
      console.log('on did change text');
      // remove text event
      if (event['oldText'].length !== 0) {
        let lineEnding = atom.config.get('coeditor.lineEnding');
        let oldText = lineEnding === 'CRLF' ?
                      event['oldText'].replace(/\r?\n/g, "\r\n") :
                      event['oldText'];
        console.log(oldText.length);
        let startPoint = event['oldRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, {d: oldText.length}];
        this.doc.submitOp(op);
      }
      // insert text event
      if (event['newText'].length !== 0) {
        let startPoint = event['newRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, event['newText']];
        this.doc.submitOp(op);
      }
    }));

    return disposables;
  }

  // TODO pass msg directly to hander function
  on(data) {
    switch (data.type) {
      case 'grammar':
        this.onGrammar(data.grammar);
        break;
      case 'cursorMoved':
        this.onCursorMoved(data.newPosition, data.clientId, data.indicatorColor);
        break;
      case 'highlight':
        this.onHighlight(data.newRange, data.clientId);
        break;
      case 'save':
        this.onSave(data.path);
        break;
      default:
    }
  }

  onGrammar(grammar) {
    this.editor.setGrammar(atom.grammars.grammarForScopeName(grammar));
  }

  onCursorMoved(positionObj, clientId, indicatorColor) {
    // type = overlay
    let overlayMarker = this.indicatorMap.resetMarker(clientId);

    overlayMarker = this.editor.markBufferPosition(Point.fromObject(positionObj), {
      'invalidate': 'never'
    });

    this.indicatorMap.set(clientId, overlayMarker);

    if (overlayMarker.isDestroyed()) {
      return;
    }
    this.editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'head',
      item: this.getIndicator(clientId, indicatorColor)
    });
    console.log('onCursorMoved: ');
    console.log(positionObj);
  }

  getIndicator(text, indicatorColor) {
    let indicatorDiv = document.createElement('div');
    Object.assign(indicatorDiv.style, {
      transform: 'translate(0, -100%)',
      display: 'flex'
    });

    let cursorDiv = document.createElement('div');
    Object.assign(cursorDiv.style, {
      alignItems: 'stretch',
      borderLeft: '2px solid ' + indicatorColor
      // borderLeft: '2px solid rgba(31, 161, 93, 1)'
    });
    cursorDiv.animate([
      {opacity: '1'},
      {opacity: '0'}
    ], {
      duration: 300,
      iterations: 'Infinity',
      direction: 'alternate'
    });
    indicatorDiv.appendChild(cursorDiv);

    let textDiv = document.createElement('div');
    textDiv.textContent = text;
    let style = {
      alignItems: 'stretch',
      backgroundColor: indicatorColor,
      paddingLeft: '1px',
      fontFamily: 'comic sans, comic sans ms, cursive, verdana, arial, sans-serif'
    }
    Object.assign(textDiv.style, style);
    indicatorDiv.appendChild(textDiv);

    return indicatorDiv;
  }

  onHighlight(rangeObj, clientId) {

    let marker = this.highlightMap.resetMarker(clientId);

    if (Point.fromObject(rangeObj.start).isEqual(Point.fromObject(rangeObj.end))) {
      return;
    }
    marker = this.editor.markBufferRange(Range.fromObject(rangeObj), {
      invalidate: 'never'
    });
    this.highlightMap.set(clientId, marker);
    this.editor.decorateMarker(marker, {
      type: 'highlight',
      class: 'selection'
    });
  }

  onSave(relativePath) {
    this.modify( async () => {
      console.log('on save: ');
      console.log(atom.project.getPaths());
      if (typeof this.editor.getPath() !== 'undefined') {
        this.editor.save();
      }
    });
    // atom.workspace.getActivePane().saveItem(atom.workspace.getActivePaneItem());
    // if (typeof this.editor.getPath() !== 'undefined') {
    //   this.editor.save();
    // } else {
    //   let absolutePath = path.join(atom.project.getPaths()[0], relativePath);
    //   this.editor.saveAs(absolutePath);
    // }
  }

  onInsert(position, text) {
    this.modify( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      this.buffer.insert(from, text);
    })
  }

  onRemove(position, length) {
    this.modify( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      let to = this.buffer.positionForCharacterIndex(position + length);
      this.buffer.delete([from.toArray(), to.toArray()]);
    })
  }

  modify(callback) {
    this.push = false;
    callback();
    this.push = true;
  }

  resetMarker(clientId) {
    this.highlightMap.resetMarker(clientId);
    this.indicatorMap.resetMarker(clientId);
  }

  // TODO more cleanups required
  destroy() {
    this.editor.getDefaultMarkerLayer().clear();
  }
}

Map.prototype.resetMarker = function(clientId) {
  let marker = this.get(clientId);
  if (typeof marker !== 'undefined') {
    marker.destroy();
  }
  return marker;
}
