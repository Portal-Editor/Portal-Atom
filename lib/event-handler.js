'use babel';

import {Point, Range} from 'atom';
import {
  changeGrammarAction,
  saveFileAction,
  closeFileAction,
  highlightAction,
  moveCursorAction,
  openFileAction,
  getFullPath,
  ACTION_TYPES
} from './constant';
import CursorIndicator from './cursor-indicator'

export default class EventHandler {
  constructor(editor, path, portalClient) {
    this.editor = editor;
    this.path = path;
    this.portalClient = portalClient;
    this.userId = this.portalClient.userId;
    this.buffer = this.editor.getBuffer();
    this.indicatorMap = new Map();
    this.highlightMap = new Map();
  }

  // TODO pass msg directly to hander function
  on(data) {
    switch (data.type) {
      case ACTION_TYPES.CHANGE_GRAMMAR:
        this.onGrammar(data.grammar);
        break;
      case ACTION_TYPES.MOVE_CURSOR:
        this.onCursorMoved(data.cursor, data.user);
        break;
      case ACTION_TYPES.HIGHLIGHT:
        this.onHighlight(data.newRange, data.userId);
        break;
      case ACTION_TYPES.CHANGE_FILE:
        this.onChange(data.path, data.buffer);
        break;
      default:
    }
  }

  onGrammar(grammar) {
    this.portalClient.push[this.path] = false
    this.editor.setGrammar(atom.grammars.grammarForScopeName(grammar));
    this.portalClient.push[this.path] = true
  }

  onCursorMoved(positionObj, user) {
    let overlayMarker = this.indicatorMap.resetMarker(user.id);
    overlayMarker = this.editor.markBufferPosition(Point.fromObject(positionObj), {
      'invalidate': 'never'
    });

    this.indicatorMap.set(user.id, overlayMarker);

    if (overlayMarker.isDestroyed()) {
      return;
    }
    this.editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'head',
      item: new CursorIndicator(user).element
    });
    console.log('onCursorMoved: ');
    console.log(positionObj);
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

  async onChange(path, buffer) {
    if (this.editor.getPath()) {
      if (Buffer.from(buffer.data).toString(this.editor.getEncoding()) === this.editor.getText()){
        this.portalClient.push[path] = false
        await this.editor.save();
        // The switch of push[path]=true is in portal-client.js L103
      }
    }
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
