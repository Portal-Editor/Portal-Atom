const Portal = require('./lib/portal');
module.exports = new Portal({
  toolTipManager: atom.toolTips,
  config: atom.config,
  workspace: atom.workspace,
  notificationManager: atom.notifications,
});
