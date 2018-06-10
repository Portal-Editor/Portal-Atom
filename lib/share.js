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
    this.portalClient = portalClient
    this.doc = portalClient.connection.get(portalClient.portalId, path)
    this.editor = editor;
    this.path = path;
    this.togglePush(true);
    this.filePath = this.portalClient.projectPath + '/' + path
    this.editorBuffer = editor && editor.getBuffer()
    try {
      this.backgroundBuffer = this.editorBuffer ? this.editorBuffer.getText() :
                                fs.readFileSync(this.filePath, 'utf8');
    } catch (e) {
      return false;
    }
    this.doc.subscribe(err => {
      if (err) throw err;
      if (!this.doc.type && editor) {
        this.doc.create(this.editorBuffer.getText(), 'text')
      } else {
        let data = this.doc.data;
        this.modify(() => {
          if(!data) return;
          if (this.editor) this.editorBuffer.setText(data);
          this.backgroundBuffer = data;
          console.log('Background Buffer: ', this.backgroundBuffer);
        })
      }
    })

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

    console.log('listening to file', path);
  }

  push() {
    return this.portalClient.push[this.path];
  }

  togglePush(push) {
    this.portalClient.push[this.path] = push
  }

  listen() {
    let disposables = []
    disposables.push(this.editor.onDidChangeGrammar( () => {
      if (!this.push()) return;
      this.portalClient.sendSocketMsg(changeGrammarAction(
        this.path,
        this.editor.getGrammar().scopeName
      ));
    }));

    disposables.push(this.editor.onDidDestroy( () => {
      console.log('close file:', this.path)
      this.applyBackgroundBuffer()
      this.portalClient.eventHandlers[this.path].destroy()
      this.portalClient.eventHandlers[this.path] = null
      this.portalClient.sendSocketMsg(closeFileAction(this.path));
    }));

    disposables.push(this.editor.onDidChangeSelectionRange( (event) => {
      if (!this.push()) {
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

      let position = this.editorBuffer.characterIndexForPosition(event.newBufferPosition);
      let op = [position, {d: 0}];
      this.doc.submitOp(op);
    }));

    disposables.push(this.editorBuffer.onDidChange((event) => {
      if (!this.push()) {
        return;
      }
      console.log('on did change text');
      // remove text event
      if (event.oldText.length !== 0) {
        let lineEnding = atom.config.get('portal.lineEnding');
        let oldText = lineEnding === 'CRLF' ?
                      event.oldText.replace(/\r?\n/g, "\r\n") :
                      event.oldText;
        console.log(oldText.length);
        let startPoint = event.oldRange.start;
        let position = this.editorBuffer.characterIndexForPosition(startPoint);
        let op = [position, {d: oldText.length}];
        this.doc.submitOp(op);
        this.backgroundBuffer = deleteByIndex(this.backgroundBuffer, position, oldText.length)
      }
      // insert text event
      if (event.newText.length !== 0) {
        let startPoint = event.newRange.start;
        let position = this.editorBuffer.characterIndexForPosition(startPoint);
        let op = [position, event.newText];
        this.doc.submitOp(op);
        this.backgroundBuffer = insertByIndex(this.backgroundBuffer, position, event.newText)
      }
    }));

    return disposables;
  }

  onInsert(position, text) {
    if (this.editor) {
      this.modify( () => {
        let from = this.editor.getBuffer().positionForCharacterIndex(position);
        this.editorBuffer.insert(from, text);
      })
    }
    this.backgroundBuffer = insertByIndex(this.backgroundBuffer, position, text)
  }

  onRemove(position, length) {
    if (this.editor) {
      this.modify( () => {
        let from = this.editorBuffer.positionForCharacterIndex(position);
        let to = this.editorBuffer.positionForCharacterIndex(position + length);
        this.editorBuffer.delete([from.toArray(), to.toArray()]);
      })
    }
    this.backgroundBuffer = deleteByIndex(this.backgroundBuffer, position, length)
  }

  applyEditorBuffer(editor) {
    if (typeof this.backgroundBuffer === 'string'){
      this.modify(() => {
        this.editor = editor
        this.editorBuffer = editor.getBuffer()
        this.editorBuffer.setText(this.backgroundBuffer);
      })
      console.log('apply editor to file ', path);
    }
  }

  applyBackgroundBuffer() {
    this.editor = null
    this.modify(() => {
      this.editorBuffer = null
    })
  }

  modify(callback) {
    this.togglePush(false);
    callback();
    this.togglePush(true);
  }

  saveFileInBackground() {
    fs.writeFile(this.filePath, this.backgroundBuffer, err => {
      console.log(err)
    })
  }

  close() {
    try {
      this.doc.unsubscribe()
      this.doc.data=undefined
      this.doc.destroy()
      this.doc.del()
    } catch (e) {
      // do nothing
    }
  }
}

const insertByIndex = (str, index, text) => [str.slice(0, index), text, str.slice(index)].join('')
const deleteByIndex = (str, index, length) => [str.slice(0, index), str.slice(index + length)].join('')
