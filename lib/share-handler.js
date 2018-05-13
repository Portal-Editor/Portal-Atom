import fs from 'fs'

export default class ShareHandler {
  constructor(doc, path, editor) {
    this.doc = doc;
    this.editor = editor;
    this.path = path;
    this.push = true;

    this.buffer = this.editor ? this.editor.getBuffer() : fs.readFileSync(this.path, 'utf8');

    this.doc.subscribe(err => {
      if (err) throw err;
      if (!this.doc.type) {
        this.doc.create(this.editor ? this.buffer.getText() : this.buffer, 'text')
      } else {
        let data = this.doc.data;
        this.modify(() => {
          if (this.editor) this.buffer.setText(data);
          else this.buffer = data;
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

    console.log('listening to file ', path);
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

  applyEditor(editor) {
    editor.getBuffer().setText(this.buffer);
    this.editor = editor
    console.log('apply editor to file ', path);
  }

  modify(callback) {
    this.push = false;
    callback();
    this.push = true;
  }
}
