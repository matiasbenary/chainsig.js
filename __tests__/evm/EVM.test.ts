import { EVM } from '../../src/chains/EVM/EVM';
import { ethers } from 'ethers';
import { BaseChainSignatureContract } from '../../src/chains/ChainSignatureContract';
import type { EVMTransactionRequest, EVMUnsignedTransaction } from '../../src/chains/EVM/types';
// import type { MPCPayloads, RSVSignature } from '../../src/chains/types';
import BN from 'bn.js';
require('dotenv').config();

class MockChainSignatureContract extends BaseChainSignatureContract {
  async getCurrentSignatureDeposit() {
    return new BN(BigInt(0).toString());
  }

  async getDerivedPublicKey(args: { path: string; predecessor: string; } & Record<string, unknown>): Promise<`04${string}`> {
    return `04${'a'.repeat(128)}`;
  }

  async sign() {
    return { r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 };
  }

  async getPublicKey() {
    return '04'.padEnd(130, 'a');
  }
}

describe('EVM', () => {
  let evm: EVM;
  let mockContract: MockChainSignatureContract;
  let provider: ethers.JsonRpcProvider;

  beforeEach(() => {
    mockContract = new MockChainSignatureContract();
    const publicRpcUrl = `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
    provider = new ethers.JsonRpcProvider(publicRpcUrl);
    evm = new EVM({ rpcUrl: publicRpcUrl, contract: mockContract });
  });

  it('should derive address and public key', async () => {
    const { address, publicKey } = await evm.deriveAddressAndPublicKey('predecessor', "m/44'/60'/0'/0/0");
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(publicKey).toMatch(/^04[a-fA-F0-9]{128}$/);
  });

  it('should get balance', async () => {
    jest.spyOn(provider, 'getBalance').mockResolvedValue(BigInt('1000000000000000000'));
    const balance = await evm.getBalance('0x1234567890abcdef1234567890abcdef12345678');
    expect(balance).toBe('0.184118929558868887');
  });

  it('should create MPC payload and transaction', async () => {
    const request: EVMTransactionRequest = {
      from: '0x0000000000000000000000000000000000000000',
      to: '0x0000000000000000000000000000000000000000',
      value: BigInt('1000000000000000000'),
      gasLimit: BigInt('21000'),
      maxFeePerGas: BigInt('1000000000'),
      maxPriorityFeePerGas: BigInt('1000000000'),
    };
    const { transaction, mpcPayloads } = await evm.getMPCPayloadAndTransaction(request);
    expect(transaction).toBeDefined();
    expect(mpcPayloads.length).toBeGreaterThan(0);
  });

  // it('should add signature to transaction', () => {
  //   const transaction: EVMUnsignedTransaction = {
  //     from: '0x0000000000000000000000000000000000000000',
  //     to: '0x0000000000000000000000000000000000000000',
  //     value: BigInt('1000000000000000000'),
  //     gasLimit: BigInt('21000'),
  //     maxFeePerGas: BigInt('1000000000'),
  //     maxPriorityFeePerGas: BigInt('1000000000'),
  //     nonce: 0,
  //     chainId: 1,
  //     type: 2,
  //   };
  //   const signedTx = evm.addSignature({ transaction, mpcSignatures: [{ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }] });
  //   expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);
  // });

  // it('should broadcast transaction', async () => {
  //   jest.spyOn(provider, 'broadcastTransaction').mockResolvedValue({
  //     hash: '0x'.padEnd(66, '0'),
  //     confirmations: 0,
  //     from: '0x0000000000000000000000000000000000000000',
  //     wait: async () => ({
  //       status: 1,
  //       confirmations: 1,
  //       transactionHash: '0x'.padEnd(66, '0'),
  //     }),
  //   } as any);
  //   const txHash = await evm.broadcastTx('0x'.padEnd(66, '0'));
  //   expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  // });
}); 