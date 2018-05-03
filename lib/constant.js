const initData = ({portalId, clientId}) => ({
  a: 'meta',
  type: 'init',
  sessionId: portalId,
  clientId
});

module.exports = {
  initData
};
