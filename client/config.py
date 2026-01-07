"""
Configuration Module
====================

This module holds the global configuration settings for the RefleX client.

Attributes:
    SERVER_URL (str): The base URL of the RefleX server.
    MASTER_PROMPT (str): The initial prompt describing the task to be performed.
    QUIET_MODE (bool): If True, suppresses output to the console.
    MAX_RETRIES (int): The maximum number of attempts to fix and retry the payload.
"""

SERVER_URL = "http://localhost:3000"
MASTER_PROMPT = "CPU Spike/Stress tester, short test that only lasts for 5 seconds"
QUIET_MODE = False  # Set to True to minimize output/window (logic depends on OS/Environment)
MAX_RETRIES = 4
