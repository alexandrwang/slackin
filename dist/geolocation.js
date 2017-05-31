'use strict';

var _ = require('lodash');
var fetch = require('isomorphic-fetch');

function processGeoIPResponse(url, field) {
  var response, json, countryCode;
  return regeneratorRuntime.async(function processGeoIPResponse$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(fetch(url));

        case 2:
          response = _context.sent;

          if (response.ok) {
            _context.next = 11;
            break;
          }

          _context.t0 = Error;
          _context.t1 = 'Status ' + response.status + ', status text: ' + response.statusText + ', response text: ';
          _context.next = 8;
          return regeneratorRuntime.awrap(response.text());

        case 8:
          _context.t2 = _context.sent;
          _context.t3 = _context.t1 + _context.t2;
          throw new _context.t0(_context.t3);

        case 11:
          _context.next = 13;
          return regeneratorRuntime.awrap(response.json());

        case 13:
          json = _context.sent;
          countryCode = json[field];

          if (!(countryCode && countryCode.length === 2)) {
            _context.next = 19;
            break;
          }

          return _context.abrupt('return', countryCode);

        case 19:
          throw new Error('Country code invalid or not found, code: ' + countryCode + ', field: ' + field + ', raw JSON: ' + JSON.stringify(json));

        case 20:
        case 'end':
          return _context.stop();
      }
    }
  }, null, this);
}

function processForwardedForHeader(header) {
  if (!header) {
    return null;
  }

  return header.split(',')[0]; // If there are multiple IPs in this header, take the first one
}

function getCountryCode(req) {
  var cloudflareGeolocation, ipAddress, strategies, errors, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, strategy, error;

  return regeneratorRuntime.async(function getCountryCode$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          // If we have cloudflare geolocation header and it's valid, use it
          cloudflareGeolocation = req.headers['cf-ipcountry'];

          if (!(cloudflareGeolocation && cloudflareGeolocation !== 'XX')) {
            _context2.next = 3;
            break;
          }

          return _context2.abrupt('return', cloudflareGeolocation);

        case 3:

          // If not, grab IP and try different GeoIP providers
          ipAddress = req.headers['cf-connecting-ip'] || processForwardedForHeader(req.headers['x-forwarded-for']) || req.connection.remoteAddress;
          strategies = [{
            url: 'https://freegeoip.net/json/' + ipAddress, // this supports up to 15,000 queries per hour
            field: 'country_code'
          }, {
            url: 'https://ipapi.co/' + ipAddress + '/json/', // this supports up to 1,000 queries per day
            field: 'country'
          }, {
            url: 'http://ip-api.com/json/' + ipAddress, // this supports up to 150 queries per minute but bans requesting IP once that limit is reached
            field: 'countryCode'
          }];
          errors = [];

          if (!ipAddress) {
            _context2.next = 42;
            break;
          }

          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context2.prev = 10;
          _iterator = strategies[Symbol.iterator]();

        case 12:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context2.next = 26;
            break;
          }

          strategy = _step.value;
          _context2.prev = 14;
          _context2.next = 17;
          return regeneratorRuntime.awrap(processGeoIPResponse(strategy.url, strategy.field));

        case 17:
          return _context2.abrupt('return', _context2.sent);

        case 20:
          _context2.prev = 20;
          _context2.t0 = _context2['catch'](14);

          errors.push(_context2.t0);

        case 23:
          _iteratorNormalCompletion = true;
          _context2.next = 12;
          break;

        case 26:
          _context2.next = 32;
          break;

        case 28:
          _context2.prev = 28;
          _context2.t1 = _context2['catch'](10);
          _didIteratorError = true;
          _iteratorError = _context2.t1;

        case 32:
          _context2.prev = 32;
          _context2.prev = 33;

          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }

        case 35:
          _context2.prev = 35;

          if (!_didIteratorError) {
            _context2.next = 38;
            break;
          }

          throw _iteratorError;

        case 38:
          return _context2.finish(35);

        case 39:
          return _context2.finish(32);

        case 40:
          _context2.next = 43;
          break;

        case 42:
          errors.push(new Error('Could not find IP address'));

        case 43:

          // If none of the providers worked, throw exception with all the details
          error = new Error('Country code not found');

          error.details = {
            errors: errors,
            cloudflareGeolocation: cloudflareGeolocation,
            ipAddress: ipAddress
          };
          throw error;

        case 46:
        case 'end':
          return _context2.stop();
      }
    }
  }, null, this, [[10, 28, 32, 40], [14, 20], [33,, 35, 39]]);
}

function getCountryList(envVar) {
  if (!envVar) {
    return [];
  }

  return envVar.split(',');
}

function isCountryInList(req, countryList) {
  var countryCode;
  return regeneratorRuntime.async(function isCountryInList$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(getCountryCode(req));

        case 2:
          countryCode = _context3.sent;
          return _context3.abrupt('return', _.includes(countryList, countryCode));

        case 4:
        case 'end':
          return _context3.stop();
      }
    }
  }, null, this);
}

function shouldRedirectToAlternateUrl(req) {
  var redirectList;
  return regeneratorRuntime.async(function shouldRedirectToAlternateUrl$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          redirectList = getCountryList(process.env.REDIRECT_COUNTRIES_LIST);

          if (!(redirectList.length === 0)) {
            _context4.next = 3;
            break;
          }

          return _context4.abrupt('return', false);

        case 3:
          _context4.next = 5;
          return regeneratorRuntime.awrap(isCountryInList(req, redirectList));

        case 5:
          return _context4.abrupt('return', _context4.sent);

        case 6:
        case 'end':
          return _context4.stop();
      }
    }
  }, null, this);
}

module.exports = {
  getCountryCode: getCountryCode,
  shouldRedirectToAlternateUrl: shouldRedirectToAlternateUrl
};