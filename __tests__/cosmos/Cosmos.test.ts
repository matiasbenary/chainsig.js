import { Cosmos } from '../../src/chains/Cosmos/Cosmos';
import { BaseChainSignatureContract } from '../../src/chains/ChainSignatureContract';
import type { CosmosTransactionRequest, CosmosUnsignedTransaction } from '../../src/chains/Cosmos/types';
import { jest } from '@jest/globals';
import BN from 'bn.js';
// import { ethers } from 'ethers';
// import { serializeTransaction } from 'ethers/lib/utils';

class MockChainSignatureContract extends BaseChainSignatureContract {
  async getCurrentSignatureDeposit() {
    return new BN(0);
  }

  async getDerivedPublicKey(args: { path: string; predecessor: string; }): Promise<`04${string}`> {
    return `04${'a'.repeat(128)}` as `04${string}`;
  }

  async sign() {
    return { r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 };
  }

  async getPublicKey() {
    return '04'.padEnd(130, 'a');
  }
}

describe('Cosmos', () => {
  let cosmos: Cosmos;
  let mockContract: MockChainSignatureContract;

  beforeEach(() => {
    mockContract = new MockChainSignatureContract();
    cosmos = new Cosmos({
      chainId: 'cosmoshub-4',
      contract: mockContract,
      endpoints: {
        rpcUrl: 'https://rpc.cosmos.network',
        restUrl: 'https://api.cosmos.network',
      },
    });
  });

  it('should derive address and public key', async () => {
    const { address, publicKey } = await cosmos.deriveAddressAndPublicKey('predecessor', "m/44'/118'/0'/0/0");
    expect(address).toMatch(/^cosmos1[a-z0-9]{38}$/);
    expect(publicKey).toBe("02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it('should get balance', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ denom: 'uatom', amount: '1000000' }],
        pagination: { next_key: null, total: '1' },
      }),
    } as Response);

    const balance = await cosmos.getBalance('cosmos1...');
    expect(balance).toBe('1');
  });

  // it('should create MPC payload and transaction', async () => {
  //   const request: CosmosTransactionRequest = {
  //     address: 'cosmos1...',
  //     publicKey: '04'.padEnd(130, 'a'),
  //     messages: [],
  //   };
  //   const { transaction, mpcPayloads } = await cosmos.getMPCPayloadAndTransaction(request);
  //   expect(transaction).toBeDefined();
  //   expect(mpcPayloads.length).toBeGreaterThan(0);
  // });

  it('should add signature to transaction', () => {
    const transaction: CosmosUnsignedTransaction = {
      bodyBytes: new Uint8Array(),
      authInfoBytes: new Uint8Array(),
      signatures: [],
    };
    const signedTx = cosmos.addSignature({
      transaction,
      mpcSignatures: [{ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }],
    });
    expect(signedTx).toMatch(/^[0-9a-f]+$/i);
  });

  // it('should broadcast transaction', async () => {
  //   jest.spyOn(global, 'fetch').mockResolvedValue({
  //     ok: true,
  //     json: async () => ({ tx_response: { txhash: 'mock_tx_hash' } }),
  //   } as Response);

  //   const txHash = await cosmos.broadcastTx('mock_tx_serialized');
  //   expect(txHash).toBe('mock_tx_hash');
  // });
});
