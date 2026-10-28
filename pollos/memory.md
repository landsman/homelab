# Memory modules

What sits in each box, for buying a matching module or replacing one. The
[HW table](README.md#hw) has the short version.

| Node   | Modules           | Part              | Rank | Rated | Runs at | ECC        |
|--------|-------------------|-------------------|------|-------|---------|------------|
| gus    | 2x 16 GB Kingston | KF3200C20S4/16G   | 1    | 3200  | 2133    | no         |
| mike   | 2x 16 GB Micron   | 18ASF2G72HZ-2G3B1 | 2    | 2400  | 2133    | yes, inert |
| walter | 2x 16 GB Micron   | 18ASF2G72HZ-2G3B1 | 2    | 2400  | 2133    | yes, inert |
| jesse  | 2x 16 GB Micron   | 18ASF2G72HZ-2G3B1 | 2    | 2400  | 2133    | yes, inert |
| saul   | 2x 16 GB SK hynix | HMA82GS6DJR8N-XN  | 2    | 3200  | 2666    | no         |

- **Runs at** is the most the CPU takes: 2133 on the i5-6500T, 2666 on the
  i5-9500T. A faster module buys nothing.
- **Rated** comes from the part number (`KF3200…` is 3200, Micron's `-2G3` is
  2400, SK hynix's `-XN` is 3200); the HP firmware reports only the speed the
  module runs at.
- **Inert ECC**: the Micron modules carry ECC, but neither the i5 CPUs nor these
  boards use it, so they run as plain memory.

Part number and rank are read off a box with `sudo dmidecode -t memory`.
