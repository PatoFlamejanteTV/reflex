"""
Execution Module
================

This module handles the execution of dynamically generated Python code payloads.
It manages writing the code to a temporary file, executing it in a subprocess,
capturing the output, and cleaning up afterwards.
"""

import subprocess
import sys
import os

def run_payload(code_str):
    """
    Writes code to a temporary file and runs it.

    Args:
        code_str (str): The Python source code to execute.

    Returns:
        subprocess.CompletedProcess: The result of the execution, containing stdout, stderr, and returncode.
    """
    filename = "payload_temp.py"
    with open(filename, "w") as f:
        f.write(code_str)
    
    try:
        # Run the payload
        # Capture stdout and stderr
        result = subprocess.run(
            [sys.executable, filename],
            capture_output=True,
            text=True
        )
        return result
    finally:
        if os.path.exists(filename):
            os.remove(filename)
