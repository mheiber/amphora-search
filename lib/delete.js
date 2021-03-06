'use strict';

const _ = require('lodash'),
  pageList = require('./page-list'),
  usersList = require('./users-list'),
  SCHEDULED = '@scheduled',
  USERS_OP = '/users/';
var log = require('./services/log').setup({file: __filename});

/**
 * Test for @scheduled when a delete is run and update
 * the page list entry
 * @param  {Array} ops
 * @returns {Promise}
 */
function onDelete(ops) {
  var scheduledOps = _.filter(ops, op => {
      return op.key.indexOf(SCHEDULED) > -1 && op.key.indexOf('/pages/') > -1;
    }),
    userDeletes = _.filter(ops, op => {
      return op.key.indexOf(USERS_OP) === 0;
    }),
    promises = [];

  if (scheduledOps.length) {
    promises.push(removeScheduled(scheduledOps[0].key.replace(SCHEDULED, '')));
  }

  if (userDeletes.length) {
    promises.push(usersList.removeUsers(userDeletes));
  }

  return Promise.all(promises);
}

/**
 * Update pagelist scheduled values for entry
 * @param  {String} uri
 * @return {Promise}
 */
function removeScheduled(uri) {
  // Update page list
  return pageList.updatePageData(uri, {
    scheduled: false,
    scheduledTime: null
  }).then(function (resp) {
    log('info', `unscheduled page updated: ${uri}`);
    return resp;
  }).catch(function (err) {
    log('error', 'error update page list for unschedule', { error: err.message });
    return err;
  });
}

/**
 * Assign a logger so we can test logging
 *
 * @param {Function} customLog
 */
function setLog(customLog) {
  log = customLog;
}

module.exports = onDelete;
module.exports.setLog = setLog;
module.exports.removeScheduled = removeScheduled;
