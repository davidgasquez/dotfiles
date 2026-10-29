---
name: publish-to-filecoin
description: Upload any file or folder to Filecoin (Calibration testnet) with the `filecoin` CLI and return shareable links. Use when asked to upload, pin, publish, or store artifacts on Filecoin/IPFS for testing and ephemeral artifacts.
disable-model-invocation: true
---

# Filecoin Pin Upload

Upload to Filecoin Calibration testnet with the [`filecoin` CLI](https://docs.filecoin.io/build-on-filecoin/filecoin-for-agents/cli) and the public demo key from [pin.filecoin.cloud](https://pin.filecoin.cloud). The key is public, so this is for tests and demos only. Never upload private data.

## Upload

The CLI needs Node.js 24 or newer. If that isn't available, prefix the command with `nix shell nixpkgs#nodejs_24 -c`.

```bash
export FILECOIN_NETWORK=calibration
export FILECOIN_ROOT_ADDRESS=0x44f08D1beFe61255b3C3A349C392C560FA333759
export FILECOIN_SESSION_KEY=0x256b25c8af80f47d81752dea07109ad9a7073ef2f7516c61f4abb3496770c710

npx -y filecoin put <file-or-folder> --json
```

- A folder is packed for IPFS and gets a root CID. To publish a website, upload a folder that contains `index.html`.
- A single file is stored as raw bytes and has no root CID. Put it in a folder if you need IPFS links.

The command prints one JSON object. Report these fields:

- `data.urls.browser`: the link to share
- `data.resource.rootCid`: also share `https://<rootCid>.ipfs.inbrowser.link`
- `data.resource.pieceCid` and `data.urls.piece`: the exact stored bytes
- `data.resource.ref` (`res_…`): needed for the commands below

## Verify

```bash
npx -y filecoin get <res_…> --output ./copy --json   # downloads and verifies the PieceCID
npx -y filecoin status --json                        # key expiry and account funds
```

Public IPFS gateways rate-limit command-line clients, and the browser links only render in a real browser. Use `filecoin get` to verify.

## Errors

Errors come back as `{"error":{"code":…},"next":[…]}`. Follow the `next` steps.

- `session_expired` / `auth_required`: the demo key has been replaced. Find the current one in the pin.filecoin.cloud JS bundle (a 0x-prefixed 64-hex-character string next to the root address).
- Interrupted upload: run the printed `filecoin operations resume op_…` command. Don't start a new `put`.
