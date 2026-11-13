{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    llm-agents.url = "github:numtide/llm-agents.nix";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    catppuccin = {
      url = "github:catppuccin/nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pi = {
      url = "github:earendil-works/pi/stable";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixos-hardware = {
      url = "github:NixOS/nixos-hardware";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ nixpkgs, ... }:
    let
      mkHost =
        name:
        nixpkgs.lib.nixosSystem {
          specialArgs = { inherit inputs; };
          modules = [
            inputs.home-manager.nixosModules.home-manager
            ./hosts/common.nix
            ./hosts/${name}/configuration.nix
          ];
        };
    in
    {
      formatter = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ] (
        system: nixpkgs.legacyPackages.${system}.nixfmt
      );

      packages = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ] (system: {
        slacrawl = nixpkgs.legacyPackages.${system}.callPackage ./modules/desktop/slacrawl.nix { };
        herdr-app = nixpkgs.legacyPackages.${system}.callPackage ./modules/desktop/herdr-app {
          package = inputs.llm-agents.packages.${system}.herdr-app;
        };
      });

      checks = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ] (system: {
        herdr-app-cargo-deps = inputs.self.packages.${system}.herdr-app.cargoDeps;
      });

      nixosConfigurations = {
        helix = mkHost "helix";
        tau = mkHost "tau";
        zephyr = mkHost "zephyr";
      };
    };
}
