import { baseDecode } from "@near-js/utils";
import { base_decode } from "near-api-js/lib/utils/serialize";
import { ec as EC } from "elliptic";
import { sha3_256 } from "js-sha3";
import hash from "hash.js";
import bs58check from "bs58check";
import { bech32 } from "bech32";
import CryptoJS from "crypto-js";
import { uncompressedHexPointToEvmAddress } from "./address";
import {
  MPC_SIGNER_MAINNET,
  MPC_SIGNER_TESTNET,
  NEAR_MAINNET_NETWORK_ID,
  NEAR_TESTNET_NETWORK_ID,
  NEAR_NETWORK_ID,
  ROOT_PUBLIC_KEY_MAINNET,
  ROOT_PUBLIC_KEY_TESTNET,
} from "./constants";

function najPublicKeyStrToUncompressedHexPoint(
  najPublicKeyStr: string
): string {
  const decodedKey = baseDecode(najPublicKeyStr.split(":")[1]!);
  return "04" + Buffer.from(decodedKey).toString("hex");
}

export function deriveChildPublicKey(
  parentUncompressedPublicKeyHex: string,
  accountId: string,
  path: string = ""
): string {
  const ec = new EC("secp256k1");
  const scalarHex = sha3_256(
    `near-mpc-recovery v0.1.0 epsilon derivation:${accountId},${path}`
  );

  const x = parentUncompressedPublicKeyHex.substring(2, 66);
  const y = parentUncompressedPublicKeyHex.substring(66);

  // Create a point object from X and Y coordinates
  const oldPublicKeyPoint = ec.curve.point(x, y);

  // Multiply the scalar by the generator point G
  const scalarTimesG = ec.g.mul(scalarHex);

  // Add the result to the old public key point
  const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG);
  const newX = newPublicKeyPoint.getX().toString("hex").padStart(64, "0");
  const newY = newPublicKeyPoint.getY().toString("hex").padStart(64, "0");
  return "04" + newX + newY;
}

export enum AddressType {
  EVM = "evm",
  BITCOIN_MAINNET_LEGACY = "bitcoin-mainnet-legacy",
  BITCOIN_MAINNET_SEGWIT = "bitcoin-mainnet-segwit",
  BITCOIN_TESTNET_LEGACY = "bitcoin-testnet-legacy",
  BITCOIN_TESTNET_SEGWIT = "bitcoin-testnet-segwit",
}

type GenerateAddressParams = {
  publicKey: string;
  accountId: string;
  path: string;
  addressType: AddressType;
};

export async function generateAddress({
  publicKey,
  accountId,
  path,
  addressType,
}: GenerateAddressParams) {
  let childPublicKey = deriveChildPublicKey(
    najPublicKeyStrToUncompressedHexPoint(publicKey),
    accountId,
    path
  );

  if (!addressType) throw new Error("addressType is required");

  let address;

  switch (addressType) {
    case AddressType.EVM:
      address = await uncompressedHexPointToEvmAddress(childPublicKey);
      break;
    case AddressType.BITCOIN_MAINNET_LEGACY:
      address = await uncompressedHexPointToBtcAddress(
        childPublicKey,
        Buffer.from([0x00])
      );
      break;
    case AddressType.BITCOIN_MAINNET_SEGWIT:
      address = await uncompressedHexPointToSegwitAddress(childPublicKey, "bc");
      break;
    case AddressType.BITCOIN_TESTNET_LEGACY:
      address = await uncompressedHexPointToBtcAddress(
        childPublicKey,
        Buffer.from([0x6f])
      );
      break;
    case AddressType.BITCOIN_TESTNET_SEGWIT:
      address = await uncompressedHexPointToSegwitAddress(childPublicKey, "tb");
      break;
    default:
      throw new Error(`Unsupported address type: ${addressType}`);
  }

  if (!address) {
    throw new Error(`Failed to generate address for type: ${addressType}`);
  }

  return {
    address,
    publicKey: childPublicKey,
  };
}

export function getRootPublicKey(network: NEAR_NETWORK_ID): string {
  switch (network) {
    case NEAR_TESTNET_NETWORK_ID:
      return ROOT_PUBLIC_KEY_TESTNET;
    case NEAR_MAINNET_NETWORK_ID:
      return ROOT_PUBLIC_KEY_MAINNET;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export function getMpcAccountIdByNetwork(network: NEAR_NETWORK_ID): string {
  switch (network) {
    case NEAR_TESTNET_NETWORK_ID:
      return MPC_SIGNER_TESTNET;
    case NEAR_MAINNET_NETWORK_ID:
      return MPC_SIGNER_MAINNET;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export async function generateBtcAddress({
  publicKey,
  accountId,
  path = "",
  isTestnet = true,
  addressType = "segwit",
}: {
  publicKey: string;
  accountId: string;
  path?: string;
  isTestnet?: boolean;
  addressType?: "legacy" | "segwit";
}): Promise<{ address: string; publicKey: string }> {
  const childPublicKey = await deriveChildPublicKey(
    najPublicKeyStrToCompressedPoint(publicKey), // Use the compressed key
    accountId,
    path
  );

  let address: string;

  if (addressType === "legacy") {
    const networkByte = Buffer.from([isTestnet ? 0x6f : 0x00]); // 0x00 for mainnet, 0x6f for testnet
    address = await uncompressedHexPointToBtcAddress(
      childPublicKey,
      networkByte
    );
  } else if (addressType === "segwit") {
    const networkPrefix = isTestnet ? "tb" : "bc";
    address = await uncompressedHexPointToSegwitAddress(
      childPublicKey,
      networkPrefix
    );
  } else {
    throw new Error(`Unsupported address type: ${addressType}`);
  }

  return {
    address,
    publicKey: childPublicKey,
  };
}

export async function uncompressedHexPointToBtcAddress(
  uncompressedHexPoint: string,
  networkByte: Buffer
): Promise<string> {
  // Step 1: SHA-256 hashing of the public key
  const publicKeyBytes = Uint8Array.from(
    Buffer.from(uncompressedHexPoint, "hex")
  );
  const sha256HashOutput = CryptoJS.SHA256(
    CryptoJS.lib.WordArray.create(publicKeyBytes)
  ).toString();

  // Step 2: RIPEMD-160 hashing on the result of SHA-256
  const ripemd160 = hash
    .ripemd160()
    .update(Buffer.from(sha256HashOutput))
    .digest();

  // Step 3: Adding network byte (0x00 for Bitcoin Mainnet, 0x6f for Testnet)
  // @ts-ignore
  const networkByteAndRipemd160 = Buffer.concat([
    networkByte,
    Buffer.from(ripemd160),
  ]);

  // Step 4: Base58Check encoding
  return bs58check.encode(networkByteAndRipemd160);
}

export async function uncompressedHexPointToSegwitAddress(
  uncompressedHexPoint: string,
  networkPrefix: string
): Promise<string> {
  const publicKeyBytes = Uint8Array.from(
    Buffer.from(uncompressedHexPoint, "hex")
  );
  const sha256HashOutput = CryptoJS.SHA256(
    CryptoJS.lib.WordArray.create(publicKeyBytes)
  ).toString();

  const ripemd160 = hash
    .ripemd160()
    .update(Buffer.from(sha256HashOutput))
    .digest();

  const witnessVersion = 0x00; // for P2PWPKH
  // @ts-ignore
  const words = bech32.toWords(Buffer.from(ripemd160));
  words.unshift(witnessVersion);
  // @ts-ignore
  const address = bech32.encode(networkPrefix, words);

  return address;
}

export function najPublicKeyStrToCompressedPoint(
  najPublicKeyStr: string
): string {
  const ec = new EC("secp256k1");

  // Decode the key from base58, then convert to a hex string
  const decodedKey = base_decode(najPublicKeyStr.split(":")[1]!);

  // Check if the key is already in uncompressed format
  if (decodedKey.length === 64) {
    // If it's a raw 64-byte key, we must assume it's uncompressed and manually prepend '04' (uncompressed prefix)
    const uncompressedKey = "04" + Buffer.from(decodedKey).toString("hex");

    // Create a key pair from the uncompressed key
    const keyPoint = ec.keyFromPublic(uncompressedKey, "hex").getPublic();

    // Return the compressed public key as a hex string
    return keyPoint.encodeCompressed("hex");
  } else {
    throw new Error("Unexpected key length. Expected uncompressed key format.");
  }
}
