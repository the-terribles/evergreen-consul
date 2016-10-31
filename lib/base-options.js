'use strict';

var Joi = require('joi');

module.exports = Joi.object().keys({
  dc: Joi.string(),
  wan: Joi.boolean(),
  consistent: Joi.boolean(),
  stale: Joi.boolean(),
  index: Joi.string(),
  wait: Joi.string(),
  token: Joi.string(),
  mode: Joi.string().valid('once', 'watch').default('once'),
  ignoreStartupNodata: Joi.boolean().default(false),
});
