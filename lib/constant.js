const initAction = (sessionId, clientId) => ({
  a: 'meta',
  type: 'init',
  sessionId,
  clientId
});

const addTabAction = uri => ({
  a: 'meta',
  type: 'addTab',
  uri
})

const changeGrammarAction = (path, grammar) => ({
  a: 'meta',
  type: 'grammar',
  path,
  grammar
})

const saveAction = path => ({
  a: 'meta',
  type: 'save',
  path
})

const editorClosedAction = (path, clientId) => ({
  a: 'meta',
  type: 'editorClosed',
  path,
  clientId
})

const highlightAction = (path, newRange, clientId) => ({
  a: 'meta',
  type: 'highlight',
  path,
  newRange,
  clientId
})

const cursorMovedAction = (path, indicatorColor, newPosition, clientId) => ({
  a: 'meta',
  type: 'cursorMoved',
  path,
  indicatorColor,
  newPosition,
  clientId
})

const activePaneItemChangedAction = uri => ({
  a: 'meta',
  type: 'activePaneItemChanged',
  uri
})

const normalizePath = pathStr => (pathStr && process.platform === 'win32') ?
  pathStr.split(path.sep).join("/") : pathStr;


module.exports = {
  initAction,
  addTabAction,
  changeGrammarAction,
  saveAction,
  editorClosedAction,
  highlightAction,
  cursorMovedAction,
  activePaneItemChangedAction,
  normalizePath
};
