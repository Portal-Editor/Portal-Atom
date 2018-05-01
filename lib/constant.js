const initData = ({sessionId, clientId}) => ({
  a: 'meta',
  type: 'init',
  sessionId,
  clientId
});

module.exports = {
  initData
};
