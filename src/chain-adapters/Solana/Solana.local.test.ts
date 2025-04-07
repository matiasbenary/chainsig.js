import { jest } from '@jest/globals'
import { Solana } from './Solana'
import { BaseChainSignatureContract } from '../../contracts/ChainSignatureContract'
import { KeyDerivationPath, UncompressedPubKeySEC1 } from '../../types'

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => {
  class MockPublicKey {
    private _value: string

    constructor(value: string) {
      this._value = value
    }

    toBase58(): string {
      return this._value
    }

    toString(): string {
      return this._value
    }

    equals(other: any): boolean {
      return this._value === other.toString()
    }
  }

  class MockTransaction {
    feePayer: any
    recentBlockhash: string | undefined
    instructions: any[]

    constructor() {
      this.instructions = []
    }

    add(...instructions: any[]) {
      this.instructions.push(...instructions)
    }

    serialize({ requireAllSignatures = false } = {}): Buffer {
      return Buffer.from('mockSerializedTransaction')
    }

    static from(buffer: Buffer): MockTransaction {
      return new MockTransaction()
    }

    compileMessage() {
      return {
        serialize: () => Buffer.from('mockMessageBytes'),
      }
    }

    addSignature(pubkey: any, signature: Buffer) {
      // Mock implementation
    }
  }

  const MockSystemProgram = {
    transfer: ({ fromPubkey, toPubkey, lamports }: any) => ({
      fromPubkey,
      toPubkey,
      lamports,
    }),
  }

  return {
    Connection: jest.fn(),
    PublicKey: MockPublicKey,
    SystemProgram: MockSystemProgram,
    Transaction: MockTransaction,
  }
})

const MockedSolanaWeb3 = jest.requireMock('@solana/web3.js') as {
  Transaction: new () => any
  PublicKey: new (value: string) => any
}

describe('Solana Chain Adapter', () => {
  let solana: Solana
  let mockConnection: any
  let mockContract: jest.Mocked<BaseChainSignatureContract>

  beforeEach(() => {
    mockConnection = {
      getBalance: jest.fn(),
      getLatestBlockhash: jest.fn(),
      sendRawTransaction: jest.fn(),
    }

    mockContract = {
      getDerivedPublicKey: jest.fn(),
    } as unknown as jest.Mocked<BaseChainSignatureContract>

    solana = new Solana({
      connection: mockConnection,
      contract: mockContract,
    })
  })

  describe('getBalance', () => {
    it('should return balance and decimals', async () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
      const expectedBalance = 1000000000n // 1 SOL in lamports

      mockConnection.getBalance.mockResolvedValue(Number(expectedBalance))

      const result = await solana.getBalance(address)

      expect(result).toEqual({
        balance: expectedBalance,
        decimals: 9,
      })
      expect(mockConnection.getBalance).toHaveBeenCalled()
    })
  })

  describe('deriveAddressAndPublicKey', () => {
    it('should derive address and public key', async () => {
      const predecessor = 'predecessor'
      const path: KeyDerivationPath = { index: 0, scheme: 'ed25519' }
      const mockPubKey = ('04' + '0'.repeat(128)) as UncompressedPubKeySEC1
      const expectedAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'

      mockContract.getDerivedPublicKey.mockResolvedValue(mockPubKey)

      const result = await solana.deriveAddressAndPublicKey(predecessor, path)

      expect(result).toEqual({
        address: expect.any(String),
        publicKey: mockPubKey,
      })
      expect(mockContract.getDerivedPublicKey).toHaveBeenCalledWith({
        path,
        predecessor,
      })
    })
  })

  describe('transaction serialization', () => {
    it('should serialize and deserialize transaction', () => {
      const mockTransaction = {
        transaction: new MockedSolanaWeb3.Transaction(),
        feePayer: new MockedSolanaWeb3.PublicKey(
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ),
        recentBlockhash: 'mockBlockhash',
      }

      const serialized = solana.serializeTransaction(mockTransaction)
      const deserialized = solana.deserializeTransaction(serialized)

      expect(deserialized).toEqual(
        expect.objectContaining({
          feePayer: expect.any(Object),
          recentBlockhash: mockTransaction.recentBlockhash,
        })
      )
    })
  })

  describe('prepareTransactionForSigning', () => {
    it('should prepare transfer transaction', async () => {
      const request = {
        from: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        to: 'GrAkKfEpTKQuVHG2Y97Y2FF4i7y7Q5AHLK94JBy7Y5yv',
        amount: 1000000000n, // 1 SOL
      }

      const mockBlockhash = 'mockBlockhash'
      mockConnection.getLatestBlockhash.mockResolvedValue({
        blockhash: mockBlockhash,
        lastValidBlockHeight: 123456789,
      })

      const result = await solana.prepareTransactionForSigning(request)

      expect(result).toEqual({
        transaction: expect.objectContaining({
          recentBlockhash: mockBlockhash,
          feePayer: expect.any(Object),
        }),
        hashesToSign: expect.arrayContaining([expect.any(Array)]),
      })
    })
  })

  describe('finalizeTransactionSigning', () => {
    it('should throw error for unimplemented signature conversion', () => {
      const mockTransaction = {
        transaction: new MockedSolanaWeb3.Transaction(),
        feePayer: new MockedSolanaWeb3.PublicKey(
          'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
        ),
        recentBlockhash: 'mockBlockhash',
      }

      expect(() =>
        solana.finalizeTransactionSigning({
          transaction: mockTransaction,
          rsvSignatures: [{ r: '0x', s: '0x', v: 0 }],
        })
      ).toThrow('Not implemented')
    })
  })
})
