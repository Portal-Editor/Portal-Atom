'use babel';

import {Point, Range} from 'atom';
import {
  changeGrammarAction,
  saveFileAction,
  closeFileAction,
  highlightAction,
  moveCursorAction,
  openFileAction,
  ACTION_TYPES
} from './constant';

export default class EventHandler {
  constructor(doc, editor, path, portalClient) {
    // this.doc = doc;
    this.editor = editor;
    this.path = path;
    this.portalClient = portalClient;
    this.userId = this.portalClient.userId;
    this.push = true;
    this.buffer = this.editor.getBuffer();
    this.indicatorMap = new Map();
    this.highlightMap = new Map();
  }

  doc() {
    return this.portalClient.docs[this.path]
  }

  // TODO pass msg directly to hander function
  on(data) {
    switch (data.type) {
      case ACTION_TYPES.CHANGE_GRAMMAR:
        this.onGrammar(data.grammar);
        break;
      case ACTION_TYPES.MOVE_CURSOR:
        this.onCursorMoved(data.cursor, data.userId, data.indicatorColor);
        break;
      case ACTION_TYPES.HIGHLIGHT:
        this.onHighlight(data.newRange, data.userId);
        break;
      case ACTION_TYPES.SAVE_FILE:
        this.onSave(data.path);
        break;
      default:
    }
  }

  onGrammar(grammar) {
    this.editor.setGrammar(atom.grammars.grammarForScopeName(grammar));
  }

  onCursorMoved(positionObj, userId, indicatorColor) {
    // type = overlay
    let overlayMarker = this.indicatorMap.resetMarker(userId);

    overlayMarker = this.editor.markBufferPosition(Point.fromObject(positionObj), {
      'invalidate': 'never'
    });

    this.indicatorMap.set(userId, overlayMarker);

    if (overlayMarker.isDestroyed()) {
      return;
    }
    this.editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'head',
      item: this.getIndicator(userId, indicatorColor)
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

  onHighlight(rangeObj, userId) {

    let marker = this.highlightMap.resetMarker(userId);

    if (Point.fromObject(rangeObj.start).isEqual(Point.fromObject(rangeObj.end))) {
      return;
    }
    marker = this.editor.markBufferRange(Range.fromObject(rangeObj), {
      invalidate: 'never'
    });
    this.highlightMap.set(userId, marker);
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
  }

  resetMarker(userId) {
    this.highlightMap.resetMarker(userId);
    this.indicatorMap.resetMarker(userId);
  }

  // TODO more cleanups required
  destroy() {
    this.editor.getDefaultMarkerLayer().clear();
  }
}

Map.prototype.resetMarker = function(userId) {
  let marker = this.get(userId);
  if (typeof marker !== 'undefined') {
    marker.destroy();
  }
  return marker;
}
