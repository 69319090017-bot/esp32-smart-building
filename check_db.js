const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyAF2Vyv4mQIbP2GK8xJLixZUaq_ZQBbYBU",
    authDomain: "smart-garage-system-cabe9.firebaseapp.com",
    databaseURL: "https://smart-garage-system-cabe9-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "smart-garage-system-cabe9",
    appId: "1:112540812441:web:1c249ee600a9d395692408"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

signInWithEmailAndPassword(auth, "jmachth@gmail.com", "Noob_101").then(() => {
    console.log("Logged in!");
    get(ref(db, "devices/garage_001")).then((snapshot) => {
        console.log("Data:", JSON.stringify(snapshot.val(), null, 2));
        process.exit(0);
    }).catch(err => {
        console.error("DB Error:", err);
        process.exit(1);
    });
}).catch(err => {
    console.error("Auth Error:", err);
    process.exit(1);
});
