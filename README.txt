    ██▀███  ▓█████   █████▒██▓    ▓█████ ▒██   ██▒
   ▓██ ▒ ██▒▓█   ▀ ▓██   ▒▓██▒    ▓█   ▀ ▒▒ █ █ ▒░
   ▓██ ░▄█ ▒▒███   ▒████ ░▒██░    ▒███   ░░  █   ░
   ▒██▀▀█▄  ▒▓█  ▄ ░▓█▒  ░▒██░    ▒▓█  ▄  ░ █ █ ▒ 
   ░██▓ ▒██▒░▒████▒░▒█░   ░██████▒░▒████▒▒██▒ ▒██▒
   ░ ▒▓ ░▒▓░░░ ▒░ ░ ▒ ░   ░ ▒░▓  ░░░ ▒░ ░▒▒ ░ ░▓ ░
     ░▒ ░ ▒░ ░ ░  ░ ░     ░ ░ ▒  ░ ░ ░  ░░░   ░▒ ░
     ░░   ░    ░    ░ ░     ░ ░      ░    ░    ░  
      ░        ░  ░           ░  ░   ░  ░ ░    ░  
                                               
                                               
   RefleX is an AI, self-healing runner designed to be
   completly fault-tolerant, it is equiped with one main
  'master prompt', the master prompt defines what the payload
   should be.
  
 - The master prompt should be one simple paragraph designed to
   do only one action, in case of any fails, the error logs get
   sent back to the server and the client asks for a fix for it.
   
 - The returned code should be in Python and does not should
   need any external dependencies. (packages on pip, etc.)

 - The client is quiet, minimizing itself using cross-platform
   methods for not scaring users randomly with an black window
   with texts. Theres only a hardcoded boolean for toggleing the
   main window and enabling verbose logging.
   
   ---   ---   ---   ---   ---   ---   ---   ---   ---   ---
   
   SERVER:
   
   The server has 3 main endpoints:
   
   
 - /gen
     - Generates a standalone Python payload based on the 'master prompt',
       ready for immediate execution, generated code should always exit
       with an specifyed, espected error code, anything other than that
       error code should be threaded as an error.
      
 - /fix
     - Gets the error returned (if any occurs), sent by the client.
       - To avoid infinite loops between 'ask -> error -> fix -> error',
         it has an 4th max iteration cap, where the app gives an
         error message.
       - If the server thinks theres NO errors, the server returns an
         special signal to the client telling that everything is alright.
     
 - /ping
     - On app start, asks for the server for an HTTP response, depending on
       the returned HTTP status code, it stops.
        - HTTP 418 should make the client close and delete
          its own executable, silently.


 - The server directly contacts Groq API to generate the payloads,
   the server is written with NodeJS and minimum libraries for
   basic HTTP GET/POST handling.
