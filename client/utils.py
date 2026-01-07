"""
Utilities Module
================

This module provides utility functions for the RefleX client,
such as the self-destruct mechanism.
"""

import os
import sys
from logger import log

def self_destruct():
    """
    Deletes the current script file and exits the application.
    This is triggered when the client needs to remove itself from the host system.
    """
    log("Received 418. Self-destructing...")
    try:
        if os.path.exists(sys.argv[0]):
             os.remove(sys.argv[0])
    except Exception as e:
        log(f"Failed to delete self: {e}")
    sys.exit(0)
