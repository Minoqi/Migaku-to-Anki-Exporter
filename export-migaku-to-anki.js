// ==UserScript==
// @name         Migaku Card → Anki Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button to send current Migaku card to Anki via AnkiConnect
// @match        https://study.migaku.com/collection/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==



(function () {
    const delay = ms => new Promise(res => setTimeout(res, ms));
  
    const loadButton = () => {
      const layout = document.querySelector(".UiPageLayout");
      if (!layout || document.getElementById("anki-export-btn")) return;
  
      const btn = document.createElement("button");
      btn.id = "anki-export-btn";
      btn.innerText = "📤 Send to Anki";
      btn.style = "position:fixed;top:10px;right:10px;z-index:9999;padding:10px 15px;background:#00c7a4;color:#fff;border:none;border-radius:6px;cursor:pointer;";
      btn.onclick = exportToAnki;
      document.body.appendChild(btn);
    };
  
      function postToAnki(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:8765",
        data: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        onload: res => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            reject("Invalid JSON from AnkiConnect");
          }
        },
        onerror: e => reject(e)
      });
    });
  }
  
  
      function waitForElement(selector, timeout = 3000) {
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
  
  
    async function exportToAnki() {
       await waitForElement(".CardWord p");
  
      const clean = v => typeof v === "string" ? v : v ? String(v) : "";
  
      // 🧠 Step 1: Extract text fields
      const word = document.querySelector('.CardWord p')?.innerText || '';
  const sentence = document.querySelector('.CardSentence p')?.innerText || '';
  const translation = document.querySelector('.CardTranslationSentence p')?.innerText || '';
  let definitionRaw = document.querySelector('.CardDefinitions p')?.innerText || '';
  
  // Replace double line breaks with single, then turn \n into <br>
  const definition = definitionRaw.replace(/\n{2,}/g, '\n').replace(/\n/g, '<br>');
        // collapse multiple line breaks and convert final ones to <br>
        const notes = document.querySelector("#notes")?.value || "";
  
  
  
  
      // 🖼 Step 2: Extract screenshot (if available)
      const screenshotImg = document.querySelector('.WordCard-screenshot img');
      // Use fallback scanner to grab first <img> blob URL
  const screenshotSrc = [...document.querySelectorAll("img")]
    .map(img => img.src)
    .find(src => src?.startsWith("blob:"));
  
      const screenshotName = screenshotSrc ? `screenshot-${Date.now()}.webp` : '';
  
        console.log("🖼 screenshotSrc:", screenshotSrc);
  
  let imageTag = "";
  if (screenshotSrc) {
    const blob = await fetch(screenshotSrc).then(r => r.blob());
    const b64 = await blobToBase64(blob);
    await uploadMedia(screenshotName, b64);
    imageTag = `<img src="${screenshotName}">`;
  }
  
  
  
      // 🔉 Step 3: Extract sentence audio (if available)
      const audioBtn = document.querySelector('.CardAudio_extra button[data-src]');
  const audioSrc = [...document.querySelectorAll("button")]
    .map(btn => btn.dataset?.src || btn.getAttribute("data-src"))
    .find(src => src?.startsWith("blob:")) || "";
  
      const audioName = audioSrc ? `sentence-audio-${Date.now()}.mp3` : '';
  
              console.log("🔊 audioSrc:", audioSrc);
  
      let sentenceAudioTag = "";
  if (audioSrc && audioSrc.startsWith("blob:")) {
      console.log("🎧 Fetching audio blob from:", audioSrc);
    const blob = await fetch(audioSrc).then(r => r.blob());
      console.log("🎧 Got blob:", blob);
    const b64 = await blobToBase64(blob);
    await uploadMedia(audioName, b64);
    sentenceAudioTag = `[sound:${audioName}]`;
  }
  
  
      // 🧾 Step 4: Send to Anki
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
  
        console.log("📋 Sending fields to Anki:", fields);
  
  const nonEmpty = Object.values(fields).some(val => val.trim && val.trim() !== "");
  if (!nonEmpty) {
    alert("❌ Cannot export: all fields are empty!");
    return;
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
        alert("❌ Anki Error: " + json.error);
        console.error(json.error);
      } else {
        alert("✅ Card sent to Anki!");
        console.log("✅ Card sent:", fields);
      }
    }
  
    function uploadMedia(filename, base64) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:8765",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          action: "storeMediaFile",
          version: 6,
          params: {
            filename,
            data: base64
          }
        }),
        onload: (res) => {
          try {
            const json = JSON.parse(res.responseText);
            if (json.error) {
              console.error("❌ Anki media upload error:", json.error);
              reject(json.error);
            } else {
              console.log(`✅ Uploaded media: ${filename}`);
              resolve();
            }
          } catch (err) {
            reject("Invalid JSON from Anki");
          }
        },
        onerror: (e) => {
          reject(e);
        }
      });
    });
  }
  
  
    async function blobToBase64(blob) {
      return new Promise(res => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    }
  
   // 🚀 Smart route + DOM watcher
  let currentPath = "";
  setInterval(() => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      if (currentPath.startsWith("/card/")) {
        console.log("📄 Card page detected. Injecting button...");
        loadButton();
      }
    }
  }, 500);
  
  })();
  