'use babel';
import atom from 'atom';

const initAction = (portalId, userId) => ({
  a: 'meta',
  type: ACTION_TYPES.INIT,
  portalId,
  userId
});

const openFileAction = (path, grammar) => ({
  a: 'meta',
  type: ACTION_TYPES.OPEN_FILE,
  path,
  grammar,
})

const changeGrammarAction = (path, grammar) => ({
  a: 'meta',
  type: ACTION_TYPES.CHANGE_GRAMMAR,
  path,
  grammar
})

const saveFileAction = path => ({
  a: 'meta',
  type: ACTION_TYPES.SAVE_FILE,
  path
})

const closeFileAction = path => ({
  a: 'meta',
  type: ACTION_TYPES.CLOSE_FILE,
  path
})

const highlightAction = (path, newRange) => ({
  a: 'meta',
  type: ACTION_TYPES.HIGHLIGHT,
  path,
  newRange
})

const moveCursorAction = (path, cursor) => ({
  a: 'meta',
  type: ACTION_TYPES.MOVE_CURSOR,
  path,
  cursor
})

const changeActiveStatus = path => ({
  a: 'meta',
  type: ACTION_TYPES.CHANGE_ACTIVE,
  path
})

const createFileAction = (path, isFolder, buffer) => ({
  a: 'meta',
  type: ACTION_TYPES.CREATE_FILE,
  path,
  isFolder,
  buffer
})

const deleteFileAction = (path, isFolder) => ({
  a: 'meta',
  type: ACTION_TYPES.DELETE_FILE,
  path,
  isFolder
})

const normalizePath = pathStr => (pathStr && process.platform === 'win32') ?
  pathStr.split(path.sep).join("/") : pathStr;

const ACTION_TYPES = {
  CHANGE_GRAMMAR: 'changeGrammar',
  MOVE_CURSOR: 'moveCursor',
  HIGHLIGHT: 'highlight',
  OPEN_FILE: 'openFile',
  INIT: 'init',
  CREATE_FILE: 'createFile',
  CLOSE_FILE: 'closeFile',
  CHANGE_ACTIVE: 'changeActiveStatus',
  SAVE_FILE: 'saveFile',
  OCCUPIER_CLEARED: 'occupierCleared',
  SOCKET_CLOSE: 'socketClose',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  DELETE_FILE: 'deleteFile'
}

module.exports = {
  initAction,
  openFileAction,
  changeGrammarAction,
  saveFileAction,
  closeFileAction,
  highlightAction,
  deleteFileAction,
  changeActiveStatus,
  createFileAction,
  moveCursorAction,
  normalizePath,
  ACTION_TYPES
};
