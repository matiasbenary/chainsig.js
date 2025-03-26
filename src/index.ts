export * as chains from "./chains";
export * as utils from "./utils";

// Import modules
import { BTCRpcAdapter } from "./chains/Bitcoin/BTCRpcAdapter";
import { ChainSignatureContract } from "./chains/ChainSignatureContract";
import { NEAR_MAX_GAS } from "./utils/chains/near/constants";

// Export specific modules
export { BTCRpcAdapter } from "./chains/Bitcoin/BTCRpcAdapter";
export { ChainSignatureContract } from "./chains/ChainSignatureContract";
export { NEAR_MAX_GAS } from "./utils/chains/near/constants";

// Export named modules for compatibility
export const chainAdapters = { BTCRpcAdapter: BTCRpcAdapter };
export const contracts = { ChainSignatureContract: ChainSignatureContract };
export const constants = { NEAR_MAX_GAS: NEAR_MAX_GAS };
