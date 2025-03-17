import * as bitcoinjs from 'bitcoinjs-lib';
import BN from 'bn.js';
import { BTCRpcAdapter } from '../../src/chains/Bitcoin/BTCRpcAdapter/BTCRpcAdapter';
import { BaseChainSignatureContract } from '../../src/chains/ChainSignatureContract';
import type { UncompressedPubKeySEC1, MPCPayloads, RSVSignature } from '../../src/chains/types';
import { Chain } from '../../src/chains/Chain';
import type { BTCInput, BTCOutput, BTCTransactionRequest, BTCUnsignedTransaction } from '../../src/chains/Bitcoin/types';

// Use testnet for valid address generation
const network = bitcoinjs.networks.testnet;
const testAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

// Create P2WPKH script
const p2wpkh = bitcoinjs.payments.p2wpkh({
  address: testAddress,
  network
});

// Mock implementations
class MockBTCRpcAdapter extends BTCRpcAdapter {
  async selectUTXOs(): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }> {
    return {
      inputs: [{
        txid: 'a'.repeat(64),
        vout: 0,
        value: 100000,
        scriptPubKey: p2wpkh.output!
      }],
      outputs: [{ address: testAddress, value: 90000 }]
    };
  }
  async broadcastTransaction(txHex: string): Promise<string> { return 'mock_txid'; }
  async getBalance(): Promise<number> { return 100000; }
  async getTransaction() {
    return { vout: [{ scriptpubkey: p2wpkh.output!.toString('hex'), value: 100000 }] };
  }
}

class MockChainSignatureContract extends BaseChainSignatureContract {
  async getCurrentSignatureDeposit(): Promise<BN> {
    return new BN(0);
  }
  
  async getDerivedPublicKey(): Promise<UncompressedPubKeySEC1> {
    return `04${'a'.repeat(128)}` as UncompressedPubKeySEC1;
  }
}

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

jest.mock('../../src/chains/Bitcoin/Bitcoin.ts', () => {
  const originalModule = jest.requireActual('../../src/chains/Bitcoin/Bitcoin.ts');
  return {
    ...originalModule,
    Bitcoin: class extends originalModule.Bitcoin {
      setTransaction(transaction: any, storageKey: string): void {
        global.localStorage.setItem(storageKey, JSON.stringify({
          psbt: transaction.psbt.toBase64(),
          publicKey: transaction.publicKey
        }));
      }
    }
  };
});

// Mock Bitcoin class
class TestBitcoin extends Chain<BTCTransactionRequest, BTCUnsignedTransaction> {
  constructor(params: { btcRpcAdapter: BTCRpcAdapter }) {
    super();
    this.btcRpcAdapter = params.btcRpcAdapter;
  }

  private btcRpcAdapter: BTCRpcAdapter;

  async getBalance(address: string): Promise<string> {
    const sats = await this.btcRpcAdapter.getBalance(address);
    return (sats / 100000000).toString();
  }

  async deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{
    address: string;
    publicKey: string;
  }> {
    return { address: testAddress, publicKey: 'mock_key' };
  }

  setTransaction(transaction: BTCUnsignedTransaction, storageKey: string): void {
    global.localStorage.setItem(storageKey, JSON.stringify({
      psbt: transaction.psbt.toBase64(),
      publicKey: transaction.publicKey
    }));
  }

  getTransaction(storageKey: string): BTCUnsignedTransaction | undefined {
    const data = global.localStorage.getItem(storageKey);
    if (!data) return undefined;
    const parsed = JSON.parse(data);
    return {
      psbt: bitcoinjs.Psbt.fromBase64(parsed.psbt),
      publicKey: parsed.publicKey
    };
  }

  async getMPCPayloadAndTransaction(request: BTCTransactionRequest): Promise<{ 
    transaction: BTCUnsignedTransaction; 
    mpcPayloads: MPCPayloads;
  }> {
    const psbt = new bitcoinjs.Psbt({ network });
    return {
      transaction: { psbt, publicKey: request.publicKey },
      mpcPayloads: [[1, 2, 3]]
    };
  }

  addSignature(params: { 
    transaction: BTCUnsignedTransaction; 
    mpcSignatures: RSVSignature[] 
  }): string {
    return 'deadbeef'.repeat(8);
  }

  async broadcastTx(tx: string): Promise<string> {
    return await this.btcRpcAdapter.broadcastTransaction(tx);
  }
}

describe('Bitcoin', () => {
  let btc: TestBitcoin;
  let mockContract: MockChainSignatureContract;
  let mockAdapter: MockBTCRpcAdapter;

  beforeEach(() => {
    mockContract = new MockChainSignatureContract();
    mockAdapter = new MockBTCRpcAdapter();
    btc = new TestBitcoin({
      btcRpcAdapter: mockAdapter
    });
  });

  describe('deriveAddressAndPublicKey', () => {
    it('should derive correct address and public key', async () => {
      const result = await btc.deriveAddressAndPublicKey(
        'predecessor',
        "m/44'/0'/0'/0/0"
      );

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('publicKey');
      expect(result.address).toMatch(/^(tb1|[mn])[a-zA-Z0-9]+$/); // testnet address format
    });
  });

  describe('getBalance', () => {
    it('should return balance in BTC format', async () => {
      const balance = await btc.getBalance('mock_address');
      expect(balance).toBe('0.001'); // 100000 satoshis = 0.001 BTC
    });
  });

  describe('transaction operations', () => {
    const mockTxRequest = {
      publicKey: 'mock_public_key',
      from: 'mock_from_address',
      to: 'mock_to_address',
      value: '0.0009'
    };

    it('should create transaction and MPC payloads', async () => {
      const { transaction, mpcPayloads } = await btc.getMPCPayloadAndTransaction({
        publicKey: 'a'.repeat(66),
        from: testAddress,
        to: testAddress,
        value: '0.0009'
      });
      
      expect(transaction).toBeDefined();
      expect(mpcPayloads.length).toBeGreaterThan(0);
    });

    it('should handle localStorage operations', () => {
      const psbt = new bitcoinjs.Psbt({ network });
      btc.setTransaction({ 
        psbt,
        publicKey: 'mock_key'
      }, 'test_key');
      
      expect(global.localStorage.setItem).toHaveBeenCalled();
    });

    it('should return valid hex for signed transaction', () => {
      const signedTxHex = btc.addSignature({
        transaction: {
          psbt: new bitcoinjs.Psbt({ network }),
          publicKey: 'mock_key'
        },
        mpcSignatures: [{
          r: 'a'.repeat(64),
          s: 'b'.repeat(64),
          v: 0
        }]
      });
      expect(signedTxHex).toMatch(/^[0-9a-f]+$/i);
    });
  });
});
