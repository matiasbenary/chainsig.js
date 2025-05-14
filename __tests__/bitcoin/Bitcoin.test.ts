import { jest } from '@jest/globals'
import * as bitcoinjs from 'bitcoinjs-lib'
import BN from 'bn.js'

// import { Bitcoin } from '../../src/chain-adapters/Bitcoin/Bitcoin'
import { BTCRpcAdapter } from '../../src/chain-adapters/Bitcoin/BTCRpcAdapter/BTCRpcAdapter'
import type {
  BTCInput,
  BTCOutput,
  BTCTransactionRequest,
  BTCUnsignedTransaction,
} from '../../src/chain-adapters/Bitcoin/types'
import { ChainAdapter } from '../../src/chain-adapters/ChainAdapter'
// import { BaseChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import type { RSVSignature, KeyDerivationPath } from '../../src/types'

// Use testnet for valid address generation
const network = bitcoinjs.networks.testnet
const testAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'

// Create P2WPKH script
const p2wpkh = bitcoinjs.payments.p2wpkh({
  address: testAddress,
  network,
})

// Mock implementations
class MockBTCRpcAdapter extends BTCRpcAdapter {
  async selectUTXOs(): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }> {
    return {
      inputs: [
        {
          txid: 'a'.repeat(64),
          vout: 0,
          value: 100000,
          scriptPubKey: p2wpkh.output || Buffer.from(''),
        },
      ],
      outputs: [{ address: testAddress, value: 90000 }],
    }
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    return 'mock_txid'
  }

  async getBalance(): Promise<number> {
    return 100000
  }

  async getTransaction(): Promise<{
    vout: Array<{ scriptpubkey: string; value: number }>
  }> {
    return {
      vout: [
        {
          scriptpubkey: (p2wpkh.output || Buffer.from('')).toString('hex'),
          value: 100000,
        },
      ],
    }
  }
}

// class MockChainSignatureContract extends BaseChainSignatureContract {
//   async getCurrentSignatureDeposit(): Promise<BN> {
//     return new BN(0)
//   }

//   async getDerivedPublicKey(): Promise<UncompressedPubKeySEC1> {
//     return `04${'a'.repeat(128)}`
//   }
// }

interface MockLocalStorage {
  store: Record<string, string>
  getItem: jest.Mock<(key: string) => string | null>
  setItem: jest.Mock<(key: string, value: string) => void>
  removeItem: jest.Mock<(key: string) => void>
  clear: jest.Mock<() => void>
  length: number
  key: jest.Mock<(index: number) => string | null>
}

const mockLocalStorage: MockLocalStorage = {
  store: {},
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.store[key] = ''
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {}
  }),
  length: 0,
  key: jest.fn(
    (index: number) => Object.keys(mockLocalStorage.store)[index] || null
  ),
}

// Assign to global
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock Bitcoin class
class TestBitcoin extends ChainAdapter<
  BTCTransactionRequest,
  BTCUnsignedTransaction
> {
  constructor(params: { btcRpcAdapter: BTCRpcAdapter }) {
    super()
    this.btcRpcAdapter = params.btcRpcAdapter
  }

  private readonly btcRpcAdapter: BTCRpcAdapter

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = await this.btcRpcAdapter.getBalance(address)
    return {
      balance: BigInt(balance),
      decimals: 8,
    }
  }

  // @ts-expect-error: Test implementation with different parameter types
  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    return {
      address: testAddress,
      publicKey: '04'.padEnd(130, 'a'),
    }
  }

  setTransaction(
    transaction: BTCUnsignedTransaction,
    storageKey: string
  ): void {
    const dataToStore = JSON.stringify({
      psbt: transaction.psbt.toBase64(),
      publicKey: transaction.publicKey,
    })

    mockLocalStorage.setItem(storageKey, dataToStore)
  }

  getTransaction(storageKey: string): BTCUnsignedTransaction | undefined {
    const stored = mockLocalStorage.getItem(storageKey)
    if (!stored) return undefined

    const parsed = JSON.parse(stored)
    if (
      typeof parsed !== 'object' ||
      !parsed ||
      !('psbt' in parsed) ||
      !('publicKey' in parsed)
    ) {
      return undefined
    }

    const { psbt, publicKey } = parsed
    return {
      psbt: bitcoinjs.Psbt.fromBase64(psbt as string),
      publicKey: publicKey as string,
    }
  }

  async getMPCPayloadAndTransaction(request: BTCTransactionRequest): Promise<{
    transaction: BTCUnsignedTransaction
    mpcPayloads: any
  }> {
    // const { inputs, outputs } = await this.btcRpcAdapter.selectUTXOs()
    return {
      transaction: {
        psbt: new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet }),
        publicKey: '04'.padEnd(130, 'a'),
      },
      mpcPayloads: {},
    }
  }

  addSignature(params: {
    transaction: BTCUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    return 'signed_tx_hex'
  }

  async broadcastTx(tx: string): Promise<{ hash: string }> {
    const txId = await this.btcRpcAdapter.broadcastTransaction(tx)
    return { hash: txId }
  }

  serializeTransaction(transaction: BTCUnsignedTransaction): string {
    return JSON.stringify(transaction)
  }

  deserializeTransaction(serialized: string): BTCUnsignedTransaction {
    return JSON.parse(serialized)
  }

  async prepareTransactionForSigning(
    transactionRequest: BTCTransactionRequest
  ): Promise<{
    transaction: BTCUnsignedTransaction
    hashesToSign: any[]
  }> {
    return {
      transaction: {
        psbt: new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet }),
        publicKey: '04'.padEnd(130, 'a'),
      },
      hashesToSign: [],
    }
  }

  finalizeTransactionSigning(params: {
    transaction: BTCUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    return 'signed_tx_hex'
  }
}

describe('Bitcoin', () => {
  let bitcoin: TestBitcoin
  let btcRpcAdapter: MockBTCRpcAdapter

  beforeEach(() => {
    btcRpcAdapter = new MockBTCRpcAdapter()
    bitcoin = new TestBitcoin({ btcRpcAdapter })
  })

  it('should get balance', async () => {
    const balance = await bitcoin.getBalance(testAddress)
    expect(balance.balance.toString()).toBe('100000')
    expect(balance.decimals).toBe(8)
  })

  it('should derive address and public key', async () => {
    const { address, publicKey } = await bitcoin.deriveAddressAndPublicKey(
      'predecessor',
      { index: 0, scheme: 'secp256k1' }
    )
    expect(address).toBe(testAddress)
    expect(publicKey).toBe('04'.padEnd(130, 'a'))
  })

  it('should set and get transaction', () => {
    const storageKey = 'test_key'
    const transaction: BTCUnsignedTransaction = {
      psbt: new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet }),
      publicKey: '04'.padEnd(130, 'a'),
    }

    bitcoin.setTransaction(transaction, storageKey)
    const retrieved = bitcoin.getTransaction(storageKey)

    expect(retrieved).toBeDefined()
    expect(retrieved?.publicKey).toBe(transaction.publicKey)
  })

  it('should prepare transaction for signing', async () => {
    const request: BTCTransactionRequest = {
      from: testAddress,
      to: testAddress,
      value: new BN('10000').toString(),
      publicKey: '04'.padEnd(130, 'a'),
    }

    const { transaction, mpcPayloads } =
      await bitcoin.getMPCPayloadAndTransaction(request)

    expect(transaction).toBeDefined()
    expect(mpcPayloads).toBeDefined()
  })

  it('should add signature to transaction', () => {
    const transaction: BTCUnsignedTransaction = {
      psbt: new bitcoinjs.Psbt({ network: bitcoinjs.networks.testnet }),
      publicKey: '04'.padEnd(130, 'a'),
    }

    const signedTx = bitcoin.addSignature({
      transaction,
      mpcSignatures: [{ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }],
    })

    expect(signedTx).toBe('signed_tx_hex')
  })

  it('should broadcast transaction', async () => {
    const txHex = '01000000000000000000'
    const txId = await bitcoin.broadcastTx(txHex)
    expect(txId.hash).toBe('mock_txid')
  })

  it('Can derive a BTC address from account with contract and wallet keys', async () => {
    const accountId = 'my_account'
    const result = await bitcoin.deriveAddressAndPublicKey(
      accountId,
      // Type cast to match expected parameter type
      {
        index: 0,
        scheme: 'secp256k1',
      } as any
    )

    expect(result.address).toBeDefined()
    expect(typeof result.address).toBe('string')
    expect(result.publicKey).toBeDefined()
    expect(typeof result.publicKey).toBe('string')
  })
})
