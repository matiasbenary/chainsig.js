import * as bitcoin from 'bitcoinjs-lib'

import { parseBTCNetwork } from '../../src/chain-adapters/Bitcoin/utils'

describe('Bitcoin Utils', () => {
  describe('parseBTCNetwork', () => {
    it('should return mainnet network for mainnet', () => {
      const network = parseBTCNetwork('mainnet')
      expect(network).toBe(bitcoin.networks.bitcoin)
    })

    it('should return testnet network for testnet', () => {
      const network = parseBTCNetwork('testnet')
      expect(network).toBe(bitcoin.networks.testnet)
    })

    it('should return regtest network for regtest', () => {
      const network = parseBTCNetwork('regtest')
      expect(network).toBe(bitcoin.networks.regtest)
    })

    it('should throw error for invalid network', () => {
      expect(() => parseBTCNetwork('invalid_network')).toThrow(
        'Unknown Bitcoin network: invalid_network'
      )
    })
  })
})
