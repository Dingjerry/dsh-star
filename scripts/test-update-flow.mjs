import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const clientSource = await readFile(
  new URL("../packages/dsh-star-desktop/client.js", import.meta.url),
  "utf8",
);

async function runUpdateFlow({ check, expected }) {
  const commands = [];
  const confirmations = [];
  const scheduled = [];
  let registration;

  const window = {
    __ModuleLoader__: {
      load(value) {
        registration = value;
      },
    },
    __TAURI_INTERNALS__: {
      async invoke(command) {
        commands.push(command);
        if (command === "check_updates") return check;
        if (command.startsWith("download_")) {
          return {
            phase: "ready",
            kind: command === "download_app_update" ? "app" : "harness",
            restartRequired: true,
          };
        }
      },
    },
    confirm(message) {
      confirmations.push(message);
      return true;
    },
    dispatchEvent() {},
  };
  const document = {
    documentElement: { lang: "zh-CN" },
    head: { appendChild() {} },
    querySelector() {
      return null;
    },
    createElement() {
      return { dataset: {}, textContent: "" };
    },
  };
  const context = vm.createContext({
    window,
    document,
    navigator: { language: "zh-CN" },
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    setTimeout(callback) {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeout() {},
  });
  vm.runInContext(clientSource, context, { filename: "client.js" });
  assert.ok(registration, "desktop client should register with Harness");
  const plugin = registration.factory((name) => {
    assert.equal(name, "react");
    return {
      createElement() {},
      useEffect() {},
      useState() {},
    };
  });
  plugin.apply({
    slots: {
      inject(_name, callback) {
        callback();
      },
      register(value) {
        return value;
      },
    },
  });
  assert.equal(scheduled.length, 1, "automatic update check should be scheduled once");
  await scheduled[0]();
  assert.deepEqual(commands, expected);
  assert.equal(confirmations.length, 2, "download and restart should each require confirmation");
}

await runUpdateFlow({
  check: {
    app: { available: true },
    harness: { compatibleRuntimeAvailable: true },
  },
  expected: ["check_updates", "download_app_update", "apply_app_update"],
});

await runUpdateFlow({
  check: {
    app: { available: false },
    harness: { compatibleRuntimeAvailable: true },
  },
  expected: ["check_updates", "download_harness_update", "restart_after_update"],
});

console.log("Desktop update prompt, background download, and restart flows verified.");
