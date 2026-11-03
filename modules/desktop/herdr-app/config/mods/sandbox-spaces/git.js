// A repo's net change against HEAD (staged, unstaged and untracked files not ignored), as
// `git diff HEAD --shortstat` would count it after `git add -N` of every untracked file.
// That add goes to a copy of the index, so the repo's own index stays untouched; git may
// still write the empty blob object it records for intent-to-add files.
// No commit yet: against the empty tree. Renames count as a deletion plus an addition.
export const DIFF = `
export LC_ALL=C
g() { git --no-optional-locks -c core.fsmonitor=false -c diff.autoRefreshIndex=false "$@"; }
top=$(g rev-parse --show-toplevel) || exit
cd "$top" || exit
idx=$(g rev-parse --git-path index) || exit
tmp=$(mktemp) || exit
trap 'rm -f "$tmp" "$tmp.lock"' EXIT
if [ -f "$idx" ]; then cp "$idx" "$tmp" || exit; else rm -f "$tmp"; fi
export GIT_INDEX_FILE="$tmp"
base=$(g rev-parse -q --verify "HEAD^{tree}") || base=$(g hash-object -t tree /dev/null) || exit
g ls-files -z -o --exclude-standard | grep -zv '/$' | g add -N --pathspec-from-file=- --pathspec-file-nul || exit
g diff "$base" --shortstat --no-renames --no-ext-diff --no-textconv
`;

const count = (text, word) => Number(text.match(new RegExp("(\\d+) " + word))?.[1] ?? 0);

// {add, del, files} when dirty, null when clean or not a repo, undefined when unsure.
export function tally(r) {
  if (r.code !== 0) return /not a git repository|must be run in a work tree/i.test(r.stderr) ? null : undefined;
  const files = count(r.stdout, "files? changed");
  return files ? { add: count(r.stdout, "insertion"), del: count(r.stdout, "deletion"), files } : null;
}
