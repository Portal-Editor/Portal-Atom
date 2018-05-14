'use babel';

import fs from 'fs'
import {
  changeGrammarAction,
  saveFileAction,
  closeFileAction,
  highlightAction,
  moveCursorAction,
  openFileAction,
  ACTION_TYPES
} from './constant';

export default class Share {
  constructor(portalClient, path, editor) {
    // this.doc = doc;
    this.portalClient = portalClient
    this.editor = editor;
    this.path = path;
    this.push = true;
    this.filePath = this.portalClient.projectPath + '/' + path

    this.buffer = this.editor ? this.editor.getBuffer() :
                                fs.readFileSync(this.filePath, 'utf8');
    // if (!this.doc().type) this.doc().create(this.editor ? this.buffer.getText() : this.buffer, 'text')
    this.doc().subscribe(err => {
      if (err) throw err;
      if (!this.doc().type && editor) {
        this.doc().create(this.buffer.getText(), 'text')
      } else {
        let data = this.doc().data;
        this.modify(() => {
          if(!data) return;
          if (this.editor) this.buffer.setText(data);
          else {
            this.buffer = data;
            console.log('Background Buffer: ', this.buffer);
          }
        })
      }
    })

    this.doc().on('op', (op, source) => {
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

      if (!this.editor){
        console.log('Buffer in BG: ', this.buffer);
      }
    });

    console.log('listening to file ', path);
  }

  doc() {
    return this.portalClient.docs[this.path];
  }

  listen() {
    let disposables = []
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
      this.portalClient.sendSocketMsg(saveFileAction(this.path));
    }));

    disposables.push(this.editor.onDidDestroy( () => {
      this.portalClient.sendSocketMsg(closeFileAction(this.path));
      this.applyBackgroundBuffer()
    }));

    disposables.push(this.editor.onDidChangeSelectionRange( (event) => {
      if (!this.push) {
        return;
      }
      console.log('on did change selection range');
      this.portalClient.sendSocketMsg(highlightAction(
        this.path,
        event.newBufferRange,
        this.userId
      ));
    }));

    disposables.push(this.editor.onDidChangeCursorPosition( (event) => {
      console.log('on did change cursor position');
      this.portalClient.sendSocketMsg(moveCursorAction(
        this.path,
        event.newBufferPosition
      ));

      let position = this.buffer.characterIndexForPosition(event.newBufferPosition);
      let op = [position, {d: 0}];
      this.doc().submitOp(op);
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
        this.doc().submitOp(op);
      }
      // insert text event
      if (event['newText'].length !== 0) {
        let startPoint = event['newRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, event['newText']];
        this.doc().submitOp(op);
      }
    }));

    return disposables;
  }

  onInsert(position, text) {
    this.editor ?
    this.modify( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      this.buffer.insert(from, text);
    }) :
    this.buffer = this.buffer.slice(0, position) + text + this.buffer.slice(position)
  }

  onRemove(position, length) {
    this.editor ?
    this.modify( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      let to = this.buffer.positionForCharacterIndex(position + length);
      this.buffer.delete([from.toArray(), to.toArray()]);
    }) :
    this.buffer = this.buffer.slice(0, position) + this.buffer.slice(position + length)
  }

  applyEditorBuffer(editor) {
    if (typeof this.buffer === 'string'){
      this.modify(() => {
        editor.getBuffer().setText(this.buffer);
        this.buffer = editor.getBuffer();
      })
      this.editor = editor
      console.log('apply editor to file ', path);
    }
  }

  applyBackgroundBuffer() {
    // let buffer = this.buffer.getText()
    // this.editor = null
    // this.modify(() => {
    //   this.buffer = buffer
    // })
  }

  modify(callback) {
    this.push = false;
    callback();
    this.push = true;
  }
}
