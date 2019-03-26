# Visual Studio Code

If you want to update the extensions list, run `code --list-extensions` and save that list.

To install the extensions from the file in a new Code installation execute the following command:

```bash
cat extensions | xargs -L 1 code --install-extension
```
