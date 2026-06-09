import type {
  ExtensionAPI,
  ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent";

export default function trustAllProjects(pi: ExtensionAPI): void {
  pi.on("project_trust", (): ProjectTrustEventResult => {
    return { trusted: "yes", remember: true };
  });
}
