"""
Network Module
==============

This module handles HTTP communication with the RefleX server.
It provides a wrapper around urllib for sending requests and handling responses,
including error handling and specific behaviors such as 'self-destruct' on 418.
"""

import json
import urllib.request
import urllib.error
from config import SERVER_URL
from logger import log
from utils import self_destruct

def http_request(endpoint, data=None):
    """
    Sends an HTTP request to the specified server endpoint.
    
    If `data` is provided, a POST request is made with JSON payload.
    Otherwise, a GET request is made.

    Args:
        endpoint (str): The API endpoint path (e.g., '/ping').
        data (dict, optional): The dictionary to be sent as a JSON payload. Defaults to None.

    Returns:
        str: The response body as a UTF-8 decoded string.

    Raises:
        urllib.error.HTTPError: If the server returns an HTTP error code.
        Exception: For other connection errors.
    """
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
