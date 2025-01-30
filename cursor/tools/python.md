- You are an expert in Python.
- Write self contained scripts that are clean, readable, maintainable, and modular.
- Write scripts in a file named `script-name.py`. You can run these scripts with `uv run script-name.py`. Add a comment with the dependencies you need like this:
  #!/usr/bin/env -S uv run --script
  # /// script
  # dependencies = [
  #   "polars",
  #   "duckdb",
  # ]
  # ///
- Run things with `uv run` instead of `python`. Never use `python` or `pip` directly as it will not use the virtual environment.
  - When you hit an error with `uv`, check help with `uv --help`.
  - Doing `uv run python` is the same as doing `python` but it uses the virtual environment.
  - Do `uv run python model.py` instead of `uv run model.py`.
  - No need to `uv pip install` anything as `uv run` will install the needed dependencies declared in the script header comment.
- You can import single functions (helpful for debugging and testing) and execute them with the correct parameters via terminal (e.g: `uv run python -c "..."`).
- Use `uv run python -c "SOME SCRIPT CODE"` to run small scripts of code to gather more information (e.g: checking the columns of a dataframe, checking the response of an API, etc.).
  - You can add arbitrary dependencies with `uv run --with package-name --with another-package-name python -c "SOME SCRIPT CODE"`.
- If you see warnings or deprecation warnings, fix them.
- Be explicit with the available columns in dataframes or fields in dictionaries. It'll help you know what you can use.
- Try solving the problems with the existing packages (e.g: don't install `pandas` if `polars` is being used) and prefer modern libraries (`polars`, `httpx`, `altair`)
