# Shell Builder

Shell builder is a tool for building shells that can be accessed remotely from any computer with a simple `curl` command piped to `bash` (even works with Windows).

<img height="400px" src="https://imgur.com/1ISoPzw.png">

## Usage

### Github Actions

```sh
npx shell-builder
```

Running this script will build the shell files and generate the output in an `out/` directory.

### Mac, Linux, & WSL

```sh
curl your.url | bash
```

### Windows

```cmd
powershell (Invoke-WebRequest your.url).content | cmd
```

> **NOTE**: If there is a shorter way to do this please create an issue and let me know!

### CLI Files

The structure of the shell should be in a file called `cli.json`.

All the functions in the shell should in the directory `funcs/` with file extensions `.sh` and `.bat`.
