import { KDF_CHAIN_IDS } from '../../../src/constants'
import {
  type NajPublicKey,
  type MPCSignature,
  type RSVSignature,
  type UncompressedPubKeySEC1,
} from '../../../src/types'

export const toRSV = (signature: MPCSignature): RSVSignature => {
  // Handle NearNearMpcSignature
  if (
    'big_r' in signature &&
    typeof signature.big_r === 'object' &&
    'affine_point' in signature.big_r &&
    's' in signature &&
    typeof signature.s === 'object' &&
    'scalar' in signature.s
  ) {
    return {
      r: signature.big_r.affine_point.substring(2),
      s: signature.s.scalar,
      v: signature.recovery_id + 27,
    }
  }
  // Handle ChainSigNearMpcSignature
  else if (
    'big_r' in signature &&
    typeof signature.big_r === 'string' &&
    's' in signature &&
    typeof signature.s === 'string'
  ) {
    return {
      r: signature.big_r.substring(2),
      s: signature.s,
      v: signature.recovery_id + 27,
    }
  }
  // Handle ChainSigEvmMpcSignature
  else if (
    'bigR' in signature &&
    'x' in signature.bigR &&
    's' in signature &&
    typeof signature.s === 'bigint'
  ) {
    return {
      r: signature.bigR.x.toString(16).padStart(64, '0'),
      s: signature.s.toString(16).padStart(64, '0'),
      v: signature.recoveryId + 27,
    }
  }

  throw new Error('Invalid signature format')
}

export const compressPubKey = (
  uncompressedPubKeySEC1: UncompressedPubKeySEC1
): string => {
  const slicedPubKey = uncompressedPubKeySEC1.slice(2)

  if (slicedPubKey.length !== 128) {
    throw new Error('Invalid uncompressed public key length')
  }

  const x = slicedPubKey.slice(0, 64)
  const y = slicedPubKey.slice(64)

  const isEven = parseInt(y.slice(-1), 16) % 2 === 0
  const prefix = isEven ? '02' : '03'

  return prefix + x
}

export const najToUncompressedPubKeySEC1 = (
  najPublicKey: NajPublicKey
): UncompressedPubKeySEC1 => {
  return `04${'a'.repeat(128)}` as UncompressedPubKeySEC1
}

export function deriveChildPublicKey(
  rootUncompressedPubKeySEC1: UncompressedPubKeySEC1,
  predecessorId: string,
  path: string = '',
  chainId: string
): UncompressedPubKeySEC1 {
  // Mock implementation
  return `04${'a'.repeat(128)}` as UncompressedPubKeySEC1
}

export const uint8ArrayToHex = (uint8Array: number[]): string => {
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
} 