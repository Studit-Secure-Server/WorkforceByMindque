(async () => {
const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
const { getAuth, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js");
const {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  onSnapshot,
  Timestamp
} = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js");
const firebaseConfig = {
  apiKey: "AIzaSyCNeTvM8AR-hWitTD_MTK1AUHGTHUPWlcQ",
  authDomain: "studit-attendance.firebaseapp.com",
  projectId: "studit-attendance",
  storageBucket: "studit-attendance.firebasestorage.app",
  messagingSenderId: "891531257178",
  appId: "1:891531257178:web:92679d4e304c514800bf63",
  measurementId: "G-77M6T37TXJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const brandLogoLight = "assets/mindque-logo-light.png";
const brandLogoDark = "assets/mindque-logo-dark.png";
const today = new Date().toISOString().split("T")[0];
const defaultOfficeLocations = [{
  id: "main-office",
  name: "Main Office",
  lat: 20.3255339,
  lng: 85.8158527,
  radius: 100,
  active: true
}];
const attendanceSelfieWidth = 320;
const attendanceSelfieHeight = 240;
const attendanceSelfieQuality = 0.45;
const defaultGraceMinutes = 30;
const notificationSoundSrc = "assets/notification-sound.mp3";

const statusEl = document.getElementById("status");
const greetingTitle = document.getElementById("greetingTitle");
const themeToggle = document.getElementById("themeToggle");
const timerEl = document.getElementById("timer");
const totalHoursEl = document.getElementById("totalHours");
const scheduleNotice = document.getElementById("scheduleNotice");
const punchInBtn = document.getElementById("punchInBtn");
const punchOutBtn = document.getElementById("punchOutBtn");
const breakStartBtn = document.getElementById("breakStartBtn");
const breakEndBtn = document.getElementById("breakEndBtn");
const modal = document.getElementById("punchModal");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const confirmPunchBtn = document.getElementById("confirmPunchBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const selfiePreview = document.getElementById("selfiePreview");
const selfieBtn = document.getElementById("selfieBtn");
const locationText = document.getElementById("locationText");
const distanceText = document.getElementById("distanceText");
const radiusStatus = document.getElementById("radiusStatus");
const mapFrame = document.getElementById("mapFrame");
const confirmHelp = document.getElementById("confirmHelp");
const smartInsightsList = document.getElementById("smartInsightsList");
const holidayList = document.getElementById("holidayList");
const notificationArea = document.getElementById("notificationArea");
const notificationButton = document.getElementById("notificationButton");
const notificationBadge = document.getElementById("notificationBadge");
const notificationPopup = document.getElementById("notificationPopup");
const notificationUnreadText = document.getElementById("notificationUnreadText");
const notificationList = document.getElementById("notificationList");
const notificationToggle = document.getElementById("notificationToggle");
const employeeTaskList = document.getElementById("employeeTaskList");
const leaveBalance = document.getElementById("leaveBalance");
const leaveUsed = document.getElementById("leaveUsed");
const leavePending = document.getElementById("leavePending");
const leaveList = document.getElementById("leaveList");
const attendanceHistoryList = document.getElementById("attendanceHistoryList");
const historyRange7 = document.getElementById("historyRange7");
const historyRange30 = document.getElementById("historyRange30");
const attendanceHistoryModal = document.getElementById("attendanceHistoryModal");
const historyDetailTitle = document.getElementById("historyDetailTitle");
const historyDetailSubtitle = document.getElementById("historyDetailSubtitle");
const historyDetailStatus = document.getElementById("historyDetailStatus");
const historyDetailGrid = document.getElementById("historyDetailGrid");
const historyDetailPhotos = document.getElementById("historyDetailPhotos");
const salarySlipMonth = document.getElementById("salarySlipMonth");
const salarySlipSummary = document.getElementById("salarySlipSummary");
const topProfilePhoto = document.getElementById("topProfilePhoto");
const profileModal = document.getElementById("profileModal");
const profilePreviewPhoto = document.getElementById("profilePreviewPhoto");
const profilePreviewName = document.getElementById("profilePreviewName");
const profilePreviewRole = document.getElementById("profilePreviewRole");
const profileEditPhoto = document.getElementById("profileEditPhoto");
const profileEditName = document.getElementById("profileEditName");
const profileEditPhone = document.getElementById("profileEditPhone");
const profileEditEmail = document.getElementById("profileEditEmail");
const profileEditRole = document.getElementById("profileEditRole");
const profileEditAddress = document.getElementById("profileEditAddress");
const profileEditEmergency = document.getElementById("profileEditEmergency");
const profileEditBlood = document.getElementById("profileEditBlood");
const profileEditBank = document.getElementById("profileEditBank");
const profileEditIfsc = document.getElementById("profileEditIfsc");
const saveProfileBtn = document.getElementById("saveProfileBtn");

let timerInterval = null;
let timerBaseMs = 0;
let timerBaseStartedAt = 0;
let stream = null;
let currentAction = "in";
let currentLocation = null;
let currentDistance = null;
let currentOfficeMatch = null;
let capturedSelfieBlob = null;
let capturedSelfieAt = null;
let latestAttendanceDoc = null;
let latestAttendanceData = null;
let employeeNotifications = [];
let showAllNotifications = false;
let seenNotificationIds = new Set();
let notificationStorageKey = "";
let notificationShakeInterval = null;
let notificationUnsubscribe = null;
let knownNotificationIds = new Set();
let notificationListenerReady = false;
let taskUnsubscribe = null;
let knownTaskIds = new Set();
let taskListenerReady = false;
let employeeAudioContext = null;
let employeeAlertAudio = null;
let employeeAlertSoundUnlocked = false;
let lastAlertSoundAt = 0;
let currentEmployeeProfile = null;
let attendanceHistoryRange = 7;
let attendanceHistoryItems = {};
let currentSalarySlip = null;
let officeLocations = [...defaultOfficeLocations];
let selfiePreviewUrl = null;
let scheduleInterval = null;
let autoLogoutInProgress = false;

function getThemeLogoPath() {
  return document.documentElement.classList.contains("theme-dark")
    ? brandLogoDark
    : brandLogoLight;
}

function setProfileImage(element, photo, fallbackAlt = "Profile photo") {
  if (!element) {
    return;
  }

  const hasPhoto = Boolean(photo);
  element.src = hasPhoto ? photo : getThemeLogoPath();
  element.alt = fallbackAlt;
  element.classList.toggle("default-logo-photo", !hasPhoto);
}

function refreshDefaultProfilePhotos() {
  const photo = currentEmployeeProfile?.photo || "";
  const employeeName = currentEmployeeProfile?.name || "Employee";
  setProfileImage(topProfilePhoto, photo, `${employeeName} profile photo`);
  setProfileImage(profilePreviewPhoto, photo, "Profile preview");
}

function updateThemeToggle() {
  if (!themeToggle) {
    return;
  }

  const isDark = document.documentElement.classList.contains("theme-dark");
  themeToggle.innerHTML = `
    <span class="theme-icon">${isDark ? "D" : "N"}</span>
    <span>${isDark ? "Day Mode" : "Night Mode"}</span>
  `;
  themeToggle.setAttribute("aria-label", isDark ? "Switch to day mode" : "Switch to night mode");
  themeToggle.setAttribute("title", isDark ? "Switch to day mode" : "Switch to night mode");
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("theme-dark", isDark);

  try {
    localStorage.setItem("workforceTheme", isDark ? "dark" : "light");
  } catch (error) {
    console.warn("Theme preference could not be saved:", error.message);
  }

  updateThemeToggle();
  refreshDefaultProfilePhotos();
}

window.toggleTheme = function () {
  const isDark = document.documentElement.classList.contains("theme-dark");
  setTheme(isDark ? "light" : "dark");
};

updateThemeToggle();
refreshDefaultProfilePhotos();

window.logout = async function () {
  stopScheduleWatcher();
  stopNotificationShake();
  if (notificationUnsubscribe) {
    notificationUnsubscribe();
    notificationUnsubscribe = null;
  }
  if (taskUnsubscribe) {
    taskUnsubscribe();
    taskUnsubscribe = null;
  }
  stopCamera();
  await signOut(auth);
  window.location.href = "index.html";
};

function formatDuration(ms) {
  const safeMs = Math.max(ms, 0);
  const hrs = Math.floor(safeMs / 3600000);
  const mins = Math.floor((safeMs % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

function formatTimer(ms) {
  const safeMs = Math.max(ms, 0);
  const hours = String(Math.floor(safeMs / 3600000)).padStart(2, "0");
  const mins = String(Math.floor((safeMs % 3600000) / 60000)).padStart(2, "0");
  const secs = String(Math.floor((safeMs % 60000) / 1000)).padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDisplayDate(dateText) {
  return new Date(dateText + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function countLeaveDays(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  let days = 0;
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (current <= end) {
    if (current.getDay() !== 0) {
      days++;
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Math.max(Number(amount) || 0, 0));
}

function formatPdfCurrency(amount) {
  return `INR ${Math.round(Math.max(Number(amount) || 0, 0)).toLocaleString("en-IN")}`;
}

function formatPayslipAmount(amount) {
  return `Rs. ${Math.max(Number(amount) || 0, 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPayslipMonth(monthValue) {
  return new Date(`${monthValue}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function formatPayslipDate(date = new Date()) {
  return date.toLocaleDateString("en-GB");
}

function numberToWordsIndian(amount) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function belowHundred(value) {
    if (value < 20) return ones[value];
    return `${tens[Math.floor(value / 10)]} ${ones[value % 10]}`.trim();
  }

  function belowThousand(value) {
    const hundred = Math.floor(value / 100);
    const rest = value % 100;
    return `${hundred ? `${ones[hundred]} Hundred` : ""} ${rest ? belowHundred(rest) : ""}`.trim();
  }

  const rounded = Math.round(Math.max(Number(amount) || 0, 0));
  if (!rounded) return "Indian Rupee Zero Only";

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const rest = rounded % 1000;
  const parts = [];

  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));

  return `Indian Rupee ${parts.join(" ")} Only`;
}

function getLeaveAllowance(profile) {
  const allowance = Number(profile?.leaveAllowance ?? profile?.leaveBalance);
  return Number.isFinite(allowance) && allowance >= 0 ? allowance : 12;
}

function isUnpaidLeave(leave) {
  return String(leave?.leaveType || "").toLowerCase().includes("unpaid");
}

function formatScheduleTime(timeText) {
  if (!timeText) return "--";

  return new Date(`${today}T${timeText}:00`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getAssignedScheduleEnd(profile) {
  if (!profile?.workEnd) {
    return null;
  }

  const endDate = new Date(`${today}T${profile.workEnd}:00`);

  if (profile.workStart) {
    const startDate = new Date(`${today}T${profile.workStart}:00`);

    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
  }

  return endDate;
}

function getGraceMinutes(profile) {
  const graceMinutes = Number(profile?.graceMinutes);
  return Number.isFinite(graceMinutes) && graceMinutes > 0
    ? graceMinutes
    : defaultGraceMinutes;
}

function setScheduleNotice(message, state = "normal") {
  scheduleNotice.innerText = message;
  scheduleNotice.classList.remove("warning", "danger");

  if (state !== "normal") {
    scheduleNotice.classList.add(state);
  }
}

function updateScheduleNotice(profile, attendanceData = latestAttendanceData) {
  if (!profile?.workStart || !profile?.workEnd) {
    setScheduleNotice("Working hours: Not assigned");
    return;
  }

  const startText = formatScheduleTime(profile.workStart);
  const endText = formatScheduleTime(profile.workEnd);
  const scheduleEnd = getAssignedScheduleEnd(profile);

  if (!attendanceData || attendanceData.status === "completed" || attendanceData.status === "missed-punch-out") {
    setScheduleNotice(`Working hours: ${startText} to ${endText}`);
    return;
  }

  const now = new Date();
  const graceMinutes = getGraceMinutes(profile);
  const graceEnd = new Date(scheduleEnd.getTime() + graceMinutes * 60000);

  if (now < scheduleEnd) {
    setScheduleNotice(`Working hours: ${startText} to ${endText}`);
    return;
  }

  if (now < graceEnd) {
    const minutesLeft = Math.max(Math.ceil((graceEnd - now) / 60000), 1);
    setScheduleNotice(`Please punch out before auto logout. ${minutesLeft} min left.`, "warning");
    return;
  }

  setScheduleNotice("Grace period ended. Auto logout is processing.", "danger");
}

async function getLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeOfficeLocation(data, id) {
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  const radius = Number(data.radius || data.allowedRadius || 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id,
    name: data.name || "Office",
    lat,
    lng,
    radius: Number.isFinite(radius) && radius > 0 ? radius : 100,
    active: data.active !== false
  };
}

function getEmployeeAssignedOfficeLocation(profile) {
  const lat = Number(profile?.workLocationLat);
  const lng = Number(profile?.workLocationLng);
  const radius = Number(profile?.workLocationRadius || 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id: `employee-${profile.uid || "work-location"}`,
    name: profile.workLocationName || "Assigned Work Location",
    lat,
    lng,
    radius: Number.isFinite(radius) && radius > 0 ? radius : 100,
    active: true
  };
}

async function loadOfficeLocations() {
  try {
    const officeSnap = await getDocs(collection(db, "officeLocations"));
    const offices = [];

    officeSnap.forEach((docSnap) => {
      const office = normalizeOfficeLocation(docSnap.data(), docSnap.id);

      if (office?.active) {
        offices.push(office);
      }
    });

    officeLocations = offices.length ? offices : [...defaultOfficeLocations];
  } catch (error) {
    console.warn("Office locations fallback used:", error.message);
    officeLocations = [...defaultOfficeLocations];
  }
}

async function loadAllowedWorkLocations() {
  const employeeOffice = getEmployeeAssignedOfficeLocation(currentEmployeeProfile);

  if (employeeOffice) {
    officeLocations = [employeeOffice];
    return;
  }

  await loadOfficeLocations();
}

function getNearestOffice(location) {
  if (!officeLocations.length) {
    officeLocations = [...defaultOfficeLocations];
  }

  return officeLocations
    .map((office) => ({
      ...office,
      distance: getDistance(location.lat, location.lng, office.lat, office.lng)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function getOfficeLocationPayload(match) {
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    name: match.name,
    lat: match.lat,
    lng: match.lng,
    radius: match.radius,
    distance: Math.round(match.distance)
  };
}

function setButtonsForStatus(status) {
  if (status === "working") {
    punchInBtn.disabled = true;
    punchOutBtn.disabled = false;
    breakStartBtn.disabled = false;
    breakEndBtn.disabled = true;
    return;
  }

  if (status === "break") {
    punchInBtn.disabled = true;
    punchOutBtn.disabled = false;
    breakStartBtn.disabled = true;
    breakEndBtn.disabled = false;
    return;
  }

  if (status === "completed" || status === "missed-punch-out") {
    punchInBtn.disabled = true;
    punchOutBtn.disabled = true;
    breakStartBtn.disabled = true;
    breakEndBtn.disabled = true;
    return;
  }

  punchInBtn.disabled = false;
  punchOutBtn.disabled = true;
  breakStartBtn.disabled = true;
  breakEndBtn.disabled = true;
}

function renderWorkTimer(ms) {
  timerEl.innerText = formatTimer(ms);
}

function startTimerFromMs(baseMs) {
  clearInterval(timerInterval);
  timerBaseMs = Math.max(baseMs, 0);
  timerBaseStartedAt = Date.now();
  renderWorkTimer(timerBaseMs);

  timerInterval = setInterval(() => {
    renderWorkTimer(timerBaseMs + (Date.now() - timerBaseStartedAt));
  }, 1000);
}

function stopTimer(displayText = null) {
  clearInterval(timerInterval);
  timerInterval = null;
  if (displayText) {
    timerEl.innerText = displayText;
  }
}

async function getTodayAttendance(user) {
  const attendanceQuery = query(
    collection(db, "attendance"),
    where("userId", "==", user.uid),
    where("date", "==", today)
  );

  const attendanceSnap = await getDocs(attendanceQuery);

  if (attendanceSnap.empty) {
    return null;
  }

  const docSnap = attendanceSnap.docs[0];
  return {
    id: docSnap.id,
    ref: doc(db, "attendance", docSnap.id),
    data: docSnap.data()
  };
}

async function getBreakTiming(user, fallbackEndTime = null) {
  const breakQuery = query(
    collection(db, "breaks"),
    where("userId", "==", user.uid),
    where("date", "==", today)
  );

  const breakSnap = await getDocs(breakQuery);
  let totalBreakMs = 0;
  let completedBreakMs = 0;
  let openBreakStart = null;

  breakSnap.forEach((breakDoc) => {
    const breakData = breakDoc.data();
    if (breakData.breakStart) {
      const startTime = breakData.breakStart.toDate();

      if (breakData.breakEnd) {
        const duration = breakData.breakEnd.toDate() - startTime;
        totalBreakMs += duration;
        completedBreakMs += duration;
        return;
      }

      if (!openBreakStart || startTime < openBreakStart) {
        openBreakStart = startTime;
      }

      if (fallbackEndTime) {
        totalBreakMs += fallbackEndTime - startTime;
      }
    }
  });

  return {
    totalBreakMs,
    completedBreakMs,
    openBreakStart
  };
}

async function getTotalBreakMs(user, fallbackEndTime = null) {
  const timing = await getBreakTiming(user, fallbackEndTime);
  return timing.totalBreakMs;
}

function getActiveWorkMs(punchInTime, breakTiming, endTime = new Date()) {
  return Math.max(endTime - punchInTime - breakTiming.completedBreakMs, 0);
}

async function startTimer(startTime, user = auth.currentUser) {
  if (!user) {
    startTimerFromMs(new Date() - startTime);
    return;
  }

  const breakTiming = await getBreakTiming(user);
  const activeWorkMs = getActiveWorkMs(startTime, breakTiming);
  startTimerFromMs(activeWorkMs);
}

async function pauseTimerForBreak(startTime, user = auth.currentUser) {
  if (!user) {
    stopTimer(formatTimer(new Date() - startTime));
    return;
  }

  const breakTiming = await getBreakTiming(user);
  const pauseTime = breakTiming.openBreakStart || new Date();
  const activeWorkMs = getActiveWorkMs(startTime, breakTiming, pauseTime);
  stopTimer(formatTimer(activeWorkMs));
}

async function closeOpenBreaks(user) {
  const breakQuery = query(
    collection(db, "breaks"),
    where("userId", "==", user.uid),
    where("date", "==", today)
  );

  const snapshot = await getDocs(breakQuery);
  const updates = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (!data.breakEnd) {
      updates.push(updateDoc(doc(db, "breaks", docSnap.id), {
        breakEnd: Timestamp.now()
      }));
    }
  });

  await Promise.all(updates);
}

async function refreshStatus(user) {
  const attendance = await getTodayAttendance(user);
  latestAttendanceDoc = attendance;
  latestAttendanceData = attendance ? attendance.data : null;

  if (!attendance) {
    statusEl.innerText = "Not Checked In";
    timerEl.innerText = "00:00:00";
    totalHoursEl.innerText = "Total Hours: --";
    totalHoursEl.style.color = "#374151";
    setButtonsForStatus("none");
    stopTimer();
    updateScheduleNotice(currentEmployeeProfile, null);
    return;
  }

  const data = attendance.data;
  updateScheduleNotice(currentEmployeeProfile, data);

  if (data.status === "working") {
    statusEl.innerText = "Working";
    totalHoursEl.innerText = "Total Hours: --";
    totalHoursEl.style.color = "#374151";
    setButtonsForStatus("working");
    await startTimer(data.punchIn.toDate(), user);
    return;
  }

  if (data.status === "break") {
    statusEl.innerText = "On Break";
    setButtonsForStatus("break");
    await pauseTimerForBreak(data.punchIn.toDate(), user);
    return;
  }

  if (data.status === "completed") {
    statusEl.innerText = "Completed";
    totalHoursEl.innerText = "Total Hours: " + (data.totalHours || "0h 0m");
    totalHoursEl.style.color = "green";
    setButtonsForStatus("completed");
    stopTimer("Finished");
  }

  if (data.status === "missed-punch-out") {
    statusEl.innerText = "Missed Punch Out";
    totalHoursEl.innerText = "Total Hours: " + (data.totalHours || "0h 0m");
    totalHoursEl.style.color = "#b91c1c";
    setButtonsForStatus("missed-punch-out");
    stopTimer("Auto Logged Out");
  }
}

async function markMissedPunchOutAndLogout(user, attendance, profile) {
  if (autoLogoutInProgress) {
    return;
  }

  autoLogoutInProgress = true;
  const autoLogoutTime = new Date();

  try {
    await closeOpenBreaks(user);

    const totalMs = autoLogoutTime - attendance.data.punchIn.toDate();
    const totalBreakMs = await getTotalBreakMs(user, autoLogoutTime);
    const workingMs = totalMs - totalBreakMs;
    const hours = formatDuration(workingMs);

    await updateDoc(attendance.ref, {
      punchOut: Timestamp.fromDate(autoLogoutTime),
      autoLogoutAt: Timestamp.fromDate(autoLogoutTime),
      assignedWorkStart: profile?.workStart || "",
      assignedWorkEnd: profile?.workEnd || "",
      missedPunchOut: true,
      punchOutType: "auto",
      status: "missed-punch-out",
      totalHours: hours
    });

    statusEl.innerText = "Missed Punch Out";
    totalHoursEl.innerText = "Total Hours: " + hours;
    totalHoursEl.style.color = "#b91c1c";
    setButtonsForStatus("missed-punch-out");
    stopTimer("Auto Logged Out");
    setScheduleNotice("You missed punch out. Attendance was auto closed.", "danger");

    alert("You missed punch out. Attendance was auto closed and you will be logged out.");
  } catch (error) {
    console.error(error);
    alert("Auto logout failed: " + error.message);
  } finally {
    stopScheduleWatcher();
    stopCamera();
    await signOut(auth);
    window.location.href = "index.html";
  }
}

async function evaluateWorkingHours(user) {
  if (!user || autoLogoutInProgress) {
    return;
  }

  const profile = currentEmployeeProfile;
  const scheduleEnd = getAssignedScheduleEnd(profile);

  if (!profile?.workEnd || !scheduleEnd) {
    updateScheduleNotice(profile);
    return;
  }

  const attendance = await getTodayAttendance(user);
  latestAttendanceDoc = attendance;
  latestAttendanceData = attendance ? attendance.data : null;

  updateScheduleNotice(profile, latestAttendanceData);

  if (!attendance) {
    return;
  }

  const status = attendance.data.status;
  const isActive = status === "working" || status === "break";

  if (!isActive) {
    return;
  }

  const graceMinutes = getGraceMinutes(profile);
  const graceEnd = new Date(scheduleEnd.getTime() + graceMinutes * 60000);

  if (new Date() >= graceEnd) {
    await markMissedPunchOutAndLogout(user, attendance, profile);
  }
}

function startScheduleWatcher(user) {
  stopScheduleWatcher();
  autoLogoutInProgress = false;
  evaluateWorkingHours(user).catch((error) => console.error(error));
  scheduleInterval = setInterval(() => {
    evaluateWorkingHours(user).catch((error) => console.error(error));
  }, 30000);
}

function stopScheduleWatcher() {
  if (scheduleInterval) {
    clearInterval(scheduleInterval);
    scheduleInterval = null;
  }
}

async function linkUserToEmployee(user) {
  const employeeQuery = query(
    collection(db, "employees"),
    where("email", "==", user.email)
  );

  const snapshot = await getDocs(employeeQuery);

  snapshot.forEach(async (docSnap) => {
    await updateDoc(doc(db, "employees", docSnap.id), {
      userId: user.uid
    });
  });
}

function getGreetingText() {
  const hour = new Date().getHours();

  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

async function getEmployeeProfile(user) {
  const directSnap = await getDoc(doc(db, "employees", user.uid));

  if (directSnap.exists()) {
    return {
      uid: user.uid,
      ...directSnap.data()
    };
  }

  const employeeQuery = query(
    collection(db, "employees"),
    where("email", "==", user.email)
  );
  const snapshot = await getDocs(employeeQuery);

  if (!snapshot.empty) {
    return {
      uid: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  }

  return null;
}

async function loadEmployeeProfile(user) {
  const profile = await getEmployeeProfile(user);
  const fallbackName = user.email ? user.email.split("@")[0] : "Employee";
  const employeeName = profile?.name || fallbackName;

  currentEmployeeProfile = profile || {
    uid: user.uid,
    name: employeeName,
    email: user.email || "",
    role: "employee"
  };
  greetingTitle.innerText = `${getGreetingText()}, ${employeeName}`;
  setProfileImage(topProfilePhoto, profile?.photo || "", `${employeeName} profile photo`);
  updateScheduleNotice(currentEmployeeProfile);
}

async function imageFileToDataUrl(file) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const maxSize = 520;
    const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = Math.round(image.width * scale);
    previewCanvas.height = Math.round(image.height * scale);

    const ctx = previewCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);

    return previewCanvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function fillProfileModal(user) {
  const profile = currentEmployeeProfile || {};
  const fallbackName = user.email ? user.email.split("@")[0] : "Employee";
  const employeeName = profile.name || fallbackName;
  const role = profile.role || "employee";

  setProfileImage(profilePreviewPhoto, profile.photo || "", "Profile preview");
  profilePreviewName.innerText = employeeName;
  profilePreviewRole.innerText = role;
  profileEditPhoto.value = "";
  profileEditName.value = employeeName;
  profileEditPhone.value = profile.phone || "";
  profileEditEmail.value = profile.email || user.email || "";
  profileEditRole.value = role;
  profileEditAddress.value = profile.currentAddress || "";
  profileEditEmergency.value = profile.emergencyContact || "";
  profileEditBlood.value = profile.bloodGroup || "";
  profileEditBank.value = profile.bankAccount || "";
  profileEditIfsc.value = profile.ifscCode || "";
}

profileEditPhoto.addEventListener("change", async () => {
  const file = profileEditPhoto.files[0];

  if (!file) {
    setProfileImage(profilePreviewPhoto, currentEmployeeProfile?.photo || "", "Profile preview");
    return;
  }

  try {
    profilePreviewPhoto.src = await imageFileToDataUrl(file);
    profilePreviewPhoto.classList.remove("default-logo-photo");
  } catch (error) {
    console.error(error);
    alert("Profile photo preview failed");
    profileEditPhoto.value = "";
  }
});

profileEditName.addEventListener("input", () => {
  profilePreviewName.innerText = profileEditName.value.trim() || "Employee";
});

window.openProfileModal = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (!currentEmployeeProfile) {
    await loadEmployeeProfile(user);
  }

  fillProfileModal(user);
  profileModal.classList.add("open");
  profileModal.setAttribute("aria-hidden", "false");
};

window.closeProfileModal = function () {
  profileModal.classList.remove("open");
  profileModal.setAttribute("aria-hidden", "true");
  profileEditPhoto.value = "";
};

window.saveProfile = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const updatedProfile = {
    name: profileEditName.value.trim(),
    phone: profileEditPhone.value.trim(),
    email: profileEditEmail.value.trim(),
    role: currentEmployeeProfile?.role || profileEditRole.value || "employee",
    userId: user.uid,
    currentAddress: profileEditAddress.value.trim(),
    emergencyContact: profileEditEmergency.value.trim(),
    bloodGroup: profileEditBlood.value.trim(),
    bankAccount: profileEditBank.value.trim(),
    ifscCode: profileEditIfsc.value.trim()
  };

  if (!updatedProfile.name || !updatedProfile.email) {
    alert("Name and email are required");
    return;
  }

  saveProfileBtn.disabled = true;
  saveProfileBtn.innerText = "Saving...";

  try {
    const file = profileEditPhoto.files[0];

    if (file) {
      updatedProfile.photo = await imageFileToDataUrl(file);
    }

    await setDoc(doc(db, "employees", user.uid), updatedProfile, { merge: true });

    currentEmployeeProfile = {
      ...currentEmployeeProfile,
      uid: user.uid,
      ...updatedProfile
    };

    await loadEmployeeProfile(user);
    closeProfileModal();
    alert("Profile updated successfully");
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtn.innerText = "Save Profile";
  }
};

async function loadUpcomingHolidays() {
  const holidaySnap = await getDocs(collection(db, "holidays"));
  const holidays = [];

  holidaySnap.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.date >= today) {
      holidays.push(data);
    }
  });

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  holidayList.innerHTML = "";

  if (!holidays.length) {
    holidayList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">No upcoming holidays</div>
          <div class="holiday-date">New holidays will appear here.</div>
        </div>
      </div>
    `;
    return;
  }

  holidays.slice(0, 5).forEach((holiday) => {
    holidayList.innerHTML += `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">${holiday.name}</div>
          <div class="holiday-date">${formatDisplayDate(holiday.date)}</div>
        </div>
        <span class="holiday-badge">${holiday.type || "company"}</span>
      </div>
    `;
  });
}

function getNotificationTime(notification) {
  const value = notification.createdAt;

  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatNotificationDate(notification) {
  const time = getNotificationTime(notification);
  return time ? new Date(time).toLocaleString() : "";
}

function getNotificationId(notification) {
  return notification.id || [
    notification.title || "",
    notification.message || "",
    notification.targetUid || notification.targetEmail || notification.targetType || "all",
    getNotificationTime(notification)
  ].join("|");
}

function getEmployeeAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!employeeAudioContext) {
    employeeAudioContext = new AudioContextClass();
  }

  return employeeAudioContext;
}

function getEmployeeAlertAudio() {
  if (!employeeAlertAudio) {
    employeeAlertAudio = new Audio(notificationSoundSrc);
    employeeAlertAudio.preload = "auto";
    employeeAlertAudio.volume = 0.85;
  }

  return employeeAlertAudio;
}

function playFallbackAlertTone() {
  const audioContext = getEmployeeAudioContext();

  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const now = audioContext.currentTime;
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gainNode.connect(audioContext.destination);

  [740, 980].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + (index * 0.16));
    oscillator.connect(gainNode);
    oscillator.start(now + (index * 0.16));
    oscillator.stop(now + 0.22 + (index * 0.16));
  });

  window.setTimeout(() => gainNode.disconnect(), 600);
}

function unlockEmployeeAlertSound() {
  const audioContext = getEmployeeAudioContext();
  const audio = getEmployeeAlertAudio();

  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  if (employeeAlertSoundUnlocked) {
    return;
  }

  const previousVolume = audio.volume;
  audio.volume = 0;
  audio.currentTime = 0;

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = previousVolume;
      employeeAlertSoundUnlocked = true;
    })
    .catch(() => {
      audio.volume = previousVolume;
    });
}

function playEmployeeAlertSound() {
  const nowMs = Date.now();

  if (nowMs - lastAlertSoundAt < 1200) {
    return;
  }

  lastAlertSoundAt = nowMs;

  const audio = getEmployeeAlertAudio();
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0.85;

  audio.play().catch(() => {
    playFallbackAlertTone();
  });
}

document.addEventListener("pointerdown", unlockEmployeeAlertSound, { once: true });
document.addEventListener("keydown", unlockEmployeeAlertSound, { once: true });

function getAndroidFcmToken(timeoutMs = 5000) {
  if (!window.WorkforceAndroid) {
    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    let settled = false;
    const previousReceiver = window.receiveAndroidFcmToken;

    const finish = (token) => {
      if (settled) {
        return;
      }

      settled = true;
      window.receiveAndroidFcmToken = previousReceiver;
      resolve(token || "");
    };

    window.receiveAndroidFcmToken = (token) => {
      if (typeof previousReceiver === "function") {
        try {
          previousReceiver(token);
        } catch (error) {
          console.warn("Previous FCM receiver failed:", error.message);
        }
      }

      finish(token);
    };

    try {
      const existingToken = typeof window.WorkforceAndroid.getFcmToken === "function"
        ? window.WorkforceAndroid.getFcmToken()
        : "";

      if (existingToken) {
        finish(existingToken);
        return;
      }

      if (typeof window.WorkforceAndroid.requestFcmToken === "function") {
        window.WorkforceAndroid.requestFcmToken();
      }
    } catch (error) {
      console.warn("Android FCM token request failed:", error.message);
      finish("");
      return;
    }

    window.setTimeout(() => finish(""), timeoutMs);
  });
}

async function registerAndroidPushToken(user) {
  const token = await getAndroidFcmToken();

  if (!token) {
    return;
  }

  const employeeUid = currentEmployeeProfile?.uid || user.uid;

  await setDoc(doc(db, "employees", employeeUid), {
    fcmTokens: arrayUnion(token),
    fcmTokenUpdatedAt: Timestamp.now(),
    fcmTokenPlatform: "android"
  }, { merge: true });
}

function loadSeenNotifications(user) {
  notificationStorageKey = `workforceSeenNotifications_${user.uid}`;

  try {
    const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || "[]");
    seenNotificationIds = new Set(Array.isArray(saved) ? saved : []);
  } catch (error) {
    seenNotificationIds = new Set();
  }
}

function saveSeenNotifications() {
  if (!notificationStorageKey) {
    return;
  }

  try {
    localStorage.setItem(notificationStorageKey, JSON.stringify([...seenNotificationIds].slice(-250)));
  } catch (error) {
    console.warn("Notification seen state could not be saved:", error.message);
  }
}

function getUnreadNotifications() {
  return employeeNotifications.filter((notification) => !seenNotificationIds.has(getNotificationId(notification)));
}

function triggerNotificationShake() {
  if (!notificationButton || !notificationPopup || !getUnreadNotifications().length || !notificationPopup.hidden) {
    return;
  }

  notificationButton.classList.remove("shake-now");
  void notificationButton.offsetWidth;
  notificationButton.classList.add("shake-now");
  window.setTimeout(() => notificationButton.classList.remove("shake-now"), 820);
}

function stopNotificationShake() {
  if (notificationShakeInterval) {
    clearInterval(notificationShakeInterval);
    notificationShakeInterval = null;
  }

  notificationButton?.classList.remove("shake-now");
}

function startNotificationShake() {
  stopNotificationShake();

  if (!getUnreadNotifications().length) {
    return;
  }

  notificationShakeInterval = setInterval(triggerNotificationShake, 10000);
}

function updateNotificationIndicator() {
  const unreadCount = getUnreadNotifications().length;

  if (notificationButton) {
    notificationButton.classList.toggle("has-unread", unreadCount > 0);
    notificationButton.setAttribute(
      "aria-label",
      unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"
    );
  }

  if (notificationBadge) {
    notificationBadge.hidden = unreadCount === 0;
    notificationBadge.innerText = unreadCount > 99 ? "99+" : String(unreadCount);
  }

  if (notificationUnreadText) {
    notificationUnreadText.innerText = unreadCount
      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
      : "You're all caught up.";
  }

  startNotificationShake();
}

function markNotificationsSeen() {
  employeeNotifications.forEach((notification) => {
    seenNotificationIds.add(getNotificationId(notification));
  });
  saveSeenNotifications();
  renderNotifications();
  updateNotificationIndicator();
}

window.openNotificationPopup = function () {
  if (!notificationPopup) {
    return;
  }

  notificationPopup.hidden = false;
  notificationPopup.setAttribute("aria-hidden", "false");
  markNotificationsSeen();
};

window.closeNotificationPopup = function () {
  if (!notificationPopup) {
    return;
  }

  notificationPopup.hidden = true;
  notificationPopup.setAttribute("aria-hidden", "true");
};

window.toggleNotificationPopup = function () {
  if (!notificationPopup || notificationPopup.hidden) {
    window.openNotificationPopup();
  } else {
    window.closeNotificationPopup();
  }
};

async function loadEmployeeNotifications(user) {
  try {
    loadSeenNotifications(user);

    if (notificationUnsubscribe) {
      notificationUnsubscribe();
    }

    knownNotificationIds = new Set();
    notificationListenerReady = false;

    notificationUnsubscribe = onSnapshot(collection(db, "notifications"), (notificationSnap) => {
      employeeNotifications = [];
      showAllNotifications = false;

      notificationSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const targetType = data.targetType || "all";
        const isForAll = targetType === "all";
        const isForUid = data.targetUid && data.targetUid === user.uid;
        const isForEmail = data.targetEmail && data.targetEmail === user.email;

        if (isForAll || isForUid || isForEmail) {
          employeeNotifications.push({ id: docSnap.id, ...data });
        }
      });

      employeeNotifications.sort((a, b) => getNotificationTime(b) - getNotificationTime(a));
      const currentNotificationIds = new Set(employeeNotifications.map(getNotificationId));
      const hasNewUnreadNotification = employeeNotifications.some((notification) => {
        const notificationId = getNotificationId(notification);
        return !knownNotificationIds.has(notificationId) && !seenNotificationIds.has(notificationId);
      });

      if (notificationListenerReady && hasNewUnreadNotification) {
        playEmployeeAlertSound();
      }

      knownNotificationIds = currentNotificationIds;
      notificationListenerReady = true;
      renderNotifications();
      updateNotificationIndicator();
    }, (error) => {
      console.error(error);
      notificationToggle.style.display = "none";
      notificationList.innerHTML = `
        <div class="holiday-item">
          <div>
            <div class="holiday-name">Notifications could not load</div>
            <div class="holiday-date">${escapeHtml(error.message)}</div>
          </div>
        </div>
      `;
      updateNotificationIndicator();
    });
  } catch (error) {
    console.error(error);
    notificationToggle.style.display = "none";
    notificationList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">Notifications could not load</div>
          <div class="holiday-date">${escapeHtml(error.message)}</div>
        </div>
      </div>
    `;
    updateNotificationIndicator();
  }
}

function renderNotifications() {
  notificationList.innerHTML = "";

  if (!employeeNotifications.length) {
    notificationToggle.style.display = "none";
    notificationList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">No notifications</div>
          <div class="holiday-date">Updates from admin will appear here.</div>
        </div>
      </div>
    `;
    updateNotificationIndicator();
    return;
  }

  const visibleNotifications = showAllNotifications
    ? employeeNotifications
    : employeeNotifications.slice(0, 1);

  visibleNotifications.forEach((notification) => {
    const createdDate = formatNotificationDate(notification);
    const notificationId = getNotificationId(notification);
    const isUnread = !seenNotificationIds.has(notificationId);

    notificationList.innerHTML += `
      <div class="holiday-item notification-item ${isUnread ? "unread" : ""}">
        <div>
          <div class="holiday-name">${escapeHtml(notification.title || "Notification")}</div>
          <div class="holiday-date">${escapeHtml(createdDate)}</div>
          <div class="notification-message">${escapeHtml(notification.message || "")}</div>
        </div>
        <span class="holiday-badge">${(notification.targetType || "all") === "all" ? "all" : "you"}</span>
      </div>
    `;
  });

  notificationToggle.style.display = employeeNotifications.length > 1 ? "block" : "none";
  notificationToggle.innerText = showAllNotifications
    ? "Show Recent"
    : `Show All (${employeeNotifications.length})`;
}

window.toggleNotifications = function () {
  showAllNotifications = !showAllNotifications;
  renderNotifications();
};

document.addEventListener("click", (event) => {
  if (!notificationArea || !notificationPopup || notificationPopup.hidden || notificationArea.contains(event.target)) {
    return;
  }

  window.closeNotificationPopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.closeNotificationPopup();
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeTaskStatus(status) {
  return ["todo", "in-progress", "completed"].includes(status) ? status : "todo";
}

function getTaskStatusLabel(status) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "in-progress") return "In Progress";
  if (normalized === "completed") return "Completed";
  return "To Do";
}

function getTaskPriorityClass(priority) {
  return `priority-${String(priority || "Medium").toLowerCase()}`;
}

function getTaskDeadlineState(deadline, status = "todo") {
  if (!deadline || status === "completed") {
    return {
      className: "",
      label: deadline ? formatDisplayDate(deadline) : "No deadline"
    };
  }

  if (deadline < today) {
    return {
      className: "overdue",
      label: `Overdue · ${formatDisplayDate(deadline)}`
    };
  }

  if (deadline === today) {
    return {
      className: "due-today",
      label: "Due Today"
    };
  }

  return {
    className: "",
    label: formatDisplayDate(deadline)
  };
}

function renderEmployeeTaskCard(task) {
  const status = normalizeTaskStatus(task.status);
  const priority = task.priority || "Medium";
  const deadline = getTaskDeadlineState(task.deadline, status);

  return `
    <div class="task-card">
      <div class="task-title">${escapeHtml(task.title || "Untitled Task")}</div>
      <div class="task-description">${escapeHtml(task.description || "No description added.")}</div>
      <div class="task-meta">
        <span class="priority-badge ${getTaskPriorityClass(priority)}">${escapeHtml(priority)}</span>
        <span class="deadline-badge ${deadline.className}">${escapeHtml(deadline.label)}</span>
      </div>
      <select class="task-status-select" onchange="updateMyTaskStatus('${task.id}', this.value)">
        <option value="todo" ${status === "todo" ? "selected" : ""}>To Do</option>
        <option value="in-progress" ${status === "in-progress" ? "selected" : ""}>In Progress</option>
        <option value="completed" ${status === "completed" ? "selected" : ""}>Completed</option>
      </select>
    </div>
  `;
}

async function loadEmployeeTasks(user) {
  try {
    if (taskUnsubscribe) {
      taskUnsubscribe();
    }

    knownTaskIds = new Set();
    taskListenerReady = false;

    const taskQuery = query(
      collection(db, "tasks"),
      where("assignedTo", "==", user.uid)
    );

    taskUnsubscribe = onSnapshot(taskQuery, (taskSnap) => {
      const tasks = [];
      const statusOrder = {
        "todo": 0,
        "in-progress": 1,
        "completed": 2
      };

      taskSnap.forEach((docSnap) => {
        tasks.push({ id: docSnap.id, ...docSnap.data() });
      });

      const currentTaskIds = new Set(tasks.map((task) => task.id));
      const hasNewTask = tasks.some((task) => !knownTaskIds.has(task.id));

      if (taskListenerReady && hasNewTask) {
        playEmployeeAlertSound();
      }

      knownTaskIds = currentTaskIds;
      taskListenerReady = true;

      tasks.sort((a, b) => {
        const statusDiff = (statusOrder[normalizeTaskStatus(a.status)] ?? 0) - (statusOrder[normalizeTaskStatus(b.status)] ?? 0);
        if (statusDiff) return statusDiff;
        return String(a.deadline || "9999-12-31").localeCompare(String(b.deadline || "9999-12-31"));
      });

      if (!tasks.length) {
        employeeTaskList.innerHTML = `
          <div class="holiday-item">
            <div>
              <div class="holiday-name">No tasks assigned</div>
              <div class="holiday-date">New work from admin will appear here.</div>
            </div>
          </div>
        `;
        return;
      }

      employeeTaskList.innerHTML = tasks.map(renderEmployeeTaskCard).join("");
    }, (error) => {
      console.error(error);
      employeeTaskList.innerHTML = `
        <div class="holiday-item">
          <div>
            <div class="holiday-name">Tasks could not load</div>
            <div class="holiday-date">${escapeHtml(error.message)}</div>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error(error);
    employeeTaskList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">Tasks could not load</div>
          <div class="holiday-date">${escapeHtml(error.message)}</div>
        </div>
      </div>
    `;
  }
}

window.updateMyTaskStatus = async function (taskId, status) {
  const normalizedStatus = normalizeTaskStatus(status);
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await updateDoc(doc(db, "tasks", taskId), {
    status: normalizedStatus,
    updatedAt: new Date().toISOString(),
    completedAt: normalizedStatus === "completed" ? new Date().toISOString() : "",
    lastActivity: {
      action: "employee-status-updated",
      at: new Date().toISOString(),
      by: user.uid,
      text: `Employee changed status to ${getTaskStatusLabel(normalizedStatus)}`
    }
  });
};

async function loadEmployeeLeaves(user) {
  try {
    const leaveSnap = await getDocs(collection(db, "leaves"));
    const leaves = [];

    leaveSnap.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.userId === user.uid) {
        leaves.push({ id: docSnap.id, ...data });
      }
    });

    leaves.sort((a, b) => (b.appliedAt || "").localeCompare(a.appliedAt || ""));

    const allowance = getLeaveAllowance(currentEmployeeProfile);
    const approvedDays = leaves
      .filter((leave) => leave.status === "approved" && !isUnpaidLeave(leave))
      .reduce((sum, leave) => sum + Number(leave.days || 0), 0);
    const pendingDays = leaves
      .filter((leave) => leave.status === "pending" && !isUnpaidLeave(leave))
      .reduce((sum, leave) => sum + Number(leave.days || 0), 0);
    const balance = Math.max(allowance - approvedDays, 0);

    leaveBalance.innerText = balance;
    leaveUsed.innerText = approvedDays;
    leavePending.innerText = pendingDays;
    leaveList.innerHTML = "";

    if (!leaves.length) {
      leaveList.innerHTML = `
        <div class="holiday-item">
          <div>
            <div class="holiday-name">No leave requests yet</div>
            <div class="holiday-date">Your requests will appear here.</div>
          </div>
        </div>
      `;
      return;
    }

    leaves.slice(0, 5).forEach((leave) => {
      const statusClass =
        leave.status === "approved" ? "green" :
        leave.status === "rejected" ? "red" : "yellow";
      const deductionText = isUnpaidLeave(leave) ? " · No balance deduction" : "";

      leaveList.innerHTML += `
        <div class="holiday-item">
          <div>
            <div class="holiday-name">${leave.leaveType || "Leave"} · ${leave.days || 0} day(s)</div>
            <div class="holiday-date">${formatDisplayDate(leave.startDate)} - ${formatDisplayDate(leave.endDate)}</div>
            <div class="notification-message">${leave.reason || ""}${deductionText}</div>
          </div>
          <span class="holiday-badge ${statusClass}">${leave.status || "pending"}</span>
        </div>
      `;
    });
  } catch (error) {
    console.error(error);
    leaveList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">Leave requests could not load</div>
          <div class="holiday-date">${error.message}</div>
        </div>
      </div>
    `;
  }
}

window.applyLeave = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const leaveType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("leaveStartDate").value;
  const endDate = document.getElementById("leaveEndDate").value;
  const reason = document.getElementById("leaveReason").value.trim();
  const days = countLeaveDays(startDate, endDate);

  if (!startDate || !endDate || !reason) {
    alert("Please select dates and enter reason");
    return;
  }

  if (!days) {
    alert("Please select a valid leave date range");
    return;
  }

  const leaveSnap = await getDocs(collection(db, "leaves"));
  let approvedDays = 0;

  leaveSnap.forEach((docSnap) => {
    const leave = docSnap.data();

    if (leave.userId === user.uid && leave.status === "approved" && !isUnpaidLeave(leave)) {
      approvedDays += Number(leave.days || 0);
    }
  });

  const availableDays = Math.max(getLeaveAllowance(currentEmployeeProfile) - approvedDays, 0);

  if (!isUnpaidLeave({ leaveType }) && days > availableDays) {
    alert("You do not have enough leave balance");
    return;
  }

  const leaveId = `${user.uid}_${Date.now()}`;

  await setDoc(doc(db, "leaves", leaveId), {
    userId: user.uid,
    employeeName: currentEmployeeProfile?.name || user.email || "Employee",
    employeeEmail: currentEmployeeProfile?.email || user.email || "",
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    status: "pending",
    appliedAt: new Date().toISOString()
  });

  alert("Leave request submitted");

  document.getElementById("leaveStartDate").value = "";
  document.getElementById("leaveEndDate").value = "";
  document.getElementById("leaveReason").value = "";

  loadEmployeeLeaves(user);
};

function getHistoryDates(days) {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - index);
    return {
      date,
      dateText: getDateInputValue(date)
    };
  });
}

function timestampToDate(timestamp) {
  return timestamp && typeof timestamp.toDate === "function"
    ? timestamp.toDate()
    : null;
}

function formatHistoryTime(timestamp) {
  const date = timestampToDate(timestamp);

  if (!date) {
    return "-";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function durationTextToMs(durationText) {
  if (!durationText) return 0;

  const hoursMatch = String(durationText).match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = String(durationText).match(/(\d+)\s*m/);

  if (hoursMatch || minutesMatch) {
    return Math.round((Number(hoursMatch?.[1] || 0) * 3600000) + (Number(minutesMatch?.[1] || 0) * 60000));
  }

  const decimalHours = Number(durationText);
  return Number.isFinite(decimalHours) ? Math.round(decimalHours * 3600000) : 0;
}

function getHistoryStatusClass(status) {
  if (status === "completed") return "green";
  if (status === "working") return "blue";
  if (status === "break") return "yellow";
  return "red";
}

function getHistoryStatusLabel(status) {
  if (status === "completed") return "Completed";
  if (status === "working") return "Working";
  if (status === "break") return "On Break";
  if (status === "missed-punch-out") return "Missed Punch Out";
  if (status === "absent") return "Absent";
  return "No Punch In";
}

function getBreakSummaryFromRecords(breaks, fallbackEndTime = null) {
  let completedBreakMs = 0;
  let totalBreakMs = 0;
  let openBreakStart = null;
  let completedBreaks = 0;

  breaks.forEach((breakRecord) => {
    const startTime = timestampToDate(breakRecord.breakStart);

    if (!startTime) {
      return;
    }

    const endTime = timestampToDate(breakRecord.breakEnd);

    if (endTime) {
      const duration = Math.max(endTime - startTime, 0);
      completedBreakMs += duration;
      totalBreakMs += duration;
      completedBreaks++;
      return;
    }

    if (!openBreakStart || startTime < openBreakStart) {
      openBreakStart = startTime;
    }

    if (fallbackEndTime) {
      totalBreakMs += Math.max(fallbackEndTime - startTime, 0);
    }
  });

  return {
    completedBreakMs,
    totalBreakMs,
    openBreakStart,
    breakCount: completedBreaks + (openBreakStart ? 1 : 0)
  };
}

function getRecordWorkMs(record, breaks) {
  const savedDuration = durationTextToMs(record.totalHours);

  if (savedDuration) {
    return savedDuration;
  }

  const punchInTime = timestampToDate(record.punchIn);

  if (!punchInTime) {
    return 0;
  }

  const punchOutTime = timestampToDate(record.punchOut);
  const breakSummary = getBreakSummaryFromRecords(breaks);
  const endTime = punchOutTime || breakSummary.openBreakStart || new Date();
  return Math.max(endTime - punchInTime - breakSummary.completedBreakMs, 0);
}

function getWeekStartDate(date = new Date()) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  return weekStart;
}

function getRecentCutoffDate(days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

function getFirstPunchInByDate(records) {
  const firstPunchInByDate = {};

  records.forEach((record) => {
    if (!record.date || record.status === "absent") {
      return;
    }

    const punchIn = timestampToDate(record.punchIn);

    if (!punchIn) {
      return;
    }

    if (!firstPunchInByDate[record.date] || punchIn < firstPunchInByDate[record.date]) {
      firstPunchInByDate[record.date] = punchIn;
    }
  });

  return firstPunchInByDate;
}

function countLateDaysThisWeek(profile, records) {
  const workStart = getTimeMinutes(profile?.workStart);

  if (workStart === null) {
    return null;
  }

  const weekStartText = getDateInputValue(getWeekStartDate());
  const currentDateText = getDateInputValue(new Date());
  const weekRecords = records.filter((record) => record.date >= weekStartText && record.date <= currentDateText);
  const firstPunchInByDate = getFirstPunchInByDate(weekRecords);

  return Object.values(firstPunchInByDate).filter((punchIn) => {
    const punchMinutes = (punchIn.getHours() * 60) + punchIn.getMinutes();
    return punchMinutes > workStart;
  }).length;
}

function getProductiveWindow(records) {
  const windows = [
    { label: "8 AM - 11 AM", start: 8 * 60, end: 11 * 60, totalMs: 0 },
    { label: "11 AM - 2 PM", start: 11 * 60, end: 14 * 60, totalMs: 0 },
    { label: "2 PM - 5 PM", start: 14 * 60, end: 17 * 60, totalMs: 0 },
    { label: "5 PM - 8 PM", start: 17 * 60, end: 20 * 60, totalMs: 0 }
  ];

  records.forEach((record) => {
    if (record.status === "absent") {
      return;
    }

    const punchIn = timestampToDate(record.punchIn);
    const punchOut = timestampToDate(record.punchOut);

    if (!punchIn || !punchOut || punchOut <= punchIn) {
      return;
    }

    const dayStart = new Date(punchIn);
    dayStart.setHours(0, 0, 0, 0);

    windows.forEach((windowBlock) => {
      const windowStart = new Date(dayStart);
      windowStart.setMinutes(windowBlock.start);
      const windowEnd = new Date(dayStart);
      windowEnd.setMinutes(windowBlock.end);
      const overlapMs = Math.max(Math.min(punchOut, windowEnd) - Math.max(punchIn, windowStart), 0);
      windowBlock.totalMs += overlapMs;
    });
  });

  const bestWindow = windows.sort((a, b) => b.totalMs - a.totalMs)[0];
  return bestWindow && bestWindow.totalMs > 0 ? bestWindow.label : null;
}

function renderSmartInsights(insights) {
  smartInsightsList.innerHTML = insights.map((insight) => `
    <div class="insight-item">
      <div class="insight-icon">${insight.icon}</div>
      <div>
        <div class="insight-title">${insight.title}</div>
        <p class="insight-copy">${insight.copy}</p>
      </div>
    </div>
  `).join("");
}

async function loadSmartInsights(user) {
  if (!smartInsightsList) {
    return;
  }

  renderSmartInsights([{
    icon: "AI",
    title: "Analyzing work patterns",
    copy: "Checking recent attendance, break time, and schedule data."
  }]);

  const [attendanceSnap, breakSnap] = await Promise.all([
    getDocs(query(collection(db, "attendance"), where("userId", "==", user.uid))),
    getDocs(query(collection(db, "breaks"), where("userId", "==", user.uid)))
  ]);

  const cutoffText = getDateInputValue(getRecentCutoffDate(30));
  const currentDateText = getDateInputValue(new Date());
  const records = [];
  const breaksByDate = {};

  attendanceSnap.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.date >= cutoffText && data.date <= currentDateText) {
      records.push({ id: docSnap.id, ...data });
    }
  });

  breakSnap.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.date >= cutoffText && data.date <= currentDateText) {
      breaksByDate[data.date] ||= [];
      breaksByDate[data.date].push({ id: docSnap.id, ...data });
    }
  });

  const completedRecords = records.filter((record) => record.status === "completed" || record.status === "missed-punch-out");
  const workedDurations = completedRecords
    .map((record) => getRecordWorkMs(record, breaksByDate[record.date] || []))
    .filter((duration) => duration > 0);
  const averageMs = workedDurations.length
    ? workedDurations.reduce((sum, duration) => sum + duration, 0) / workedDurations.length
    : 0;
  const lateDays = countLateDaysThisWeek(currentEmployeeProfile, records);
  const productiveWindow = getProductiveWindow(completedRecords);

  renderSmartInsights([
    {
      icon: "L",
      title: "Late arrivals",
      copy: lateDays === null
        ? "Your working start time is not assigned yet, so lateness tracking is waiting for schedule setup."
        : `You were late ${lateDays} ${lateDays === 1 ? "time" : "times"} this week.`
    },
    {
      icon: "A",
      title: "Average working time",
      copy: averageMs
        ? `Your average working time is ${formatDuration(averageMs)} across recent completed shifts.`
        : "Complete a punch in and punch out cycle to calculate your average working time."
    },
    {
      icon: "P",
      title: "Most productive window",
      copy: productiveWindow
        ? `You are most productive between ${productiveWindow}, based on your recent logged hours.`
        : "More completed attendance records are needed to detect your strongest work window."
    }
  ]);
}

function getTimeMinutes(timeText) {
  if (!timeText) return null;

  const [hours, minutes] = timeText.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function getExpectedDailyMinutes(profile) {
  const start = getTimeMinutes(profile?.workStart);
  const end = getTimeMinutes(profile?.workEnd);

  if (start === null || end === null) {
    return 480;
  }

  const minutes = end > start ? end - start : (24 * 60) - start + end;
  return minutes > 0 ? minutes : 480;
}

function countWorkingDaysInMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);

  if (!year || !month) {
    return 0;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);

    if (date.getDay() !== 0) {
      workingDays++;
    }
  }

  return workingDays;
}

function getPayrollSettings(profile) {
  const monthlySalary = Number(profile?.monthlySalary ?? profile?.salary ?? 0);
  const salaryType = profile?.salaryType === "fixed" || profile?.salaryBasis === "days" ? "fixed" : "hourly";
  const hourlyRate = Number(profile?.hourlyRate ?? profile?.perHourSalary ?? 0);
  const defaultDeduction = Number(profile?.payrollDeduction ?? profile?.deduction ?? 0);
  const lateDeductionPerDay = Number(profile?.lateDeductionPerDay ?? 0);
  const bonus = Number(profile?.payrollBonus ?? profile?.bonus ?? 0);

  return {
    salaryType,
    hourlyRate: Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : 0,
    monthlySalary: Number.isFinite(monthlySalary) && monthlySalary > 0 ? monthlySalary : 0,
    defaultDeduction: Number.isFinite(defaultDeduction) && defaultDeduction > 0 ? defaultDeduction : 0,
    lateDeductionPerDay: Number.isFinite(lateDeductionPerDay) && lateDeductionPerDay > 0 ? lateDeductionPerDay : 0,
    bonus: Number.isFinite(bonus) && bonus > 0 ? bonus : 0,
    deductionRules: profile?.deductionRules || ""
  };
}

function getPayrollDocId(uid, monthValue) {
  return `${uid}_${monthValue}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function countLateDays(profile, records) {
  const workStart = getTimeMinutes(profile?.workStart);

  if (workStart === null) return 0;

  const lateDates = new Set();

  records.forEach((record) => {
    if (record.status === "absent") return;

    const punchIn = timestampToDate(record.punchIn);
    if (!punchIn) return;

    const punchMinutes = (punchIn.getHours() * 60) + punchIn.getMinutes();
    if (punchMinutes > workStart) {
      lateDates.add(record.date);
    }
  });

  return lateDates.size;
}

async function getMonthlySalarySlip(user, monthValue) {
  const profile = currentEmployeeProfile;

  if (!profile) {
    throw new Error("Employee profile not loaded");
  }

  const [attendanceSnap, breakSnap, payrollStatusSnap] = await Promise.all([
    getDocs(query(collection(db, "attendance"), where("userId", "==", user.uid))),
    getDocs(query(collection(db, "breaks"), where("userId", "==", user.uid))),
    getDoc(doc(db, "payrollStatus", getPayrollDocId(profile.uid || user.uid, monthValue)))
  ]);

  const records = [];
  const breaksByDate = {};
  let breakMs = 0;

  attendanceSnap.forEach((docSnap) => {
    const data = docSnap.data();

    if (String(data.date || "").startsWith(monthValue)) {
      records.push({ id: docSnap.id, ...data });
    }
  });

  breakSnap.forEach((docSnap) => {
    const data = docSnap.data();

    if (!String(data.date || "").startsWith(monthValue)) {
      return;
    }

    breaksByDate[data.date] ||= [];
    breaksByDate[data.date].push({ id: docSnap.id, ...data });

    const start = timestampToDate(data.breakStart);
    const end = timestampToDate(data.breakEnd);

    if (start && end) {
      breakMs += Math.max(end - start, 0);
    }
  });

  const settings = getPayrollSettings(profile);
  const totalDays = countWorkingDaysInMonth(monthValue);
  const presentDays = new Set(records.filter((record) => record.status !== "absent").map((record) => record.date)).size;
  const absentRecords = records.filter((record) => record.status === "absent").length;
  const absentDays = Math.max(totalDays - presentDays, absentRecords, 0);
  const workedMs = records
    .filter((record) => record.status !== "absent")
    .reduce((sum, record) => sum + getRecordWorkMs(record, breaksByDate[record.date] || []), 0);
  const workedHours = workedMs / 3600000;
  const expectedMonthlyHours = (totalDays * getExpectedDailyMinutes(profile)) / 60;
  const computedHourlyRate = expectedMonthlyHours ? settings.monthlySalary / expectedMonthlyHours : 0;
  const hourlyRate = settings.hourlyRate || computedHourlyRate;
  const dailyRate = totalDays ? settings.monthlySalary / totalDays : 0;
  const lateDays = countLateDays(profile, records);
  const lateDeduction = lateDays * settings.lateDeductionPerDay;
  const absentDeduction = settings.salaryType === "fixed" ? absentDays * dailyRate : 0;
  const grossSalary = settings.salaryType === "fixed" ? settings.monthlySalary : workedHours * hourlyRate;
  const totalDeduction = settings.defaultDeduction + lateDeduction + absentDeduction;
  const netSalary = Math.max(grossSalary + settings.bonus - totalDeduction, 0);
  const hasSalarySetup = Boolean(settings.hourlyRate || settings.monthlySalary);

  return {
    companyName: "Mindque India Pvt. Ltd.",
    companyAddress: "Plot No-211, Ground Floor, District Center Chandrasekharpur, Bhubaneswar-751016, Odisha India",
    employeeName: profile.name || user.email || "Employee",
    employeeId: profile.employeeId || profile.employeeCode || profile.uid || user.uid,
    employeeEmail: profile.email || user.email || "-",
    month: monthValue,
    monthLabel: formatPayslipMonth(monthValue),
    payDate: formatPayslipDate(),
    salaryType: settings.salaryType,
    totalDays,
    presentDays,
    absentDays,
    workedMs,
    breakMs,
    hourlyRate,
    grossSalary,
    bonus: settings.bonus,
    defaultDeduction: settings.defaultDeduction,
    lateDeduction,
    absentDeduction,
    totalDeduction,
    netSalary,
    status: payrollStatusSnap.exists() ? payrollStatusSnap.data().status : (hasSalarySetup ? "Calculated" : "Draft"),
    deductionRules: settings.deductionRules || "Standard attendance deduction rules"
  };
}

function renderSalarySlipSummary(slip) {
  currentSalarySlip = slip;
  salarySlipSummary.innerHTML = `
    <div class="salary-slip-stat">
      <span>Month</span>
      <strong>${slip.month}</strong>
    </div>
    <div class="salary-slip-stat">
      <span>Net Salary</span>
      <strong>${formatCurrency(slip.netSalary)}</strong>
    </div>
    <div class="salary-slip-stat">
      <span>Total Hours</span>
      <strong>${formatDuration(slip.workedMs)}</strong>
    </div>
    <div class="salary-slip-stat">
      <span>Status</span>
      <strong>${slip.status}</strong>
    </div>
  `;
}

function drawMonthlyPayslipPdf(pdf, slip) {
  const pageWidth = 210;
  const margin = 14;
  const rightX = 132;
  const grossEarnings = slip.grossSalary + slip.bonus;
  const totalDeductions = slip.totalDeduction;

  pdf.setDrawColor(229, 231, 235);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(10, 10, 190, 277, 3, 3, "FD");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text("Powered by Workforce By Mindque", pageWidth - margin, 17, { align: "right" });

  pdf.setTextColor(17, 24, 39);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(slip.companyName, margin, 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(75, 85, 99);
  pdf.text(pdf.splitTextToSize(slip.companyAddress, 95), margin, 34);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text("Payslip For the Month", pageWidth - margin, 30, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(17, 24, 39);
  pdf.text(slip.monthLabel, pageWidth - margin, 39, { align: "right" });

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, 52, pageWidth - margin, 52);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(17, 24, 39);
  pdf.text("EMPLOYEE SUMMARY", margin, 64);

  const summaryRows = [
    ["Employee Name", slip.employeeName],
    ["Employee ID", slip.employeeId],
    ["Pay Period", slip.monthLabel],
    ["Pay Date", slip.payDate]
  ];

  let y = 75;
  summaryRows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    pdf.text(String(value || "-"), 55, y);
    y += 8;
  });

  pdf.setFillColor(240, 253, 244);
  pdf.setDrawColor(187, 247, 208);
  pdf.roundedRect(rightX, 62, 58, 42, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(5, 150, 105);
  pdf.text(formatPayslipAmount(slip.netSalary), rightX + 29, 78, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(75, 85, 99);
  pdf.text("Total Net Pay", rightX + 29, 88, { align: "center" });

  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(rightX, 110, 27, 18, 2, 2);
  pdf.roundedRect(rightX + 31, 110, 27, 18, 2, 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text("Paid Days", rightX + 13.5, 116, { align: "center" });
  pdf.text("LOP Days", rightX + 44.5, 116, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(17, 24, 39);
  pdf.text(String(slip.presentDays), rightX + 13.5, 124, { align: "center" });
  pdf.text(String(slip.absentDays), rightX + 44.5, 124, { align: "center" });

  const tableY = 140;
  const tableW = 86;

  function drawTable(x, title, rows, totalLabel, totalAmount) {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(229, 231, 235);
    pdf.rect(x, tableY, tableW, 11, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(75, 85, 99);
    pdf.text(title, x + 3, tableY + 7);
    pdf.text("AMOUNT", x + tableW - 3, tableY + 7, { align: "right" });

    let rowY = tableY + 20;
    rows.forEach(([label, amount]) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(17, 24, 39);
      pdf.text(label, x + 3, rowY);
      pdf.text(formatPayslipAmount(amount), x + tableW - 3, rowY, { align: "right" });
      rowY += 9;
    });

    pdf.line(x, tableY + 50, x + tableW, tableY + 50);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    pdf.text(totalLabel, x + 3, tableY + 58);
    pdf.text(formatPayslipAmount(totalAmount), x + tableW - 3, tableY + 58, { align: "right" });
  }

  drawTable(margin, "EARNINGS", [
    ["Basic", slip.grossSalary],
    ["House Rent Allowance", 0],
    ["Bonus / Incentive", slip.bonus]
  ], "Gross Earnings", grossEarnings);

  drawTable(110, "DEDUCTIONS", [
    ["Income Tax", 0],
    ["Provident Fund", 0],
    ["Attendance Deduction", totalDeductions]
  ], "Total Deductions", totalDeductions);

  pdf.setFillColor(240, 253, 244);
  pdf.setDrawColor(187, 247, 208);
  pdf.roundedRect(margin, 214, 182, 28, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(17, 24, 39);
  pdf.text("TOTAL NET PAYABLE", margin + 4, 224);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(75, 85, 99);
  pdf.text("Gross Earnings - Total Deductions", margin + 4, 233);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(5, 150, 105);
  pdf.text(formatPayslipAmount(slip.netSalary), pageWidth - margin - 4, 230, { align: "right" });

  pdf.setTextColor(75, 85, 99);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Amount In Words: ${numberToWordsIndian(slip.netSalary)}`, margin, 254);
  pdf.setTextColor(107, 114, 128);
  pdf.text("-- This is a system-generated document. --", pageWidth / 2, 274, { align: "center" });
}

window.loadSalarySlipSummary = async function () {
  const user = auth.currentUser;
  const monthValue = salarySlipMonth.value || getCurrentMonthValue();

  if (!user) return;

  salarySlipMonth.value = monthValue;
  salarySlipSummary.innerHTML = `
    <div class="holiday-item" style="grid-column:1 / -1;">
      <div>
        <div class="holiday-name">Loading salary slip...</div>
      </div>
    </div>
  `;

  try {
    const slip = await getMonthlySalarySlip(user, monthValue);
    renderSalarySlipSummary(slip);
  } catch (error) {
    console.error(error);
    currentSalarySlip = null;
    salarySlipSummary.innerHTML = `
      <div class="holiday-item" style="grid-column:1 / -1;">
        <div>
          <div class="holiday-name">Salary slip could not load</div>
          <div class="holiday-date">${error.message}</div>
        </div>
      </div>
    `;
  }
};

window.downloadMonthlySalarySlip = async function () {
  const user = auth.currentUser;
  const monthValue = salarySlipMonth.value || getCurrentMonthValue();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (!currentSalarySlip || currentSalarySlip.month !== monthValue) {
    currentSalarySlip = await getMonthlySalarySlip(user, monthValue);
    renderSalarySlipSummary(currentSalarySlip);
  }

  const jsPDF = window.jspdf?.jsPDF;

  if (!jsPDF) {
    alert("PDF library could not load. Please check your internet connection.");
    return;
  }

  const slip = currentSalarySlip;
  const pdf = new jsPDF();
  drawMonthlyPayslipPdf(pdf, slip);
  pdf.save(`Salary_Slip_${slip.employeeName.replace(/[^a-z0-9]+/gi, "_")}_${slip.month}.pdf`);
};

function createMapLink(location) {
  if (!location) {
    return "-";
  }

  return `<a target="_blank" href="https://www.google.com/maps?q=${location.lat},${location.lng}">View Map</a>`;
}

function createHistoryPhoto(photoUrl, label) {
  if (!photoUrl) {
    return `
      <div>
        <div class="history-detail-label">${label}</div>
        <div class="history-empty-photo">No photo</div>
      </div>
    `;
  }

  return `
    <div>
      <div class="history-detail-label">${label}</div>
      <img class="history-photo" src="${photoUrl}" alt="${label}">
    </div>
  `;
}

function buildHistorySummary(dateText, records, breaks) {
  if (!records.length) {
    return {
      dateText,
      status: "none",
      statusLabel: "No Punch In",
      statusClass: "red",
      punchIn: "-",
      punchOut: "-",
      totalHours: "-",
      breakTime: "-",
      breakCount: 0,
      meta: "No attendance recorded",
      location: null,
      punchOutLocation: null,
      selfie: "",
      punchOutSelfie: ""
    };
  }

  const sortedRecords = [...records].sort((a, b) => {
    const aTime = timestampToDate(a.punchIn)?.getTime() || 0;
    const bTime = timestampToDate(b.punchIn)?.getTime() || 0;
    return aTime - bTime;
  });
  const firstRecord = sortedRecords[0];
  const lastRecord = sortedRecords[sortedRecords.length - 1];
  const status = lastRecord.status || firstRecord.status || "none";
  const breakSummary = getBreakSummaryFromRecords(breaks, new Date());
  const totalWorkMs = sortedRecords.reduce((sum, record) => sum + getRecordWorkMs(record, breaks), 0);
  const totalHours = totalWorkMs ? formatDuration(totalWorkMs) : (lastRecord.totalHours || "-");
  const firstIn = formatHistoryTime(firstRecord.punchIn);
  const lastOut = formatHistoryTime(lastRecord.punchOut);

  return {
    dateText,
    status,
    statusLabel: getHistoryStatusLabel(status),
    statusClass: getHistoryStatusClass(status),
    punchIn: firstIn,
    punchOut: lastOut,
    totalHours,
    breakTime: breakSummary.totalBreakMs ? formatDuration(breakSummary.totalBreakMs) : "0h 0m",
    breakCount: breakSummary.breakCount,
    meta: `${firstIn} - ${lastOut} · ${totalHours}`,
    location: firstRecord.location || null,
    punchOutLocation: lastRecord.punchOutLocation || null,
    selfie: firstRecord.selfie || "",
    punchOutSelfie: lastRecord.punchOutSelfie || ""
  };
}

function renderAttendanceHistory(items) {
  attendanceHistoryItems = {};
  attendanceHistoryList.innerHTML = "";

  if (!items.length) {
    attendanceHistoryList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">No attendance history</div>
          <div class="holiday-date">Your recent days will appear here.</div>
        </div>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    attendanceHistoryItems[item.dateText] = item;
    attendanceHistoryList.innerHTML += `
      <button class="history-item" type="button" onclick="openAttendanceHistoryDetails('${item.dateText}')">
        <div>
          <div class="history-day">${formatDisplayDate(item.dateText)}</div>
          <div class="history-meta">${item.meta}</div>
        </div>
        <span class="history-status ${item.statusClass}">${item.statusLabel}</span>
      </button>
    `;
  });
}

async function loadAttendanceHistory(user) {
  try {
    const historyDates = getHistoryDates(attendanceHistoryRange);
    const historyDateSet = new Set(historyDates.map((item) => item.dateText));
    const attendanceQuery = query(
      collection(db, "attendance"),
      where("userId", "==", user.uid)
    );
    const breakQuery = query(
      collection(db, "breaks"),
      where("userId", "==", user.uid)
    );
    const [attendanceSnap, breakSnap] = await Promise.all([
      getDocs(attendanceQuery),
      getDocs(breakQuery)
    ]);
    const recordsByDate = {};
    const breaksByDate = {};

    attendanceSnap.forEach((docSnap) => {
      const data = docSnap.data();

      if (!historyDateSet.has(data.date)) {
        return;
      }

      recordsByDate[data.date] ||= [];
      recordsByDate[data.date].push({ id: docSnap.id, ...data });
    });

    breakSnap.forEach((docSnap) => {
      const data = docSnap.data();

      if (!historyDateSet.has(data.date)) {
        return;
      }

      breaksByDate[data.date] ||= [];
      breaksByDate[data.date].push({ id: docSnap.id, ...data });
    });

    const items = historyDates.map(({ dateText }) => {
      return buildHistorySummary(dateText, recordsByDate[dateText] || [], breaksByDate[dateText] || []);
    });

    renderAttendanceHistory(items);
  } catch (error) {
    console.error(error);
    attendanceHistoryList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">Attendance history could not load</div>
          <div class="holiday-date">${error.message}</div>
        </div>
      </div>
    `;
  }
}

window.setAttendanceHistoryRange = function (days) {
  attendanceHistoryRange = days === 30 ? 30 : 7;
  historyRange7.classList.toggle("active", attendanceHistoryRange === 7);
  historyRange30.classList.toggle("active", attendanceHistoryRange === 30);

  const user = auth.currentUser;
  if (user) {
    loadAttendanceHistory(user);
  }
};

window.openAttendanceHistoryDetails = function (dateText) {
  const item = attendanceHistoryItems[dateText];

  if (!item) {
    alert("Attendance details not found");
    return;
  }

  historyDetailTitle.innerText = formatDisplayDate(dateText);
  historyDetailSubtitle.innerText = "Daily punch, break, location, and photo details.";
  historyDetailStatus.className = `history-status ${item.statusClass}`;
  historyDetailStatus.innerText = item.statusLabel;
  historyDetailGrid.innerHTML = `
    <div class="history-detail-field">
      <div class="history-detail-label">Punch In</div>
      <div class="history-detail-value">${item.punchIn}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Punch Out</div>
      <div class="history-detail-value">${item.punchOut}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Total Hours</div>
      <div class="history-detail-value">${item.totalHours}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Break Time</div>
      <div class="history-detail-value">${item.breakTime}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Breaks</div>
      <div class="history-detail-value">${item.breakCount}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Punch In Location</div>
      <div class="history-detail-value">${createMapLink(item.location)}</div>
    </div>
    <div class="history-detail-field">
      <div class="history-detail-label">Punch Out Location</div>
      <div class="history-detail-value">${createMapLink(item.punchOutLocation)}</div>
    </div>
  `;
  historyDetailPhotos.innerHTML = `
    ${createHistoryPhoto(item.selfie, "Punch In Photo")}
    ${createHistoryPhoto(item.punchOutSelfie, "Punch Out Photo")}
  `;
  attendanceHistoryModal.classList.add("open");
  attendanceHistoryModal.setAttribute("aria-hidden", "false");
};

window.closeAttendanceHistoryDetails = function () {
  attendanceHistoryModal.classList.remove("open");
  attendanceHistoryModal.setAttribute("aria-hidden", "true");
};

async function openCamera() {
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;
}

function updateConfirmState() {
  const locationOk = currentOfficeMatch && currentDistance !== null && currentDistance <= currentOfficeMatch.radius;
  const ready = Boolean(capturedSelfieBlob) && locationOk;

  confirmPunchBtn.disabled = !ready;

  if (ready) {
    confirmPunchBtn.removeAttribute("disabled");
    confirmPunchBtn.style.opacity = "1";
    confirmPunchBtn.style.cursor = "pointer";
    confirmHelp.innerText = "Ready to confirm.";
    return;
  }

  if (!capturedSelfieBlob && !locationOk) {
    confirmHelp.innerText = "Capture selfie and wait for location check.";
  } else if (!capturedSelfieBlob) {
    confirmHelp.innerText = "Capture selfie to continue.";
  } else {
    confirmHelp.innerText = "You must be inside the office radius.";
  }
}

async function loadLiveLocation() {
  locationText.innerText = "Getting your location...";
  distanceText.innerText = "Distance: --";
  radiusStatus.innerText = "Checking radius";
  radiusStatus.classList.remove("ok");

  await loadAllowedWorkLocations();
  currentLocation = await getLocation();
  currentOfficeMatch = getNearestOffice(currentLocation);
  currentDistance = currentOfficeMatch.distance;

  const roundedDistance = Math.round(currentDistance);
  const mapDelta = 0.003;
  const left = currentLocation.lng - mapDelta;
  const right = currentLocation.lng + mapDelta;
  const top = currentLocation.lat + mapDelta;
  const bottom = currentLocation.lat - mapDelta;

  mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${currentLocation.lat},${currentLocation.lng}`;
  locationText.innerText = `Lat: ${currentLocation.lat.toFixed(6)}, Lng: ${currentLocation.lng.toFixed(6)}`;
  distanceText.innerText = `Nearest office: ${currentOfficeMatch.name} · ${roundedDistance}m / ${currentOfficeMatch.radius}m`;

  if (currentDistance <= currentOfficeMatch.radius) {
    radiusStatus.innerText = "Inside office radius";
    radiusStatus.classList.add("ok");
  } else {
    radiusStatus.innerText = "Outside office radius";
    radiusStatus.classList.remove("ok");
  }

  updateConfirmState();
}

async function openPunchModal(action) {
  currentAction = action;
  capturedSelfieBlob = null;
  capturedSelfieAt = null;
  currentLocation = null;
  currentDistance = null;
  currentOfficeMatch = null;

  const isPunchOut = action === "out";
  modalTitle.innerText = isPunchOut ? "Confirm Punch Out" : "Confirm Punch In";
  modalSubtitle.innerText = isPunchOut
    ? "Capture a selfie and confirm your location before ending your work day."
    : "Capture a selfie and confirm your location before starting your timer.";
  confirmPunchBtn.innerText = isPunchOut ? "Confirm Punch Out" : "Confirm Punch In";
  confirmPunchBtn.className = isPunchOut ? "btn btn-red" : "btn btn-green";
  confirmPunchBtn.disabled = true;
  confirmPunchBtn.style.opacity = "";
  confirmPunchBtn.style.cursor = "";
  confirmHelp.innerText = "Capture selfie and wait for location check.";
  selfiePreview.style.display = "none";
  selfiePreview.removeAttribute("src");
  selfieBtn.innerText = "Capture Selfie";
  selfieBtn.disabled = false;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  try {
    await Promise.all([
      openCamera(),
      loadLiveLocation()
    ]);
  } catch (error) {
    console.error(error);
    alert(error.message);
    closePunchModal();
  }
}

window.closePunchModal = function () {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  stopCamera();
  capturedSelfieBlob = null;
  capturedSelfieAt = null;
  if (selfiePreviewUrl) {
    URL.revokeObjectURL(selfiePreviewUrl);
    selfiePreviewUrl = null;
  }
  currentLocation = null;
  currentDistance = null;
  currentOfficeMatch = null;
  confirmPunchBtn.disabled = true;
};

window.startPunchIn = async function () {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await refreshStatus(user);

  if (latestAttendanceData && ["working", "break"].includes(latestAttendanceData.status)) {
    alert("You are already punched in today");
    return;
  }

  if (latestAttendanceData && ["completed", "missed-punch-out"].includes(latestAttendanceData.status)) {
    alert("Today is already completed");
    return;
  }

  await openPunchModal("in");
};

window.startPunchOut = async function () {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await refreshStatus(user);

  if (!latestAttendanceDoc || !["working", "break"].includes(latestAttendanceData.status)) {
    alert("No active punch in found");
    return;
  }

  await openPunchModal("out");
};

function drawCompressedSelfieFrame() {
  canvas.width = attendanceSelfieWidth;
  canvas.height = attendanceSelfieHeight;

  const ctx = canvas.getContext("2d");
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  if (!videoWidth || !videoHeight) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return;
  }

  const targetRatio = canvas.width / canvas.height;
  const videoRatio = videoWidth / videoHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (videoRatio > targetRatio) {
    sourceWidth = videoHeight * targetRatio;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetRatio;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  ctx.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
}

window.captureSelfie = function () {
  selfieBtn.disabled = true;
  const selfieCapturedAt = new Date();
  drawCompressedSelfieFrame();

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Selfie capture failed");
      selfieBtn.disabled = false;
      return;
    }

    capturedSelfieBlob = blob;
    capturedSelfieAt = selfieCapturedAt;
    if (selfiePreviewUrl) {
      URL.revokeObjectURL(selfiePreviewUrl);
    }
    selfiePreviewUrl = URL.createObjectURL(blob);
    selfiePreview.src = selfiePreviewUrl;
    selfiePreview.style.display = "block";
    selfieBtn.innerText = "Retake Selfie";
    selfieBtn.disabled = false;
    updateConfirmState();
  }, "image/jpeg", attendanceSelfieQuality);
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadSelfie() {
  return blobToDataUrl(capturedSelfieBlob);
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), 15000);
    })
  ]);
}

window.confirmPunch = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (!capturedSelfieBlob) {
    alert("Please capture selfie first");
    return;
  }

  if (!currentLocation || !currentOfficeMatch || currentDistance > currentOfficeMatch.radius) {
    alert("You must be inside the office radius");
    return;
  }

  confirmPunchBtn.disabled = true;
  confirmPunchBtn.innerText = currentAction === "in" ? "Saving Punch In..." : "Saving Punch Out...";
  confirmHelp.innerText = "Saving attendance. Please wait...";

  try {
    if (currentAction === "in") {
      const punchInTime = new Date();
      confirmHelp.innerText = "Preparing selfie...";
      const imageUrl = await uploadSelfie();

      confirmHelp.innerText = "Saving punch in...";
      await withTimeout(addDoc(collection(db, "attendance"), {
        userId: user.uid,
        date: today,
        punchIn: Timestamp.fromDate(punchInTime),
        location: currentLocation,
        officeLocation: getOfficeLocationPayload(currentOfficeMatch),
        selfie: imageUrl,
        assignedWorkStart: currentEmployeeProfile?.workStart || "",
        assignedWorkEnd: currentEmployeeProfile?.workEnd || "",
        graceMinutes: getGraceMinutes(currentEmployeeProfile),
        status: "working"
      }), "Punch in save timed out. Please check Firestore rules or internet connection.");

      statusEl.innerText = "Working";
      setButtonsForStatus("working");
      await startTimer(punchInTime, user);
      alert("Punch In Successful");
    } else {
      const attendance = await getTodayAttendance(user);

      if (!attendance || !["working", "break"].includes(attendance.data.status)) {
        alert("No active punch in found");
        return;
      }

      confirmHelp.innerText = "Preparing selfie...";
      const imageUrl = await uploadSelfie();
      const punchOutTime = capturedSelfieAt || new Date();
      const totalMs = punchOutTime - attendance.data.punchIn.toDate();
      const totalBreakMs = await getTotalBreakMs(user, punchOutTime);
      const workingMs = totalMs - totalBreakMs;
      const hours = formatDuration(workingMs);

      await closeOpenBreaks(user);

      confirmHelp.innerText = "Saving punch out...";
      await withTimeout(updateDoc(attendance.ref, {
        punchOut: Timestamp.fromDate(punchOutTime),
        manualPunchOutAt: Timestamp.fromDate(punchOutTime),
        punchOutLocation: currentLocation,
        punchOutOfficeLocation: getOfficeLocationPayload(currentOfficeMatch),
        punchOutSelfie: imageUrl,
        punchOutType: "manual",
        missedPunchOut: false,
        autoLogoutAt: null,
        autoClosedByAdminPanel: false,
        status: "completed",
        totalHours: hours,
        updatedAt: new Date().toISOString()
      }), "Punch out save timed out. Please check Firestore rules or internet connection.");

      statusEl.innerText = "Completed";
      totalHoursEl.innerText = "Total Hours: " + hours;
      totalHoursEl.style.color = "green";
      setButtonsForStatus("completed");
      stopTimer("Finished");
      alert("Punch Out Successful. Total Working Hours: " + hours);
    }

    closePunchModal();
    await refreshStatus(user);
    loadAttendanceHistory(user).catch((error) => console.error(error));
  } catch (error) {
    console.error(error);
    alert(error.message);
    confirmPunchBtn.disabled = false;
    confirmPunchBtn.innerText = currentAction === "in" ? "Confirm Punch In" : "Confirm Punch Out";
    confirmHelp.innerText = "Try again or retake selfie.";
  }
};

window.startBreak = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const attendance = await getTodayAttendance(user);

  if (!attendance || attendance.data.status !== "working") {
    alert("You must be working to start a break");
    return;
  }

  await addDoc(collection(db, "breaks"), {
    userId: user.uid,
    date: today,
    breakStart: Timestamp.now(),
    breakEnd: null
  });

  await updateDoc(attendance.ref, {
    status: "break"
  });

  await refreshStatus(user);
  loadAttendanceHistory(user).catch((error) => console.error(error));
  alert("Break Started");
};

window.endBreak = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const breakQuery = query(
    collection(db, "breaks"),
    where("userId", "==", user.uid),
    where("date", "==", today)
  );

  const snapshot = await getDocs(breakQuery);
  const updates = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (!data.breakEnd) {
      updates.push(updateDoc(doc(db, "breaks", docSnap.id), {
        breakEnd: Timestamp.now()
      }));
    }
  });

  await Promise.all(updates);

  const attendance = await getTodayAttendance(user);
  if (attendance) {
    await updateDoc(attendance.ref, {
      status: "working"
    });
  }

  await refreshStatus(user);
  loadAttendanceHistory(user).catch((error) => console.error(error));
  alert("Break Ended");
};

window.punchIn = async function () {
  await window.startPunchIn();
};

window.punchOut = async function () {
  await window.startPunchOut();
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    await linkUserToEmployee(user);
  } catch (error) {
    console.warn("Employee link skipped:", error.message);
  }

  try {
    await loadEmployeeProfile(user);
    registerAndroidPushToken(user).catch((error) => console.warn("Push token registration skipped:", error.message));
    salarySlipMonth.value ||= getCurrentMonthValue();
  } catch (error) {
    console.error(error);
    greetingTitle.innerText = `${getGreetingText()}, Employee`;
  }

  refreshStatus(user).catch((error) => console.error(error));
  startScheduleWatcher(user);
  loadSmartInsights(user).catch((error) => console.error(error));
  loadUpcomingHolidays().catch((error) => console.error(error));
  loadEmployeeNotifications(user).catch((error) => console.error(error));
  loadEmployeeTasks(user).catch((error) => console.error(error));
  loadEmployeeLeaves(user).catch((error) => console.error(error));
  loadAttendanceHistory(user).catch((error) => console.error(error));
  loadSalarySlipSummary().catch((error) => console.error(error));
});
})().catch((error) => {
  console.error("Employee dashboard failed to load:", error);
});
