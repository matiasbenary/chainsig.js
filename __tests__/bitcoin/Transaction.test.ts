import { Bitcoin } from "../../src/chains/Bitcoin/Bitcoin";
import { Mempool } from "../../src/chains/Bitcoin/BTCRpcAdapter/Mempool";
// import { BaseChainSignatureContract } from "../../src/chains/ChainSignatureContract";
// import { jest } from "@jest/globals";
import { ChainSignatureContract } from "../../src/utils/chains/near/ChainSignatureContract";
import { KeyPair, type KeyPairString } from "@near-js/crypto";

import { config } from "dotenv";

// Load environment variables
config();

describe("Bitcoin Transaction Lifecycle Test", () => {
  let bitcoin: Bitcoin;
  let btcRpcAdapter: Mempool;
  let contract: ChainSignatureContract;
  let derivedAddress: string;
  let derivedPublicKey: string;

  beforeAll(async () => {
    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString;

    if (!accountId || !privateKey) {
      throw new Error(
        "Missing required environment variables: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY",
      );
    }

    try {
      // Initialize contract
      contract = new ChainSignatureContract({
        networkId: "testnet",
        contractId: "v1.signer-prod.testnet",
        accountId,
        keypair: KeyPair.fromString(privateKey),
      });

      // Initialize Bitcoin connection
      btcRpcAdapter = new Mempool("https://mempool.space/testnet/api");
      bitcoin = new Bitcoin({
        network: "testnet",
        contract,
        btcRpcAdapter,
      });

      // Derive Bitcoin address
      const result = await bitcoin.deriveAddressAndPublicKey(
        accountId,
        "bitcoin-1",
      );
      derivedAddress = result.address;
      derivedPublicKey = result.publicKey;
      console.log("Derived Bitcoin address:", derivedAddress);
      console.log("Derived public key:", derivedPublicKey);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Setup error:", {
        name: err.name || "Unknown error",
        message: err.message || "No error message",
      });
      throw error;
    }
  });

  it("should initialize Bitcoin connection", () => {
    expect(bitcoin).toBeDefined();
    expect(btcRpcAdapter).toBeDefined();
  });

  it("should derive Bitcoin address and public key", () => {
    expect(derivedAddress).toBeDefined();
    expect(derivedAddress).toMatch(/^(tb1|[mn])[a-zA-Z0-9]+/); // testnet address format
    expect(derivedPublicKey).toBeDefined();
    expect(derivedPublicKey).toMatch(/^[0-9a-fA-F]+$/);
  });

  it("should get balance for derived address", async () => {
    const balance = await bitcoin.getBalance(derivedAddress);
    expect(balance).toBeDefined();
    expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
  });

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
});
