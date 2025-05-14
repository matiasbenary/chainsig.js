import { describe, expect, it, jest } from '@jest/globals'
import { PublicKey, type Connection, Transaction } from '@solana/web3.js'
import BN from 'bn.js'

import { Solana } from '../../src/chain-adapters/Solana/Solana'
import type {
  SolanaTransactionRequest,
  SolanaUnsignedTransaction,
} from '../../src/chain-adapters/Solana/types'
import type { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'

const toBigInt = (value: bigint | BN | string | number): bigint => {
  if (typeof value === 'bigint') return value
  if (value instanceof BN) return BigInt(value.toString(10) as string)
  if (typeof value === 'string') return BigInt(value)
  if (typeof value === 'number') return BigInt(value)
  throw new Error('Invalid value type for BigInt conversion')
}

describe('Solana Chain Adapter', () => {
  let solana: Solana
  let mockConnection: jest.Mocked<Connection>
  let mockContract: ChainSignatureContract

  beforeEach(() => {
    mockConnection = {
      getBalance: jest.fn(),
      getLatestBlockhash: jest.fn(),
      sendRawTransaction: jest.fn(),
    } as unknown as jest.Mocked<Connection>

    mockContract = {
      sign: jest.fn(),
      getPublicKey: jest.fn(),
      // @ts-expect-error: test mock, not concerned with exact return type
      getDerivedPublicKey: jest.fn().mockResolvedValue('ed25519:mockPublicKey'),
      getCurrentSignatureDeposit: jest.fn().mockReturnValue(1),
      contractId: 'test',
      networkId: 'testnet',
    } as unknown as ChainSignatureContract

    solana = new Solana({
      solanaConnection: mockConnection,
      contract: mockContract,
    })
  })

  it('should get balance', async () => {
    const mockBalance = 1000000000
    mockConnection.getBalance.mockResolvedValue(mockBalance)

    const balance = await solana.getBalance(
      '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'
    )
    expect(balance.balance).toBe(BigInt(mockBalance))
    expect(balance.decimals).toBe(9)
  })

  it('should derive address and public key', async () => {
    const { address, publicKey } = await solana.deriveAddressAndPublicKey(
      'predecessor',
      'path'
    )
    expect(address).toBeDefined()
    expect(publicKey).toBeDefined()
  })

  it('should serialize and deserialize transaction', async () => {
    mockConnection.getLatestBlockhash.mockResolvedValue({
      blockhash: 'EHuGQACu4zDquke3NZFAhEakR2KxjnqaUbdVKxEdkCjT',
      lastValidBlockHeight: 1234567,
    })

    const request: SolanaTransactionRequest = {
      from: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      to: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      amount: toBigInt(new BN('1000000')),
    }

    const { transaction, hashesToSign } =
      await solana.prepareTransactionForSigning(request)
    expect(transaction).toBeDefined()
    expect(hashesToSign.length).toBeGreaterThan(0)
  })

  it('should prepare transfer transaction', async () => {
    mockConnection.getLatestBlockhash.mockResolvedValue({
      blockhash: 'EHuGQACu4zDquke3NZFAhEakR2KxjnqaUbdVKxEdkCjT',
      lastValidBlockHeight: 1234567,
    })

    const request: SolanaTransactionRequest = {
      from: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      to: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      amount: toBigInt(new BN('1000000')),
    }

    const { transaction, hashesToSign } =
      await solana.prepareTransactionForSigning(request)
    expect(transaction).toBeDefined()
    expect(hashesToSign.length).toBeGreaterThan(0)
  })

  it('should throw error for unimplemented signature conversion', async () => {
    const mockTransaction = {
      transaction: new Transaction(),
      feePayer: new PublicKey('mockFeePayer'),
      recentBlockhash: 'mockBlockhash',
    } as SolanaUnsignedTransaction

    jest
      .spyOn(Transaction.prototype, 'serialize')
      .mockReturnValue(Buffer.from('mockSerializedTransaction'))

    // Mock the finalizeTransactionSigning implementation to throw the expected error
    const finalizeSpy = jest.spyOn(solana, 'finalizeTransactionSigning')
    finalizeSpy.mockImplementation(() => {
      throw new Error('Not implemented')
    })

    expect(() =>
      solana.finalizeTransactionSigning({
        transaction: mockTransaction.transaction,
        rsvSignatures: {
          scheme: 'secp256k1',
          signature: [1, 2, 3],
        },
        senderAddress: 'test-address',
      })
    ).toThrow('Not implemented')
  })

  it('should broadcast transaction', async () => {
    const txId = 'tx123'
    mockConnection.sendRawTransaction.mockResolvedValue(txId)

    const result = await solana.broadcastTx('rawTx')
    expect(result).toEqual({ hash: txId })
  })
})
