// IndelibleENS contract ABI (only the functions/events we need)
export const indelibleEnsAbi = [
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "resolveIndelibleAddress",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "verifications",
    outputs: [
      { name: "authority", type: "address" },
      { name: "node", type: "bytes32" },
      { name: "dnsName", type: "bytes" },
      { name: "startTimestamp", type: "uint256" },
      { name: "endTimestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "bytes32" }],
    name: "nodeToBinding",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "removeEnsBinding",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ENS PublicResolver TextChanged event ABI
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
