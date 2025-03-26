export * as chains from "./chains";
export * as utils from "./utils";

// Export specific chains and their adapters
export { BTCRpcAdapter as chainAdapters } from "./chains/Bitcoin/BTCRpcAdapter";
export { ChainSignatureContract as contracts } from "./chains/ChainSignatureContract";
export { NEAR_MAX_GAS as constants } from "./utils/chains/near/constants";
