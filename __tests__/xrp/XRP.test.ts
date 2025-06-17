import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { Client } from 'xrpl'

import { XRP } from '../../src/chain-adapters/XRP/XRP'
import type { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import type { RSVSignature } from '../../src/types'

// Create a properly typed mock contract that matches the ChainSignatureContract interface
const createMockContract = (): ChainSignatureContract => {
  const mockImpl = {
    sign: jest.fn().mockImplementation(
      async (_args: unknown): Promise<RSVSignature[]> => [
        {
          r: 'a'.repeat(64),
          s: 'b'.repeat(64),
          v: 27,
        },
      ]
    ),
    getCurrentSignatureDeposit: jest.fn().mockReturnValue(1),
    getPublicKey: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(
      `04${'a'.repeat(128)}`
    ),
    getDerivedPublicKey: (
      jest.fn() as jest.MockedFunction<any>
    ).mockResolvedValue(`04${'a'.repeat(128)}`),
    contractId: 'test',
    networkId: 'testnet' as const,
    provider: {} as any,
    viewFunction: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  }

  return mockImpl as unknown as ChainSignatureContract
}

describe('XRP Balance Tests', () => {
  let xrp: XRP
  let mockContract: ChainSignatureContract
  let mockClient: jest.Mocked<Client>

  beforeEach(() => {
    mockContract = createMockContract()

    // Create a properly mocked XRPL client
    mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      request: jest.fn(),
      autofill: jest.fn(),
      submit: jest.fn(),
    } as unknown as jest.Mocked<Client>

    // Create XRP instance with mocked client
    xrp = new XRP({
      rpcUrl: 'wss://s.altnet.rippletest.net:51233',
      contract: mockContract,
      client: mockClient,
    })
  })

  describe('getBalance', () => {
    it('should return balance for existing account', async () => {
      const mockBalance = '1000000' // 1 XRP in drops
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      // Mock successful responses
      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockResolvedValue({
        result: {
          account_data: {
            Balance: mockBalance,
          },
        },
      } as any)

      const result = await xrp.getBalance(testAddress)
      expect(result).toEqual({
        balance: BigInt(mockBalance),
        decimals: 6,
      })
    })

    it('should return zero balance for non-existent account', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        data: {
          error: 'actNotFound',
        },
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should return zero balance for account not found message', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        message: 'Account not found',
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should return zero balance for account not found in error message', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        data: {
          error_message: 'Account not found',
        },
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should handle large balance values', async () => {
      const mockBalance = '999999999999999999' // Very large balance
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockResolvedValue({
        result: {
          account_data: {
            Balance: mockBalance,
          },
        },
      } as any)

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: BigInt(mockBalance),
        decimals: 6,
      })
    })
  })

  describe('deriveAddressAndPublicKey', () => {
    it('should derive address and public key successfully', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock the getDerivedPublicKey to return a valid uncompressed public key
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      expect(result).toHaveProperty('address')
      expect(result).toHaveProperty('publicKey')
      expect(typeof result.address).toBe('string')
      expect(typeof result.publicKey).toBe('string')
      expect(result.address.length).toBeGreaterThan(0)
      expect(result.publicKey.length).toBeGreaterThan(0)
    })

    it('should throw error when public key derivation fails', async () => {
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock getDerivedPublicKey to return null/undefined
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(null)

      await expect(
        xrp.deriveAddressAndPublicKey(predecessor, path)
      ).rejects.toThrow('Failed to get derived secp256k1 public key')
    })

    it('should throw error when getDerivedPublicKey rejects', async () => {
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock getDerivedPublicKey to reject
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockRejectedValue(new Error('Contract error'))

      await expect(
        xrp.deriveAddressAndPublicKey(predecessor, path)
      ).rejects.toThrow('Contract error')
    })

    it('should generate valid XRP address format', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      // XRP addresses start with 'r' and are typically 25-34 characters long
      expect(result.address).toMatch(/^r[a-zA-Z0-9]{24,33}$/)
    })

    it('should generate compressed public key format', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      // Compressed public key should be 66 characters (33 bytes in hex)
      // and start with 02 or 03
      expect(result.publicKey).toMatch(/^(02|03)[a-fA-F0-9]{64}$/)
      expect(result.publicKey.length).toBe(66)
    })
  })
})
