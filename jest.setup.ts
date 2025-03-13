/// <reference lib="dom" />

export {}; // Make this a module

declare global {
  var localStorage: Storage;
}

// Setup fetch mock
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Setup localStorage mock
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}; 