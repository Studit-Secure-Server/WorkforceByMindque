(async () => {
const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
const { getAuth, signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js");
const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js");

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

window.togglePassword = function () {
  const password = document.getElementById("password");
  const isHidden = password.type === "password";
  password.type = isHidden ? "text" : "password";
};

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("Logged in UID:", user.uid);
    console.log("Logged in Email:", user.email);

    const userRef = doc(db, "employees", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("User not found in employees collection");
      return;
    }

    const data = userSnap.data();

    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else if (data.role === "employee") {
      window.location.href = "dashboard.html";
    } else {
      alert("Invalid role");
    }
  } catch (error) {
    alert(error.message);
  }
};
})().catch((error) => {
  console.error("Login page failed to load:", error);
  alert("Login page failed to load. Please refresh and try again.");
});
