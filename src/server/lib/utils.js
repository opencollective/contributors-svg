import crypto from 'crypto';

import { get } from 'lodash';

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

export const sortObjectByValue = (obj, path) => {
  const sortable = [];
  for (const key in obj) {
    sortable.push([key, obj[key], path ? get(obj[key], path) : obj[key]]);
  }

  sortable.sort((a, b) => {
    return a[2] > b[2] ? -1 : a[2] < b[2] ? 1 : 0;
  });

  const orderedList = {};
  for (let i = 0; i < sortable.length; i++) {
    orderedList[sortable[i][0]] = sortable[i][1];
  }

  return orderedList;
};
