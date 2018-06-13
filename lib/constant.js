'use babel';
import atom from 'atom';
import path from 'path';

const initAction = (portalId, userId, initNewPortal) => ({
  a: 'meta',
  type: ACTION_TYPES.INIT,
  portalId,
  userId,
  initNewPortal
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

const changeFileAction = (path, buffer) => ({
  a: 'meta',
  type: ACTION_TYPES.CHANGE_FILE,
  path,
  buffer
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

const changeActiveStatusAction = path => ({
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

const getFullPath = (rootPath, subPath) => process.platform === 'win32' ?
[rootPath, ...subPath.split('/')].join(path.sep) : [rootPath, subPath].join(path.sep)

const ACTION_TYPES = {
  CHANGE_GRAMMAR: 'changeGrammar',
  MOVE_CURSOR: 'moveCursor',
  HIGHLIGHT: 'highlight',
  OPEN_FILE: 'openFile',
  INIT: 'init',
  CREATE_FILE: 'createFile',
  CLOSE_FILE: 'closeFile',
  CHANGE_ACTIVE: 'changeActiveStatus',
  CHANGE_FILE: 'changeFile',
  OCCUPIER_CLEARED: 'occupierCleared',
  SOCKET_CLOSE: 'socketClose',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  DELETE_FILE: 'deleteFile',
  INIT_FAILED: 'initFailed',
  FILE_DELETED: 'fileDeleted'
}

module.exports = {
  initAction,
  openFileAction,
  changeGrammarAction,
  changeFileAction,
  closeFileAction,
  highlightAction,
  deleteFileAction,
  changeActiveStatusAction,
  createFileAction,
  moveCursorAction,
  normalizePath,
  getFullPath,
  ACTION_TYPES
};
