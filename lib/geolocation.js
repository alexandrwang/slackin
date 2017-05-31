const _ = require('lodash');
const fetch = require('isomorphic-fetch');

async function processGeoIPResponse(url, field) {
  let response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Status ${response.status}, status text: ${response.statusText}, response text: ${await response.text()}`);
  }

  let json = await response.json();
  let countryCode = json[field];

  if (countryCode && countryCode.length === 2) {
    return countryCode;
  } else {
    throw new Error(`Country code invalid or not found, code: ${countryCode}, field: ${field}, raw JSON: ${JSON.stringify(json)}`);
  }
}

function processForwardedForHeader(header) {
  if (!header) {
    return null;
  }

  return header.split(',')[0]; // If there are multiple IPs in this header, take the first one
}

async function getCountryCode(req) {
  // If we have cloudflare geolocation header and it's valid, use it
  let cloudflareGeolocation = req.headers['cf-ipcountry'];

  if (cloudflareGeolocation && cloudflareGeolocation !== 'XX') {
    return cloudflareGeolocation;
  }

  // If not, grab IP and try different GeoIP providers
  let ipAddress = req.headers['cf-connecting-ip'] || processForwardedForHeader(req.headers['x-forwarded-for']) || req.connection.remoteAddress;
  let strategies = [
    {
      url: `https://freegeoip.net/json/${ipAddress}`, // this supports up to 15,000 queries per hour
      field: 'country_code'
    },
    {
      url: `https://ipapi.co/${ipAddress}/json/`, // this supports up to 1,000 queries per day
      field: 'country'
    },
    {
      url: `http://ip-api.com/json/${ipAddress}`, // this supports up to 150 queries per minute but bans requesting IP once that limit is reached
      field: 'countryCode'
    }
  ];

  let errors = [];

  if (ipAddress) {
    for (let strategy of strategies) {
      try {
        // If one of the strategies work, return the country code
        return await processGeoIPResponse(strategy.url, strategy.field);
      } catch (err) {
        errors.push(err);
      }
    }
  } else {
    errors.push(new Error('Could not find IP address'));
  }

  // If none of the providers worked, throw exception with all the details
  let error = new Error('Country code not found');
  error.details = {
    errors,
    cloudflareGeolocation,
    ipAddress
  };
  throw error;
}

function getCountryList(envVar) {
  if (!envVar) {
    return [];
  }

  return envVar.split(',');
}

async function isCountryInList(req, countryList) {
  let countryCode = await getCountryCode(req);
  return _.includes(countryList, countryCode);
}

async function shouldRedirectToAlternateUrl(req) {
  let redirectList = getCountryList(process.env.REDIRECT_COUNTRIES_LIST);
  if (redirectList.length === 0) {
    return false;
  }

  return await isCountryInList(req, redirectList);
}

module.exports = {
  getCountryCode,
  shouldRedirectToAlternateUrl
};
