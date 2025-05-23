// Mock implementation of elliptic for ESM compatibility
export const ec = {
  keyFromPrivate: () => ({
    getPublic: () => ({
      encode: () => Buffer.from('mock'),
      encodeCompressed: () => Buffer.from('mock'),
    }),
    sign: () => ({
      r: { toString: () => 'mock' },
      s: { toString: () => 'mock' },
      recoveryParam: 0,
    }),
  }),
}

export default { ec }
