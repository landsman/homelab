# Pollos

pollos is my homelab — a small cluster of Debian 13 boxes where every node is named after a Breaking Bad character (walter, jesse, mike, gus…). 
Pretty hostnames make each box easy to spot and a joy to SSH into. 
The scripts in [setup](setup) folder take a fresh Debian install and turn it into another member of the family.

You can easily install them from microsite: https://www.pollos.cz

## HW

- 4x HP Prodesk 600 G3 Mini i5-6500T
- 4x SSD Kingston 240GB
- 2x 16GB Sk Hynix DDR4 3200Mhz HMA82GS6DJR8N - XN
- 2x 16GB Kingston DDR4 3200MHz FURY so-dimm CL20 Impact

![stack photo](microsite/src/assets/img/stack-photo.jpg)

## SSH

```yml
# ~/.ssh/config

Host *.pollos
   User ansible
   # stored in 1password
   IdentityFile ~/.ssh/id_ed25519_homelab
   IdentitiesOnly yes

Host gus.pollos
  HostName 192.168.0.115

Host mike.pollos
  HostName 192.168.0.113

Host walter.pollos
  HostName 192.168.0.116

Host jesse.pollos
  HostName 192.168.0.117
```
