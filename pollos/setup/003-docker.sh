#!/bin/sh
set -eu

sudo apt install -y make rsync unzip tmux

# docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exec sg docker newgrp `id -gn`
docker run --rm hello-world

# bun
curl -fsSL https://bun.sh/install | bash
exec $SHELL # source ~/.bashrc
bun --version

