#!/usr/bin/env bash
set -e
for i in {1..10}; do
    echo "Starting iteration $i"
    echo "--------"
    cat prompt.local.md | qwen -y -p
    echo "--------"
done