import { Mempool } from '../../src/chains/Bitcoin/BTCRpcAdapter/Mempool/Mempool';

interface MockResponse {
  ok: boolean;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

describe('Mempool BTCRpcAdapter', () => {
  let mempool: Mempool;

  beforeEach(() => {
    mempool = new Mempool('https://mempool.space/api');
    (global.fetch as jest.Mock).mockClear();
  });

  describe('selectUTXOs', () => {
    it('should select appropriate UTXOs for transaction', async () => {
      const mockUTXOs = [
        {
          txid: 'mock_txid_1',
          vout: 0,
          value: 100000,
          status: {
            confirmed: true,
            block_height: 100,
            block_hash: 'mock_hash',
            block_time: 1000000
          }
        }
      ];

      const mockFees = {
        fastestFee: 100,
        halfHourFee: 80,
        hourFee: 60,
        economyFee: 40,
        minimumFee: 20
      };

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUTXOs)
        } as MockResponse))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFees)
        } as MockResponse));

      const result = await mempool.selectUTXOs(
        'mock_address',
        [{ address: 'destination_address', value: 50000 }]
      );

      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('outputs');
      expect(result.inputs.length).toBeGreaterThan(0);
      expect(result.outputs.length).toBeGreaterThan(0);
    });
  });

  describe("getBalance", () => {
    it("should fetch and return correct balance", async () => {
      const mockResponse = {
        chain_stats: {
          funded_txo_sum: 200000,
          spent_txo_sum: 100000,
        },
      };

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          } as MockResponse)
        );

      const balance = await mempool.getBalance("mock_address");
      expect(balance).toBe(100000); // funded - spent = 100000
    });
  });

  describe("broadcastTransaction", () => {
    it("should broadcast transaction successfully", async () => {
      const mockTxId = "mock_transaction_id";

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockTxId),
          } as MockResponse)
        );

      const result = await mempool.broadcastTransaction("mock_tx_hex");
      expect(result).toBe(mockTxId);
    });

    it("should handle broadcast errors", async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            text: () => Promise.resolve("Transaction rejected"),
          } as MockResponse)
        );

      await expect(mempool.broadcastTransaction("mock_tx_hex")).rejects.toThrow(
        "Failed to broadcast transaction"
      );
    });
  });
});
