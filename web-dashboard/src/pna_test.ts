export {};

const PNA_TEST_ALERT_KEY = 'sbcc_pna_test_alert';
const PNA_TEST_ALERT_HISTORY_KEY = 'sbcc_pna_test_alert_history';
const PNA_TEST_HISTORY_ENABLED_KEY = 'sbcc_pna_test_history_enabled';
const MAX_PNA_TEST_HISTORY = 50;

const form = document.getElementById('pnaTestForm') as HTMLFormElement | null;
const messageInput = document.getElementById('pnaTestInput') as HTMLTextAreaElement | null;
const statusElement = document.getElementById('pnaTestSendStatus');
const saveHistoryCheckbox = document.getElementById('pnaTestSaveHistory') as HTMLInputElement | null;

if (saveHistoryCheckbox) {
    saveHistoryCheckbox.checked = localStorage.getItem(PNA_TEST_HISTORY_ENABLED_KEY) !== 'false';
    saveHistoryCheckbox.addEventListener('change', () => {
        localStorage.setItem(PNA_TEST_HISTORY_ENABLED_KEY, String(saveHistoryCheckbox.checked));
        if (statusElement) {
            statusElement.textContent = saveHistoryCheckbox.checked
                ? 'เปิดการเก็บประวัติในอุปกรณ์นี้แล้ว'
                : 'ปิดการเก็บประวัติสำหรับข้อความที่จะส่งต่อไป';
        }
    });
}

const readHistory = (): Array<{ message: string; createdAt: string }> => {
    try {
        const entries = JSON.parse(localStorage.getItem(PNA_TEST_ALERT_HISTORY_KEY) || '[]');
        if (!Array.isArray(entries)) return [];
        return entries.filter((entry): entry is { message: string; createdAt: string } =>
            typeof entry?.message === 'string' && typeof entry?.createdAt === 'string'
        );
    } catch {
        return [];
    }
};

form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const message = messageInput?.value.trim();
    if (!message) {
        if (statusElement) statusElement.textContent = 'กรุณาพิมพ์ข้อความก่อนส่ง';
        messageInput?.focus();
        return;
    }

    const alert = { message, createdAt: new Date().toISOString() };

    try {
        localStorage.setItem(PNA_TEST_ALERT_KEY, JSON.stringify(alert));
        if (saveHistoryCheckbox?.checked) {
            const history = readHistory();
            history.push(alert);
            localStorage.setItem(PNA_TEST_ALERT_HISTORY_KEY, JSON.stringify(history.slice(-MAX_PNA_TEST_HISTORY)));
        }
        if (statusElement) {
            statusElement.textContent = saveHistoryCheckbox?.checked
                ? 'ส่งข้อความและเล่นเสียงออกลำโพงแล้ว (บันทึกประวัติ)'
                : 'ส่งข้อความและเล่นเสียงออกลำโพงแล้ว';
        }

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(`ข้อความแจ้งเตือน: ${message}`);
            utterance.lang = 'th-TH';
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
    } catch {
        if (statusElement) statusElement.textContent = 'ส่งไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูลในหน้านี้';
    }
});

form?.addEventListener('reset', () => {
    if (statusElement) statusElement.textContent = '';
});
