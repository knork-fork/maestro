# tags: comments, code-style, documentation

Don't delete helpful comments unless specifically asked to, even if they look redundant at first.
  
Example of a comment that SHOULDN'T be deleted:
```
// Create .maestro/conventions dir if it doesn't exist
if (!existsSync(join(maestroDir, 'conventions'))) {
    mkdirSync(...);
}
```