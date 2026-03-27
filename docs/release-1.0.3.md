### Welcome to Atlas v1.0.3 — The High-Visibility Audit Update! 🚀
This release focused on making your security audits significantly more "vocal". No more missing silent backend errors or hidden firewall blocks!

### What's New in v1.0.3 🛡️
- **Critical HTTP Error Highlighting:** All 4xx and 5xx status codes (like 404, 403, 406) are now automatically flagged as **Critical Violations (Level 2)**. 
  - *Previously, these were marked as Warnings and could be missed in "Stable" reports. Now they turn the whole report RED if a page navigation fails.*
- **Actionable Proxy Error Descriptions:** Added specialized translation logic for the reporting engine:
  - **HTTP 406 (Not Acceptable):** Specifically warns about **firewalls and Pixie Proxies** blocking traffic, directing you to check backend logs.
  - **HTTP 403 (Forbidden):** Alerts you to permission/authentication failures.
  - **HTTP 500 (Internal Server Error):** Detects backend crashes immediately.
- **Optimized Release Assets:** Cleaned up the installer generation to provide only core essentials: `.exe` (Windows), `.dmg` (macOS), and `.AppImage` (Linux).

### Installation & Usage Instructions
1. Download the `Atlas-Sandbox-Setup-1.0.3.exe` (or your OS equivalent) from the Assets below.
2. Double-click the installer to add Atlas to your machine.
3. Open a Command Prompt, PowerShell, or Git Bash terminal.
4. **Run Audit:**
   ```bash
   atlas run
   ```

### Debugging with v1.0.3 🔐
If you see an **Access Blocked (Not Acceptable)** error in your audit report, it means your server's backend security (WAF/Proxy) is rejecting Atlas. Use the new "Fix" instructions in the report to authorize the traffic!
