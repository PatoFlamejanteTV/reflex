"""
RefleX Client Module
====================

This module serves as the entry point for the RefleX client application.
It handles the main execution loop, including communicating with the server,
executing payloads, and reporting results or errors back to the server.

The client operates by:
1. Pinging the server to ensure connectivity.
2. Requesting an initial code payload based on a master prompt.
3. Executing the payload in a loop.
4. If execution fails, reporting the error to the server and requesting a fix.
5. Retrying with the fixed code until success or maximum retries are reached.

Dependencies:
    - config: Configuration settings.
    - logger: Logging utility.
    - network: Network communication functions.
    - execution: Code execution logic.
"""

import json
import sys
from config import SERVER_URL, MASTER_PROMPT, MAX_RETRIES
from logger import log
from network import http_request
from execution import run_payload

def main():
    """
    Main entry point for the RefleX client.

    This function coordinates the lifecycle of the client:
    - Connects to the server.
    - Fetches the generated code.
    - Executes the code.
    - Handles errors and retries by requesting fixes from the server.
    """
    log(f"RefleX Client Started. Target: {SERVER_URL}")
    log(f"Master Prompt: {MASTER_PROMPT}")

    # 1. Ping
    try:
        http_request("/ping")
        log("Server Ping: OK")
    except Exception:
        log("Could not reach server. Exiting.")
        return

    # 2. Initial Generation
    current_code = ""
    try:
        resp = http_request("/gen", {"master_prompt": MASTER_PROMPT})
        resp_json = json.loads(resp)
        current_code = resp_json.get("code", "")
    except Exception as e:
        log(f"Failed to generate initial payload: {e}")
        return

    if not current_code:
        log("No code received.")
        return

    # 3. Execution Loop
    for attempt in range(MAX_RETRIES + 1):
        log(f"--- Attempt {attempt + 1} ---")
        
        # Execute
        result = run_payload(current_code)
        
        if result.returncode == 0:
            log("Payload executed successfully!")
            log("Output:\n" + result.stdout)
            break
        else:
            log(f"Payload failed with exit code {result.returncode}")
            error_log = f"Exit Code: {result.returncode}\nStderr: {result.stderr}\nStdout: {result.stdout}"
            
            if attempt < MAX_RETRIES:
                log("Requesting fix from server...")
                try:
                    resp = http_request("/fix", {
                        "code": current_code,
                        "error": error_log,
                        "master_prompt": MASTER_PROMPT
                    })
                    resp_json = json.loads(resp)
                    
                    if resp_json.get("status") == "ok":
                        log("Server signaled NO_ERROR. Stopping.")
                        break
                        
                    new_code = resp_json.get("code")
                    if new_code:
                        current_code = new_code
                    else:
                        log("Server returned no fix.")
                        break
                except Exception as e:
                    log(f"Failed to request fix: {e}")
                    break
            else:
                log("Max retries reached. Giving up.")

if __name__ == "__main__":
    main()
