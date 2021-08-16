import crypto from 'crypto';

export const queryString = {
  stringify: (obj) => {
    let str = '';
    for (const key in obj) {
      if (str !== '') {
        str += '&';
      }
      str += `${key}=${encodeURIComponent(obj[key])}`;
    }
    return str;
  },
};

export const md5 = (string) => crypto.createHash('md5').update(string).digest('hex');

export const parseToBooleanDefaultFalse = (value) => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  const string = value.toString().trim().toLowerCase();
  return ['on', 'enabled', '1', 'true', 'yes', 1].includes(string);
};

export const parseToBooleanDefaultTrue = (value) => {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  const string = value.toString().trim().toLowerCase();
  return !['off', 'disabled', '0', 'false', 'no', 0].includes(string);
};

export function sleep(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomInteger(max) {
  return Math.floor(Math.random() * max);
}
