const crypto = require('crypto');
const Portal = require('./lib/portal');
module.exports = new Portal({
  toolTipManager: atom.tooltips,
  workspace: atom.workspace,
  notificationManager: atom.notifications
});
