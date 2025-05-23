// Mock implementation of js-sha3 for ESM compatibility
export const sha3_256 = () => ({
  update: () => ({
    digest: () => Buffer.from('mock'),
    hex: () => 'mock',
  }),
})

export const keccak256 = () => ({
  update: () => ({
    digest: () => Buffer.from('mock'),
    hex: () => 'mock',
  }),
})

export default {
  sha3_256,
  keccak256,
}
