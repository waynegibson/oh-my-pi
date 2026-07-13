set dotenv-load := true

default:
    @just --list

# Default pi, no extensions
pi:
    pi

# Pi with the damage-control safety gate (confirms before rm -rf, sudo, force-push, hard reset)
ext-damage-control:
    pi -e extensions/damage-control.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts

# Damage-Control (continue): same rules, but blocked turns keep running with actionable feedback
ext-damage-control-continue:
    pi -e extensions/damage-control-continue.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts

# Theme cycler: Ctrl+X forward, Ctrl+Q backward, /theme picker
ext-theme-cycler:
    pi -e extensions/theme-cycler.ts -e extensions/minimal.ts