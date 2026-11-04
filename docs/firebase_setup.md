# 🔥 Firebase Cloud Setup Guide

This guide provides step-by-step instructions for creating and configuring the Firebase project for the Smart Garage system.

---

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and enter your desired Project Name (e.g. `smart-garage-system`).
3. (Optional) Disable Google Analytics unless required, then click **Create Project**.

---

## 2. Enable Realtime Database

1. In the left navigation sidebar, navigate to **Build** -> **Realtime Database**.
2. Click **Create Database**.
3. Choose a database location close to you (e.g. `asia-southeast1` for Singapore/Southeast Asia or `us-central1` for US).
4. Start in **Locked Mode** (we will configure security rules in Step 4).
5. Copy your database URL (e.g. `https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app/`).

---

## 3. Enable Email/Password Authentication

1. In the left sidebar, navigate to **Build** -> **Authentication**.
2. Click **Get Started** and select the **Sign-in method** tab.
3. Select **Email/Password**, toggle **Enable**, and click **Save**.
4. Switch to the **Users** tab and create two dedicated accounts:
   - **ESP32 Device Account:** e.g. `garage-device@example.com` (password: strong random string).
   - **Dashboard Admin Account:** e.g. `admin@example.com` (password: strong random string).

---

## 4. Configure Security Rules

1. In **Realtime Database**, switch to the **Rules** tab.
2. Replace existing rules with the following authenticated access policy:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

3. Click **Publish**.

> [!NOTE]
> This rule ensures that only authenticated clients (the ESP32 device holding a valid Firebase Auth ID Token, and logged-in web dashboard sessions) can read and write data.

---

## 5. Retrieve Web App Credentials

1. Click the **Gear Icon ⚙️** next to **Project Overview** -> **Project Settings**.
2. In the **General** tab, scroll down to **Your apps** and click the **Web `</>`** icon.
3. Register the app name (e.g. `Smart Garage Web`).
4. Copy the `apiKey`, `projectId`, and `appId` into your `secrets.env` file.
