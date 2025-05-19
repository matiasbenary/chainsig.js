// Create the EC class
function EC(curve) {
  this.curve = {
    point: (x, y) => ({
      add: (point) => ({
        getX: () => ({ toString: () => x }),
        getY: () => ({ toString: () => y })
      })
    })
  };
  this.g = {
    mul: (scalar) => ({
      getX: () => ({ toString: () => '123456' }),
      getY: () => ({ toString: () => '789012' })
    }),
  };
}

EC.prototype.keyFromPrivate = function() {
  return {
    getPublic: () => ({
      encode: () => Buffer.from('mock_public_key'),
      encodeCompressed: () => Buffer.from('mock_compressed_key'),
    }),
  };
};

EC.prototype.keyFromPublic = function() {
  return {
    getPublic: () => ({
      encode: () => Buffer.from('mock_public_key'),
      encodeCompressed: () => Buffer.from('mock_compressed_key'),
    }),
    verify: () => true,
  };
};

// Create the exports object
const ellipticExports = {
  ec: EC,
  version: '6.6.1',
  utils: {
    assert: function() {},
    toArray: function() {},
    zero2: function() {},
    toHex: function() {},
    encode: function() {},
  },
  rand: function() {},
  curve: {
    base: function() {},
    short: function() {},
    mont: function() {},
    edwards: function() {},
  },
  curves: {
    PresetCurve: function() {},
    p192: {},
    p224: {},
    p256: {},
    p384: {},
    p521: {},
    curve25519: {},
    ed25519: {},
    secp256k1: {},
  },
  eddsa: function() {},
};

// For CommonJS:
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ellipticExports;
}

// For ESM:
export const ec = EC;
export default ellipticExports; 