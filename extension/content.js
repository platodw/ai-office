// AI Office — Content Script
// Extracts page content and signals context changes to the side panel.

function extractPageContent() {
  const url = location.href;
  let text = "";

  // Gmail: extract open email body
  if (url.includes("mail.google.com")) {
    const subject = document.querySelector("h2.hP")?.innerText || "";
    const fromName = document.querySelector(".gD")?.getAttribute("name") || "";
    const fromEmail = document.querySelector(".go")?.innerText || "";
    const fromLine = fromName || fromEmail ? `From: ${[fromName, fromEmail ? `<${fromEmail}>` : ""].filter(Boolean).join(" ")}` : "";
    const dateLine = document.querySelector(".g3")?.innerText ? `Date: ${document.querySelector(".g3").innerText}` : "";
    const bodies = [...document.querySelectorAll(".a3s.aiL")];
    if (bodies.length > 0) {
      const bodyText = bodies.map(el => {
        const c = el.cloneNode(true);
        c.querySelectorAll(".gmail_quote,.gmail_signature").forEach(n => n.remove());
        return (c.innerText || "").trim();
      }).filter(Boolean).join("\n\n---\n\n");
      text = [subject, fromLine, dateLine, bodyText].filter(Boolean).join("\n\n");
    }
  }

  // Generic fallback
  if (!text) {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script,style,nav,footer,aside,[role='banner'],[role='navigation']").forEach(el => el.remove());
    text = (clone.innerText || "").replace(/\s{3,}/g, "\n\n").trim();
  }

  return { title: document.title, url, text };
}

// Listen for content requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_page_content") {
    sendResponse(extractPageContent());
  }
  return true;
});
