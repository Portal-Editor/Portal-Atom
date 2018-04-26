const Portal = require('./lib/portal');
module.exports = new Portal({
  toolTipManager: atom.tooltips,
  config: atom.config,
  workspace: atom.workspace,
  // notificationManager: atom.notifications,
});
