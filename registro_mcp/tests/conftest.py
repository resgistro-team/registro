import os
import sys

# Tests import the server's modules directly, as `python server.py` does.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
