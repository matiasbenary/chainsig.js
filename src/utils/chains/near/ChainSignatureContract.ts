import { type Account, Contract, Connection } from "@near-js/accounts";
import { KeyPair } from "@near-js/crypto";
import { actionCreators } from "@near-js/transactions";
import BN from "bn.js";
import { base_decode } from "near-api-js/lib/utils/serialize";
// import { Connection as WalletConnection } from "@near-js/wallet-account";

import { ChainSignatureContract as AbstractChainSignatureContract } from "@chains/ChainSignatureContract";
import type { SignArgs } from "@chains/ChainSignatureContract";
import type {
  RSVSignature,
  MPCSignature,
  UncompressedPubKeySEC1,
} from "@chains/types";
import { cryptography, chains } from "@utils";
import { getNearAccount } from "@utils/chains/near/account";
import {
  DONT_CARE_ACCOUNT_ID,
  NEAR_MAX_GAS,
} from "@utils/chains/near/constants";
import { parseSignedDelegateForRelayer } from "@utils/chains/near/relayer";
import {
  type NearNetworkIds,
  type ChainSignatureContractIds,
} from "@utils/chains/near/types";

const najToUncompressedPubKey = (najPubKey: string): UncompressedPubKeySEC1 => {
  return `04${Buffer.from(base_decode(najPubKey.split(":")[1])).toString(
    "hex",
  )}`;
};

const requireAccount = (accountId: string): void => {
  if (accountId === DONT_CARE_ACCOUNT_ID) {
    throw new Error(
      "A valid account ID and keypair are required for change methods. Please instantiate a new contract with valid credentials.",
    );
  }
};

type NearContract = Contract & {
  public_key: () => Promise<string>;
  sign: (args: {
    args: { request: SignArgs };
    gas: BN;
    amount: BN;
  }) => Promise<MPCSignature>;
  experimental_signature_deposit: () => Promise<number>;
  derived_public_key: (args: {
    path: string;
    predecessor: string;
  }) => Promise<string>;
};

interface ChainSignatureContractArgs {
  networkId: NearNetworkIds;
  contractId: ChainSignatureContractIds;
  accountId?: string;
  keypair?: KeyPair;
}

const getRpcUrl = (networkId: NearNetworkIds): string => {
  const urls = {
    mainnet: [
      "https://rpc.mainnet.near.org",
      "https://near-mainnet.api.pagoda.co/rpc/v1",
    ],
    testnet: [
      "https://rpc.testnet.near.org",
      "https://near-testnet.api.pagoda.co/rpc/v1",
      "https://public-rpc.testnet.near.org",
    ],
  };

  return urls[networkId][0];
};

// Custom fetch implementation with better error handling
const customFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorText}`,
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Request timed out after 15 seconds");
      }
      throw new Error(`Fetch error: ${error.message}`);
    }
    throw error;
  }
};

// Custom JSON RPC request implementation
const jsonRpcRequest = async (
  url: string,
  method: string,
  params: unknown = {},
): Promise<unknown> => {
  try {
    const response = await customFetch(url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.random().toString(36).substring(7),
        method,
        params,
      }),
    });

    const result = await response.json();

    if ("error" in result) {
      throw new Error(
        `RPC error: ${result.error.message || JSON.stringify(result.error)}`,
      );
    }

    return result.result;
  } catch (error) {
    console.error("JSON-RPC request failed:", error);
    throw error;
  }
};

/**
 * This contract will default to view methods only.
 * If you want to use the change methods, you need to provide an account and keypair.
 */
export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly networkId: NearNetworkIds;
  private readonly contractId: ChainSignatureContractIds;
  private readonly accountId: string;
  private readonly keypair: KeyPair;
  private readonly connection: Connection;
  private contract: NearContract;
  private readonly rpcUrl: string;

  constructor({
    networkId,
    contractId,
    accountId = DONT_CARE_ACCOUNT_ID,
    keypair = KeyPair.fromRandom("ed25519"),
  }: ChainSignatureContractArgs) {
    super();

    this.networkId = networkId;
    this.contractId = contractId;
    this.accountId = accountId;
    this.keypair = keypair;
    this.rpcUrl = getRpcUrl(networkId);

    // Create a single connection to be reused
    this.connection = Connection.fromConfig({
      networkId,
      provider: {
        type: "JsonRpcProvider",
        args: {
          url: this.rpcUrl,
          // Use our custom fetch implementation
          fetchCustom: async (url: string, options: RequestInit) => {
            const response = await customFetch(url, options);
            const result = await response.json();
            return { ok: true, json: () => Promise.resolve(result) };
          },
        },
      },
      signer: keypair,
    });

    // Initialize the contract with the connection
    this.contract = new Contract(this.connection, contractId, {
      viewMethods: [
        "derived_public_key",
        "public_key",
        "experimental_signature_deposit",
      ],
      changeMethods: ["sign"],
      useLocalViewExecution: false,
    }) as unknown as NearContract;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error as Error;
        console.error(`Attempt ${i + 1} failed:`, error);

        if (i < retries - 1) {
          const delay = 1000 * Math.pow(2, i);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Operation failed after ${retries} attempts. Last error: ${lastError?.message}`,
    );
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    return this.withRetry(async () => {
      try {
        const deposit = await this.contract.experimental_signature_deposit();
        return new BN(
          deposit.toLocaleString("fullwide", { useGrouping: false }),
        );
      } catch (error) {
        console.error("Error getting signature deposit:", error);
        throw error;
      }
    });
  }

  async getDerivedPublicKey(args: {
    path: string;
    predecessor: string;
  }): Promise<UncompressedPubKeySEC1> {
    return this.withRetry(async () => {
      try {
        const najPubKey = await this.contract.derived_public_key({
          path: args.path,
          predecessor: args.predecessor,
        });
        return najToUncompressedPubKey(najPubKey);
      } catch (error) {
        console.error("Error getting derived public key:", error);
        throw error;
      }
    });
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    return this.withRetry(async () => {
      try {
        const najPubKey = await this.contract.public_key();
        return najToUncompressedPubKey(najPubKey);
      } catch (error) {
        console.error("Error getting public key:", error);
        throw error;
      }
    });
  }

  async sign(args: SignArgs): Promise<RSVSignature> {
    requireAccount(this.accountId);

    return this.withRetry(async () => {
      try {
        const deposit = await this.getCurrentSignatureDeposit();
        const signature = await this.contract.sign({
          args: { request: args },
          gas: NEAR_MAX_GAS,
          amount: deposit,
        });
        return cryptography.toRSV(signature);
      } catch (error) {
        console.error("Error signing transaction:", error);
        throw error;
      }
    });
  }

  static async signWithRelayer({
    account,
    contract,
    signArgs,
    deposit,
    relayerUrl,
  }: {
    account: Account;
    contract: ChainSignatureContractIds;
    signArgs: SignArgs;
    deposit: BN;
    relayerUrl: string;
  }): Promise<RSVSignature> {
    const functionCall = actionCreators.functionCall(
      "sign",
      { request: signArgs },
      BigInt(NEAR_MAX_GAS.toString()),
      BigInt(deposit.toString()),
    );

    const signedDelegate = await account.signedDelegate({
      receiverId: contract,
      actions: [functionCall],
      blockHeightTtl: 60,
    });

    // Remove the cached access key to prevent nonce reuse
    delete account.accessKeyByPublicKeyCache[
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      signedDelegate.delegateAction.publicKey.toString()
    ];

    const res = await fetch(`${relayerUrl}/send_meta_tx_async`, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(parseSignedDelegateForRelayer(signedDelegate)),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const txHash = await res.text();
    const txStatus = await account.connection.provider.txStatus(
      txHash,
      account.accountId,
      "FINAL",
    );

    const signature = chains.near.transactionBuilder.responseToMpcSignature({
      response: txStatus,
    });

    if (!signature) {
      throw new Error("Signature error, please retry");
    }

    return signature;
  }
}
