window.__ModuleLoader__.load({
  id: "dsh-star-desktop",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const { createElement: h, useEffect, useState } = React;

    const style = `
      .dshStarPage{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:18px}
      .dshStarPage h2{font-size:20px;line-height:28px;margin:0}.dshStarLead{color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:22px;margin:0}
      .dshStarGroup{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden}.dshStarRow{display:flex;gap:18px;align-items:center;padding:14px 16px;border-top:1px solid var(--dsw-alias-border-l2)}.dshStarRow:first-child{border-top:0}
      .dshStarCopy{min-width:0;flex:1}.dshStarTitle{font-size:14px;font-weight:500;line-height:22px}.dshStarBody{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-top:2px}.dshStarValue{color:var(--dsw-alias-label-secondary);font:12px/18px var(--ds-font-family-code);white-space:nowrap}
      .dshStarSelect,.dshStarButton,.dshStarSearch{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;height:34px;padding:0 11px;font:inherit}.dshStarButton{cursor:pointer}.dshStarButton:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dshStarBadge{display:inline-flex;width:max-content;border-radius:10px;background:var(--dsw-alias-bg-module-platform);padding:2px 8px;color:var(--dsw-alias-label-secondary);font-size:11px}
    `;
    if (!document.querySelector('style[data-plugin-css="dsh-star-desktop"]')) {
      const tag = document.createElement("style");
      tag.dataset.pluginCss = "dsh-star-desktop";
      tag.textContent = style;
      document.head.appendChild(tag);
    }

    const zh = () => document.documentElement.lang.toLowerCase().startsWith("zh") || navigator.language.toLowerCase().startsWith("zh");
    const copy = (cn, en) => zh() ? cn : en;

    function Row({ title, body, children }) {
      return h("div", { className: "dshStarRow" }, h("div", { className: "dshStarCopy" }, h("div", { className: "dshStarTitle" }, title), h("div", { className: "dshStarBody" }, body)), children);
    }
    function DesktopSection() {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      const [status, setStatus] = useState(null);
      const [error, setError] = useState("");
      const refresh = async () => {
        try { setStatus(await invoke("desktop_status")); setError(""); }
        catch (reason) { setError(String(reason)); }
      };
      useEffect(() => { refresh(); }, []);
      const changeLaunchAtLogin = async () => {
        try {
          const launchAtLogin = await invoke("set_launch_at_login", { enabled: !status.launchAtLogin });
          setStatus({ ...status, launchAtLogin }); setError("");
        } catch (reason) { setError(String(reason)); }
      };
      const changeCloseBehavior = async behavior => {
        try {
          const closeBehavior = await invoke("set_close_behavior", { behavior });
          setStatus({ ...status, closeBehavior }); setError("");
        } catch (reason) { setError(String(reason)); }
      };
      return h("section", { className: "dshStarPage", "data-dsh-star-settings": "desktop" },
        h("h2", null, copy("Star设置", "Star Settings")),
        h("p", { className: "dshStarLead" }, copy("DSH Star 的原生宿主、运行时和插件市场设置。官方 Harness 配置仍由 Harness 管理。", "Native host, runtime, and plugin market preferences for DSH Star.")),
        h("div", { className: "dshStarGroup" },
          h(Row, {
            title: copy("关于 DSH Star", "About DSH Star"),
            body: copy(
              "基于 DeepSeek Harness 官方开源源码，使用 Tauri 2 与 Rust 封装的社区桌面版。",
              "A community desktop edition built from the official open-source DeepSeek Harness and wrapped with Tauri 2 and Rust."
            )
          }, h("span", { className: "dshStarValue" }, "v0.1.0")),
          h(Row, { title: copy("Harness 运行时", "Harness runtime"), body: copy("固定的官方 DeepSeek Harness 构建", "Pinned official DeepSeek Harness build") }, h("span", { className: "dshStarValue" }, "0.1.1-rc.2 · b150a55")),
          h(Row, {
            title: copy("活动 Profile", "Active profile"),
            body: copy(
              "web 是官方的 base + web-app Profile；数据、插件和凭据仍由官方 Harness 管理",
              "web is the official base + web-app profile; Harness continues to own its data, plugins, and credentials"
            )
          }, h("span", { className: "dshStarValue" }, "web")),
          h(Row, { title: copy("运行架构", "Runtime architecture"), body: copy("Rust 直接监督 Harness；仅保留一个 Node 进程", "Rust directly supervises one Harness Node process") }, h("span", { className: "dshStarBadge" }, "Tauri 2 / Rust")),
          h(Row, { title: copy("登录时启动", "Launch at login"), body: copy("登录 macOS 后自动启动 DSH Star", "Start DSH Star when you sign in to macOS") },
            h("button", { className: "dshStarButton", type: "button", disabled: !status, role: "switch", "aria-checked": status?.launchAtLogin || false, onClick: changeLaunchAtLogin }, status?.launchAtLogin ? copy("已开启", "Enabled") : copy("已关闭", "Disabled"))),
          h(Row, { title: copy("关闭窗口行为", "Close behavior"), body: copy("选择关闭窗口时的默认动作", "Choose what closing the window does") },
            h("select", { className: "dshStarSelect", disabled: !status, value: status?.closeBehavior || "ask", onChange: e => changeCloseBehavior(e.target.value) },
              h("option", { value: "ask" }, copy("每次询问", "Ask every time")), h("option", { value: "hide" }, copy("隐藏窗口", "Hide window")), h("option", { value: "quit" }, copy("退出应用", "Quit app")))),
          h(Row, { title: copy("诊断", "Diagnostics"), body: error || (status ? copy(`Harness ${status.runtimeRunning ? "运行中" : "未运行"}；${status.loopbackOnly ? "仅监听本机" : "监听范围异常"}`, `Harness is ${status.runtimeRunning ? "running" : "stopped"}; ${status.loopbackOnly ? "loopback only" : "unexpected binding"}`) : copy("正在读取真实运行状态…", "Reading runtime status…")) }, h("button", { className: "dshStarButton", type: "button", onClick: refresh }, copy("刷新状态", "Refresh"))),
          h(Row, { title: copy("在线更新", "Online updates"), body: copy("尚未启用；当前版本不会在后台检查或安装更新", "Not enabled; this version does not check for or install updates in the background") }, h("span", { className: "dshStarBadge" }, copy("尚未启用", "Unavailable")))
        )
      );
    }

    exports.name = "dsh-star-desktop";
    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "desktop", order: 1000, label: copy("Star设置", "Star Settings") }, DesktopSection));
    };
    return module.exports;
  }
});
