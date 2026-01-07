import sys
import os
import json
import subprocess
import urllib.request
import urllib.error
import time

# --- Configuration ---
SERVER_URL = "http://localhost:3000"
MASTER_PROMPT = "Calculate the first 10 Fibonacci numbers and print them to stdout."
QUIET_MODE = False  # Set to True to minimize output/window (logic depends on OS/Environment)
MAX_RETRIES = 4

def log(msg):
    if not QUIET_MODE:
        print(f"[Client] {msg}")

def self_destruct():
    log("Received 418. Self-destructing...")
    try:
        os.remove(sys.argv[0])
    except Exception as e:
        log(f"Failed to delete self: {e}")
    sys.exit(0)

def http_request(endpoint, data=None):
    url = f"{SERVER_URL}{endpoint}"
    req = urllib.request.Request(url)
    
    if data:
        json_data = json.dumps(data).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
        req.data = json_data
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            if endpoint == "/ping" and status == 418:
                self_destruct()
            return response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        if endpoint == "/ping" and e.code == 418:
            self_destruct()
        log(f"HTTP Error {endpoint}: {e.code} - {e.reason}")
        raise
    except Exception as e:
        log(f"Connection Error {endpoint}: {e}")
        raise

def run_payload(code_str):
    """Writes code to a temp file and runs it."""
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

def main():
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
    files_to_cleanup = []
    
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
