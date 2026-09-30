#!/bin/sh
set -eu

#
# MANUAL STEP: run on a box that is to run a Docker Swarm stack, as root, after 003-docker.sh.
# Only the boxes that host a stack need it; the rest never run this.
#
# What it does:
#   - initialises a single-node swarm, with this box as its manager
#   - says nothing and changes nothing if the box is already in one
#
# Why the address is computed rather than given:
#
#   $ docker swarm init --advertise-addr eno1
#   Error response from daemon: interface eno1 has more than one IPv6 address
#
# A box here has a LAN address and a tailnet one, so swarm will not pick for us — and naming the
# interface does not settle it either, because the interface carries two IPv6 addresses (a SLAAC
# one and a privacy one) and the daemon refuses to choose. So the IPv4 is read off the interface
# at run time. Written into a script it would be a lie the first time DHCP hands out another one.
#
# `docker swarm init` prints a **worker join token**. It is a credential: anything that reaches
# this box on 2377 can join the swarm with it. Do not paste it into a chat, a ticket or a log. If
# it is seen, rotate both:
#
#   docker swarm join-token --rotate worker
#   docker swarm join-token --rotate manager
#

IFACE=${IFACE:-eno1}

state=$(docker info --format '{{.Swarm.LocalNodeState}}')
if [ "$state" = active ]; then
	echo "already in a swarm ($(docker info --format '{{if .Swarm.ControlAvailable}}manager{{else}}worker{{end}}')) — nothing to do"
	exit 0
fi

addr=$(ip -4 -o addr show "$IFACE" | awk '{print $4}' | cut -d/ -f1)
[ -n "$addr" ] || {
	echo "no IPv4 on $IFACE — set IFACE to the interface to advertise" >&2
	exit 1
}

echo "initialising a single-node swarm, advertising $addr"
docker swarm init --advertise-addr "$addr" >/dev/null

echo "done. this box is $(docker node ls --format '{{.Hostname}} {{.Status}} {{.ManagerStatus}}')"
echo "the join token printed by 'docker swarm join-token worker' is a credential — treat it as one"
