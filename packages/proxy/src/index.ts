import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import { loadOrGenerateCA, getCAPath } from "./ca.js";
import { createProxy } from "./proxy.js";
import { WiretapWebSocketServer } from "./websocket.js";
import { createSetupServer, getSetupCommand } from "./setup-server.js";
import { createUIServer } from "./ui-server.js";

const VERSION = "1.0.6";

const BANNER = `
${chalk.cyan("╔════════════════════════════════════════════════════════════╗")}
${chalk.cyan("║")}                                                            ${chalk.cyan("║")}
${chalk.cyan("║")}   ${chalk.bold.white("CC Wiretap")} ${chalk.gray("v" + VERSION)}                                        ${chalk.cyan("║")}
${chalk.cyan("║")}   ${chalk.gray("HTTP/HTTPS proxy for Claude Code traffic inspection")}      ${chalk.cyan("║")}
${chalk.cyan("║")}                                                            ${chalk.cyan("║")}
${chalk.cyan("╚════════════════════════════════════════════════════════════╝")}
`;

interface CLIOptions {
  port: string;
  wsPort: string;
  uiPort: string;
  quiet: boolean;
}

async function main() {
  const program = new Command();

  program
    .name("cc-wiretap")
    .description(
      "HTTP/HTTPS proxy for intercepting and visualizing Claude Code traffic",
    )
    .version(VERSION)
    .option("-p, --port <port>", "Proxy server port", "8080")
    .option("-w, --ws-port <port>", "WebSocket server port for UI", "8081")
    .option("-u, --ui-port <port>", "UI dashboard server port", "3000")
    .option("-q, --quiet", "Suppress banner and verbose output", false)
    .action(async (options: CLIOptions) => {
      if (!options.quiet) {
        console.log(BANNER);
      }

      const proxyPort = parseInt(options.port, 10);
      const wsPort = parseInt(options.wsPort, 10);
      const uiPort = parseInt(options.uiPort, 10);

      try {
        // Load or generate CA certificate
        const ca = await loadOrGenerateCA();

        // Start WebSocket server
        const wsServer = new WiretapWebSocketServer({ port: wsPort });
        console.log(
          chalk.green("✓"),
          `WebSocket server started on port ${chalk.cyan(wsPort)}`,
        );

        // Start proxy server
        const proxy = await createProxy({
          port: proxyPort,
          ca,
          wsServer,
        });

        // Start setup server (for terminal eval command)
        const setupServer = createSetupServer(proxyPort);

        // Start UI server (serves bundled dashboard)
        const uiServer = createUIServer({ port: uiPort });

        console.log();
        console.log(chalk.white("Ready to intercept Claude API traffic."));
        console.log();

        // Highlight the easy setup command
        console.log(
          chalk.yellow.bold("Quick setup - run this in any terminal:"),
        );
        console.log();
        console.log(chalk.yellow("=>"), chalk.cyan.bold(getSetupCommand()));
        console.log();
        console.log(chalk.gray("Or manually:"));
        console.log();
        console.log(chalk.gray(`   NODE_EXTRA_CA_CERTS="${getCAPath()}" \\`));
        console.log(
          chalk.gray(`   HTTPS_PROXY=http://localhost:${proxyPort} \\`),
        );
        console.log(chalk.gray("   claude"));
        console.log();
        const uiUrl = `http://localhost:${uiPort}`;
        console.log(
          chalk.yellow("=>"),
          chalk.yellow.bold("UI:"),
          chalk.cyan(uiUrl),
        );
        console.log();
        console.log(chalk.gray("─".repeat(60)));
        console.log();

        // Open browser automatically
        await open(uiUrl);

        // Handle shutdown
        const shutdown = async () => {
          console.log();
          console.log(chalk.yellow("Shutting down..."));
          await proxy.stop();
          await wsServer.close();
          setupServer.close();
          uiServer?.close();
          process.exit(0);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
      } catch (error) {
        console.error(chalk.red("✗"), "Failed to start:", error);
        process.exit(1);
      }
    });

  program.parse();
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});

export { loadOrGenerateCA, getCAPath } from "./ca.js";
export { createProxy } from "./proxy.js";
export { WiretapWebSocketServer } from "./websocket.js";
export { ClaudeInterceptor, CLAUDE_API_HOSTS } from "./interceptor.js";
export {
  SSEStreamParser,
  parseSSEChunk,
  reconstructResponseFromEvents,
} from "./parser.js";
export { createSetupServer, getSetupCommand } from "./setup-server.js";
export { createUIServer } from "./ui-server.js";
export * from "./types.js";
