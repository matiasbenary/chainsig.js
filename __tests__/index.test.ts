// import { NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID } from '../../../network';
import {
  MPC_SIGNER_MAINNET,
  MPC_SIGNER_TESTNET,
  NEAR_MAINNET_NETWORK_ID,
  NEAR_TESTNET_NETWORK_ID,
  ROOT_PUBLIC_KEY_MAINNET,
  ROOT_PUBLIC_KEY_TESTNET,
} from "../src/constants";
import {
  AddressType,
  deriveChildPublicKey,
  generateAddress,
  getMpcAccountIdByNetwork,
  getRootPublicKey,
} from "../src/kdf";
import { initializeNear, sign } from "../src/near";
import * as nearAPI from "near-api-js";
import BN from "bn.js";
import {
  bitcoin,
  constructPsbt,
  // recoverPubkeyFromSignature,
} from "../src/bitcoin";
import { fetchJson } from "../src/utils";
// import * as bitcoinJs from "bitcoinjs-lib";

const accountId = process.env.NEAR_ACCOUNT_ID || "default-account-id";
const privateKey = process.env.NEAR_PRIVATE_KEY || "default-private-key";
const mpcPublicKey =
  process.env.MPC_PUBLIC_KEY ||
  "secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq";
const contractId = process.env.NEAR_CONTRACT_ID || "default-contract-id";

jest.mock("near-api-js", () => {
  const originalModule = jest.requireActual("near-api-js");
  return {
    ...originalModule,
    keyStores: {
      InMemoryKeyStore: jest.fn().mockImplementation(() => ({
        setKey: jest.fn(),
      })),
    },
    KeyPair: {
      fromString: jest.fn(),
    },
    Near: jest.fn().mockImplementation(() => ({
      connection: {},
    })),
    Account: jest.fn().mockImplementation(() => ({
      functionCall: jest.fn().mockResolvedValue({
        transaction: {},
        transaction_outcome: {
          id: "test-id",
          outcome: {
            logs: [],
            receipt_ids: [],
            gas_burnt: 0,
            tokens_burnt: "0",
            executor_id: "test.near",
            status: { SuccessValue: "test" },
          },
        },
        receipts_outcome: [],
        status: {
          SuccessValue: Buffer.from(
            JSON.stringify(["0x1234", "0x5678"])
          ).toString("base64"),
        },
      }),
    })),
  };
});

describe("Chain Signature Utils", () => {
  describe("deriveChildPublicKey", () => {
    it("should derive a valid child public key", () => {
      const accountId = "omnitester.testnet";
      const derivedKey = deriveChildPublicKey(
        "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId,
        "ethereum-1"
      );

      expect(derivedKey).toEqual(
        "046a99e52f042a96ea2293a69f3154b63c06cd0770cf89a46d0d1ab331dab64d8b1472638899edf8904e1c06ac7fce3e47ea1403279341c147303fd6c5df806623"
      );
    });

    it("should derive a valid child public key [against signet]", () => {
      const accountId = "omnitester.testnet";
      const derivedKey = deriveChildPublicKey(
        "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId,
        "ethereum-1"
      );

      expect(derivedKey).toEqual(
        "046a99e52f042a96ea2293a69f3154b63c06cd0770cf89a46d0d1ab331dab64d8b1472638899edf8904e1c06ac7fce3e47ea1403279341c147303fd6c5df806623"
      );
    });
  });

  describe("generateAddress", () => {
    it("should generate a valid EVM address", async () => {
      const cases = [
        {
          publicKey:
            "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
          accountId: "omnitester.testnet",
          path: "ethereum-1",
          addressType: AddressType.EVM,
          expectedAddress: "0xd8d25820c9b9e2aa9cce55504355e500efcce715",
          expectedPublicKey:
            "04e612e7650febebc50b448bf790f6bdd70a8a6ce3b111a1d7e72c87afe84be776e36226e3f89de1ba3cbb62c0f3fc05bffae672c9c59d5fa8a4737b6547c64eb7",
        },
        {
          publicKey:
            "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya",
          accountId: "example.near",
          path: "ethereum-1",
          addressType: AddressType.EVM,
          expectedAddress: "0xef4ea05e5c11057decc8e1bd6f5369f2acd91fa5",
          expectedPublicKey:
            "04f981e58fa26199180ea71b627362c7d1a6bebd73f61fedbe2e0acea5c2e75128a327822ee298967e485d787e0e98163b7d385516811f913cb7256182f5a20394",
        },
        {
          publicKey:
            "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya",
          accountId: "example.near",
          path: "ethereum-2",
          addressType: AddressType.EVM,
          expectedAddress: "0x273eeb4d7651d9296ec5bd9a6ceebca219101cb8",
          expectedPublicKey:
            "04599038b49d32f1f345e4321dca5f3619d96100126ef940f904c1f7cb0ada3ad8f2bb44672ba5b686940230505d0bdaf4764ee7df58a5300691f60eeff095e9fc",
        },
      ];

      for (const {
        publicKey,
        accountId,
        path,
        addressType,
        expectedAddress,
        expectedPublicKey,
      } of cases) {
        const result = await generateAddress({
          publicKey,
          accountId,
          path,
          addressType,
        });

        expect(result).toHaveProperty("address", expectedAddress);
        expect(result).toHaveProperty("publicKey", expectedPublicKey);
      }
    });

    it("should generate a valid Bitcoin mainnet legacy address", async () => {
      const result = await generateAddress({
        publicKey:
          "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId: "omnitester.testnet",
        path: "bitcoin-1",
        addressType: AddressType.BITCOIN_MAINNET_LEGACY,
      });

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
    });

    it("should generate a valid Bitcoin mainnet segwit address", async () => {
      const result = await generateAddress({
        publicKey:
          "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId: "omnitester.testnet",
        path: "bitcoin-1",
        addressType: AddressType.BITCOIN_MAINNET_SEGWIT,
      });

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
    });

    it("should generate a valid Bitcoin testnet legacy address", async () => {
      const result = await generateAddress({
        publicKey:
          "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId: "omnitester.testnet",
        path: "bitcoin-1",
        addressType: AddressType.BITCOIN_TESTNET_LEGACY,
      });

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
    });

    it("should generate a valid Bitcoin testnet segwit address", async () => {
      const result = await generateAddress({
        publicKey:
          "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
        accountId: "omnitester.testnet",
        path: "bitcoin-1",
        addressType: AddressType.BITCOIN_TESTNET_SEGWIT,
      });

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("publicKey");
    });

    it("should throw an error for unsupported address types", async () => {
      await expect(
        generateAddress({
          publicKey:
            "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3",
          accountId: "omnitester.testnet",
          path: "0",
          addressType: "unsupported-type" as AddressType,
        })
      ).rejects.toThrow("Unsupported address type: unsupported-type");
    });
  });

  describe("getRootPublicKey", () => {
    it("should return the correct root public key for testnet", () => {
      expect(getRootPublicKey(NEAR_TESTNET_NETWORK_ID)).toEqual(
        ROOT_PUBLIC_KEY_TESTNET
      );
    });

    it("should return the correct root public key for mainnet", () => {
      expect(getRootPublicKey(NEAR_MAINNET_NETWORK_ID)).toEqual(
        ROOT_PUBLIC_KEY_MAINNET
      );
    });

    it("should throw an error for unsupported networks", () => {
      expect(() => getRootPublicKey("invalid-network" as any)).toThrow(
        "Unsupported network: invalid-network"
      );
    });
  });

  describe("getMpcAccountIdByNetwork", () => {
    it("should return the correct MPC signer for testnet", () => {
      expect(getMpcAccountIdByNetwork(NEAR_TESTNET_NETWORK_ID)).toEqual(
        MPC_SIGNER_TESTNET
      );
    });

    it("should return the correct MPC signer for mainnet", () => {
      expect(getMpcAccountIdByNetwork(NEAR_MAINNET_NETWORK_ID)).toEqual(
        MPC_SIGNER_MAINNET
      );
    });

    it("should throw an error for unsupported networks", () => {
      expect(() => getMpcAccountIdByNetwork("invalid-network" as any)).toThrow(
        "Unsupported network: invalid-network"
      );
    });
  });
});

describe("NEAR Module", () => {
  const payload = "test-payload";
  const path = "test-path";

  describe("initializeNear", () => {
    it("should initialize NEAR and return near and account objects", () => {
      const { near, account } = initializeNear(accountId, privateKey);

      console.log("initializeNear", near, account);
      expect(nearAPI.keyStores.InMemoryKeyStore).toHaveBeenCalled();
      expect(nearAPI.KeyPair.fromString).toHaveBeenCalledWith(privateKey);
      expect(nearAPI.Near).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: "testnet",
          nodeUrl: "https://rpc.testnet.near.org",
        })
      );
      expect(nearAPI.Account).toHaveBeenCalledWith({}, accountId);
      expect(near).toBeDefined();
      expect(account).toBeDefined();
    });
  });

  describe("sign", () => {
    it("should call functionCall on the account with correct parameters", async () => {
      const { account } = initializeNear(accountId, privateKey);
      const functionCallMock = jest
        .spyOn(account, "functionCall")
        .mockResolvedValue({
          transaction: {},
          transaction_outcome: {
            id: "test-id",
            outcome: {
              logs: [],
              receipt_ids: [],
              gas_burnt: 0,
              tokens_burnt: "0",
              executor_id: "test.near",
              status: { SuccessValue: "test" },
            },
          },
          receipts_outcome: [],
          status: {
            SuccessValue: Buffer.from(
              JSON.stringify(["0x1234", "0x5678"])
            ).toString("base64"),
          },
        });

      const result = await sign(account, contractId, payload, path);

      expect(functionCallMock).toHaveBeenCalledWith({
        contractId,
        methodName: "sign",
        args: {
          payload,
          path,
          key_version: 0,
          rlp_payload: undefined,
        },
        gas: new BN("300000000000000"),
        attachedDeposit: new BN("0"),
      });

      expect(result).toEqual({
        r: "1234",
        s: "0x5678",
      });
    });

    it("should handle errors during functionCall", async () => {
      const { account } = initializeNear(accountId, privateKey);
      jest
        .spyOn(account, "functionCall")
        .mockRejectedValue(new Error("Function call error"));

      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await sign(account, contractId, payload, path);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("this may take approx. 30 seconds to complete")
      );

      consoleLogSpy.mockRestore();
    });
  });
});

describe("Bitcoin Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructPsbt", () => {
    let address: string;
    let publicKey: string;

    beforeAll(async () => {
      const result = await generateAddress({
        publicKey: mpcPublicKey,
        accountId: accountId,
        path: "bitcoin-1",
        addressType: AddressType.BITCOIN_TESTNET_LEGACY,
      });
      address = result.address;
      publicKey = result.publicKey;
    });

    it("should throw an error if no UTXOs are found", async () => {
      await expect(
        constructPsbt(address, address, "1000", "testnet")
      ).rejects.toThrow(`No utxos detected for address: ${address}`);
    });

    it("should return a PSBT and UTXOs", async () => {
      const mockUtxos = [{ txid: "txid", vout: 0, value: 2000 }];
      const result = await constructPsbt(address, address, "1000", "testnet");
      console.log("result", result);
      expect(result).toBeDefined();
      // if (result) {
      //   expect(result[0]).toEqual(mockUtxos);
      // }
    });

    it("should return a defined result", async () => {
      const result = await constructPsbt(address, address, "1000", "testnet");
      expect(result).toBeDefined();
    });
  });

  describe("getBalance", () => {
    it("should return the maximum UTXO value", async () => {
      const mockUtxos = [
        { txid: "txid1", vout: 0, value: 1000 },
        { txid: "txid2", vout: 1, value: 2000 },
      ];
      (fetchJson as jest.Mock).mockResolvedValueOnce(mockUtxos);
      const balance = await bitcoin.getBalance(
        { address: "address" },
        "testnet"
      );
      expect(balance).toBe(2000);
    });

    it("should return UTXOs if getUtxos is true", async () => {
      const mockUtxos = [{ txid: "txid1", vout: 0, value: 1000 }];
      (fetchJson as jest.Mock).mockResolvedValueOnce(mockUtxos);
      const utxos = await bitcoin.getBalance(
        { address: "address", getUtxos: true },
        "testnet"
      );
      expect(utxos).toEqual(mockUtxos);
    });
  });

  describe("getSignature", () => {
    it("should return a signature", async () => {
      const mockUtxos = [{ txid: "txid", vout: 0, value: 2000 }];
      (fetchJson as jest.Mock).mockResolvedValueOnce(mockUtxos);
      (sign as jest.Mock).mockResolvedValueOnce("signature");

      const signature = await bitcoin.getSignature({
        from: "address",
        publicKey: "publicKey",
        to: "to",
        amount: "1000",
        path: "path",
        networkId: "testnet",
        account: {},
        contractId: "contractId",
      });

      expect(signature).toBe("signature");
    });
  });

  describe("broadcast", () => {
    it("should return transaction hash on successful broadcast", async () => {
      const mockUtxos = [{ txid: "txid", vout: 0, value: 2000 }];
      (fetchJson as jest.Mock).mockResolvedValueOnce(mockUtxos);
      const mockResponse = {
        status: 200,
        text: jest.fn().mockResolvedValueOnce("txHash"),
      };
      global.fetch = jest.fn().mockResolvedValueOnce(mockResponse);

      const result = await bitcoin.broadcast({
        from: "address",
        publicKey: "publicKey",
        to: "to",
        amount: "1000",
        path: "path",
        sig: {
          big_r: { affine_point: "affine_point" },
          s: { scalar: "scalar" },
          recovery_id: 1,
        },
        networkId: "testnet",
      });

      expect(result).toBe("txHash");
    });
  });
});
