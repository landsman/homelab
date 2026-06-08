#!/bin/sh
set -eu

# docker (root)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exec sg docker newgrp `id -gn`
docker run --rm hello-world
