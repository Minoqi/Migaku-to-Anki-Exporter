// ==UserScript==
// @name         Migaku Card → Anki Exporter + Auto Export All
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds buttons to export Migaku cards to Anki (single + full deck)
// @match        https://study.migaku.com/collection/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function () {
  const delay = ms => new Promise(res => setTimeout(res, ms));

  const clean = v => typeof v === "string" ? v : v ? String(v) : "";

  async function blobToBase64(blob) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  function postToAnki(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:8765",
        data: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        onload: res => {
          try { resolve(JSON.parse(res.responseText)); }
          catch (e) { reject("Invalid JSON from AnkiConnect"); }
        },
        onerror: e => reject(e)
      });
    });
  }

  async function uploadMedia(filename, base64) {
    return postToAnki({
      action: "storeMediaFile",
      version: 6,
      params: { filename, data: base64 }
    });
  }

  async function waitForElement(selector, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Timed out waiting for " + selector));
      }, timeout);
    });
  }

  async function exportToAnki(auto = false) {
    await waitForElement(".CardWord p");

    const word = document.querySelector('.CardWord p')?.innerText || '';
    const sentence = document.querySelector('.CardSentence p')?.innerText || '';
    const translation = document.querySelector('.CardTranslationSentence p')?.innerText || '';
    let definitionRaw = document.querySelector('.CardDefinitions p')?.innerText || '';
    const definition = definitionRaw.replace(/\n{2,}/g, '\n').replace(/\n/g, '<br>');
    const notes = document.querySelector("#notes")?.value || "";

    const screenshotSrc = [...document.querySelectorAll("img")].map(img => img.src).find(src => src?.startsWith("blob:"));
    const screenshotName = screenshotSrc ? `screenshot-${Date.now()}.webp` : '';
    let imageTag = "";
    if (screenshotSrc) {
      const blob = await fetch(screenshotSrc).then(r => r.blob());
      const b64 = await blobToBase64(blob);
      await uploadMedia(screenshotName, b64);
      imageTag = `<img src=\"${screenshotName}\">`;
    }

    const audioSrc = [...document.querySelectorAll("button")].map(btn => btn.dataset?.src || btn.getAttribute("data-src")).find(src => src?.startsWith("blob:")) || "";
    const audioName = audioSrc ? `sentence-audio-${Date.now()}.mp3` : '';
    let sentenceAudioTag = "";
    if (audioSrc && audioSrc.startsWith("blob:")) {
      const blob = await fetch(audioSrc).then(r => r.blob());
      const b64 = await blobToBase64(blob);
      await uploadMedia(audioName, b64);
      sentenceAudioTag = `[sound:${audioName}]`;
    }

    const fields = {
      "Target Word": clean(word),
      "Sentence": clean(sentence),
      "Sentence Translation": clean(translation),
      "Definitions": clean(definition),
      "Sentence Audio": sentenceAudioTag,
      "Word Audio": "",
      "Images": imageTag,
      "Example Sentences": "",
      "Notes": clean(notes),
      "Is Vocabulary Card": "1",
    };

    const nonEmpty = Object.values(fields).some(val => val.trim && val.trim() !== "");
    if (!nonEmpty) {
      if (!auto) alert("❌ Cannot export: all fields are empty!");
      return false;
    }

    const payload = {
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: "Migaku",
          modelName: "Migaku Korean CUSTOM",
          fields,
          tags: ["migaku"],
          options: { allowDuplicate: true }
        }
      }
    };

    const json = await postToAnki(payload);

    if (json.error) {
      if (!auto) alert("❌ Anki Error: " + json.error);
      console.error(json.error);
      return false;
    } else {
      if (!auto) alert("✅ Card sent to Anki!");
      console.log("✅ Card sent:", fields);
      return true;
    }
  }

  async function autoExportAllCards() {
    let lastCardId = null;
    let count = 0;

    while (true) {
      const urlId = location.pathname.split("/")[2];
      if (urlId === lastCardId) break;
      lastCardId = urlId;

      const success = await exportToAnki(true);
      if (!success) break;

      count++;
      console.log(`➡️ Moving to next card (${count})...`);

      const nextBtn = document.querySelector(".CardBrowsingArrow__right");
      if (!nextBtn || nextBtn.classList.contains("-cant-interact") || nextBtn.disabled) break;

      nextBtn.click();
      await delay(1200);
    }

    alert(`✅ Done! ${count} cards exported.`);
  }

  const loadButtons = () => {
    const layout = document.querySelector(".UiPageLayout");
    if (!layout || document.getElementById("anki-export-btn")) return;

    const btn1 = document.createElement("button");
    btn1.id = "anki-export-btn";
    btn1.innerText = "📤 Send to Anki";
    btn1.style = "position:fixed;top:10px;right:10px;z-index:9999;padding:10px 15px;background:#00c7a4;color:#fff;border:none;border-radius:6px;cursor:pointer;";
    btn1.onclick = () => exportToAnki();

    const btn2 = document.createElement("button");
    btn2.innerText = "📤 Auto Export Deck";
    btn2.style = "position:fixed;top:50px;right:10px;z-index:9999;padding:10px 15px;background:#008cba;color:#fff;border:none;border-radius:6px;cursor:pointer;";
    btn2.onclick = autoExportAllCards;

    document.body.appendChild(btn1);
    document.body.appendChild(btn2);
  }

  // SPA aware
  let currentPath = "";
  setInterval(() => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      if (currentPath.startsWith("/card/")) {
        waitForElement(".CardWord p").then(loadButtons);
      } else {
        const btn1 = document.getElementById("anki-export-btn");
        if (btn1) btn1.remove();
        const btn2 = [...document.querySelectorAll("button")].find(b => b.innerText.includes("Auto Export Deck"));
        if (btn2) btn2.remove();
      }
    }
  }, 500);
})();