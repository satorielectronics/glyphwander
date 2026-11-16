#!/usr/bin/env sh
# Assemble the single-file game from src/ into index.html
set -e
cd "$(dirname "$0")"
{ cat src/shell.html; echo "<script>"; cat src/game.js; echo "</script>"; echo "</body>"; echo "</html>"; } > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
