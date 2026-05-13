const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();
const channelId = "workforce_updates";

function normalizeTokens(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((token) => typeof token === "string" && token.trim()))];
}

async function getTokensFromEmployeeSnap(snap) {
  if (!snap.exists) {
    return [];
  }

  return normalizeTokens(snap.data().fcmTokens);
}

async function getEmployeeTokensByUid(uid) {
  if (!uid) {
    return [];
  }

  const directSnap = await db.collection("employees").doc(uid).get();
  let tokens = await getTokensFromEmployeeSnap(directSnap);

  if (tokens.length) {
    return tokens;
  }

  const querySnap = await db.collection("employees").where("userId", "==", uid).limit(1).get();

  if (!querySnap.empty) {
    tokens = await getTokensFromEmployeeSnap(querySnap.docs[0]);
  }

  return tokens;
}

async function getEmployeeTokensByEmail(email) {
  if (!email) {
    return [];
  }

  const querySnap = await db.collection("employees").where("email", "==", email).limit(1).get();

  if (querySnap.empty) {
    return [];
  }

  return getTokensFromEmployeeSnap(querySnap.docs[0]);
}

async function getAllEmployeeTokens() {
  const employeeSnap = await db.collection("employees").get();
  const tokens = [];

  employeeSnap.forEach((docSnap) => {
    tokens.push(...normalizeTokens(docSnap.data().fcmTokens));
  });

  return [...new Set(tokens)];
}

async function sendPushToTokens(tokens, payload) {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);

  if (!uniqueTokens.length) {
    logger.info("No device tokens found for push", payload.data || {});
    return;
  }

  const chunks = [];
  for (let index = 0; index < uniqueTokens.length; index += 500) {
    chunks.push(uniqueTokens.slice(index, index + 500));
  }

  for (const chunk of chunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data,
      android: {
        priority: "high",
        notification: {
          channelId,
          sound: "notification_sound",
          clickAction: "OPEN_WORKFORCE"
        }
      }
    });

    logger.info("Push send result", {
      successCount: response.successCount,
      failureCount: response.failureCount,
      type: payload.data.type
    });
  }
}

exports.sendNotificationPush = onDocumentCreated("notifications/{notificationId}", async (event) => {
  const data = event.data?.data();

  if (!data) {
    return;
  }

  const targetType = data.targetType || "all";
  let tokens = [];

  if (targetType === "all") {
    tokens = await getAllEmployeeTokens();
  } else {
    tokens = await getEmployeeTokensByUid(data.targetUid);

    if (!tokens.length) {
      tokens = await getEmployeeTokensByEmail(data.targetEmail);
    }
  }

  await sendPushToTokens(tokens, {
    title: data.title || "Workforce Notification",
    body: data.message || "You have a new notification.",
    data: {
      type: "notification",
      id: event.params.notificationId,
      title: data.title || "Workforce Notification",
      body: data.message || "You have a new notification."
    }
  });
});

exports.sendTaskPush = onDocumentCreated("tasks/{taskId}", async (event) => {
  const data = event.data?.data();

  if (!data) {
    return;
  }

  const tokens = await getEmployeeTokensByUid(data.assignedTo);
  const deadlineText = data.deadline ? ` Deadline: ${data.deadline}.` : "";
  const priorityText = data.priority ? ` Priority: ${data.priority}.` : "";
  const body = `${data.description || "A new task has been assigned to you."}${deadlineText}${priorityText}`;

  await sendPushToTokens(tokens, {
    title: data.title || "New Task Assigned",
    body,
    data: {
      type: "task",
      id: event.params.taskId,
      title: data.title || "New Task Assigned",
      body
    }
  });
});
