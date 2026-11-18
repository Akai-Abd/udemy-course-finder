const DEFAULT_API = "http://localhost:4000";

let courses = [];
let untouchedCourses = [];
let isEnrolling = false;

document.addEventListener("DOMContentLoaded", async () => {
  const statTotal = document.getElementById("stat-total");
  const statNew = document.getElementById("stat-new");
  const statusText = document.getElementById("status-text");
  const btnBatch = document.getElementById("btn-batch-enroll");
  const btnOpen = document.getElementById("btn-open-tabs");
  const btnRefresh = document.getElementById("btn-refresh");
  const apiUrlInput = document.getElementById("api-url");
  const progressBar = document.getElementById("progress-bar");
  const progressFill = document.getElementById("progress-fill");

  // Load saved API URL
  const stored = await chrome.storage.local.get(["apiUrl", "openedCourseIds"]);
  if (stored.apiUrl) apiUrlInput.value = stored.apiUrl;
  const openedIds = new Set(stored.openedCourseIds || []);

  apiUrlInput.addEventListener("change", () => {
    chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim() });
    loadCourses();
  });

  async function loadCourses() {
    statusText.textContent = "Fetching active coupons...";
    const apiBase = apiUrlInput.value.trim() || DEFAULT_API;

    try {
      // 1. Fetch courses discovered today (active coupons)
      const res = await fetch(`${apiBase}/courses?limit=100&timeRange=today&expiryStatus=active`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      courses = data.data || [];

      // 2. Fetch history if possible, or use local set
      try {
        const histRes = await fetch(`${apiBase}/history?limit=500`);
        if (histRes.ok) {
          const histData = await histRes.json();
          (histData.data || []).forEach(h => openedIds.add(h.courseId));
          chrome.storage.local.set({ openedCourseIds: Array.from(openedIds) });
        }
      } catch (_) {}

      untouchedCourses = courses.filter(c => !openedIds.has(c.id));

      statTotal.textContent = courses.length;
      statNew.textContent = untouchedCourses.length;
      statusText.textContent = `Found ${courses.length} courses (${untouchedCourses.length} new)`;
    } catch (err) {
      statusText.textContent = `Server offline (${err.message})`;
    }
  }

  // 1-Click Open all tabs
  btnOpen.addEventListener("click", () => {
    if (!untouchedCourses.length) {
      statusText.textContent = "No new courses to open!";
      return;
    }
    const toOpen = untouchedCourses.slice(0, 15); // Open max 15 tabs to avoid browser freeze
    toOpen.forEach(c => {
      chrome.tabs.create({ url: c.couponUrl || c.udemyUrl, active: false });
      openedIds.add(c.id);
    });
    chrome.storage.local.set({ openedCourseIds: Array.from(openedIds) });
    statNew.textContent = Math.max(0, untouchedCourses.length - toOpen.length);
    statusText.textContent = `Opened ${toOpen.length} Udemy tabs in background!`;
  });

  // 1-Click Auto-Enroll Loop
  btnBatch.addEventListener("click", async () => {
    if (isEnrolling) return;
    if (!untouchedCourses.length) {
      statusText.textContent = "No new courses to enroll in!";
      return;
    }

    isEnrolling = true;
    btnBatch.disabled = true;
    progressBar.style.display = "block";

    const queue = [...untouchedCourses];
    const total = queue.length;
    let completed = 0;

    for (const course of queue) {
      statusText.textContent = `Enrolling (${completed + 1}/${total}): ${course.title.slice(0, 24)}...`;
      const url = course.couponUrl || course.udemyUrl;

      try {
        // Open background tab
        const tab = await chrome.tabs.create({ url, active: false });
        
        // Wait for page to load & attempt 1-click enroll via script injection
        await new Promise(r => setTimeout(r, 4500));
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Target Udemy "Enroll now" button
              const buttons = Array.from(document.querySelectorAll("button"));
              const enrollBtn = buttons.find(b => {
                const text = b.innerText.toLowerCase();
                return text.includes("enroll now") || text.includes("inscríbete") || text.includes("s'inscrire");
              });
              if (enrollBtn) {
                enrollBtn.click();
                return true;
              }
              return false;
            }
          });
        } catch (_) {}

        // Small wait and close tab
        await new Promise(r => setTimeout(r, 2000));
        await chrome.tabs.remove(tab.id);

        openedIds.add(course.id);
      } catch (e) {
        console.error(e);
      }

      completed++;
      progressFill.style.width = `${Math.round((completed / total) * 100)}%`;
      statNew.textContent = total - completed;
    }

    chrome.storage.local.set({ openedCourseIds: Array.from(openedIds) });
    statusText.textContent = `🎉 Finished auto-enrolling ${completed} courses!`;
    progressBar.style.display = "none";
    btnBatch.disabled = false;
    isEnrolling = false;
  });

  btnRefresh.addEventListener("click", loadCourses);

  // Initial load
  loadCourses();
});
