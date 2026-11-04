{
  lib,
  stdenv,
  buildGo127Module,
  coreutils,
  fetchFromGitHub,
  gitMinimal,
  installShellFiles,
  makeWrapper,
  nodejs,
}:

buildGo127Module (finalAttrs: {
  pname = "slacrawl";
  version = "0.10.5";

  src = fetchFromGitHub {
    owner = "openclaw";
    repo = "slacrawl";
    tag = "v${finalAttrs.version}";
    hash = "sha256-0jyzdftsi4GldEhURBEnHkLDCdMB/0O1tkesEPeCS3I=";
  };

  vendorHash = "sha256-cOawSmp/tbVAwvEgnOHC/pmImZWBOYBpXIc8oV6dB+o=";
  subPackages = [ "cmd/slacrawl" ];

  env = {
    CGO_ENABLED = 0;
    SLACRAWL_NO_UPDATE_CHECK = 1;
  };

  nativeBuildInputs = [
    installShellFiles
    makeWrapper
  ];
  nativeCheckInputs = [
    gitMinimal
    nodejs
  ];

  ldflags = [
    "-s"
    "-w"
    "-X github.com/openclaw/slacrawl/internal/cli.version=${finalAttrs.version}"
  ];

  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR"
    substituteInPlace internal/mcpclient/client_test.go \
      --replace-fail /bin/sleep ${lib.getExe' coreutils "sleep"}
    go test -p "$NIX_BUILD_CORES" ./...
    runHook postCheck
  '';

  postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
    export HOME="$TMPDIR"
    installShellCompletion --cmd slacrawl \
      --bash <($out/bin/slacrawl completion bash) \
      --zsh <($out/bin/slacrawl completion zsh)
  '';

  postFixup = ''
    wrapProgram "$out/bin/slacrawl" \
      --prefix PATH : ${lib.makeBinPath [ nodejs ]} \
      --set-default SLACRAWL_NO_UPDATE_CHECK 1
  '';

  meta = {
    description = "Mirror Slack history into a locally searchable SQLite archive";
    homepage = "https://github.com/openclaw/slacrawl";
    license = lib.licenses.mit;
    mainProgram = "slacrawl";
    platforms = lib.platforms.linux;
  };
})
