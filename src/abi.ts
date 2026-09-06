// ENS PublicResolver TextChanged event ABI (standard ENS, not part of the `indelible` package)
export const resolverTextChangedAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "node", type: "bytes32" },
      { indexed: true, name: "indexedKey", type: "string" },
      { indexed: false, name: "key", type: "string" },
      { indexed: false, name: "value", type: "string" },
    ],
    name: "TextChanged",
    type: "event",
  },
] as const;

// ENS Registry ABI (for NewResolver events to track resolver changes)
export const ensRegistryAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "node", type: "bytes32" },
      { indexed: false, name: "resolver", type: "address" },
    ],
    name: "NewResolver",
    type: "event",
  },
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "resolver",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
