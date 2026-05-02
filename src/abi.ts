// IndelibleENS contract ABI — sourced from @indelible-world/indelible-protocol
import ensAbiJson from "@indelible-world/indelible-protocol/abi/ens";
export const indelibleEnsAbi = ensAbiJson as typeof ensAbiJson;

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
