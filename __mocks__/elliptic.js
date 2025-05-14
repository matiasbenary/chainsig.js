// Create the EC class
function EC(curve) {
  this.curve = curve;
  this.g = {
    mul: () => ({}),
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

// CommonJS exports - must use module.exports (not ESM export)
module.exports = {
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