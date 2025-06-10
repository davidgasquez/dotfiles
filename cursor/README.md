# Cursor

To fix the Python REPL, you need to update `product.json` (in your Cursor program directory, `/opt/cursor/usr/share/cursor/resources/app`) so that `extensionsEnabledApiProposals` > `ms-python.python` includes `notebookVariableProvider`.
