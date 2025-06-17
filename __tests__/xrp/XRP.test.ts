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
})
