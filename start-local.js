const { spawn } = require("child_process");

const phpCommand = process.env.PHP_EXE || "php";
const args = ["-S", "localhost:3000", "-t", "public_html"];

const child = spawn(phpCommand, args, {
  stdio: "inherit",
  windowsHide: false
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error("PHP executable not found. Add php to PATH or set the PHP_EXE environment variable.");
    process.exit(1);
    return;
  }

  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
