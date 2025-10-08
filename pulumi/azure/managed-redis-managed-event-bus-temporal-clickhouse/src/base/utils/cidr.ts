/**
 * Splits a VNet CIDR block into subnet CIDRs for Azure
 *
 * Azure subnets are regional (span all AZs), so we need 4 subnets:
 * - Private: for AKS nodes and workload pods
 * - Public: for public-facing resources
 * - Isolated: for databases and sensitive services (no internet)
 * - API Server: dedicated subnet for AKS API server VNet integration
 *
 * @param vnetCidr - The VNet CIDR block (must be /16)
 * @returns Object containing the four subnet CIDRs
 *
 * @example
 * defaultVNetSubnetCIDRSplit("10.193.0.0/16")
 * // Returns:
 * // {
 * //   publicSubnetCidr: "10.193.0.0/23",      // 512 IPs
 * //   isolatedSubnetCidr: "10.193.2.0/23",    // 512 IPs
 * //   apiServerSubnetCidr: "10.193.4.0/23",   // 512 IPs
 * //   privateSubnetCidr: "10.193.128.0/17"    // 32,768 IPs
 * // }
 */
export function defaultVNetSubnetCIDRSplit(vnetCidr: string) {
  const cidrBlockParts = vnetCidr.split("/");
  if (cidrBlockParts.pop() !== "16") {
    throw new Error("CIDR block must be a /16");
  }

  const octets = cidrBlockParts[0].split(".");
  if (octets[2] !== "0" || octets[3] !== "0") {
    throw new Error("Last two octets of CIDR block must be 0");
  }

  const secondOctet = parseInt(octets[1]);

  // Public subnet: /23 for public resources (512 IPs)
  const publicSubnetCidr = `10.${secondOctet}.0.0/23`;

  // Isolated subnet: /23 for databases (512 IPs, no internet)
  const isolatedSubnetCidr = `10.${secondOctet}.2.0/23`;

  // API Server subnet: /23 for AKS API server (512 IPs)
  const apiServerSubnetCidr = `10.${secondOctet}.4.0/23`;

  // Private subnet: /17 for AKS nodes and pods (32,768 IPs - ~50% of /16)
  const privateSubnetCidr = `10.${secondOctet}.128.0/17`;

  return {
    publicSubnetCidr,
    isolatedSubnetCidr,
    apiServerSubnetCidr,
    privateSubnetCidr,
  };
}

/**
 * Generates Kubernetes service network CIDRs for AKS
 *
 * The service CIDR must NOT overlap with the VNet CIDR. We use a separate
 * private address space (10.0.0.0/16) for Kubernetes internal services.
 *
 * @param vnetCidr - The VNet CIDR block (must be /16)
 * @returns Object containing service CIDR and DNS service IP
 *
 * @example
 * defaultAksServiceNetworkCIDRs("10.193.0.0/16")
 * // Returns:
 * // {
 * //   aksServiceCidr: "10.0.0.0/16",
 * //   aksDnsServiceIP: "10.0.0.10"
 * // }
 */
export function defaultAksServiceNetworkCIDRs(vnetCidr: string) {
  const cidrBlockParts = vnetCidr.split("/");
  if (cidrBlockParts.pop() !== "16") {
    throw new Error("CIDR block must be a /16");
  }

  // Use a completely separate private address space for K8s services
  // This must NOT overlap with the VNet CIDR
  // 10.0.0.0/16 is a safe choice when VNet is 10.X.0.0/16 where X != 0
  const aksServiceCidr = "10.0.0.0/16";
  const aksDnsServiceIP = "10.0.0.10";

  return {
    aksServiceCidr,
    aksDnsServiceIP,
  };
}
