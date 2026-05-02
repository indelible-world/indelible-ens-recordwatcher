declare module "@indelible-world/indelible-protocol" {
  export const TAANQ_ADDRESS: `0x${string}`;
  export const ENS_INDELIBLE_ADDRESS: `0x${string}`;
  export const ENS_REGISTRY_ADDRESS: `0x${string}`;
  export const MERKLE_SPLIT: number;
  export const RESULT_CODE: {
    NOT_FOUND: 0;
    VERIFIED: 1;
    UNVERIFIED: 2;
    REVOKED: 3;
    WARNING: 4;
  };
}

declare module "@indelible-world/indelible-protocol/abi/ens" {
  const abi: readonly object[];
  export default abi;
}
