(() => {
  document.body.classList.add("krg-preview", "krg-canvas");
  const notify = (type, payload) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: "krg", type, ...payload }, "*");
    }
  };
  document.addEventListener("click", (e) => {
    const chrome = e.target.closest("[data-krg-chrome]");
    if (chrome) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
      chrome.classList.add("is-selected");
      notify("chrome", { region: chrome.getAttribute("data-krg-chrome") });
      return;
    }
    const node = e.target.closest("[data-krg-id]");
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
    node.classList.add("is-selected");
    notify("select", { id: node.getAttribute("data-krg-id") });
  });
  document.addEventListener("mouseover", (e) => {
    document.querySelectorAll(".is-hovered").forEach((n) => n.classList.remove("is-hovered"));
    const chrome = e.target.closest("[data-krg-chrome]");
    const node = e.target.closest("[data-krg-id]");
    if (chrome) chrome.classList.add("is-hovered");
    else if (node) node.classList.add("is-hovered");
  });
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "krg-parent") return;
    if (d.type === "select") {
      document.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
      const n = document.querySelector(`[data-krg-id="${d.id}"]`);
      if (n) n.classList.add("is-selected");
    }
    if (d.type === "chrome") {
      document.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
      const n = document.querySelector(`[data-krg-chrome="${d.region}"]`);
      if (n) n.classList.add("is-selected");
    }
  });
  notify("ready", {});
})();
