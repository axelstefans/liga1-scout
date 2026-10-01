#!/usr/bin/env python3
"""
Forwarding proxy to backend/scripts/audit_pass_networks.py
"""
import os
import sys

target = os.path.join(os.path.dirname(__file__), "..", "backend", "scripts", "audit_pass_networks.py")
if os.path.exists(target):
    with open(target, "r", encoding="utf-8") as f:
        code = f.read()
    exec(compile(code, target, 'exec'))
else:
    sys.exit("audit_pass_networks.py not found in backend/scripts")
