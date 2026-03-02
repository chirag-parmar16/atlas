### Welcome to Atlas! 🚀
Atlas is a standalone Electron sandbox for web development, featuring production domain masking, chaos engineering, and session recording.

### What's New in v1.0.1
- **Integrated GUI Mode:** A dedicated standalone dashboard to browse your projects, view hierarchical reports, and watch session recordings—all in one place.
- **Standalone Windows Installer:** You can now install Atlas globally on your machine using the provided `.exe` file.
- **Smart CLI Integration:** The installer automatically configures your system `PATH`. Simply open any terminal and run `atlas init` or `atlas run`!
- **Unified Architecture:** The new backend pipeline and separated engine modules provide complete stability for the UI and metric collections.

### Installation & Usage Instructions
1. Download `Atlas Setup 1.0.1.exe` below.
2. Double-click the installer to add Atlas to your machine.
3. Open a Command Prompt, PowerShell, or Git Bash terminal.
4. **GUI Mode:** Simply run `atlas` or `atlas gui` to open the Dashboard and explore your projects.
5. **CLI Mode:** Navigate to your web project folder and:
   - Initialize the project with an `atlas.config.json` file:
     ```bash
     atlas init
     ```
   - Start the Atlas development sandbox:
     ```bash
     atlas run
     ```

### Customizing the HUD with Flags
Atlas lets you enable or disable specific UI tools on the fly using command-line flags. 

For example, to **disable** the Console and Networks tabs for a cleaner view:
```bash
atlas -d "Console, Networks" run
```

Or, to explicitly **enable** them back again later:
```bash
atlas -e "Console, Networks" run
```
