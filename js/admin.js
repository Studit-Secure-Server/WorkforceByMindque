(async () => {
const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
const { getAuth, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js");
const {
  getFirestore,
  collection,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  setDoc
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
const payrollCompanyName = "Mindque India Pvt. Ltd.";
const payrollCompanyAddress = "Plot No-211, Ground Floor, District Center Chandrasekharpur, Bhubaneswar-751016, Odisha India";

let today = getDateInputValue(new Date());
const attendancePhotoStore = {};
let latestReportRows = [];
let latestWeeklyRows = [];
let latestMonthlyRows = [];
let latestPayrollRows = [];
let currentSalarySlipKey = "";
const payrollSlipStore = {};
let currentWeekStart = getWeekStart(new Date());
let currentTimesheetMode = "weekly";
let currentTimesheetMonth = getCurrentMonthValue();
let absenceAutomationRunning = false;
let absenceAutomationTimer = null;
let employeeDirectoryStore = {};
let snapshotDetailStore = {};
let editingEmployeeUid = "";
let currentView = "dashboard";
let realtimeUnsubscribers = [];
let realtimeRefreshTimer = null;
const themeToggle = document.getElementById("themeToggle");

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
}

window.toggleTheme = function () {
  const isDark = document.documentElement.classList.contains("theme-dark");
  setTheme(isDark ? "light" : "dark");
};

updateThemeToggle();

const viewMeta = {
  dashboard: {
    title: () => `${getGreetingText()}, Admin`,
    subtitle: "Attendance overview for your in-house team.",
    search: "Search employee..."
  },
  employees: {
    title: "Employees",
    subtitle: "View employee profiles, schedules, and HR details.",
    search: "Search employees..."
  },
  attendance: {
    title: "Attendance",
    subtitle: "Weekly timesheets for the team.",
    search: "Search attendance..."
  },
  payroll: {
    title: "Payroll",
    subtitle: "Calculate monthly salary, approve payroll, and export salary slips.",
    search: "Search payroll..."
  },
  tasks: {
    title: "Tasks",
    subtitle: "Create, assign, and track employee work.",
    search: "Search tasks..."
  },
  reports: {
    title: "Reports",
    subtitle: "Monthly reports, summaries, and exports.",
    search: "Search reports..."
  }
};

function getGreetingText() {
  const hour = new Date().getHours();

  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function refreshToday() {
  today = getDateInputValue(new Date());
  return today;
}

function getWeekStart(date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  return weekStart;
}

function getWeekDates() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + index);
    return date;
  });
}

function getCurrentWeekDates() {
  const weekStart = getWeekStart(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

function formatWeekRange(dates) {
  const start = dates[0];
  const end = dates[6];
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (start.getFullYear() !== end.getFullYear()) {
    return `${startMonth} ${startDay}, ${start.getFullYear()} - ${endMonth} ${endDay}, ${end.getFullYear()}`;
  }

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function setDefaultMonthInputs() {
  const monthValue = getCurrentMonthValue();
  document.getElementById("reportMonth").value ||= monthValue;
  document.getElementById("payrollMonth").value ||= monthValue;
  document.getElementById("monthlyTimesheetMonth").value ||= currentTimesheetMonth;
  document.getElementById("weekDatePicker").value ||= getDateInputValue(currentWeekStart);
}

function updateTimesheetModeUI() {
  const isWeekly = currentTimesheetMode === "weekly";

  document.getElementById("weeklyModeBtn").classList.toggle("active", isWeekly);
  document.getElementById("monthlyModeBtn").classList.toggle("active", !isWeekly);
  document.getElementById("weeklyControls").style.display = isWeekly ? "flex" : "none";
  document.getElementById("monthlyControls").style.display = isWeekly ? "none" : "flex";
  document.getElementById("weeklyTimesheetWrap").classList.toggle("hidden", !isWeekly);
  document.getElementById("monthlyTimesheetWrap").classList.toggle("hidden", isWeekly);
  document.getElementById("timesheetExportBtn").innerText = isWeekly ? "Export Weekly" : "Export Monthly";
}

window.switchTimesheetMode = function (mode) {
  currentTimesheetMode = mode === "monthly" ? "monthly" : "weekly";
  document.getElementById("filterDate").value = "";
  updateTimesheetModeUI();
  loadData();
};

window.changeTimesheetPeriod = function (offset) {
  if (currentTimesheetMode === "monthly") {
    const monthDate = new Date(`${currentTimesheetMonth}-01T00:00:00`);
    monthDate.setMonth(monthDate.getMonth() + offset);
    currentTimesheetMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("monthlyTimesheetMonth").value = currentTimesheetMonth;
  } else {
    currentWeekStart.setDate(currentWeekStart.getDate() + offset * 7);
    document.getElementById("weekDatePicker").value = getDateInputValue(currentWeekStart);
  }

  document.getElementById("filterDate").value = "";
  loadData();
};

window.setTimesheetWeek = function (dateText) {
  if (!dateText) return;

  currentWeekStart = getWeekStart(new Date(dateText + "T00:00:00"));
  document.getElementById("weekDatePicker").value = getDateInputValue(currentWeekStart);
  document.getElementById("filterDate").value = "";
  loadData();
};

window.setTimesheetMonth = function (monthText) {
  if (!monthText) return;

  currentTimesheetMonth = monthText;
  document.getElementById("monthlyTimesheetMonth").value = currentTimesheetMonth;
  document.getElementById("filterDate").value = "";
  loadData();
};

window.openMobileMenu = function () {
  document.body.classList.add("menu-open");
};

window.closeMobileMenu = function () {
  document.body.classList.remove("menu-open");
};

window.toggleMobileMenu = function () {
  document.body.classList.toggle("menu-open");
};

window.switchView = function (viewName) {
  const meta = viewMeta[viewName] || viewMeta.dashboard;
  currentView = viewMeta[viewName] ? viewName : "dashboard";
  window.closeMobileMenu();

  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("active", section.classList.contains(`${viewName}-view`));
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  const navId = `nav${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}`;
  document.getElementById(navId)?.classList.add("active");
  document.getElementById("pageTitle").innerText = typeof meta.title === "function" ? meta.title() : meta.title;
  document.getElementById("pageSubtitle").innerText = meta.subtitle;
  const searchInput = document.getElementById("searchInput");
  const showSearch = currentView !== "dashboard";
  searchInput.style.display = showSearch ? "block" : "none";
  searchInput.placeholder = meta.search;

  if (!showSearch) {
    searchInput.value = "";
  }

  const timesheetSearch = document.getElementById("timesheetSearch");

  if (timesheetSearch) {
    timesheetSearch.value = searchInput.value;
  }

  loadData();
};

window.handleSearch = function () {
  const timesheetSearch = document.getElementById("timesheetSearch");

  if (timesheetSearch) {
    timesheetSearch.value = document.getElementById("searchInput").value;
  }

  loadData();
};

window.syncTimesheetSearch = function (value) {
  document.getElementById("searchInput").value = value;
  loadData();
};

function renderAttendancePhoto(photoUrl, key, label) {
  if (!photoUrl) {
    return "-";
  }

  attendancePhotoStore[key] = photoUrl;

  return `
    <button class="photo-button" type="button" onclick="openAttendancePhoto('${key}', '${label}')">
      <img class="selfie" src="${photoUrl}" alt="${label}">
    </button>
  `;
}

window.openAttendancePhoto = function (key, title) {
  const photoUrl = attendancePhotoStore[key];

  if (!photoUrl) {
    alert("Photo not found");
    return;
  }

  document.getElementById("photoModalTitle").innerText = title;
  document.getElementById("photoModalImage").src = photoUrl;
  document.getElementById("photoModal").classList.add("open");
  document.getElementById("photoModal").setAttribute("aria-hidden", "false");
};

window.closeAttendancePhoto = function () {
  document.getElementById("photoModal").classList.remove("open");
  document.getElementById("photoModal").setAttribute("aria-hidden", "true");
  document.getElementById("photoModalImage").src = "";
};

function scheduleRealtimeRefresh() {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
  }

  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = null;
    window.loadData().catch((error) => {
      console.error("Realtime dashboard refresh failed:", error);
    });
  }, 250);
}

function stopRealtimeDashboard() {
  realtimeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  realtimeUnsubscribers = [];

  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = null;
  }
}

function startRealtimeDashboard() {
  stopRealtimeDashboard();

  ["employees", "attendance", "leaves", "breaks", "payrollStatus", "tasks"].forEach((collectionName) => {
    realtimeUnsubscribers.push(
      onSnapshot(
        collection(db, collectionName),
        scheduleRealtimeRefresh,
        (error) => console.error(`Realtime ${collectionName} listener failed:`, error)
      )
    );
  });

  realtimeUnsubscribers.push(
    onSnapshot(
      collection(db, "holidays"),
      () => {
        window.loadHolidays().catch((error) => {
          console.error("Realtime holidays refresh failed:", error);
        });
      },
      (error) => console.error("Realtime holidays listener failed:", error)
    )
  );

  realtimeUnsubscribers.push(
    onSnapshot(
      collection(db, "notifications"),
      () => {
        window.loadNotifications().catch((error) => {
          console.error("Realtime notifications refresh failed:", error);
        });
      },
      (error) => console.error("Realtime notifications listener failed:", error)
    )
  );

  realtimeUnsubscribers.push(
    onSnapshot(
      collection(db, "officeLocations"),
      () => {
        window.loadOfficeLocations().catch((error) => {
          console.error("Realtime office locations refresh failed:", error);
        });
      },
      (error) => console.error("Realtime office locations listener failed:", error)
    )
  );
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    stopRealtimeDashboard();
    window.location.href = "index.html";
    return;
  }

  const userSnap = await getDoc(doc(db, "employees", user.uid));

  if (!userSnap.exists() || userSnap.data().role !== "admin") {
    alert("Access denied");
    window.location.href = "dashboard.html";
    return;
  }

  setDefaultMonthInputs();
  document.getElementById("pageTitle").innerText = viewMeta.dashboard.title();
  await autoMarkAbsences();
  startAbsenceAutomation();
  loadData();
  loadHolidays();
  loadOfficeLocations();
  loadNotifications();
  startRealtimeDashboard();
});

window.logout = async function () {
  stopRealtimeDashboard();

  if (absenceAutomationTimer) {
    clearInterval(absenceAutomationTimer);
  }
  await signOut(auth);
  window.location.href = "index.html";
};

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const maxSize = 480;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read employee photo"));
    };

    img.src = objectUrl;
  });
}

function setEmployeeFormMode(isEditing) {
  document.getElementById("employeeFormTitle").innerText = isEditing ? "Edit Employee Details" : "Add / Update Employee";
  document.getElementById("employeeSaveBtn").innerText = isEditing ? "Update Employee" : "Save Employee";
  document.getElementById("cancelEmployeeEditBtn").style.display = isEditing ? "inline-flex" : "none";
  document.getElementById("empUID").readOnly = isEditing;
}

function resetEmployeeForm() {
  editingEmployeeUid = "";
  document.getElementById("empName").value = "";
  document.getElementById("empEmail").value = "";
  document.getElementById("empEmployeeId").value = "";
  document.getElementById("empUID").value = "";
  document.getElementById("empRole").value = "employee";
  document.getElementById("empWorkStart").value = "";
  document.getElementById("empWorkEnd").value = "";
  document.getElementById("empWorkLocationName").value = "";
  document.getElementById("empWorkLat").value = "";
  document.getElementById("empWorkLng").value = "";
  document.getElementById("empWorkRadius").value = "";
  document.getElementById("empLeaveAllowance").value = "";
  document.getElementById("empMonthlySalary").value = "";
  document.getElementById("empSalaryBasis").value = "hours";
  document.getElementById("empPhoto").value = "";
  document.getElementById("empPhone").value = "";
  document.getElementById("empEmergency").value = "";
  document.getElementById("empBlood").value = "";
  document.getElementById("empBank").value = "";
  document.getElementById("empIfsc").value = "";
  document.getElementById("empAddress").value = "";
  setEmployeeFormMode(false);
}

window.cancelEmployeeEdit = function () {
  resetEmployeeForm();
};

window.editEmployee = function (uid) {
  const employee = employeeDirectoryStore[uid];

  if (!employee) {
    alert("Employee details not found. Please refresh and try again.");
    return;
  }

  editingEmployeeUid = uid;
  document.getElementById("empName").value = employee.name || "";
  document.getElementById("empEmail").value = employee.email || "";
  document.getElementById("empEmployeeId").value = employee.employeeId || employee.employeeCode || "";
  document.getElementById("empUID").value = employee.uid || uid;
  document.getElementById("empRole").value = employee.role || "employee";
  document.getElementById("empWorkStart").value = employee.workStart || "";
  document.getElementById("empWorkEnd").value = employee.workEnd || "";
  document.getElementById("empWorkLocationName").value = employee.workLocationName || "";
  document.getElementById("empWorkLat").value = employee.workLocationLat ?? "";
  document.getElementById("empWorkLng").value = employee.workLocationLng ?? "";
  document.getElementById("empWorkRadius").value = employee.workLocationRadius ?? "";
  document.getElementById("empLeaveAllowance").value = getLeaveAllowance(employee);
  document.getElementById("empMonthlySalary").value = getMonthlySalary(employee);
  document.getElementById("empSalaryBasis").value = getSalaryBasis(employee);
  document.getElementById("empPhoto").value = "";
  document.getElementById("empPhone").value = employee.phone || "";
  document.getElementById("empEmergency").value = employee.emergencyContact || "";
  document.getElementById("empBlood").value = employee.bloodGroup || "";
  document.getElementById("empBank").value = employee.bankAccount || "";
  document.getElementById("empIfsc").value = employee.ifscCode || "";
  document.getElementById("empAddress").value = employee.currentAddress || "";
  setEmployeeFormMode(true);
  document.getElementById("employeeFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
};

window.addEmployee = async function () {
  const name = document.getElementById("empName").value.trim();
  const email = document.getElementById("empEmail").value.trim();
  const employeeId = document.getElementById("empEmployeeId").value.trim();
  const uid = document.getElementById("empUID").value.trim();
  const role = document.getElementById("empRole").value;
  const workStart = document.getElementById("empWorkStart").value;
  const workEnd = document.getElementById("empWorkEnd").value;
  const workLocationName = document.getElementById("empWorkLocationName").value.trim();
  const workLatInput = document.getElementById("empWorkLat").value.trim();
  const workLngInput = document.getElementById("empWorkLng").value.trim();
  const workRadiusInput = document.getElementById("empWorkRadius").value.trim();
  const leaveAllowanceInput = document.getElementById("empLeaveAllowance").value.trim();
  const monthlySalaryInput = document.getElementById("empMonthlySalary").value.trim();
  const salaryBasis = document.getElementById("empSalaryBasis").value;
  const photoFile = document.getElementById("empPhoto").files[0];
  const phone = document.getElementById("empPhone").value.trim();
  const emergencyContact = document.getElementById("empEmergency").value.trim();
  const bloodGroup = document.getElementById("empBlood").value.trim();
  const bankAccount = document.getElementById("empBank").value.trim();
  const ifscCode = document.getElementById("empIfsc").value.trim();
  const currentAddress = document.getElementById("empAddress").value.trim();

  if (!name || !email || !uid) {
    alert("Please enter employee name, email and Firebase UID");
    return;
  }

  const hasWorkLocationInput = Boolean(workLocationName || workLatInput || workLngInput || workRadiusInput);
  const workLocationLat = Number(workLatInput);
  const workLocationLng = Number(workLngInput);
  const workLocationRadius = Number(workRadiusInput || 100);

  if (hasWorkLocationInput && (!Number.isFinite(workLocationLat) || !Number.isFinite(workLocationLng) || !Number.isFinite(workLocationRadius) || workLocationRadius <= 0)) {
    alert("Please enter valid employee work latitude, longitude and radius");
    return;
  }

  const employeeRef = doc(db, "employees", uid);
  const existingEmployeeSnap = await getDoc(employeeRef);
  const existingEmployee = existingEmployeeSnap.exists() ? existingEmployeeSnap.data() : {};
  const isEditing = editingEmployeeUid === uid && existingEmployeeSnap.exists();
  const leaveAllowance = leaveAllowanceInput
    ? Number(leaveAllowanceInput)
    : Number(isEditing ? 12 : existingEmployee.leaveAllowance ?? existingEmployee.leaveBalance ?? 12);
  const monthlySalary = monthlySalaryInput
    ? Number(monthlySalaryInput)
    : Number(isEditing ? 0 : existingEmployee.monthlySalary ?? existingEmployee.salary ?? 0);
  const savedWorkLocationLat = hasWorkLocationInput
    ? workLocationLat
    : (isEditing ? "" : existingEmployee.workLocationLat ?? "");
  const savedWorkLocationLng = hasWorkLocationInput
    ? workLocationLng
    : (isEditing ? "" : existingEmployee.workLocationLng ?? "");
  const savedWorkLocationRadius = hasWorkLocationInput
    ? workLocationRadius
    : (isEditing ? "" : existingEmployee.workLocationRadius ?? "");
  const employeeData = {
    name,
    email,
    employeeId,
    employeeCode: employeeId,
    role,
    userId: uid,
    workStart: isEditing ? workStart : workStart || existingEmployee.workStart || "",
    workEnd: isEditing ? workEnd : workEnd || existingEmployee.workEnd || "",
    workLocationName: hasWorkLocationInput
      ? workLocationName || "Assigned Work Location"
      : (isEditing ? "" : existingEmployee.workLocationName || ""),
    workLocationLat: savedWorkLocationLat,
    workLocationLng: savedWorkLocationLng,
    workLocationRadius: savedWorkLocationRadius,
    leaveAllowance: Number.isFinite(leaveAllowance) ? leaveAllowance : 12,
    monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : 0,
    salaryBasis: salaryBasis === "days" ? "days" : "hours",
    graceMinutes: existingEmployee.graceMinutes || 30,
    phone: isEditing ? phone : phone || existingEmployee.phone || "",
    emergencyContact: isEditing ? emergencyContact : emergencyContact || existingEmployee.emergencyContact || "",
    bloodGroup: isEditing ? bloodGroup : bloodGroup || existingEmployee.bloodGroup || "",
    bankAccount: isEditing ? bankAccount : bankAccount || existingEmployee.bankAccount || "",
    ifscCode: isEditing ? ifscCode : ifscCode || existingEmployee.ifscCode || "",
    currentAddress: isEditing ? currentAddress : currentAddress || existingEmployee.currentAddress || "",
    updatedAt: new Date().toISOString()
  };

  if (!existingEmployeeSnap.exists()) {
    employeeData.createdDate = getDateInputValue(new Date());
  }

  if (photoFile) {
    employeeData.photo = await imageFileToDataUrl(photoFile);
  }

  await setDoc(employeeRef, employeeData, { merge: true });

  alert(isEditing ? "Employee updated successfully" : "Employee added successfully");

  resetEmployeeForm();

  loadData();
};

window.toggleNotificationEmployee = function () {
  const target = document.getElementById("notificationTarget").value;
  const employeeSelect = document.getElementById("notificationEmployee");
  employeeSelect.disabled = target !== "specific";

  if (target !== "specific") {
    employeeSelect.value = "";
  }
};

function formatDisplayDate(dateText) {
  return new Date(dateText + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

window.addHoliday = async function () {
  const date = document.getElementById("holidayDate").value;
  const name = document.getElementById("holidayName").value.trim();
  const type = document.getElementById("holidayType").value;

  if (!date || !name) {
    alert("Please enter holiday date and name");
    return;
  }

  await setDoc(doc(db, "holidays", date), {
    date,
    name,
    type
  });

  alert("Holiday added successfully");

  document.getElementById("holidayDate").value = "";
  document.getElementById("holidayName").value = "";
  document.getElementById("holidayType").value = "company";

  loadHolidays();
};

window.loadHolidays = async function () {
  const holidaySnap = await getDocs(collection(db, "holidays"));
  const holidayList = document.getElementById("holidayList");
  const holidays = [];

  holidaySnap.forEach((docSnap) => {
    holidays.push(docSnap.data());
  });

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  holidayList.innerHTML = "";

  if (!holidays.length) {
    holidayList.innerHTML = `<div class="holiday-item"><span class="holiday-name">No holidays added yet</span></div>`;
    return;
  }

  holidays.forEach((holiday) => {
    holidayList.innerHTML += `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">${holiday.name}</div>
          <div class="holiday-date">${formatDisplayDate(holiday.date)}</div>
        </div>
        <span class="badge blue">${holiday.type || "company"}</span>
      </div>
    `;
  });
};

function createOfficeId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "office"}-${Date.now()}`;
}

window.addOfficeLocation = async function () {
  const name = document.getElementById("officeName").value.trim();
  const lat = Number(document.getElementById("officeLat").value);
  const lng = Number(document.getElementById("officeLng").value);
  const radius = Number(document.getElementById("officeRadius").value || 100);
  const active = document.getElementById("officeActive").value === "true";

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    alert("Please enter office name, latitude, longitude and valid radius");
    return;
  }

  await setDoc(doc(db, "officeLocations", createOfficeId(name)), {
    name,
    lat,
    lng,
    radius,
    active,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  alert("Office location added successfully");

  document.getElementById("officeName").value = "";
  document.getElementById("officeLat").value = "";
  document.getElementById("officeLng").value = "";
  document.getElementById("officeRadius").value = "100";
  document.getElementById("officeActive").value = "true";

  loadOfficeLocations();
};

window.toggleOfficeLocation = async function (officeId, active) {
  await setDoc(doc(db, "officeLocations", officeId), {
    active,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  loadOfficeLocations();
};

window.loadOfficeLocations = async function () {
  const officeSnap = await getDocs(collection(db, "officeLocations"));
  const officeList = document.getElementById("officeLocationList");
  const offices = [];

  officeSnap.forEach((docSnap) => {
    offices.push({ id: docSnap.id, ...docSnap.data() });
  });

  offices.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  officeList.innerHTML = "";

  if (!offices.length) {
    officeList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">No office locations added yet</div>
          <div class="holiday-date">Employees will use the default office location until you add one here.</div>
        </div>
      </div>
    `;
    return;
  }

  offices.forEach((office) => {
    const active = office.active !== false;
    const lat = Number(office.lat);
    const lng = Number(office.lng);
    const radius = Number(office.radius || 100);

    officeList.innerHTML += `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">${office.name || "Office"}</div>
          <div class="holiday-date">
            ${Number.isFinite(lat) ? lat.toFixed(6) : "-"},
            ${Number.isFinite(lng) ? lng.toFixed(6) : "-"}
            · Radius: ${Number.isFinite(radius) ? radius : 100}m
          </div>
        </div>
        <div class="request-actions">
          <span class="badge ${active ? "green" : "red"}">${active ? "active" : "inactive"}</span>
          <button class="small-btn toggle" type="button" onclick="toggleOfficeLocation('${office.id}', ${!active})">
            ${active ? "Deactivate" : "Activate"}
          </button>
          <a class="small-btn edit" style="text-decoration:none;" target="_blank" href="https://www.google.com/maps?q=${office.lat},${office.lng}">Map</a>
        </div>
      </div>
    `;
  });
};

function renderNotificationEmployeeOptions(employees) {
  const employeeSelect = document.getElementById("notificationEmployee");
  const currentValue = employeeSelect.value;

  employeeSelect.innerHTML = `<option value="">Select Employee</option>`;

  employees
    .filter((employee) => employee.role === "employee")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .forEach((employee) => {
      employeeSelect.innerHTML += `<option value="${employee.uid}" data-email="${employee.email || ""}">${employee.name || employee.email || employee.uid}</option>`;
    });

  employeeSelect.value = currentValue;
}

function renderPayrollEmployeeOptions(employees) {
  const payrollFilter = document.getElementById("payrollEmployeeFilter");
  const payrollSetup = document.getElementById("payrollSetupEmployee");

  if (!payrollFilter || !payrollSetup) return;

  const currentFilter = payrollFilter.value;
  const currentSetup = payrollSetup.value;
  const employeeOptions = employees
    .filter((employee) => (employee.role || "employee") === "employee")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((employee) => `<option value="${employee.uid}">${employee.name || employee.email || employee.uid}</option>`)
    .join("");

  payrollFilter.innerHTML = `<option value="">All Employees</option>${employeeOptions}`;
  payrollSetup.innerHTML = `<option value="">Select Employee</option>${employeeOptions}`;
  payrollFilter.value = currentFilter;
  payrollSetup.value = currentSetup;
}

window.loadPayrollEmployeeSettings = function () {
  const uid = document.getElementById("payrollSetupEmployee").value;
  const employee = employeeDirectoryStore[uid];

  if (!uid || !employee) {
    document.getElementById("payrollSalaryType").value = "hourly";
    document.getElementById("payrollHourlyRate").value = "";
    document.getElementById("payrollMonthlySalary").value = "";
    document.getElementById("payrollDeduction").value = "";
    document.getElementById("payrollLateDeduction").value = "";
    document.getElementById("payrollBonus").value = "";
    document.getElementById("payrollDeductionRules").value = "";
    return;
  }

  const settings = getPayrollSettings(employee);
  document.getElementById("payrollSalaryType").value = settings.salaryType;
  document.getElementById("payrollHourlyRate").value = settings.hourlyRate || "";
  document.getElementById("payrollMonthlySalary").value = settings.monthlySalary || "";
  document.getElementById("payrollDeduction").value = settings.defaultDeduction || "";
  document.getElementById("payrollLateDeduction").value = settings.lateDeductionPerDay || "";
  document.getElementById("payrollBonus").value = settings.bonus || "";
  document.getElementById("payrollDeductionRules").value = settings.deductionRules || "";
};

window.savePayrollSettings = async function () {
  const uid = document.getElementById("payrollSetupEmployee").value;
  const salaryType = document.getElementById("payrollSalaryType").value;
  const hourlyRate = Number(document.getElementById("payrollHourlyRate").value || 0);
  const monthlySalary = Number(document.getElementById("payrollMonthlySalary").value || 0);
  const payrollDeduction = Number(document.getElementById("payrollDeduction").value || 0);
  const lateDeductionPerDay = Number(document.getElementById("payrollLateDeduction").value || 0);
  const payrollBonus = Number(document.getElementById("payrollBonus").value || 0);
  const deductionRules = document.getElementById("payrollDeductionRules").value.trim();

  if (!uid) {
    alert("Please select an employee");
    return;
  }

  if (salaryType === "hourly" && (!Number.isFinite(hourlyRate) || hourlyRate <= 0)) {
    alert("Please enter a valid per hour salary");
    return;
  }

  if (salaryType === "fixed" && (!Number.isFinite(monthlySalary) || monthlySalary <= 0)) {
    alert("Please enter a valid monthly salary");
    return;
  }

  await setDoc(doc(db, "employees", uid), {
    salaryType,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    perHourSalary: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : 0,
    payrollDeduction: Number.isFinite(payrollDeduction) ? payrollDeduction : 0,
    lateDeductionPerDay: Number.isFinite(lateDeductionPerDay) ? lateDeductionPerDay : 0,
    payrollBonus: Number.isFinite(payrollBonus) ? payrollBonus : 0,
    deductionRules,
    salaryBasis: salaryType === "fixed" ? "days" : "hours",
    updatedAt: new Date().toISOString()
  }, { merge: true });

  alert("Salary setup saved");
  loadData();
};

window.addNotification = async function () {
  const title = document.getElementById("notificationTitle").value.trim();
  const message = document.getElementById("notificationMessage").value.trim();
  const target = document.getElementById("notificationTarget").value;
  const employeeUid = document.getElementById("notificationEmployee").value;
  const selectedEmployee = document.getElementById("notificationEmployee").selectedOptions[0];
  const employeeName = selectedEmployee?.textContent || "";
  const employeeEmail = selectedEmployee?.dataset.email || "";

  if (!title || !message) {
    alert("Please enter notification title and message");
    return;
  }

  if (target === "specific" && !employeeUid) {
    alert("Please select an employee");
    return;
  }

  const notificationId = `${Date.now()}`;

  await setDoc(doc(db, "notifications", notificationId), {
    title,
    message,
    targetType: target,
    targetUid: target === "specific" ? employeeUid : "",
    targetEmail: target === "specific" ? employeeEmail : "",
    targetName: target === "specific" ? employeeName : "All Employees",
    createdAt: new Date().toISOString()
  });

  alert("Notification sent successfully");

  document.getElementById("notificationTitle").value = "";
  document.getElementById("notificationMessage").value = "";
  document.getElementById("notificationTarget").value = "all";
  document.getElementById("notificationEmployee").value = "";
  toggleNotificationEmployee();
  loadNotifications();
};

window.loadNotifications = async function () {
  const notificationSnap = await getDocs(collection(db, "notifications"));
  const notificationList = document.getElementById("notificationList");
  const notifications = [];

  notificationSnap.forEach((docSnap) => {
    notifications.push(docSnap.data());
  });

  notifications.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  notificationList.innerHTML = "";

  if (!notifications.length) {
    notificationList.innerHTML = `<div class="holiday-item"><span class="holiday-name">No notifications sent yet</span></div>`;
    return;
  }

  notifications.slice(0, 8).forEach((notification) => {
    const createdDate = notification.createdAt
      ? new Date(notification.createdAt).toLocaleString()
      : "-";

    notificationList.innerHTML += `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">${notification.title}</div>
          <div class="holiday-date">To: ${notification.targetName || "All Employees"} · ${createdDate}</div>
          <div class="notification-message">${notification.message}</div>
        </div>
        <span class="badge blue">${notification.targetType || "all"}</span>
      </div>
    `;
  });
};

function getDatesFromMonthStart() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const dates = [];

  for (const date = new Date(start); date <= now; date.setDate(date.getDate() + 1)) {
    dates.push(getDateInputValue(date));
  }

  return dates;
}

function getEmployeeAbsenceCutoff(employee, dateText) {
  if (employee.workEnd) {
    const end = new Date(`${dateText}T${employee.workEnd}:00`);

    if (employee.workStart) {
      const start = new Date(`${dateText}T${employee.workStart}:00`);

      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }
    }

    const graceMinutes = Number(employee.graceMinutes) || 30;
    end.setMinutes(end.getMinutes() + graceMinutes);
    return end;
  }

  return new Date(`${dateText}T23:59:59`);
}

function shouldSkipAbsenceDate(dateText, holidaySet) {
  const date = new Date(`${dateText}T00:00:00`);
  const isSunday = date.getDay() === 0;
  return isSunday || holidaySet.has(dateText);
}

function isBeforeEmployeeCreated(employee, dateText) {
  const createdDate = employee.createdDate || (employee.createdAt ? String(employee.createdAt).split("T")[0] : "");
  return Boolean(createdDate) && dateText < createdDate;
}

function getDateRange(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) {
    return [];
  }

  const dates = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (current <= end) {
    dates.push(getDateInputValue(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function autoMarkAbsences() {
  if (absenceAutomationRunning) {
    return false;
  }

  absenceAutomationRunning = true;

  try {
    const employeeSnap = await getDocs(collection(db, "employees"));
    const attendanceSnap = await getDocs(collection(db, "attendance"));
    const holidaySnap = await getDocs(collection(db, "holidays"));
    const leaveSnap = await getDocs(collection(db, "leaves"));
    const employees = [];
    const attendanceKeys = new Set();
    const holidaySet = new Set();
    const approvedLeaveKeys = new Set();
    const datesToCheck = getDatesFromMonthStart();
    const now = new Date();
    const writes = [];

    employeeSnap.forEach((docSnap) => {
      const data = docSnap.data();

      if ((data.role || "employee") === "employee") {
        employees.push({ uid: docSnap.id, ...data });
      }
    });

    attendanceSnap.forEach((docSnap) => {
      const data = docSnap.data();
      attendanceKeys.add(`${data.userId}_${data.date}`);
    });

    holidaySnap.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.date) {
        holidaySet.add(data.date);
      }
    });

    leaveSnap.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.status === "approved") {
        getDateRange(data.startDate, data.endDate).forEach((dateText) => {
          approvedLeaveKeys.add(`${data.userId}_${dateText}`);
        });
      }
    });

    employees.forEach((employee) => {
      datesToCheck.forEach((dateText) => {
        const key = `${employee.uid}_${dateText}`;

        if (
          attendanceKeys.has(key) ||
          approvedLeaveKeys.has(key) ||
          shouldSkipAbsenceDate(dateText, holidaySet) ||
          isBeforeEmployeeCreated(employee, dateText)
        ) {
          return;
        }

        if (now < getEmployeeAbsenceCutoff(employee, dateText)) {
          return;
        }

        writes.push(setDoc(doc(db, "attendance", `absent_${employee.uid}_${dateText}`), {
          userId: employee.uid,
          employeeName: employee.name || "",
          date: dateText,
          status: "absent",
          absent: true,
          autoMarked: true,
          totalHours: "0h 0m",
          punchIn: null,
          punchOut: null,
          markedAt: new Date().toISOString()
        }));
      });
    });

    if (writes.length) {
      await Promise.all(writes);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Auto absent check failed:", error);
    return false;
  } finally {
    absenceAutomationRunning = false;
  }
}

function startAbsenceAutomation() {
  if (absenceAutomationTimer) {
    clearInterval(absenceAutomationTimer);
  }

  absenceAutomationTimer = setInterval(async () => {
    const changed = await autoMarkAbsences();

    if (changed) {
      loadData();
    }
  }, 60000);
}

function getStatusClass(status) {
  if (status === "completed") return "green";
  if (status === "working") return "blue";
  if (status === "break") return "yellow";
  if (status === "absent") return "red";
  return "red";
}

function formatTimeValue(timeText) {
  if (!timeText) return "--";

  return new Date(`${today}T${timeText}:00`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatWorkHours(employee) {
  if (!employee.workStart || !employee.workEnd) {
    return "--";
  }

  return `${formatTimeValue(employee.workStart)} - ${formatTimeValue(employee.workEnd)}`;
}

function formatEmployeeWorkLocation(employee) {
  const lat = Number(employee.workLocationLat);
  const lng = Number(employee.workLocationLng);
  const radius = Number(employee.workLocationRadius || 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return `<span class="table-badge blue">Default Office</span>`;
  }

  return `
    <div class="work-location-cell">
    <div class="work-location-name">${employee.workLocationName || "Assigned Work Location"}</div>
    <div class="holiday-date">${lat.toFixed(6)}, ${lng.toFixed(6)} · ${Number.isFinite(radius) ? radius : 100}m</div>
    </div>
  `;
}

function durationToMinutes(durationText) {
  if (!durationText) return 0;

  const hoursMatch = String(durationText).match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = String(durationText).match(/(\d+)\s*m/);

  if (hoursMatch || minutesMatch) {
    return Math.round((Number(hoursMatch?.[1] || 0) * 60) + Number(minutesMatch?.[1] || 0));
  }

  const decimalHours = Number(durationText);
  return Number.isFinite(decimalHours) ? Math.round(decimalHours * 60) : 0;
}

function formatMinutes(totalMinutes) {
  const safeMinutes = Math.max(totalMinutes, 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Math.max(Number(amount) || 0, 0));
}

function getMonthlySalary(employee) {
  const salary = Number(employee?.monthlySalary ?? employee?.salary ?? 0);
  return Number.isFinite(salary) && salary > 0 ? salary : 0;
}

function getSalaryBasis(employee) {
  return employee?.salaryBasis === "days" ? "days" : "hours";
}

function formatSalaryBasis(employee) {
  return getSalaryBasis(employee) === "days" ? "By Days" : "By Hours";
}

function getTimeMinutes(timeText) {
  if (!timeText) return null;

  const [hours, minutes] = timeText.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function getExpectedDailyMinutes(employee) {
  const start = getTimeMinutes(employee?.workStart);
  const end = getTimeMinutes(employee?.workEnd);

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

function calculateMonthlyPayroll(employee, records, reportMonth, presentDays, workedMinutes) {
  const monthlySalary = getMonthlySalary(employee);
  const salaryBasis = getSalaryBasis(employee);
  const workingDays = countWorkingDaysInMonth(reportMonth);
  const expectedDailyMinutes = getExpectedDailyMinutes(employee);
  const expectedMonthlyHours = (workingDays * expectedDailyMinutes) / 60;
  const workedHours = workedMinutes / 60;
  const hourlyRate = expectedMonthlyHours ? monthlySalary / expectedMonthlyHours : 0;
  const dailyRate = workingDays ? monthlySalary / workingDays : 0;
  const payoutByHours = hourlyRate * workedHours;
  const payoutByDays = dailyRate * presentDays;
  const payout = salaryBasis === "days" ? payoutByDays : payoutByHours;

  return {
    monthlySalary,
    salaryBasis,
    workingDays,
    presentDays,
    workedHours,
    hourlyRate,
    dailyRate,
    payoutByHours,
    payoutByDays,
    payout
  };
}

function getPayrollSettings(employee) {
  const monthlySalary = getMonthlySalary(employee);
  const salaryType = employee?.salaryType === "fixed" ? "fixed" : "hourly";
  const hourlyRate = Number(employee?.hourlyRate ?? employee?.perHourSalary ?? 0);
  const defaultDeduction = Number(employee?.payrollDeduction ?? employee?.deduction ?? 0);
  const lateDeductionPerDay = Number(employee?.lateDeductionPerDay ?? 0);
  const bonus = Number(employee?.payrollBonus ?? employee?.bonus ?? 0);

  return {
    salaryType,
    hourlyRate: Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : 0,
    monthlySalary,
    defaultDeduction: Number.isFinite(defaultDeduction) && defaultDeduction > 0 ? defaultDeduction : 0,
    lateDeductionPerDay: Number.isFinite(lateDeductionPerDay) && lateDeductionPerDay > 0 ? lateDeductionPerDay : 0,
    bonus: Number.isFinite(bonus) && bonus > 0 ? bonus : 0,
    deductionRules: employee?.deductionRules || ""
  };
}

function getTimestampDate(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRawRecordMinutes(record) {
  const punchIn = getTimestampDate(record.punchIn);
  const punchOut = getTimestampDate(record.punchOut);

  if (!punchIn || !punchOut) {
    return 0;
  }

  return Math.max(Math.round((punchOut - punchIn) / 60000), 0);
}

function getMonthlyBreakMinutes(uid, monthValue, breaks) {
  return breaks
    .filter((item) => item.userId === uid && String(item.date || "").startsWith(monthValue))
    .reduce((sum, item) => {
      const start = getTimestampDate(item.breakStart);
      const end = getTimestampDate(item.breakEnd);

      if (!start || !end) return sum;
      return sum + Math.max(Math.round((end - start) / 60000), 0);
    }, 0);
}

function countLateDays(employee, records) {
  const workStart = getTimeMinutes(employee.workStart);

  if (workStart === null) return 0;

  const lateDates = new Set();

  records.forEach((record) => {
    if (record.status === "absent") return;

    const punchIn = getTimestampDate(record.punchIn);
    if (!punchIn) return;

    const punchMinutes = (punchIn.getHours() * 60) + punchIn.getMinutes();
    if (punchMinutes > workStart) {
      lateDates.add(record.date);
    }
  });

  return lateDates.size;
}

function getPayrollDocId(uid, monthValue) {
  return `${uid}_${monthValue}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getPayrollStatusClass(status) {
  if (status === "Paid") return "green";
  if (status === "Approved") return "blue";
  if (status === "Calculated") return "yellow";
  return "red";
}

function getTodayEmployeeRecord(uid, attendanceRecords, dateText) {
  return attendanceRecords
    .filter((record) => record.userId === uid && record.date === dateText)
    .sort((a, b) => {
      const first = getTimestampDate(a.punchIn)?.getTime() || 0;
      const second = getTimestampDate(b.punchIn)?.getTime() || 0;
      return second - first;
    })[0] || null;
}

function formatSnapshotTime(timestamp) {
  const date = getTimestampDate(timestamp);

  if (!date) {
    return "-";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getSnapshotBadgeClass(record, statusText) {
  if (record?.status) {
    return getStatusClass(record.status);
  }

  if (statusText === "present") return "green";
  if (statusText === "break") return "yellow";
  if (statusText === "absent") return "red";
  return "blue";
}

function buildSnapshotEmployeeRow(employee, record, statusText) {
  const workHours = formatWorkHours(employee);
  const punchIn = record ? formatSnapshotTime(record.punchIn) : "-";
  const punchOut = record ? formatSnapshotTime(record.punchOut) : "-";
  const totalHours = record?.totalHours || "-";

  return {
    name: getEmployeeDisplayName(employee),
    badge: record?.status || statusText || employee.role || "employee",
    badgeClass: getSnapshotBadgeClass(record, statusText),
    meta: [
      employee.email || "No email",
      `Work hours: ${workHours}`,
      `Punch in: ${punchIn}`,
      `Punch out: ${punchOut}`,
      `Total: ${totalHours}`
    ].join(" · ")
  };
}

function updateSnapshotDetails({ employees, employeeById, attendanceRecords, presentTodayUsers, breakTodayUsers, employeeIds, todayText }) {
  const employeeList = employees
    .filter((employee) => (employee.role || "employee") === "employee")
    .sort((a, b) => getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b)));
  const expectedEmployees = employeeList.filter((employee) => employeeIds.has(employee.uid));
  const presentEmployees = expectedEmployees.filter((employee) => presentTodayUsers.has(employee.uid));
  const absentEmployees = expectedEmployees.filter((employee) => !presentTodayUsers.has(employee.uid));
  const breakEmployees = expectedEmployees.filter((employee) => breakTodayUsers.has(employee.uid));
  const makeRows = (items, fallbackStatus) => items.map((employee) => {
    const record = getTodayEmployeeRecord(employee.uid, attendanceRecords, todayText);
    return buildSnapshotEmployeeRow(employeeById[employee.uid] || employee, record, fallbackStatus);
  });

  snapshotDetailStore = {
    total: {
      title: "Total Employees",
      subtitle: `${employeeList.length} employees in the company directory.`,
      empty: "No employees found.",
      rows: makeRows(employeeList, "employee")
    },
    present: {
      title: "Present Today",
      subtitle: `${presentEmployees.length} employees punched in today.`,
      empty: "No employees have punched in today.",
      rows: makeRows(presentEmployees, "present")
    },
    absent: {
      title: "Absent Today",
      subtitle: `${absentEmployees.length} expected employees have not punched in today.`,
      empty: "No absent employees today.",
      rows: makeRows(absentEmployees, "absent")
    },
    break: {
      title: "Employees On Break",
      subtitle: `${breakEmployees.length} employees are currently on break.`,
      empty: "No employees are on break right now.",
      rows: makeRows(breakEmployees, "break")
    }
  };
}

window.openSnapshotDetails = function (type) {
  const details = snapshotDetailStore[type];
  const modal = document.getElementById("snapshotDetailModal");
  const title = document.getElementById("snapshotDetailTitle");
  const subtitle = document.getElementById("snapshotDetailSubtitle");
  const list = document.getElementById("snapshotDetailList");

  if (!details || !modal || !title || !subtitle || !list) {
    return;
  }

  title.innerText = details.title;
  subtitle.innerText = details.subtitle;
  list.innerHTML = details.rows.length
    ? details.rows.map((row) => `
      <div class="snapshot-detail-item">
        <div>
          <div class="snapshot-detail-name">${escapeHtml(row.name)}</div>
          <div class="snapshot-detail-meta">${escapeHtml(row.meta)}</div>
        </div>
        <span class="status ${row.badgeClass}">${escapeHtml(row.badge)}</span>
      </div>
    `).join("")
    : `<div class="snapshot-detail-item"><div class="snapshot-detail-name">${escapeHtml(details.empty)}</div></div>`;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
};

window.closeSnapshotDetails = function () {
  const modal = document.getElementById("snapshotDetailModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
};

window.handleSnapshotCardKey = function (event, type) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    window.openSnapshotDetails(type);
  }
};

function calculatePayrollRow(employee, attendanceRecords, breaks, statusMap, monthValue) {
  const records = attendanceRecords.filter((record) => record.userId === employee.uid && String(record.date || "").startsWith(monthValue));
  const settings = getPayrollSettings(employee);
  const totalDays = countWorkingDaysInMonth(monthValue);
  const presentDays = new Set(records.filter((record) => record.status !== "absent").map((record) => record.date)).size;
  const absentRecords = records.filter((record) => record.status === "absent").length;
  const absentDays = Math.max(totalDays - presentDays, absentRecords, 0);
  const breakMinutes = getMonthlyBreakMinutes(employee.uid, monthValue, breaks);
  let rawMinutes = 0;
  let fallbackMinutes = 0;

  records.forEach((record) => {
    if (record.status === "absent") return;

    const minutes = getRawRecordMinutes(record);

    if (minutes) {
      rawMinutes += minutes;
    } else {
      fallbackMinutes += getRecordMinutes(record);
    }
  });

  const workedMinutes = Math.max(rawMinutes - breakMinutes, 0) + fallbackMinutes;
  const workedHours = workedMinutes / 60;
  const expectedMonthlyHours = (totalDays * getExpectedDailyMinutes(employee)) / 60;
  const computedHourlyRate = expectedMonthlyHours ? settings.monthlySalary / expectedMonthlyHours : 0;
  const hourlyRate = settings.hourlyRate || computedHourlyRate;
  const dailyRate = totalDays ? settings.monthlySalary / totalDays : 0;
  const lateDays = countLateDays(employee, records);
  const lateDeduction = lateDays * settings.lateDeductionPerDay;
  const absentDeduction = settings.salaryType === "fixed" ? absentDays * dailyRate : 0;
  const grossSalary = settings.salaryType === "fixed" ? settings.monthlySalary : workedHours * hourlyRate;
  const totalDeduction = settings.defaultDeduction + lateDeduction + absentDeduction;
  const netSalary = Math.max(grossSalary + settings.bonus - totalDeduction, 0);
  const statusRecord = statusMap[getPayrollDocId(employee.uid, monthValue)] || {};
  const hasSalarySetup = Boolean(settings.hourlyRate || settings.monthlySalary);
  const status = statusRecord.status || (hasSalarySetup ? "Calculated" : "Draft");

  return {
    key: getPayrollDocId(employee.uid, monthValue),
    uid: employee.uid,
    employeeId: employee.employeeId || employee.employeeCode || employee.uid,
    employeeName: employee.name || employee.email || employee.uid,
    employeeEmail: employee.email || "-",
    month: monthValue,
    salaryType: settings.salaryType,
    totalDays,
    presentDays,
    absentDays,
    workedMinutes,
    breakMinutes,
    lateDays,
    hourlyRate,
    grossSalary,
    bonus: settings.bonus,
    defaultDeduction: settings.defaultDeduction,
    lateDeduction,
    absentDeduction,
    totalDeduction,
    netSalary,
    status,
    deductionRules: settings.deductionRules
  };
}

function getSearchText() {
  return document.getElementById("searchInput").value.trim().toLowerCase();
}

function matchesEmployeeSearch(employee, searchText) {
  if (!searchText) return true;

  return [
    employee.employeeId,
    employee.employeeCode,
    employee.name,
    employee.email,
    employee.role,
    employee.phone,
    employee.uid
  ].some((value) => String(value || "").toLowerCase().includes(searchText));
}

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

  const todayText = getDateInputValue(new Date());

  if (deadline < todayText) {
    return {
      className: "overdue",
      label: `Overdue · ${formatDisplayDate(deadline)}`
    };
  }

  if (deadline === todayText) {
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

function matchesTaskSearch(task, employeesByUid, searchText) {
  if (!searchText) return true;

  const assignee = employeesByUid[task.assignedTo] || {};

  return [
    task.title,
    task.description,
    task.priority,
    getTaskStatusLabel(task.status),
    task.deadline,
    assignee.name,
    assignee.email,
    assignee.employeeId,
    assignee.employeeCode
  ].some((value) => String(value || "").toLowerCase().includes(searchText));
}

function renderTaskAssigneeOptions(employees) {
  const taskAssignee = document.getElementById("taskAssignee");

  if (!taskAssignee) return;

  const currentValue = taskAssignee.value;
  const options = employees
    .filter((employee) => (employee.role || "employee") === "employee")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((employee) => `<option value="${employee.uid}">${escapeHtml(employee.name || employee.email || employee.uid)}</option>`)
    .join("");

  taskAssignee.innerHTML = `<option value="">Assign To</option>${options}`;

  if ([...taskAssignee.options].some((option) => option.value === currentValue)) {
    taskAssignee.value = currentValue;
  }
}

function renderTaskCard(task, employeesByUid) {
  const assignee = employeesByUid[task.assignedTo] || {};
  const status = normalizeTaskStatus(task.status);
  const deadline = getTaskDeadlineState(task.deadline, status);
  const priority = task.priority || "Medium";

  return `
    <div class="task-card">
      <div class="task-title">${escapeHtml(task.title || "Untitled Task")}</div>
      <div class="task-description">${escapeHtml(task.description || "No description added.")}</div>
      <div class="task-meta">
        <span class="priority-badge ${getTaskPriorityClass(priority)}">${escapeHtml(priority)}</span>
        <span class="deadline-badge ${deadline.className}">${escapeHtml(deadline.label)}</span>
      </div>
      <div class="task-assignee">Assigned to: ${escapeHtml(assignee.name || assignee.email || "Unknown")}</div>
      <select class="task-status-select" onchange="updateTaskStatus('${task.id}', this.value)">
        <option value="todo" ${status === "todo" ? "selected" : ""}>To Do</option>
        <option value="in-progress" ${status === "in-progress" ? "selected" : ""}>In Progress</option>
        <option value="completed" ${status === "completed" ? "selected" : ""}>Completed</option>
      </select>
    </div>
  `;
}

function renderTasks(employees, tasks) {
  const taskBoard = document.getElementById("taskBoard");

  if (!taskBoard) return;

  const employeesByUid = Object.fromEntries(employees.map((employee) => [employee.uid, employee]));
  const searchText = currentView === "tasks" ? getSearchText() : "";
  const visibleTasks = tasks
    .filter((task) => matchesTaskSearch(task, employeesByUid, searchText))
    .sort((a, b) => String(a.deadline || "9999-12-31").localeCompare(String(b.deadline || "9999-12-31")));
  const columns = [
    { status: "todo", title: "To Do" },
    { status: "in-progress", title: "In Progress" },
    { status: "completed", title: "Completed" }
  ];

  taskBoard.innerHTML = columns.map((column) => {
    const columnTasks = visibleTasks.filter((task) => normalizeTaskStatus(task.status) === column.status);
    const cards = columnTasks.length
      ? columnTasks.map((task) => renderTaskCard(task, employeesByUid)).join("")
      : `<div class="task-empty">No ${column.title.toLowerCase()} tasks</div>`;

    return `
      <div class="task-column">
        <div class="task-column-head">
          <div class="task-column-title">${column.title}</div>
          <span class="task-count">${columnTasks.length}</span>
        </div>
        <div class="task-list">${cards}</div>
      </div>
    `;
  }).join("");
}

window.createTask = async function () {
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const assignedTo = document.getElementById("taskAssignee").value;
  const deadline = document.getElementById("taskDeadline").value;
  const priority = document.getElementById("taskPriority").value;

  if (!title || !assignedTo || !deadline) {
    alert("Please add title, employee, and deadline");
    return;
  }

  const assignee = employeeDirectoryStore[assignedTo] || {};
  const taskRef = doc(collection(db, "tasks"));
  const nowIso = new Date().toISOString();

  await setDoc(taskRef, {
    title,
    description,
    assignedTo,
    assignedToName: assignee.name || "",
    assignedToEmail: assignee.email || "",
    status: "todo",
    priority,
    deadline,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: auth.currentUser?.uid || "",
    activityLog: [{
      action: "created",
      at: nowIso,
      text: `Task created for ${assignee.name || assignee.email || assignedTo}`
    }]
  });

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDescription").value = "";
  document.getElementById("taskAssignee").value = "";
  document.getElementById("taskDeadline").value = "";
  document.getElementById("taskPriority").value = "Medium";

  alert("Task created successfully");
  loadData();
};

window.updateTaskStatus = async function (taskId, status) {
  const normalizedStatus = normalizeTaskStatus(status);
  const nowIso = new Date().toISOString();

  await setDoc(doc(db, "tasks", taskId), {
    status: normalizedStatus,
    updatedAt: nowIso,
    completedAt: normalizedStatus === "completed" ? nowIso : "",
    lastActivity: {
      action: "status-updated",
      at: nowIso,
      text: `Status changed to ${getTaskStatusLabel(normalizedStatus)}`
    }
  }, { merge: true });

  loadData();
};

function getLeaveAllowance(employee) {
  const allowance = Number(employee?.leaveAllowance ?? employee?.leaveBalance);
  return Number.isFinite(allowance) && allowance >= 0 ? allowance : 12;
}

function getApprovedLeaveDays(leaves, uid, excludeLeaveId = "") {
  return leaves
    .filter((leave) => leave.userId === uid && leave.status === "approved" && leave.id !== excludeLeaveId)
    .reduce((sum, leave) => sum + Number(leave.days || 0), 0);
}

function getLeaveBalance(employee, leaves, excludeLeaveId = "") {
  return Math.max(getLeaveAllowance(employee) - getApprovedLeaveDays(leaves, employee.uid, excludeLeaveId), 0);
}

function findLeaveForDate(leaves, uid, dateText) {
  return leaves.find((leave) => {
    if (leave.userId !== uid || leave.status === "rejected") {
      return false;
    }

    return dateText >= leave.startDate && dateText <= leave.endDate;
  });
}

function renderEmployeeDirectory(employees, leaves = []) {
  const tableBody = document.getElementById("employeeTableBody");
  const searchText = getSearchText();
  employeeDirectoryStore = {};
  employees.forEach((employee) => {
    employeeDirectoryStore[employee.uid] = employee;
  });
  const visibleEmployees = employees
    .filter((employee) => matchesEmployeeSearch(employee, searchText))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  tableBody.innerHTML = "";

  if (!visibleEmployees.length) {
    tableBody.innerHTML = `<tr><td colspan="18">No employees found</td></tr>`;
    return;
  }

  visibleEmployees.forEach((employee) => {
    const balance = getLeaveBalance(employee, leaves);
    const allowance = getLeaveAllowance(employee);

    tableBody.innerHTML += `
      <tr>
        <td><img class="employee-photo ${employee.photo ? "" : "default-logo-photo"}" src="${employee.photo || "assets/mindque-logo-light.png"}" alt="${employee.name || "Employee"}"></td>
        <td><strong>${employee.employeeId || employee.employeeCode || "-"}</strong></td>
        <td><strong>${employee.name || "-"}</strong></td>
        <td>${employee.email || "-"}</td>
        <td><span class="status ${employee.role === "admin" ? "blue" : "green"}">${employee.role || "employee"}</span></td>
        <td>${formatWorkHours(employee)}</td>
        <td>${formatEmployeeWorkLocation(employee)}</td>
        <td><strong>${balance}</strong> / ${allowance}</td>
        <td>${formatCurrency(getMonthlySalary(employee))}</td>
        <td><span class="table-badge blue">${formatSalaryBasis(employee)}</span></td>
        <td>${employee.phone || "-"}</td>
        <td>${employee.emergencyContact || "-"}</td>
        <td>${employee.bloodGroup || "-"}</td>
        <td>${employee.bankAccount || "-"}</td>
        <td>${employee.ifscCode || "-"}</td>
        <td>${employee.currentAddress || "-"}</td>
        <td><button class="small-btn edit" type="button" onclick="editEmployee('${employee.uid}')">Edit</button></td>
        <td>${employee.uid}</td>
      </tr>
    `;
  });
}

function renderLeaveRequests(leaves, employees) {
  const leaveList = document.getElementById("adminLeaveList");
  const employeeMap = {};

  employees.forEach((employee) => {
    employeeMap[employee.uid] = employee;
  });

  const sortedLeaves = [...leaves].sort((a, b) => {
    const statusOrder = { pending: 0, approved: 1, rejected: 2 };
    const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);

    if (statusDiff) return statusDiff;
    return (b.appliedAt || "").localeCompare(a.appliedAt || "");
  });

  leaveList.innerHTML = "";

  if (!sortedLeaves.length) {
    leaveList.innerHTML = `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">No leave requests yet</div>
          <div class="holiday-date">Employee leave requests will appear here.</div>
        </div>
      </div>
    `;
    return;
  }

  sortedLeaves.slice(0, 12).forEach((leave) => {
    const employee = employeeMap[leave.userId] || {};
    const balance = employee.uid ? getLeaveBalance(employee, leaves, leave.id) : 0;
    const statusClass =
      leave.status === "approved" ? "green" :
      leave.status === "rejected" ? "red" : "yellow";

    leaveList.innerHTML += `
      <div class="holiday-item">
        <div>
          <div class="holiday-name">${leave.employeeName || employee.name || "Employee"} · ${leave.leaveType || "Leave"}</div>
          <div class="holiday-date">${formatDisplayDate(leave.startDate)} - ${formatDisplayDate(leave.endDate)} · ${leave.days || 0} day(s) · Balance: ${balance}</div>
          <div class="notification-message">${leave.reason || ""}</div>
        </div>
        <div class="request-actions">
          <span class="badge ${statusClass}">${leave.status || "pending"}</span>
          ${leave.status === "pending" ? `
            <button class="small-btn approve" type="button" onclick="reviewLeave('${leave.id}', 'approved')">Approve</button>
            <button class="small-btn reject" type="button" onclick="reviewLeave('${leave.id}', 'rejected')">Reject</button>
          ` : ""}
        </div>
      </div>
    `;
  });
}

window.reviewLeave = async function (leaveId, status) {
  const leaveRef = doc(db, "leaves", leaveId);
  const leaveSnap = await getDoc(leaveRef);

  if (!leaveSnap.exists()) {
    alert("Leave request not found");
    return;
  }

  const leave = { id: leaveId, ...leaveSnap.data() };

  if (status === "approved") {
    const employeeSnap = await getDoc(doc(db, "employees", leave.userId));
    const leaveSnapAll = await getDocs(collection(db, "leaves"));
    const leaves = [];

    leaveSnapAll.forEach((docSnap) => {
      leaves.push({ id: docSnap.id, ...docSnap.data() });
    });

    const employee = employeeSnap.exists()
      ? { uid: leave.userId, ...employeeSnap.data() }
      : { uid: leave.userId, leaveAllowance: 12 };
    const balance = getLeaveBalance(employee, leaves, leaveId);

    if (Number(leave.days || 0) > balance) {
      alert("Insufficient leave balance");
      return;
    }
  }

  await setDoc(leaveRef, {
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: auth.currentUser?.email || "admin"
  }, { merge: true });

  alert(`Leave ${status}`);
  loadData();
};

window.selectAttendanceDate = function (dateText) {
  document.getElementById("filterDate").value = dateText;
  switchView("attendance");
};

window.clearAttendanceDate = function () {
  document.getElementById("filterDate").value = "";
  loadData();
};

function getEmployeeInitial(employee) {
  return String(employee.name || employee.email || "E").trim().charAt(0).toUpperCase();
}

function getRecordMinutes(record) {
  const savedMinutes = durationToMinutes(record.totalHours);

  if (savedMinutes) {
    return savedMinutes;
  }

  if (record.punchIn && record.punchOut) {
    return Math.max(Math.round((record.punchOut.toDate() - record.punchIn.toDate()) / 60000), 0);
  }

  return 0;
}

function formatRecordTime(timestamp) {
  if (!timestamp) return "-";

  return timestamp.toDate().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderWeeklyTimesheet(employees, attendanceRecords, leaves = []) {
  const weekDates = getWeekDates();
  const weekDateTexts = weekDates.map(getDateInputValue);
  const searchText = getSearchText();
  const weeklyBody = document.getElementById("weeklyTimesheetBody");
  const employeesToShow = employees
    .filter((employee) => employee.role === "employee")
    .filter((employee) => matchesEmployeeSearch(employee, searchText))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  document.getElementById("weekRangeLabel").innerText = formatWeekRange(weekDates);
  document.getElementById("weekDatePicker").value = getDateInputValue(currentWeekStart);
  latestWeeklyRows = [];

  weekDates.forEach((date, index) => {
    const dateText = getDateInputValue(date);
    const isToday = dateText === today;
    const dayLetter = date.toLocaleDateString(undefined, { weekday: "short" }).charAt(0);
    const dayNumber = date.getDate();
    const header = document.getElementById(`weekDay${index}`);

    header.className = `day-head${isToday ? " today" : ""}`;
    header.innerHTML = `
      <span class="day-letter">${dayLetter}</span>
      <span class="day-number">${dayNumber}</span>
    `;
  });

  weeklyBody.innerHTML = "";

  if (!employeesToShow.length) {
    weeklyBody.innerHTML = `<tr><td colspan="9" style="padding:28px;text-align:left;">No employees found</td></tr>`;
    return;
  }

  employeesToShow.forEach((employee) => {
    let totalMinutes = 0;
    const rowData = {
      Employee: employee.name || "-",
      Email: employee.email || "-"
    };

    const dayCells = weekDateTexts.map((dateText, index) => {
      const dayRecords = attendanceRecords.filter((record) => record.userId === employee.uid && record.date === dateText);
      const record = dayRecords[0];
      const leave = findLeaveForDate(leaves, employee.uid, dateText);
      const isSunday = weekDates[index].getDay() === 0;
      const isSelected = document.getElementById("filterDate").value === dateText;

      if (!record) {
        if (leave) {
          const leaveLabel = leave.status === "approved" ? "Leave" : "Pending";
          rowData[dateText] = leaveLabel;
          return `
            <td class="timesheet-cell${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${dateText}')">
              <span class="rest-pill">${leaveLabel}</span>
            </td>
          `;
        }

        rowData[dateText] = isSunday ? "Rest day" : "-";
        return `
          <td class="timesheet-cell${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${dateText}')">
            ${isSunday ? `<span class="rest-pill">Rest day</span>` : "-"}
          </td>
        `;
      }

      const minutes = dayRecords.reduce((sum, item) => sum + getRecordMinutes(item), 0);
      totalMinutes += minutes;
      const displayHours = minutes ? formatMinutes(minutes) : (record.status || "-");
      const firstIn = formatRecordTime(record.punchIn);
      const lastOut = formatRecordTime(record.punchOut);
      const warnClass = record.status === "missed-punch-out" || record.status === "absent" ? " warn" : "";

      rowData[dateText] = displayHours;

      return `
        <td class="timesheet-cell has-time${warnClass}${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${dateText}')">
          ${displayHours}
          <div class="timesheet-popover">
            <div class="popover-row"><span>First in</span><strong>${firstIn}</strong></div>
            <div class="popover-row"><span>Last out</span><strong>${lastOut}</strong></div>
            <div class="popover-rule"></div>
            <div class="popover-row"><span>${record.status || "Regular"}</span><strong>${displayHours}</strong></div>
          </div>
        </td>
      `;
    }).join("");

    const totalText = totalMinutes ? formatMinutes(totalMinutes) : "-";
    rowData.Total = totalText;
    latestWeeklyRows.push(rowData);

    weeklyBody.innerHTML += `
      <tr class="timesheet-row">
        <td class="member-cell">
          <div class="member-info">
            ${employee.photo
              ? `<img class="member-avatar" src="${employee.photo}" alt="${employee.name || "Employee"}">`
              : `<span class="member-initial">${getEmployeeInitial(employee)}</span>`
            }
            <div class="member-name">${employee.name || employee.email || employee.uid}</div>
          </div>
        </td>
        ${dayCells}
        <td class="total-cell">${totalText}</td>
      </tr>
    `;
  });
}

function renderMonthlyTimesheet(employees, attendanceRecords, leaves = []) {
  const [year, month] = currentTimesheetMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month - 1, index + 1);
    return {
      date,
      text: getDateInputValue(date)
    };
  });
  const searchText = getSearchText();
  const monthlyHead = document.getElementById("monthlyTimesheetHead");
  const monthlyBody = document.getElementById("monthlyTimesheetBody");
  const employeesToShow = employees
    .filter((employee) => employee.role === "employee")
    .filter((employee) => matchesEmployeeSearch(employee, searchText))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  document.getElementById("monthRangeLabel").innerText = new Date(`${currentTimesheetMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
  document.getElementById("monthlyTimesheetMonth").value = currentTimesheetMonth;

  monthlyHead.innerHTML = `
    <th class="member-head">
      <div class="timesheet-search">Month View</div>
    </th>
    ${monthDates.map(({ date }) => {
      const dateText = getDateInputValue(date);
      const isToday = dateText === today;
      const dayLetter = date.toLocaleDateString(undefined, { weekday: "short" }).charAt(0);

      return `
        <th class="month-day-head day-head${isToday ? " today" : ""}">
          <span class="day-letter">${dayLetter}</span>
          <span class="day-number">${date.getDate()}</span>
        </th>
      `;
    }).join("")}
    <th class="total-head">Total</th>
  `;

  monthlyBody.innerHTML = "";
  latestMonthlyRows = [];

  if (!employeesToShow.length) {
    monthlyBody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" style="padding:28px;text-align:left;">No employees found</td></tr>`;
    return;
  }

  employeesToShow.forEach((employee) => {
    let totalMinutes = 0;
    const rowData = {
      Employee: employee.name || "-",
      Email: employee.email || "-"
    };

    const dayCells = monthDates.map(({ date, text }) => {
      const dayRecords = attendanceRecords.filter((record) => record.userId === employee.uid && record.date === text);
      const record = dayRecords[0];
      const leave = findLeaveForDate(leaves, employee.uid, text);
      const isSunday = date.getDay() === 0;
      const isSelected = document.getElementById("filterDate").value === text;

      if (!record) {
        if (leave) {
          const leaveLabel = leave.status === "approved" ? "Leave" : "Pending";
          rowData[text] = leaveLabel;
          return `
            <td class="timesheet-cell compact month-cell${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${text}')">
              <span class="rest-pill">${leaveLabel}</span>
            </td>
          `;
        }

        rowData[text] = isSunday ? "Rest day" : "-";
        return `
          <td class="timesheet-cell compact month-cell${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${text}')">
            ${isSunday ? `<span class="rest-pill">Rest</span>` : "-"}
          </td>
        `;
      }

      const minutes = dayRecords.reduce((sum, item) => sum + getRecordMinutes(item), 0);
      totalMinutes += minutes;
      const displayHours = minutes ? formatMinutes(minutes) : (record.status || "-");
      const firstIn = formatRecordTime(record.punchIn);
      const lastOut = formatRecordTime(record.punchOut);
      const warnClass = record.status === "missed-punch-out" || record.status === "absent" ? " warn" : "";

      rowData[text] = displayHours;

      return `
        <td class="timesheet-cell compact month-cell has-time${warnClass}${isSelected ? " selected" : ""}" onclick="selectAttendanceDate('${text}')">
          ${displayHours}
          <div class="timesheet-popover">
            <div class="popover-row"><span>First in</span><strong>${firstIn}</strong></div>
            <div class="popover-row"><span>Last out</span><strong>${lastOut}</strong></div>
            <div class="popover-rule"></div>
            <div class="popover-row"><span>${record.status || "Regular"}</span><strong>${displayHours}</strong></div>
          </div>
        </td>
      `;
    }).join("");

    const totalText = totalMinutes ? formatMinutes(totalMinutes) : "-";
    rowData.Total = totalText;
    latestMonthlyRows.push(rowData);

    monthlyBody.innerHTML += `
      <tr class="timesheet-row">
        <td class="member-cell">
          <div class="member-info">
            ${employee.photo
              ? `<img class="member-avatar" src="${employee.photo}" alt="${employee.name || "Employee"}">`
              : `<span class="member-initial">${getEmployeeInitial(employee)}</span>`
            }
            <div class="member-name">${employee.name || employee.email || employee.uid}</div>
          </div>
        </td>
        ${dayCells}
        <td class="total-cell">${totalText}</td>
      </tr>
    `;
  });
}

function renderReports(employees, attendanceRecords) {
  const reportMonth = document.getElementById("reportMonth").value || getCurrentMonthValue();
  const searchText = getSearchText();
  const reportEmployees = employees
    .filter((employee) => employee.role === "employee")
    .filter((employee) => matchesEmployeeSearch(employee, searchText))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const tableBody = document.getElementById("reportTableBody");

  latestReportRows = [];
  tableBody.innerHTML = "";

  let totalPresentDays = 0;
  let totalAbsentDays = 0;
  let totalMissed = 0;
  let totalMinutes = 0;
  let totalPayout = 0;

  reportEmployees.forEach((employee) => {
    const records = attendanceRecords
      .filter((record) => record.userId === employee.uid && String(record.date || "").startsWith(reportMonth))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const presentDays = new Set(records.filter((record) => record.status !== "absent").map((record) => record.date)).size;
    const absentDays = records.filter((record) => record.status === "absent").length;
    const completed = records.filter((record) => record.status === "completed").length;
    const missed = records.filter((record) => record.status === "missed-punch-out").length;
    const minutes = records.reduce((sum, record) => sum + durationToMinutes(record.totalHours), 0);
    const lastStatus = records.length ? records[records.length - 1].status : "-";
    const totalHours = formatMinutes(minutes);
    const payroll = calculateMonthlyPayroll(employee, records, reportMonth, presentDays, minutes);
    const payout = payroll.payout;

    totalPresentDays += presentDays;
    totalAbsentDays += absentDays;
    totalMissed += missed;
    totalMinutes += minutes;
    totalPayout += payout;

    const reportRow = {
      Employee: employee.name || "-",
      Email: employee.email || "-",
      PresentDays: presentDays,
      AbsentDays: absentDays,
      Completed: completed,
      MissedPunchOut: missed,
      TotalHours: totalHours,
      MonthlySalary: formatCurrency(payroll.monthlySalary),
      SalaryBasis: formatSalaryBasis(employee),
      WorkingDays: payroll.workingDays,
      PayableDays: presentDays,
      HourlyRate: formatCurrency(payroll.hourlyRate),
      DailyRate: formatCurrency(payroll.dailyRate),
      PayoutByHours: formatCurrency(payroll.payoutByHours),
      PayoutByDays: formatCurrency(payroll.payoutByDays),
      MonthlyPayout: formatCurrency(payout),
      LastStatus: lastStatus || "-"
    };

    latestReportRows.push(reportRow);

    tableBody.innerHTML += `
      <tr>
        <td><strong>${reportRow.Employee}</strong></td>
        <td>${reportRow.Email}</td>
        <td>${presentDays}</td>
        <td>${absentDays}</td>
        <td>${completed}</td>
        <td>${missed}</td>
        <td>${totalHours}</td>
        <td>${formatCurrency(payroll.monthlySalary)}</td>
        <td>${formatSalaryBasis(employee)}</td>
        <td>${presentDays} / ${payroll.workingDays}</td>
        <td><strong>${formatCurrency(payout)}</strong></td>
        <td><span class="status ${getStatusClass(lastStatus)}">${lastStatus}</span></td>
      </tr>
    `;
  });

  if (!reportEmployees.length) {
    tableBody.innerHTML = `<tr><td colspan="12">No report data found</td></tr>`;
  }

  document.getElementById("reportEmployees").innerText = reportEmployees.length;
  document.getElementById("reportPresentDays").innerText = totalPresentDays;
  document.getElementById("reportMissed").innerText = totalMissed;
  document.getElementById("reportHours").innerText = formatMinutes(totalMinutes);
  document.getElementById("reportPayout").innerText = formatCurrency(totalPayout);
}

function renderPayroll(employees, attendanceRecords, breaks, payrollStatuses) {
  const payrollMonth = document.getElementById("payrollMonth").value || getCurrentMonthValue();
  const selectedEmployee = document.getElementById("payrollEmployeeFilter").value;
  const searchText = getSearchText();
  const statusMap = {};
  const tableBody = document.getElementById("payrollTableBody");

  payrollStatuses.forEach((item) => {
    statusMap[item.id] = item;
  });

  latestPayrollRows = [];
  Object.keys(payrollSlipStore).forEach((key) => {
    delete payrollSlipStore[key];
  });

  const payrollEmployees = employees
    .filter((employee) => (employee.role || "employee") === "employee")
    .filter((employee) => !selectedEmployee || employee.uid === selectedEmployee)
    .filter((employee) => matchesEmployeeSearch(employee, searchText))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  tableBody.innerHTML = "";

  let totalMinutes = 0;
  let totalAmount = 0;
  let pendingSlips = 0;

  payrollEmployees.forEach((employee) => {
    const row = calculatePayrollRow(employee, attendanceRecords, breaks, statusMap, payrollMonth);
    latestPayrollRows.push(row);
    payrollSlipStore[row.key] = row;

    totalMinutes += row.workedMinutes;
    totalAmount += row.netSalary;

    if (row.status !== "Paid") {
      pendingSlips++;
    }

    tableBody.innerHTML += `
      <tr>
        <td><strong>${row.employeeName}</strong></td>
        <td>${row.month}</td>
        <td>${row.totalDays}</td>
        <td>${row.presentDays}</td>
        <td>${row.absentDays}</td>
        <td>${formatMinutes(row.workedMinutes)}</td>
        <td>${formatCurrency(row.hourlyRate)}</td>
        <td>${formatCurrency(row.grossSalary + row.bonus)}</td>
        <td>${formatCurrency(row.totalDeduction)}</td>
        <td><strong>${formatCurrency(row.netSalary)}</strong></td>
        <td><span class="status ${getPayrollStatusClass(row.status)}">${row.status}</span></td>
        <td>
          <div class="payroll-action-row">
            <button class="small-btn edit" type="button" onclick="viewSalarySlip('${row.key}')">View Slip</button>
            <button class="small-btn toggle" type="button" onclick="downloadSalarySlip('${row.key}')">PDF</button>
            <button class="small-btn approve" type="button" onclick="setPayrollStatus('${row.uid}', '${row.month}', 'Approved')">Approve</button>
            <button class="small-btn reject" type="button" onclick="setPayrollStatus('${row.uid}', '${row.month}', 'Paid')">Paid</button>
          </div>
        </td>
      </tr>
    `;
  });

  if (!payrollEmployees.length) {
    tableBody.innerHTML = `<tr><td colspan="12">No payroll data found</td></tr>`;
  }

  document.getElementById("payrollTotalEmployees").innerText = payrollEmployees.length;
  document.getElementById("payrollTotalHours").innerText = formatMinutes(totalMinutes);
  document.getElementById("payrollTotalAmount").innerText = formatCurrency(totalAmount);
  document.getElementById("payrollPendingSlips").innerText = pendingSlips;
}

function getApprovedLeaveUsersForDate(leaves, dateText) {
  const leaveUsers = new Set();

  leaves.forEach((leave) => {
    if (
      leave.status === "approved" &&
      leave.startDate &&
      leave.endDate &&
      leave.startDate <= dateText &&
      leave.endDate >= dateText
    ) {
      leaveUsers.add(leave.userId);
    }
  });

  return leaveUsers;
}

function getEmployeeDisplayName(employee) {
  return employee?.name || employee?.employeeId || employee?.email || employee?.uid || "Employee";
}

function getPunchInDate(record) {
  return getTimestampDate(record?.punchIn);
}

function getDailyRecordsByUser(attendanceRecords, dateText) {
  const recordsByUser = {};

  attendanceRecords
    .filter((record) => record.date === dateText)
    .forEach((record) => {
      recordsByUser[record.userId] ||= [];
      recordsByUser[record.userId].push(record);
    });

  return recordsByUser;
}

function getFirstPunchIn(records) {
  return records
    .map(getPunchInDate)
    .filter(Boolean)
    .sort((a, b) => a - b)[0] || null;
}

function getLiveRecordMinutes(record, now) {
  if (!record || record.status === "absent") {
    return 0;
  }

  const savedMinutes = durationToMinutes(record.totalHours);

  if (savedMinutes && !["working", "break"].includes(record.status)) {
    return savedMinutes;
  }

  const punchIn = getTimestampDate(record.punchIn);
  const punchOut = getTimestampDate(record.punchOut);

  if (!punchIn) {
    return 0;
  }

  const end = punchOut || (["working", "break"].includes(record.status) ? now : null);
  return end ? Math.max(Math.round((end - punchIn) / 60000), 0) : savedMinutes;
}

function getDailyBreakMinutes(uid, dateText, breaks, now) {
  return breaks
    .filter((item) => item.userId === uid && item.date === dateText)
    .reduce((sum, item) => {
      const start = getTimestampDate(item.breakStart);
      const end = getTimestampDate(item.breakEnd) || (start ? now : null);

      if (!start || !end) return sum;
      return sum + Math.max(Math.round((end - start) / 60000), 0);
    }, 0);
}

function formatInsightNames(items, limit = 3) {
  if (!items.length) {
    return "";
  }

  const visible = items.slice(0, limit).map((item) => escapeHtml(item));
  const extra = items.length > limit ? ` +${items.length - limit} more` : "";
  return `${visible.join(", ")}${extra}`;
}

function renderInsightCard({ className = "", icon = "AI", title, copy, meta = "" }) {
  return `
    <div class="admin-insight-card ${className}">
      <div class="admin-insight-icon">${escapeHtml(icon)}</div>
      <div>
        <div class="admin-insight-title">${escapeHtml(title)}</div>
        <div class="admin-insight-copy">${copy}</div>
        ${meta ? `<div class="admin-insight-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    </div>
  `;
}

function renderAdminInsights(employees, attendanceRecords, leaves, breaks) {
  const insightList = document.getElementById("adminInsightList");

  if (!insightList) {
    return;
  }

  const todayText = refreshToday();
  const now = new Date();
  const leaveTodayUsers = getApprovedLeaveUsersForDate(leaves, todayText);
  const expectedEmployees = employees
    .filter((employee) => (
      (employee.role || "employee") === "employee" &&
      !isBeforeEmployeeCreated(employee, todayText) &&
      !leaveTodayUsers.has(employee.uid)
    ));
  const recordsByUser = getDailyRecordsByUser(attendanceRecords, todayText);
  const punctual = [];
  const late = [];
  const absent = [];
  const active = [];
  const missedPunchOut = [];
  const missingSchedule = [];
  let topWorker = null;
  let totalWorkedMinutes = 0;

  expectedEmployees.forEach((employee) => {
    const employeeRecords = recordsByUser[employee.uid] || [];
    const presentRecords = employeeRecords.filter((record) => record.status !== "absent" && getPunchInDate(record));
    const firstPunchIn = getFirstPunchIn(presentRecords);
    const name = getEmployeeDisplayName(employee);
    const hasActiveRecord = employeeRecords.some((record) => ["working", "break"].includes(record.status));
    const hasMissedPunchOut = employeeRecords.some((record) => record.status === "missed-punch-out" || record.missedPunchOut);
    const workStartMinutes = getTimeMinutes(employee.workStart);

    if (!presentRecords.length) {
      absent.push(name);
      return;
    }

    if (hasActiveRecord) {
      active.push(name);
    }

    if (hasMissedPunchOut) {
      missedPunchOut.push(name);
    }

    if (firstPunchIn && workStartMinutes !== null) {
      const punchMinutes = (firstPunchIn.getHours() * 60) + firstPunchIn.getMinutes();

      if (punchMinutes <= workStartMinutes) {
        punctual.push(name);
      } else {
        late.push({
          name,
          minutes: punchMinutes - workStartMinutes
        });
      }
    } else {
      missingSchedule.push(name);
    }

    const workedMinutes = Math.max(
      presentRecords.reduce((sum, record) => sum + getLiveRecordMinutes(record, now), 0) -
      getDailyBreakMinutes(employee.uid, todayText, breaks, now),
      0
    );

    totalWorkedMinutes += workedMinutes;

    if (!topWorker || workedMinutes > topWorker.minutes) {
      topWorker = { name, minutes: workedMinutes };
    }
  });

  const expectedCount = expectedEmployees.length;
  const presentCount = Math.max(expectedCount - absent.length, 0);
  const attendancePercent = expectedCount ? Math.round((presentCount / expectedCount) * 100) : 0;
  const lateSummary = late
    .sort((a, b) => b.minutes - a.minutes)
    .map((item) => `${item.name} (${item.minutes}m late)`);
  const insightCards = [
    renderInsightCard({
      className: attendancePercent >= 90 ? "good" : attendancePercent >= 70 ? "warn" : "danger",
      icon: "AI",
      title: "Daily team pulse",
      copy: expectedCount
        ? `${presentCount}/${expectedCount} employees are present today. ${leaveTodayUsers.size} employee${leaveTodayUsers.size === 1 ? "" : "s"} on approved leave.`
        : "No employees are expected today based on current employee and leave records.",
      meta: `Today attendance: ${attendancePercent}%`
    }),
    renderInsightCard({
      className: punctual.length ? "good" : "warn",
      icon: "ON",
      title: "Punctual employees",
      copy: punctual.length
        ? `${formatInsightNames(punctual)} punched in on or before their scheduled start time.`
        : "No punctual punch-ins detected yet for employees with assigned work start time.",
      meta: `On-time count: ${punctual.length}`
    }),
    renderInsightCard({
      className: late.length ? "warn" : "good",
      icon: "LT",
      title: "Late arrival watch",
      copy: late.length
        ? `${formatInsightNames(lateSummary)} need attention for late arrival today.`
        : "No late arrivals detected against assigned work start times.",
      meta: `Late count: ${late.length}`
    }),
    renderInsightCard({
      className: absent.length ? "danger" : "good",
      icon: "AB",
      title: "Not punched in",
      copy: absent.length
        ? `${formatInsightNames(absent)} have not punched in today.`
        : "Everyone expected today has punched in.",
      meta: `Absent count: ${absent.length}`
    }),
    renderInsightCard({
      className: active.length ? "warn" : "good",
      icon: "RUN",
      title: "Still active",
      copy: active.length
        ? `${formatInsightNames(active)} are still working or on break.`
        : "No employees are currently pending punch out.",
      meta: `Active sessions: ${active.length}`
    }),
    renderInsightCard({
      className: missedPunchOut.length ? "danger" : "good",
      icon: "OUT",
      title: "Missed punch out",
      copy: missedPunchOut.length
        ? `${formatInsightNames(missedPunchOut)} missed punch out and may need admin review.`
        : "No missed punch out cases found today.",
      meta: `Missed punch outs: ${missedPunchOut.length}`
    }),
    renderInsightCard({
      className: topWorker?.minutes ? "good" : "",
      icon: "TOP",
      title: "Top working time",
      copy: topWorker?.minutes
        ? `${escapeHtml(topWorker.name)} has the highest tracked time today with ${formatMinutes(topWorker.minutes)}.`
        : "Working time will appear after employees complete or continue tracked sessions.",
      meta: `Team tracked time: ${formatMinutes(totalWorkedMinutes)}`
    }),
    renderInsightCard({
      className: missingSchedule.length ? "warn" : "good",
      icon: "SET",
      title: "Schedule setup",
      copy: missingSchedule.length
        ? `${formatInsightNames(missingSchedule)} need work start time to judge punctuality accurately.`
        : "All present employees have schedules available for punctuality checks.",
      meta: `Missing schedules: ${missingSchedule.length}`
    })
  ];

  insightList.innerHTML = insightCards.join("");
}

function renderDashboardOverview(employees, attendanceRecords, leaves) {
  const employeeList = employees.filter((employee) => (employee.role || "employee") === "employee");
  const weekDates = getCurrentWeekDates();
  const todayText = refreshToday();
  const chart = document.getElementById("weeklyAttendanceChart");
  const colors = ["#10b981", "#2563eb", "#facc15", "#2563eb", "#8b5cf6", "#10b981", "#94a3b8"];

  if (!chart) {
    return;
  }

  chart.innerHTML = "";

  weekDates.forEach((date, index) => {
    const dateText = getDateInputValue(date);
    const isFuture = dateText > todayText;
    const leaveUsers = getApprovedLeaveUsersForDate(leaves, dateText);
    const dayEmployeeIds = new Set(
      employeeList
        .filter((employee) => !isBeforeEmployeeCreated(employee, dateText) && !leaveUsers.has(employee.uid))
        .map((employee) => employee.uid)
    );
    const presentUsers = new Set();

    attendanceRecords.forEach((record) => {
      if (record.date === dateText && dayEmployeeIds.has(record.userId) && record.status !== "absent") {
        presentUsers.add(record.userId);
      }
    });

    const presentCount = presentUsers.size;
    const expectedCount = dayEmployeeIds.size;
    const percent = expectedCount ? Math.round((presentCount / expectedCount) * 100) : 0;
    const height = isFuture ? 8 : Math.max(Math.round((percent / 100) * 170), presentCount ? 24 : 8);
    const dayName = date.toLocaleDateString(undefined, { weekday: "short" });

    chart.innerHTML += `
      <div class="bar-wrap" title="${presentCount}/${expectedCount} present on ${dateText}">
        <div class="bar-value">${isFuture ? "--" : `${percent}%`}</div>
        <div class="bar" style="height:${height}px;background:${isFuture ? "#d1d5db" : colors[index]};"></div>
        <div>${dayName}</div>
        <div class="bar-sub">${isFuture ? "Future" : `${presentCount}/${expectedCount}`}</div>
      </div>
    `;
  });
}

window.loadData = async function () {
  refreshToday();
  const employeeSnap = await getDocs(collection(db, "employees"));
  const attendanceSnap = await getDocs(collection(db, "attendance"));
  const leaveSnap = await getDocs(collection(db, "leaves"));
  const breakSnap = await getDocs(collection(db, "breaks"));
  const payrollStatusSnap = await getDocs(collection(db, "payrollStatus"));
  let taskSnap = null;

  try {
    taskSnap = await getDocs(collection(db, "tasks"));
  } catch (error) {
    console.error("Tasks could not load:", error);
  }

  const employeeMap = {};
  const employeeById = {};
  const employees = [];
  const attendanceRecords = [];
  const leaves = [];
  const breaks = [];
  const payrollStatuses = [];
  const tasks = [];

  employeeSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const employee = { uid: docSnap.id, ...data };
    employeeMap[docSnap.id] = data.name;
    employeeById[docSnap.id] = employee;
    employees.push(employee);
  });

  attendanceSnap.forEach((docSnap) => {
    attendanceRecords.push({ id: docSnap.id, ...docSnap.data() });
  });

  leaveSnap.forEach((docSnap) => {
    leaves.push({ id: docSnap.id, ...docSnap.data() });
  });

  breakSnap.forEach((docSnap) => {
    breaks.push({ id: docSnap.id, ...docSnap.data() });
  });

  payrollStatusSnap.forEach((docSnap) => {
    payrollStatuses.push({ id: docSnap.id, ...docSnap.data() });
  });

  if (taskSnap) {
    taskSnap.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });
  }

  const searchText = getSearchText();
  const dashboardEmployees = employees;

  renderNotificationEmployeeOptions(employees);
  renderPayrollEmployeeOptions(employees);
  renderTaskAssigneeOptions(employees);
  renderEmployeeDirectory(employees, leaves);
  renderLeaveRequests(leaves, employees);
  renderTasks(employees, tasks);
  updateTimesheetModeUI();
  renderWeeklyTimesheet(employees, attendanceRecords, leaves);
  renderMonthlyTimesheet(employees, attendanceRecords, leaves);
  renderReports(employees, attendanceRecords);
  renderPayroll(employees, attendanceRecords, breaks, payrollStatuses);
  renderDashboardOverview(dashboardEmployees, attendanceRecords, leaves);
  renderAdminInsights(dashboardEmployees, attendanceRecords, leaves, breaks);

  const tableBody = document.getElementById("tableBody");
  const selectedDate = document.getElementById("filterDate").value;

  tableBody.innerHTML = "";
  Object.keys(attendancePhotoStore).forEach((key) => {
    delete attendancePhotoStore[key];
  });

  let presentToday = 0;
  let visibleAttendanceRows = 0;
  const presentTodayUsers = new Set();
  const workingTodayUsers = new Set();
  const breakTodayUsers = new Set();
  const leaveTodayUsers = getApprovedLeaveUsersForDate(leaves, today);
  const employeeIds = new Set(
    dashboardEmployees
      .filter((employee) => (
        (employee.role || "employee") === "employee" &&
        !isBeforeEmployeeCreated(employee, today) &&
        !leaveTodayUsers.has(employee.uid)
      ))
      .map((employee) => employee.uid)
  );

  attendanceRecords.forEach((data) => {
    if (data.date === today && employeeIds.has(data.userId) && data.status !== "absent") {
      presentTodayUsers.add(data.userId);
      if (data.status === "working") workingTodayUsers.add(data.userId);
      if (data.status === "break") breakTodayUsers.add(data.userId);
    }
  });

  attendanceRecords.forEach((data) => {
    const punchInPhotoKey = `${data.id}_punch_in`;
    const punchOutPhotoKey = `${data.id}_punch_out`;

    const employee = employeeById[data.userId] || { uid: data.userId, name: employeeMap[data.userId] || "Unknown" };
    const name = employeeMap[data.userId] || "Unknown";
    const matchSearch = !searchText || matchesEmployeeSearch(employee, searchText);
    const matchDate = selectedDate ? data.date === selectedDate : true;

    if (!matchSearch || !matchDate) return;
    visibleAttendanceRows++;

    const row = `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${data.date || "-"}</td>
        <td>${data.punchIn ? data.punchIn.toDate().toLocaleTimeString() : "-"}</td>
        <td>${data.punchOut ? data.punchOut.toDate().toLocaleTimeString() : "-"}</td>
        <td>${data.totalHours || "-"}</td>
        <td><span class="status ${getStatusClass(data.status)}">${data.status || "-"}</span></td>
        <td>${renderAttendancePhoto(data.selfie, punchInPhotoKey, "Punch In Photo")}</td>
        <td>${renderAttendancePhoto(data.punchOutSelfie, punchOutPhotoKey, "Punch Out Photo")}</td>
        <td>
          ${data.location
            ? `<a target="_blank" href="https://www.google.com/maps?q=${data.location.lat},${data.location.lng}">View</a>`
            : "-"
          }
        </td>
      </tr>
    `;

    tableBody.innerHTML += row;
  });

  if (!visibleAttendanceRows) {
    tableBody.innerHTML = `<tr><td colspan="9">No attendance records found</td></tr>`;
  }

  const totalEmployees = dashboardEmployees.filter((employee) => (employee.role || "employee") === "employee").length;
  const expectedTodayEmployees = employeeIds.size;
  presentToday = presentTodayUsers.size;
  const workingToday = workingTodayUsers.size;
  const onBreak = breakTodayUsers.size;
  const absent = Math.max(expectedTodayEmployees - presentToday, 0);
  const percent = expectedTodayEmployees ? Math.round((presentToday / expectedTodayEmployees) * 100) : 0;

  updateSnapshotDetails({
    employees: dashboardEmployees,
    employeeById,
    attendanceRecords,
    presentTodayUsers,
    breakTodayUsers,
    employeeIds,
    todayText: today
  });

  document.getElementById("totalEmployees").innerText = totalEmployees;
  document.getElementById("presentToday").innerText = presentToday;
  document.getElementById("absentToday").innerText = absent;
  document.getElementById("onBreak").innerText = onBreak;
  document.getElementById("attendancePercent").innerText = percent + "%";
  document.getElementById("attendanceDonut").style.background =
    `conic-gradient(#2563eb 0 ${percent}%, #e5e7eb ${percent}% 100%)`;
  document.getElementById("actionAbsent").innerText = absent;
  document.getElementById("pendingPunchOut").innerText = workingToday;
};

window.filterData = async function () {
  await loadData();
};

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

function getPayslipData(row) {
  const grossEarnings = row.grossSalary + row.bonus;
  const totalDeductions = row.totalDeduction;

  return {
    companyName: payrollCompanyName,
    companyAddress: payrollCompanyAddress,
    monthLabel: formatPayslipMonth(row.month),
    payPeriod: formatPayslipMonth(row.month),
    payDate: formatPayslipDate(),
    employeeName: row.employeeName,
    employeeId: row.employeeId || row.uid,
    paidDays: row.presentDays,
    lopDays: row.absentDays,
    totalNetPay: row.netSalary,
    grossEarnings,
    totalDeductions,
    amountWords: numberToWordsIndian(row.netSalary),
    earnings: [
      ["Basic", row.grossSalary],
      ["House Rent Allowance", 0],
      ["Bonus / Incentive", row.bonus]
    ],
    deductions: [
      ["Income Tax", 0],
      ["Provident Fund", 0],
      ["Attendance Deduction", totalDeductions]
    ]
  };
}

function drawPayslipPdf(pdf, row) {
  const slip = getPayslipData(row);
  const pageWidth = 210;
  const margin = 14;
  const rightX = 132;

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
    ["Pay Period", slip.payPeriod],
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
  pdf.text(formatPayslipAmount(slip.totalNetPay), rightX + 29, 78, { align: "center" });
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
  pdf.text(String(slip.paidDays), rightX + 13.5, 124, { align: "center" });
  pdf.text(String(slip.lopDays), rightX + 44.5, 124, { align: "center" });

  const tableY = 140;
  const tableW = 86;
  const leftTableX = margin;
  const rightTableX = 110;

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

  drawTable(leftTableX, "EARNINGS", slip.earnings, "Gross Earnings", slip.grossEarnings);
  drawTable(rightTableX, "DEDUCTIONS", slip.deductions, "Total Deductions", slip.totalDeductions);

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
  pdf.text(formatPayslipAmount(slip.totalNetPay), pageWidth - margin - 4, 230, { align: "right" });

  pdf.setTextColor(75, 85, 99);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`Amount In Words: ${slip.amountWords}`, margin, 254);
  pdf.setTextColor(107, 114, 128);
  pdf.text("-- This is a system-generated document. --", pageWidth / 2, 274, { align: "center" });
}

function renderSalarySlipHtml(row) {
  const slip = getPayslipData(row);

  return `
    <div>
      <h3 style="margin:0 0 6px;">${slip.companyName}</h3>
      <div class="holiday-date">${slip.companyAddress}</div>
      <div class="holiday-date">Payslip For the Month: <strong>${slip.monthLabel}</strong></div>
    </div>
    <div class="salary-slip-grid">
      <div class="salary-slip-line"><span>Employee Name</span><strong>${slip.employeeName}</strong></div>
      <div class="salary-slip-line"><span>Employee ID</span><strong>${slip.employeeId}</strong></div>
      <div class="salary-slip-line"><span>Pay Period</span><strong>${slip.payPeriod}</strong></div>
      <div class="salary-slip-line"><span>Pay Date</span><strong>${slip.payDate}</strong></div>
      <div class="salary-slip-line"><span>Paid Days</span><strong>${slip.paidDays}</strong></div>
      <div class="salary-slip-line"><span>LOP Days</span><strong>${slip.lopDays}</strong></div>
      <div class="salary-slip-line"><span>Gross Earnings</span><strong>${formatCurrency(slip.grossEarnings)}</strong></div>
      <div class="salary-slip-line"><span>Total Deductions</span><strong>${formatCurrency(slip.totalDeductions)}</strong></div>
      <div class="salary-slip-line"><span>Total Net Pay</span><strong>${formatCurrency(slip.totalNetPay)}</strong></div>
      <div class="salary-slip-line"><span>Status</span><strong>${row.status}</strong></div>
    </div>
    <div class="holiday-date">Amount In Words: ${slip.amountWords}</div>
    <div class="holiday-date">-- This is a system-generated document. --</div>
  `;
}

window.viewSalarySlip = function (key) {
  const row = payrollSlipStore[key];

  if (!row) {
    alert("Salary slip not found. Please refresh payroll.");
    return;
  }

  currentSalarySlipKey = key;
  document.getElementById("salarySlipContent").innerHTML = renderSalarySlipHtml(row);
  document.getElementById("salarySlipModal").classList.add("open");
  document.getElementById("salarySlipModal").setAttribute("aria-hidden", "false");
};

window.closeSalarySlip = function () {
  document.getElementById("salarySlipModal").classList.remove("open");
  document.getElementById("salarySlipModal").setAttribute("aria-hidden", "true");
  document.getElementById("salarySlipContent").innerHTML = "";
};

window.downloadCurrentSalarySlip = function () {
  if (!currentSalarySlipKey) return;
  downloadSalarySlip(currentSalarySlipKey);
};

window.downloadSalarySlip = function (key) {
  const row = payrollSlipStore[key];

  if (!row) {
    alert("Salary slip not found. Please refresh payroll.");
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;

  if (!jsPDF) {
    alert("PDF library could not load. Please check your internet connection.");
    return;
  }

  const pdf = new jsPDF();
  drawPayslipPdf(pdf, row);
  pdf.save(`Salary_Slip_${row.employeeName.replace(/[^a-z0-9]+/gi, "_")}_${row.month}.pdf`);
};

window.setPayrollStatus = async function (uid, monthValue, status) {
  await setDoc(doc(db, "payrollStatus", getPayrollDocId(uid, monthValue)), {
    userId: uid,
    month: monthValue,
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || "admin"
  }, { merge: true });

  loadData();
};

window.exportToExcel = async function () {
  const employeeSnap = await getDocs(collection(db, "employees"));
  const attendanceSnap = await getDocs(collection(db, "attendance"));

  const employeeMap = {};
  employeeSnap.forEach((docSnap) => {
    employeeMap[docSnap.id] = docSnap.data().name;
  });

  const selectedDate = document.getElementById("filterDate").value;
  const exportData = [];

  attendanceSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (selectedDate && data.date !== selectedDate) return;

    exportData.push({
      Employee: employeeMap[data.userId] || "Unknown",
      Date: data.date || "-",
      PunchIn: data.punchIn ? data.punchIn.toDate().toLocaleString() : "-",
      PunchOut: data.punchOut ? data.punchOut.toDate().toLocaleString() : "-",
      TotalHours: data.totalHours || "-",
      Status: data.status || "-"
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  XLSX.writeFile(workbook, "Workforce_By_Mindque_Attendance_Report.xlsx");
};

window.exportWeeklyTimesheet = function () {
  if (!latestWeeklyRows.length) {
    alert("No weekly timesheet data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(latestWeeklyRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Timesheet");
  XLSX.writeFile(workbook, "Workforce_By_Mindque_Weekly_Timesheet.xlsx");
};

window.exportPayrollToExcel = function () {
  if (!latestPayrollRows.length) {
    alert("No payroll data to export");
    return;
  }

  const exportRows = latestPayrollRows.map((row) => ({
    Employee: row.employeeName,
    Month: row.month,
    SalaryType: row.salaryType,
    TotalDays: row.totalDays,
    PresentDays: row.presentDays,
    AbsentDays: row.absentDays,
    TotalHours: formatMinutes(row.workedMinutes),
    BreakDeduction: formatMinutes(row.breakMinutes),
    PerHourRate: row.hourlyRate,
    GrossSalary: row.grossSalary + row.bonus,
    Deduction: row.totalDeduction,
    NetSalary: row.netSalary,
    Status: row.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
  XLSX.writeFile(workbook, "Workforce_By_Mindque_Payroll.xlsx");
};

window.exportMonthlyTimesheet = function () {
  if (!latestMonthlyRows.length) {
    alert("No monthly timesheet data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(latestMonthlyRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Timesheet");
  XLSX.writeFile(workbook, "Workforce_By_Mindque_Monthly_Timesheet.xlsx");
};

window.exportTimesheet = function () {
  if (currentTimesheetMode === "monthly") {
    window.exportMonthlyTimesheet();
    return;
  }

  window.exportWeeklyTimesheet();
};

window.exportReportToExcel = function () {
  if (!latestReportRows.length) {
    alert("No report data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(latestReportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Report");
  XLSX.writeFile(workbook, "Workforce_By_Mindque_Monthly_Report.xlsx");
};
})().catch((error) => {
  console.error("Admin page failed to load:", error);
});
