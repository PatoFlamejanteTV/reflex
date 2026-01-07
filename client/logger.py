"""
Logger Module
=============

This module provides a simple logging utility for the RefleX client.
It respects the global QUIET_MODE configuration.
"""

from config import QUIET_MODE

def log(msg):
    """
    Prints a message to the console with a prefix, unless QUIET_MODE is enabled.

    Args:
        msg (str): The message to log.
    """
    if not QUIET_MODE:
        print(f"[Client] {msg}")
