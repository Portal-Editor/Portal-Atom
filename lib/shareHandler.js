import fs from 'fs'

export default class ShareHandler {
  constructor(doc, editor, path, portalClient) {
    this.doc = doc;
    this.editor = editor;
    this.path = path;
    this.portalClient = this.portalClient;
    this.push = true;

    if (this.editor) this.listenEditor();
    else this.listenInBackground();
  }

  listenEditor() {
    this.buffer = this.editor.getBuffer();
    this.doc.subscribe(err => {
      if (err) throw err;
      if (!this.doc.type) {
        this.doc.create(this.buffer.getText(), 'text')
      } else {
        let data = this.doc.data;
        this.modify(() => {
          this.buffer.setText(data);
        })
      }
    })
  }

  async listenInBackground() {
    this.buffer = fs.readFileSync(this.path, 'utf8');
    this.doc.subscribe(err => {
      if (err) throw err;
      if (!this.doc.type) {
        this.doc.create(this.buffer, 'text')
      } else {
        let data = this.doc.data;
        this.modify(() => {
          this.buffer = data;
        })
      }
    })
  }
}
