import Promise from 'bluebird';
import cachedRequestLib from 'cached-request';
import request from 'request';

const cachedRequest = cachedRequestLib(request);
cachedRequest.setCacheDirectory('/tmp');

const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

const defaultTtl = oneDayInMilliseconds;

const cachedRequestPromise = Promise.promisify(cachedRequest, { multiArgs: true });

const requestPromise = async (options) => {
  return new Promise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve([response, body]);
      }
    });
  });
};

// Fetches images (our own avatar route), not the API: no oc-* headers, oc-secret is only for the API
export const asyncRequest = (requestOptions) => {
  const headers = {
    'user-agent': 'contributors-svg/1.0',
  };
  if (process.env.ENABLE_CACHED_REQUEST) {
    return cachedRequestPromise({ ttl: defaultTtl, ...requestOptions, headers });
  } else {
    return requestPromise({ ...requestOptions, headers });
  }
};

export const imageRequest = (url) =>
  asyncRequest({ url, encoding: null }).then(([response]) => {
    return response;
  });
