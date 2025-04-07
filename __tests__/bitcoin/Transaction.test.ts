// import { jest } from '@jest/globals'
import { type KeyPairString } from '@near-js/crypto'
import BN from 'bn.js'
import { config } from 'dotenv'

import { Bitcoin } from '../../src/chain-adapters/Bitcoin/Bitcoin'
import { Mempool } from '../../src/chain-adapters/Bitcoin/BTCRpcAdapter/Mempool'
import { BaseChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import { type RSVSignature, type KeyDerivationPath } from '../../src/types'

// Load environment variables
config()

class MockChainSignatureContract extends BaseChainSignatureContract {
  async getCurrentSignatureDeposit(): Promise<BN> {
    return new BN(0)
  }

  async getDerivedPublicKey(args: {
    path: KeyDerivationPath
    predecessor: string
  }): Promise<`04${string}`> {
    return ('04' + '0'.repeat(128)) as `04${string}`
  }

  async sign(): Promise<RSVSignature> {
    return { r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }
  }

  async getPublicKey(): Promise<`04${string}`> {
    return '04'.padEnd(130, 'a') as `04${string}`
  }
}

describe('Bitcoin Transaction Lifecycle Test', () => {
  let bitcoin: Bitcoin
  let btcRpcAdapter: Mempool
  let contract: MockChainSignatureContract
  let derivedAddress: string
  let derivedPublicKey: string

  beforeAll(async () => {
    const accountId = process.env.NEAR_ACCOUNT_ID
    const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString

    if (!accountId || !privateKey) {
      throw new Error(
        'Missing required environment variables: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY'
      )
    }

    try {
      // Initialize contract
      contract = new MockChainSignatureContract()

      // Initialize Bitcoin connection
      btcRpcAdapter = new Mempool('https://mempool.space/testnet/api')
      bitcoin = new Bitcoin({
        network: 'testnet',
        contract,
        btcRpcAdapter,
      })

      // Derive Bitcoin address
      const result = await bitcoin.deriveAddressAndPublicKey(accountId, {
        index: 0,
        scheme: 'secp256k1',
      })
      derivedAddress = result.address
      derivedPublicKey = result.publicKey
      console.log('Derived Bitcoin address:', derivedAddress)
      console.log('Derived public key:', derivedPublicKey)
    } catch (error: unknown) {
      const err = error as Error
      console.error('Setup error:', {
        name: err.name || 'Unknown error',
        message: err.message || 'No error message',
      })
      throw error
    }
  })

  it('should initialize Bitcoin connection', () => {
    expect(bitcoin).toBeDefined()
    expect(btcRpcAdapter).toBeDefined()
  })

  it('should derive Bitcoin address and public key', () => {
    expect(derivedAddress).toBeDefined()
    expect(derivedAddress).toMatch(/^(tb1|[mn])[a-zA-Z0-9]+/) // testnet address format
    expect(derivedPublicKey).toBeDefined()
    expect(derivedPublicKey).toMatch(/^[0-9a-fA-F]+$/)
  })

  it('should get balance for derived address', async () => {
    const balance = await bitcoin.getBalance(derivedAddress)
    expect(balance).toBeDefined()
    expect(Number(balance.balance.toString())).toBeGreaterThanOrEqual(0)
  })

  // Uncomment when ready to test transaction
  /*
  it("should create and sign Bitcoin transaction", async () => {
    const transactionRequest = {
      from: derivedAddress,
      to: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
      value: "0.001",
      publicKey: derivedPublicKey,
    };

    const { transaction, mpcPayloads } = await bitcoin.getMPCPayloadAndTransaction(transactionRequest);
    expect(transaction).toBeDefined();
    expect(mpcPayloads.length).toBeGreaterThan(0);

    // Sign the transaction (implement when ready)
    const signature = await contract.sign({
      payload: mpcPayloads[0],
      path: "bitcoin-1",
      key_version: 0,
    });

    const signedTx = bitcoin.addSignature({
      transaction,
      mpcSignatures: [signature],
    });

    expect(signedTx).toMatch(/^[0-9a-f]+$/i);
  });
  */
})
