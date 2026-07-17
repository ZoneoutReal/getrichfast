// FocusFence blocked page: shows which site was fenced, the custom message,
// and the live session countdown.
const params = new URLSearchParams(location.search);
const from = params.get("from");
if (from) document.getElementById("site").textContent = from;

document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

function render(state) {
  if (state.blockMessage) {
    const msg = document.getElementById("msg");
    msg.hidden = false;
    msg.textContent = state.blockMessage;
  }
  const left = document.getElementById("left");
  if (state.session && state.session.endsAt > Date.now()) {
    left.hidden = false;
    const tick = () => {
      const ms = state.session.endsAt - Date.now();
      if (ms <= 0) {
        left.hidden = true;
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      document.getElementById("mins").textContent = `${m}:${String(s).padStart(2, "0")}`;
      setTimeout(tick, 1000);
    };
    tick();
  }
}

chrome.runtime.sendMessage({ type: "get-state" }).then((res) => {
  if (res && res.ok) render(res.state);
  window.__ffBlockedReady = true;
});
