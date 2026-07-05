// ==========================================
// 1. تهيئة Appwrite
// ==========================================
const { Client, Account, Databases, Functions, Query, ID } = Appwrite;
const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1') 
    .setProject('6a36cda70021ceb1f3d0'); 

const account = new Account(client);
const databases = new Databases(client);
const appwriteFunctions = new Functions(client);

const DB_ID = '6a3706880011ad5651b5'; 
const COLLECTION_ID = 'cvs_chat_cv_mab'; 

let currentUser = null;
let isLoginMode = true;

// ==========================================
// نظام ذاكرة التراجع (Undo System)
// ==========================================
let editHistory = []; // مصفوفة لحفظ حالات النص

function saveHistoryState() {
    const currentText = ui.bookOutlineText.innerText;
    // لا تحفظ إذا كان النص مطابقاً لآخر حالة تم حفظها لتجنب التكرار
    if (editHistory.length === 0 || editHistory[editHistory.length - 1] !== currentText) {
        editHistory.push(currentText);
        if (editHistory.length > 50) editHistory.shift(); // الاحتفاظ بآخر 50 عملية فقط لعدم إثقال الذاكرة
    }
}

function handleUndo() {
    if (editHistory.length > 1) {
        editHistory.pop(); // إزالة الحالة الحالية (الخاطئة)
        ui.bookOutlineText.innerText = editHistory[editHistory.length - 1]; // استرجاع الحالة السابقة
    } else if (editHistory.length === 1) {
        ui.bookOutlineText.innerText = editHistory[0]; // العودة للنسخة الأصلية الأولى
    }
}

// ==========================================
// 2. إدارة الواجهة الديناميكية
// ==========================================
const ui = {
    source: document.getElementById('source-select'),
    action: document.getElementById('action-select'),
    provider: document.getElementById('provider-select'),
    model: document.getElementById('model-select'),
    imageUpload: document.getElementById('image-upload-section'),
    bookSettings: document.getElementById('book-settings'),
    prompt: document.getElementById('main-prompt'),
    sendBtn: document.getElementById('send-btn'),
    loader: document.getElementById('loader'),
    resultArea: document.getElementById('result-area'),
    resultText: document.getElementById('result-text'),
    bookOutlineText: document.getElementById('book-outline-text'), // الآن هو div contenteditable
    editableContainer: document.getElementById('editable-outline-container'),
    bookActions: document.getElementById('book-actions'),
    refinePrompt: document.getElementById('refine-prompt'),
    refineBtn: document.getElementById('refine-btn'),
    writeIntroBtn: document.getElementById('write-intro-btn'),
    undoBtn: document.getElementById('undo-btn'),
    introArea: document.getElementById('intro-area'),
    introText: document.getElementById('intro-text'),
    resultImage: document.getElementById('result-image'),
    sourceBadge: document.getElementById('source-badge'),
    imageFile: document.getElementById('image-file')
};

// ربط زر التراجع
ui.undoBtn.addEventListener('click', handleUndo);

// التقاط الكتابة اليدوية لحفظها في الذاكرة (كلمة بكلمة)
ui.bookOutlineText.addEventListener('keyup', (e) => {
    // يحفظ الحالة فقط عند الضغط على مسافة (انتهاء كلمة)، أو إدخال (سطر جديد)، أو مسح
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
        saveHistoryState();
    }
});

function updateUI() {
    const source = ui.source.value;
    const action = ui.action.value;

    if (source === '6a3c7a760032067bd275') { 
        Array.from(ui.action.options).forEach(opt => {
            if (opt.value === 'book_outline') opt.disabled = true;
        });
        if (action === 'book_outline') ui.action.value = 'text'; 
    } else {
        Array.from(ui.action.options).forEach(opt => opt.disabled = false);
    }

    const currentAction = ui.action.value;

    ui.imageUpload.classList.toggle('hidden', currentAction !== 'edit');
    ui.bookSettings.classList.toggle('hidden', currentAction !== 'book_outline');

    if (currentAction === 'book_outline') {
        ui.provider.innerHTML = `<option value="gemini">Gemini 3.5 Flash (Free)</option><option value="openai">OpenAI</option><option value="cloudflare">Cloudflare</option>`;
    } else if (currentAction === 'text') {
        ui.provider.innerHTML = `<option value="openai">OpenAI (متقدم)</option><option value="cloudflare">Cloudflare (اقتصادي)</option>`;
    } else if (currentAction === 'generate') {
        ui.provider.innerHTML = `<option value="cloudflare">Cloudflare (Flux)</option><option value="openai">OpenAI (DALL-E)</option>`;
    } else if (currentAction === 'edit') {
        ui.provider.innerHTML = `<option value="openai">OpenAI (تعديل صور)</option>`;
    }
    updateModels();
}

function updateModels() {
    const action = ui.action.value;
    const provider = ui.provider.value;

    if (action === 'text' || action === 'book_outline') {
        if (provider === 'gemini') {
            ui.model.innerHTML = `<option value="gemini-3.5-flash">Gemini 3.5 Flash</option>`;
        } else if (provider === 'openai') {
            ui.model.innerHTML = `<option value="gpt-4o">GPT-4o (8 نقاط)</option><option value="gpt-5.4-mini">GPT-5.4-mini (10 نقاط)</option><option value="gpt-5.5">GPT-5.5 (15 نقطة)</option>`;
        } else {
            ui.model.innerHTML = `<option value="llama">LLaMA 3.3 (5 نقاط)</option>`;
        }
    } else {
        if (provider === 'openai') {
            ui.model.innerHTML = `<option value="light">عادي (10 نقاط)</option><option value="mid">متوسط (15 نقطة)</option><option value="pro">Pro (20 نقطة)</option>`;
        } else {
            ui.model.innerHTML = `<option value="flux">Flux (5 نقاط)</option>`;
        }
    }
}

ui.source.addEventListener('change', updateUI);
ui.action.addEventListener('change', updateUI);
ui.provider.addEventListener('change', updateModels);
window.addEventListener('DOMContentLoaded', updateUI);

// ==========================================
// 3. التفاعل مع الخادم (Appwrite Functions)
// ==========================================
async function executeRequest(payloadObj) {
    if (!currentUser) { alert("يرجى تسجيل الدخول أولاً."); openModal(); return null; }

    const targetFunctionId = ui.source.value;
    ui.loader.classList.remove('hidden');
    
    try {
        const execution = await appwriteFunctions.createExecution(
            targetFunctionId,
            JSON.stringify(payloadObj),
            false,
            '/',
            'POST',
            { 'Content-Type': 'application/json' }
        );
        if (execution.status === 'failed') throw new Error("حدث خطأ داخلي في السيرفر.");
        return JSON.parse(execution.responseBody);
    } catch (error) {
        alert("خطأ في الاتصال بالسيرفر: " + error.message);
        return null;
    } finally {
        ui.loader.classList.add('hidden');
    }
}

// دالة توليد الخطة الأساسية
ui.sendBtn.addEventListener('click', async () => {
    const actionType = ui.action.value;
    
    if (!ui.prompt.value.trim() && actionType !== 'book_outline') { 
        alert("يرجى إدخال نص الطلب!"); return; 
    }

    let payloadObj = {
        userId: currentUser?.$id,
        prompt: ui.prompt.value,
        provider: ui.provider.value,
        modelTier: ui.model.value
    };

    if (actionType === 'book_outline') {
        const rawGenre = document.getElementById('b-genre').value;
        const finalGenre = rawGenre === 'other' ? document.getElementById('b-custom-genre').value : rawGenre;
        let pages = parseInt(document.getElementById('b-pages').value);
        if (isNaN(pages) || pages < 50) pages = 50;
        
        payloadObj.action = 'book_outline';
        payloadObj.bookDetails = {
            title: document.getElementById('b-title').value,
            topic: document.getElementById('b-topic').value,
            genre: finalGenre,
            structure: document.getElementById('b-structure').value,
            maxPages: pages,
            audience: document.getElementById('b-audience').value,
            tone: document.getElementById('b-tone').value,
            pov: document.getElementById('b-pov').value,
            language: document.getElementById('b-language').value,
            imagesType: document.getElementById('b-images').value,
            coverPrompt: document.getElementById('b-cover').value
        };
        
        if(!payloadObj.bookDetails.title || !payloadObj.bookDetails.topic) {
            alert("عنوان الكتاب وموضوعه ضروريان!"); return;
        }
    } else {
        payloadObj.action = 'legacy_chat';
        payloadObj.mode = actionType;
        if (actionType === 'edit') {
            if (ui.imageFile.files.length === 0) { alert("يرجى اختيار صورة للتعديل."); return; }
            payloadObj.imageBase64 = await convertToBase64(ui.imageFile.files[0]);
        }
    }

    // تجهيز الواجهة
    ui.resultArea.classList.add('hidden');
    ui.resultText.classList.add('hidden');
    ui.editableContainer.classList.add('hidden');
    ui.bookActions.classList.add('hidden');
    ui.introArea.classList.add('hidden');
    ui.resultImage.classList.add('hidden');
    ui.sourceBadge.classList.add('hidden');
    ui.sendBtn.disabled = true;

    const responseData = await executeRequest(payloadObj);
    ui.sendBtn.disabled = false;

    if (responseData && responseData.success) {
        document.getElementById('user-credits').innerText = responseData.remainingTokens;
        
        if (actionType === 'book_outline') {
            // مسح الذاكرة القديمة وتخزين الخطة الجديدة
            editHistory = []; 
            ui.bookOutlineText.innerText = responseData.data; // استخدام innerText لأنها div
            saveHistoryState(); // حفظ كأول نقطة في التاريخ
            
            ui.editableContainer.classList.remove('hidden');
            ui.bookActions.classList.remove('hidden');
        } else if (responseData.resultType === 'text') {
            ui.resultText.innerText = responseData.data;
            ui.resultText.classList.remove('hidden');
        } else if (responseData.resultType === 'image') {
            ui.resultImage.src = responseData.data;
            ui.resultImage.classList.remove('hidden');
        }
        
        if (responseData.sourceFunction) {
            ui.sourceBadge.innerHTML = `<i class="fas fa-check-circle"></i> تم التنفيذ عبر: ${responseData.sourceFunction}`;
            ui.sourceBadge.classList.remove('hidden');
        }
        ui.resultArea.classList.remove('hidden');
    } else if (responseData) {
        alert(`❌ فشل: ${responseData.error}`);
    }
});

// دالة تعديل الخطة (Refine) بالذكاء الاصطناعي
ui.refineBtn.addEventListener('click', async () => {
    const refinePrompt = ui.refinePrompt.value.trim();
    if (!refinePrompt) {
        alert("يرجى كتابة التعديلات المطلوبة!"); return;
    }

    const payloadObj = {
        userId: currentUser?.$id,
        action: 'book_outline',
        bookStep: 'refine',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        // إرسال النص من الـ div المعدل يدوياً
        previousOutline: ui.bookOutlineText.innerText, 
        prompt: refinePrompt,
        bookDetails: { title: document.getElementById('b-title').value }
    };

    ui.refineBtn.disabled = true;
    const responseData = await executeRequest(payloadObj);
    ui.refineBtn.disabled = false;

    if (responseData && responseData.success) {
        document.getElementById('user-credits').innerText = responseData.remainingTokens;
        
        ui.bookOutlineText.innerText = responseData.data; 
        saveHistoryState(); // لتراحفظ النتيجة الجديدة في ذاكةع
        ui.refinePrompt.value = ''; 
        alert("✅ تم تعديل الخطة بنجاح!");
    } else if (responseData) {
        alert(`❌ فشل التعديل: ${responseData.error}`);
    }
});

// دالة  الخطة وكتابة المقدمة
ui.writeIntroBtn.addEventListener('click', async () => {
    const payloadObj = {
        userId: currentUser?.$id,
        action: 'book_outline',
        bookStep: 'introduction',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        previousOutline: ui.bookOutlineText.innerText, // اعتماد الخطة من الـ div
        bookDetails: { 
            title: document.getElementById('b-title').value,
            topic: document.getElementById('b-topic').value
        }
    };

    ui.writeIntroBtn.disabled = true;
    const responseData = await executeRequest(payloadObj);
    ui.writeIntroBtn.disabled = false;

    if (responseData && responseData.success) {
        document.getElementById('user-credits').innerText = responseData.remainingTokens;
        ui.introText.innerText = responseData.data;
        ui.introArea.classList.remove('hidden');
        ui.introArea.scrollIntoView({ behavior: 'smooth' });
    } else if (responseData) {
        alert(`❌ فشل كتابة المقدمة: ${responseData.error}`);
    }
});

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}


async function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        if (!isLoginMode) {
            const newAccount = await account.create(ID.unique(), email, password, document.getElementById('name').value);
            await account.createEmailPasswordSession(email, password);
            await databases.createDocument(DB_ID, COLLECTION_ID, ID.unique(), { userId: newAccount.$id, tokens: 70 });
        } else {
            await account.createEmailPasswordSession(email, password);
        }
        closeModal(); 
        checkSession();
    } catch (error) { alert("خطأ: " + error.message); }
}

async function checkSession() {
    try {
        currentUser = await account.get();
        document.getElementById('login-btn').classList.add('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        fetchUserCredits();
    } catch (error) {
        document.getElementById('login-btn').classList.remove('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
        currentUser = null;
    }
}

async function logout() { await account.deleteSession('current'); location.reload(); }

async function fetchUserCredits() {
    try {
        const response = await databases.listDocuments(DB_ID, COLLECTION_ID, [ Query.equal('userId', currentUser.$id) ]);
        if (response.documents.length > 0) document.getElementById('user-credits').innerText = response.documents[0].tokens;
    } catch (error) { console.error("Error fetching credits", error); }
}

function openModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('auth-modal').style.display = 'none'; }
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('modal-title').innerText = isLoginMode ? 'تسجيل الدخول' : 'حساب جديد';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'دخول' : 'إنشاء حساب';
    document.getElementById('name').classList.toggle('hidden', isLoginMode);
    document.getElementById('toggle-auth-text').innerText = isLoginMode ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول';
}

checkSession(); 