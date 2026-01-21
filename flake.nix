{
  description = "Development environment for Pulumi BYOC examples";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs_20
            pnpm

            # Pulumi
            pulumi
            pulumiPackages.pulumi-nodejs

            # Cloud CLIs
            awscli2
            kubectl
            azure-cli

            # Development tools
            typescript
            nodePackages.prettier
          ];
        };
      }
    );
}
