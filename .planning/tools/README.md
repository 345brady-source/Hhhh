# Orchestrator tools (kept in the repo so a restart or a new session loses nothing)

- heavy.sh: runs one browser-heavy command in one of three slots (copy to the scratchpad's exec-011/ folder, or run from here; it keeps its locks beside itself).
- preview/diy-portal.html: the page published to the owner's preview link (https://claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP). It loads the build's files by relative path; rewrite its script and style lists from diy.html for each build and bump its reset key. preview/b13-files.txt is the last build's file list (every file must have an extension).
- help-chat/help-chat.html: the owner's help chat page (https://claude.ai/artifact/Sbf9kfcoaqJd3svbb7tezj), published with guide.json beside it and the `sample` capability. Regenerate guide.json after any help guide merge: `node .planning/tools/help-chat/make-guide.mjs <dir>`, then republish.
