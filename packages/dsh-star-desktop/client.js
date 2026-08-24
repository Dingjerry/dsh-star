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
      .dshStarButton:disabled{cursor:default;opacity:.5}.dshStarActions{display:flex;align-items:center;gap:8px}.dshStarProgress{width:130px;height:5px;border-radius:5px;overflow:hidden;background:var(--dsw-alias-border-l2)}.dshStarProgress>i{display:block;height:100%;background:var(--dsw-alias-interactive-primary);transition:width .2s ease}.dshStarUpdateMeta{font:11px/16px var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);white-space:nowrap}
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
    const nativeInvoke = () => window.__TAURI_INTERNALS__?.invoke;
    const broadcastUpdate = detail => {
      const merged = { ...(window.__DSH_STAR_LAST_UPDATE__ || {}), ...detail };
      window.__DSH_STAR_LAST_UPDATE__ = merged;
      window.dispatchEvent(new CustomEvent("dsh-star-update", { detail: merged }));
    };
    const confirmRestart = async kind => {
      const accepted = window.confirm(copy(
        kind === "app" ? "DSH Star 更新已准备好。现在重启并完成更新吗？" : "Harness 更新已准备好。现在重启进入新版本吗？",
        kind === "app" ? "The DSH Star update is ready. Restart and finish updating now?" : "The Harness update is ready. Restart into the new version now?"
      ));
      if (!accepted) return;
      await nativeInvoke()(kind === "app" ? "apply_app_update" : "restart_after_update");
    };
    const downloadUpdate = async kind => {
      const invoke = nativeInvoke();
      if (!invoke) throw new Error("Native update bridge is unavailable");
      const progress = await invoke(kind === "app" ? "download_app_update" : "download_harness_update");
      broadcastUpdate({ progress });
      if (progress?.restartRequired) await confirmRestart(kind);
      return progress;
    };
    const checkOnlineUpdates = async () => {
      const invoke = nativeInvoke();
      if (!invoke) return null;
      const check = await invoke("check_updates");
      broadcastUpdate({ check });
      return check;
    };

    function Row({ title, body, children }) {
      return h("div", { className: "dshStarRow" }, h("div", { className: "dshStarCopy" }, h("div", { className: "dshStarTitle" }, title), h("div", { className: "dshStarBody" }, body)), children);
    }
    function DesktopSection() {
      const invoke = nativeInvoke();
      const [status, setStatus] = useState(null);
      const [error, setError] = useState("");
      const [updates, setUpdates] = useState(window.__DSH_STAR_LAST_UPDATE__?.check || null);
      const [progress, setProgress] = useState(window.__DSH_STAR_LAST_UPDATE__?.progress || null);
      const [updateBusy, setUpdateBusy] = useState(false);
      const refresh = async () => {
        try { setStatus(await invoke("desktop_status")); setError(""); }
        catch (reason) { setError(String(reason)); }
      };
      useEffect(() => {
        refresh();
        const receive = event => {
          if (event.detail?.check) setUpdates(event.detail.check);
          if (event.detail?.progress) setProgress(event.detail.progress);
        };
        window.addEventListener("dsh-star-update", receive);
        if (!window.__DSH_STAR_LAST_UPDATE__?.check) checkOnlineUpdates().catch(reason => setError(String(reason)));
        return () => window.removeEventListener("dsh-star-update", receive);
      }, []);
      useEffect(() => {
        if (!updateBusy) return;
        const timer = setInterval(async () => {
          try { setProgress(await invoke("update_status")); } catch {}
        }, 500);
        return () => clearInterval(timer);
      }, [updateBusy]);
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
      const checkNow = async () => {
        setUpdateBusy(true);
        try { setUpdates(await checkOnlineUpdates()); setError(""); }
        catch (reason) { setError(String(reason)); }
        finally { setUpdateBusy(false); }
      };
      const startUpdate = async kind => {
        setUpdateBusy(true);
        try { setProgress(await downloadUpdate(kind)); setError(""); }
        catch (reason) { setError(String(reason)); }
        finally { setUpdateBusy(false); }
      };
      const progressPercent = progress?.total ? Math.min(100, Math.round(progress.downloaded * 100 / progress.total)) : 0;
      const progressActive = ["downloading", "verifying", "installing"].includes(progress?.phase);
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
          }, h("span", { className: "dshStarValue" }, status ? `v${status.appVersion}` : "…")),
          h(Row, { title: copy("Harness 运行时", "Harness runtime"), body: copy("当前活动的官方 DeepSeek Harness 构建", "Active official DeepSeek Harness build") }, h("span", { className: "dshStarValue" }, status ? `${status.harnessTag.replace(/^dsh-v/, "")} · ${status.harnessCommit.slice(0, 7)}` : "…")),
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
          h(Row, {
            title: copy("DSH Star 更新", "DSH Star updates"),
            body: updates?.app?.message || copy("自动检查轻量壳的新版本，下载后由你确认重启", "Automatically check for shell updates and ask before restarting")
          }, h("div", { className: "dshStarActions" },
            updates?.app?.latestVersion && h("span", { className: "dshStarUpdateMeta" }, `v${updates.app.currentVersion} → v${updates.app.latestVersion}`),
            h("button", { className: "dshStarButton", type: "button", disabled: updateBusy, onClick: () => updates?.app?.available ? startUpdate("app") : checkNow() }, updates?.app?.available ? copy("后台更新", "Update") : copy("检查更新", "Check"))
          )),
          h(Row, {
            title: copy("DeepSeek Harness 更新", "DeepSeek Harness updates"),
            body: updates?.harness?.message || copy("检查官方源码版本；仅安装经过兼容性验证和签名的运行时", "Check official releases; only install tested and signed runtime packs")
          }, h("div", { className: "dshStarActions" },
            updates?.harness?.latestTag && h("span", { className: "dshStarUpdateMeta" }, updates.harness.latestTag),
            updates?.harness?.compatibleRuntimeAvailable
              ? h("button", { className: "dshStarButton", type: "button", disabled: updateBusy, onClick: () => startUpdate("harness") }, copy("后台更新", "Update"))
              : h("span", { className: "dshStarBadge" }, updates?.harness?.officialUpdateAvailable ? copy("等待适配", "Pending validation") : copy("已是最新", "Up to date"))
          )),
          h(Row, {
            title: copy("更新状态", "Update status"),
            body: progress?.message || copy("后台更新不会阻塞 Harness；完成后会提示是否重启", "Background updates keep Harness responsive and ask before restart")
          }, progressActive
            ? h("div", { className: "dshStarActions" }, h("div", { className: "dshStarProgress" }, h("i", { style: { width: `${progress?.total ? progressPercent : 35}%` } })), h("span", { className: "dshStarUpdateMeta" }, progress?.total ? `${progressPercent}%` : "…"))
            : progress?.restartRequired
              ? h("button", { className: "dshStarButton", type: "button", onClick: () => confirmRestart(progress.kind) }, copy("立即重启", "Restart now"))
              : h("span", { className: "dshStarBadge" }, progress?.phase === "error" ? copy("失败", "Failed") : copy("就绪", "Ready")))
        )
      );
    }

    exports.name = "dsh-star-desktop";
    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "desktop", order: 1000, label: copy("Star设置", "Star Settings") }, DesktopSection));
      if (!window.__DSH_STAR_AUTO_UPDATE_STARTED__) {
        window.__DSH_STAR_AUTO_UPDATE_STARTED__ = true;
        setTimeout(async () => {
          try {
            const check = await checkOnlineUpdates();
            if (window.__DSH_STAR_UPDATE_PROMPTED__) return;
            const kind = check?.app?.available ? "app" : check?.harness?.compatibleRuntimeAvailable ? "harness" : null;
            if (!kind) return;
            window.__DSH_STAR_UPDATE_PROMPTED__ = true;
            const accepted = window.confirm(copy(
              kind === "app" ? "发现新的 DSH Star 版本，是否在后台下载更新？" : "发现经过验证的 DeepSeek Harness 新版本，是否在后台下载更新？",
              kind === "app" ? "A new DSH Star version is available. Download it in the background?" : "A verified DeepSeek Harness update is available. Download it in the background?"
            ));
            if (accepted) await downloadUpdate(kind);
          } catch (reason) {
            broadcastUpdate({ progress: { phase: "error", message: String(reason), restartRequired: false } });
          }
        }, 4000);
      }
    };
    return module.exports;
  }
});
