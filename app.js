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
    bookOutlineText: document.getElementById('book-outline-text'),
    resultImage: document.getElementById('result-image'),
    sourceBadge: document.getElementById('source-badge'),
    imageFile: document.getElementById('image-file')
};

function updateUI() {
    const source = ui.source.value;
    const action = ui.action.value;

    // التحكم في توفر خيار "تأليف كتاب" بناءً على المصدر
    if (source === '6a3c7a760032067bd275') { 
        Array.from(ui.action.options).forEach(opt => {
            if (opt.value === 'book_outline') opt.disabled = true;
        });
        if (action === 'book_outline') ui.action.value = 'text'; 
    } else {
        Array.from(ui.action.options).forEach(opt => opt.disabled = false);
    }

    const currentAction = ui.action.value;

    // إظهار/إخفاء الأقسام
    ui.imageUpload.classList.toggle('hidden', currentAction !== 'edit');
    ui.bookSettings.classList.toggle('hidden', currentAction !== 'book_outline');

    // تحديث المزودين
    if (currentAction === 'text' || currentAction === 'book_outline') {
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
        if (provider === 'openai') {
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
// 3. الإرسال للباك إند
// ==========================================

// دالة مساعدة لجمع معلومات الكتاب
function getBookDetails() {
    const rawGenre = document.getElementById('b-genre').value;
    const finalGenre = rawGenre === 'other' ? document.getElementById('b-custom-genre').value : rawGenre;
    
    let pages = parseInt(document.getElementById('b-pages').value);
    if (isNaN(pages) || pages < 50) pages = 50;

    return {
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
}

// دالة إرسال طلبات الكتب (الخطة، التعديل، المقدمة)
async function sendBookRequest(step, refineText = "") {
    ui.loader.classList.remove('hidden');
    
    let payloadObj = {
        userId: currentUser.$id,
        action: 'book_outline',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        bookStep: step,
        bookDetails: getBookDetails()
    };

    if (step === 'refine') {
        payloadObj.previousOutline = ui.bookOutlineText.value;
        payloadObj.prompt = refineText;
    } else if (step === 'introduction') {
        payloadObj.previousOutline = ui.bookOutlineText.value;
    } else {
        payloadObj.prompt = ui.prompt.value;
    }

    try {
        const execution = await appwriteFunctions.createExecution(
            ui.source.value, JSON.stringify(payloadObj), false, '/', 'POST', { 'Content-Type': 'application/json' }
        );
        
        if (execution.status === 'failed') throw new Error("حدث خطأ داخلي في السيرفر.");

        const responseData = JSON.parse(execution.responseBody);
        
        if (responseData.success) {
            document.getElementById('user-credits').innerText = responseData.remainingTokens;
            
            if (step === 'introduction') {
                document.getElementById('intro-text').innerText = responseData.data;
                document.getElementById('intro-area').classList.remove('hidden');
            } else {
                ui.bookOutlineText.value = responseData.data;
                ui.bookOutlineText.classList.remove('hidden');
                document.getElementById('book-actions').classList.remove('hidden');
            }
            
            if (responseData.sourceFunction) {
                ui.sourceBadge.innerHTML = `<i class="fas fa-check-circle"></i> تم التنفيذ عبر: ${responseData.sourceFunction}`;
                ui.sourceBadge.classList.remove('hidden');
            }
        } else {
            alert(`❌ فشل: ${responseData.error}`);
        }
    } catch (error) {
        console.error(error);
        alert("❌ حدث خطأ أثناء الاتصال بالدالة.");
    } finally {
        ui.loader.classList.add('hidden');
    }
}

// زر الإرسال الرئيسي
ui.sendBtn.addEventListener('click', async () => {
    if (!currentUser) { alert("يرجى تسجيل الدخول أولاً."); openModal(); return; }
    
    const actionType = ui.action.value;
    
    if (actionType === 'book_outline') {
        const details = getBookDetails();
        if(!details.title || !details.topic) { alert("عنوان الكتاب وموضوعه ضروريان!"); return; }
        
        ui.resultArea.classList.remove('hidden');
        ui.resultText.classList.add('hidden');
        ui.resultImage.classList.add('hidden');
        document.getElementById('book-actions')?.classList.add('hidden');
        document.getElementById('intro-area')?.classList.add('hidden');
        
        await sendBookRequest('outline');
    } else {
        // أدوات المحادثة القديمة وتعديل الصور
        if (!ui.prompt.value.trim()) { alert("يرجى إدخال نص الطلب!"); return; }

        let payloadObj = {
            userId: currentUser.$id,
            prompt: ui.prompt.value,
            provider: ui.provider.value,
            modelTier: ui.model.value,
            action: 'legacy_chat',
            mode: actionType
        };

        if (actionType === 'edit') {
            if (ui.imageFile.files.length === 0) { alert("يرجى اختيار صورة للتعديل."); return; }
            payloadObj.imageBase64 = await convertToBase64(ui.imageFile.files[0]);
        }

        ui.loader.classList.remove('hidden');
        ui.resultArea.classList.add('hidden');
        ui.resultText.classList.add('hidden');
        ui.bookOutlineText.classList.add('hidden');
        document.getElementById('book-actions')?.classList.add('hidden');
        ui.resultImage.classList.add('hidden');
        ui.sourceBadge.classList.add('hidden');
        ui.sendBtn.disabled = true;

        try {
            const execution = await appwriteFunctions.createExecution(
                ui.source.value, JSON.stringify(payloadObj), false, '/', 'POST', { 'Content-Type': 'application/json' }
            );

            if (execution.status === 'failed') throw new Error("حدث خطأ داخلي في السيرفر.");

            const responseData = JSON.parse(execution.responseBody);
            
            if (responseData.success) {
                document.getElementById('user-credits').innerText = responseData.remainingTokens;
                
                if (responseData.resultType === 'text') {
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
            } else {
                alert(`❌ فشل: ${responseData.error}`);
            }
        } catch (error) {
            console.error(error);
            alert("❌ حدث خطأ أثناء الاتصال بالدالة.");
        } finally {
            ui.loader.classList.add('hidden');
            ui.sendBtn.disabled = false;
        }
    }
});

// تفعيل زر التعديل
document.getElementById('refine-btn').addEventListener('click', async () => {
    const refineText = document.getElementById('refine-prompt').value;
    if (!refineText.trim()) { alert("يرجى كتابة التعديل المطلوب."); return; }
    await sendBookRequest('refine', refineText);
});

// تفعيل زر كتابة المقدمة
document.getElementById('write-intro-btn').addEventListener('click', async () => {
    await sendBookRequest('introduction');
});

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// 4. دوال المصادقة
// ==========================================
function openModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('auth-modal').style.display = 'none'; }
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('modal-title').innerText = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'دخول' : 'إنشاء حساب';
    document.getElementById('name').classList.toggle('hidden', isLoginMode);
    document.getElementById('toggle-auth-text').innerText = isLoginMode ? 'لديك حساب؟ دخول' : 'إنشاء حساب جديد';
}

async function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    try {
        if (!isLoginMode) {
            const newAccount = await account.create(ID.unique(), email, password, name);
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
    } catch (error) { console.error("Error fetching credits:", error); }
}

window.onload = checkSession;