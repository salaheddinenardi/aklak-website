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
let editHistory = [];

function saveHistoryState() {
    const currentText = document.getElementById('book-outline-text').innerText;
    if (editHistory.length === 0 || editHistory[editHistory.length - 1] !== currentText) {
        editHistory.push(currentText);
        if (editHistory.length > 50) {
            editHistory.shift();
        }
    }
}

function handleUndo() {
    if (editHistory.length > 1) {
        editHistory.pop();
        document.getElementById('book-outline-text').innerText = editHistory[editHistory.length - 1]; 
    } else if (editHistory.length === 1) {
        document.getElementById('book-outline-text').innerText = editHistory[0];
    }
}

// ==========================================
// متغيرات ودوال نظام صفحات الكتاب
// ==========================================
let bookPagesData = []; 
let currentViewedPageIndex = 0; 
let rawIntroductionText = ""; // المتغير لحفظ نص المقدمة الأصلي

// دالة لتقسيم النص الطويل إلى صفحات (حوالي 1200 حرف للصفحة)
function paginateText(text) {
    const charsPerPage = 1200;
    let pages = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
        let chunk = text.slice(currentIndex, currentIndex + charsPerPage);
        if (currentIndex + charsPerPage < text.length) {
            let lastSpace = chunk.lastIndexOf(' ');
            if (lastSpace > 0) {
                chunk = chunk.slice(0, lastSpace);
                currentIndex += lastSpace + 1;
            } else {
                currentIndex += charsPerPage;
            }
        } else {
            currentIndex += charsPerPage;
        }
        pages.push(chunk.trim());
    }
    return pages;
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
    bookOutlineText: document.getElementById('book-outline-text'),
    editableContainer: document.getElementById('editable-outline-container'),
    bookActions: document.getElementById('book-actions'),
    refinePrompt: document.getElementById('refine-prompt'),
    refineBtn: document.getElementById('refine-btn'),
    writeIntroBtn: document.getElementById('write-intro-btn'),
    undoBtn: document.getElementById('undo-btn'),
    
    // عناصر المقدمة وصفحات الكتاب
    introArea: document.getElementById('intro-area'),
    introText: document.getElementById('intro-text'),
    resultImage: document.getElementById('result-image'),
    sourceBadge: document.getElementById('source-badge'),
    imageFile: document.getElementById('image-file'),

    // العناصر المتعلقة بالصفحات
    introPagesInput: document.getElementById('intro-pages-input'),
    remainingPagesDisplay: document.getElementById('remaining-pages-display'),
    refineIntroPrompt: document.getElementById('refine-intro-prompt'),
    refineIntroBtn: document.getElementById('refine-intro-btn')
};

const pageUI = {
    prevBtn: document.getElementById('prev-page-btn'),
    nextBtn: document.getElementById('next-page-btn'),
    indicator: document.getElementById('page-indicator'),
    pageNumber: document.getElementById('page-number')
};

if (ui.undoBtn) ui.undoBtn.addEventListener('click', handleUndo);

if (ui.bookOutlineText) {
    ui.bookOutlineText.addEventListener('keyup', function(e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
            saveHistoryState();
        }
    });
}

// دالة حساب وعرض الصفحات المتبقية بشكل حي
function calculateRemainingPages() {
    if (!ui.introPagesInput) return;
    const totalPages = parseInt(document.getElementById('b-pages') ? document.getElementById('b-pages').value : 50) || 50;
    const introPages = parseInt(ui.introPagesInput.value) || 2;
    const remaining = totalPages - introPages;
    if (ui.remainingPagesDisplay) {
        ui.remainingPagesDisplay.innerText = `(المتبقي لباقي الفصول: ${remaining} صفحة)`;
    }
}

if (ui.introPagesInput) ui.introPagesInput.addEventListener('input', calculateRemainingPages);
if (document.getElementById('b-pages')) document.getElementById('b-pages').addEventListener('input', calculateRemainingPages);

// دالة عرض صفحة محددة
function renderCurrentPage() {
    if(bookPagesData.length === 0) return;
    if (ui.introText) ui.introText.innerText = bookPagesData[currentViewedPageIndex];
    if (pageUI.pageNumber) pageUI.pageNumber.innerText = currentViewedPageIndex + 1;
    if (pageUI.indicator) pageUI.indicator.innerText = 'صفحة ' + (currentViewedPageIndex + 1) + ' من ' + bookPagesData.length;
    
    if (pageUI.prevBtn) {
        if (currentViewedPageIndex === 0) pageUI.prevBtn.classList.add('hidden');
        else pageUI.prevBtn.classList.remove('hidden');
    }
    
    if (pageUI.nextBtn) {
        if (currentViewedPageIndex === bookPagesData.length - 1) pageUI.nextBtn.classList.add('hidden');
        else pageUI.nextBtn.classList.remove('hidden');
    }
}

// أزرار التنقل بين الصفحات
if (pageUI.prevBtn) {
    pageUI.prevBtn.addEventListener('click', function() {
        if (currentViewedPageIndex > 0) {
            currentViewedPageIndex--;
            renderCurrentPage();
        }
    });
}

if (pageUI.nextBtn) {
    pageUI.nextBtn.addEventListener('click', function() {
        if (currentViewedPageIndex < bookPagesData.length - 1) {
            currentViewedPageIndex++;
            renderCurrentPage();
        }
    });
}

function updateUI() {
    const source = ui.source.value;
    const action = ui.action.value;

    if (source === '6a3c7a760032067bd275') { 
        Array.from(ui.action.options).forEach(function(opt) {
            if (opt.value === 'book_outline') opt.disabled = true;
        });
        if (action === 'book_outline') ui.action.value = 'text'; 
    } else {
        Array.from(ui.action.options).forEach(function(opt) {
            opt.disabled = false;
        });
    }

    const currentAction = ui.action.value;

    if (currentAction === 'edit') {
        ui.imageUpload.classList.remove('hidden');
    } else {
        ui.imageUpload.classList.add('hidden');
    }

    if (currentAction === 'book_outline') {
        ui.bookSettings.classList.remove('hidden');
    } else {
        ui.bookSettings.classList.add('hidden');
    }

    if (currentAction === 'book_outline') {
        ui.provider.innerHTML = '<option value="gemini">Gemini 3.5 Flash (Free)</option><option value="openai">OpenAI</option><option value="cloudflare">Cloudflare</option>';
    } else if (currentAction === 'text') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (متقدم)</option><option value="cloudflare">Cloudflare (اقتصادي)</option>';
    } else if (currentAction === 'generate') {
        ui.provider.innerHTML = '<option value="cloudflare">Cloudflare (Flux)</option><option value="openai">OpenAI (DALL-E)</option>';
    } else if (currentAction === 'edit') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (تعديل صور)</option>';
    }
    
    updateModels();
    calculateRemainingPages();
}

function updateModels() {
    const action = ui.action.value;
    const provider = ui.provider.value;

    if (action === 'text' || action === 'book_outline') {
        if (provider === 'gemini') {
            ui.model.innerHTML = '<option value="gemini-3.5-flash">Gemini 3.5 Flash</option>';
        } else if (provider === 'openai') {
            ui.model.innerHTML = '<option value="gpt-4o">GPT-4o (8 نقاط)</option><option value="gpt-5.4-mini">GPT-5.4-mini (10 نقاط)</option><option value="gpt-5.5">GPT-5.5 (15 نقطة)</option>';
        } else {
            ui.model.innerHTML = '<option value="llama">LLaMA 3.3 (5 نقاط)</option>';
        }
    } else {
        if (provider === 'openai') {
            ui.model.innerHTML = '<option value="light">عادي (10 نقاط)</option><option value="mid">متوسط (15 نقطة)</option><option value="pro">Pro (20 نقطة)</option>';
        } else {
            ui.model.innerHTML = '<option value="flux">Flux (5 نقاط)</option>';
        }
    }
}

if (ui.source) ui.source.addEventListener('change', updateUI);
if (ui.action) ui.action.addEventListener('change', updateUI);
if (ui.provider) ui.provider.addEventListener('change', updateModels);
window.addEventListener('DOMContentLoaded', updateUI);

// ==========================================
// 3. التفاعل مع الخادم (Appwrite Functions)
// ==========================================
async function executeRequest(payloadObj) {
    if (!currentUser) { 
        alert("يرجى تسجيل الدخول أولاً.");
        openModal(); 
        return null; 
    }

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
if (ui.sendBtn) {
    ui.sendBtn.addEventListener('click', async function() {
        const actionType = ui.action.value;
        
        if (!ui.prompt.value.trim() && actionType !== 'book_outline') { 
            alert("يرجى إدخال نص الطلب!"); 
            return; 
        }

        let payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            prompt: ui.prompt.value,
            provider: ui.provider.value,
            modelTier: ui.model.value
        };

        if (actionType === 'book_outline') {
            const bGenreSelect = document.getElementById('b-genre');
            const bCustomGenre = document.getElementById('b-custom-genre');
            const rawGenre = bGenreSelect ? bGenreSelect.value : '';
            const finalGenre = (rawGenre === 'other' && bCustomGenre) ? bCustomGenre.value : rawGenre;
            
            const bPagesInput = document.getElementById('b-pages');
            let pages = bPagesInput ? parseInt(bPagesInput.value) : 50;
            if (isNaN(pages) || pages < 50) pages = 50;
            
            payloadObj.action = 'book_outline';
            payloadObj.bookDetails = {
                title: document.getElementById('b-title') ? document.getElementById('b-title').value : '',
                topic: document.getElementById('b-topic') ? document.getElementById('b-topic').value : '',
                genre: finalGenre,
                structure: document.getElementById('b-structure') ? document.getElementById('b-structure').value : '',
                maxPages: pages,
                audience: document.getElementById('b-audience') ? document.getElementById('b-audience').value : '',
                tone: document.getElementById('b-tone') ? document.getElementById('b-tone').value : '',
                pov: document.getElementById('b-pov') ? document.getElementById('b-pov').value : '',
                language: document.getElementById('b-language') ? document.getElementById('b-language').value : '',
                imagesType: document.getElementById('b-images') ? document.getElementById('b-images').value : '',
                coverPrompt: document.getElementById('b-cover') ? document.getElementById('b-cover').value : ''
            };
            if(!payloadObj.bookDetails.title || !payloadObj.bookDetails.topic) {
                alert("عنوان الكتاب وموضوعه ضروريان!");
                return;
            }
        } else {
            payloadObj.action = 'legacy_chat';
            payloadObj.mode = actionType;
            if (actionType === 'edit') {
                if (ui.imageFile.files.length === 0) { 
                    alert("يرجى اختيار صورة للتعديل.");
                    return; 
                }
                payloadObj.imageBase64 = await convertToBase64(ui.imageFile.files[0]);
            }
        }

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
            const creditsElem = document.getElementById('user-credits');
            if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
            
            if (actionType === 'book_outline') {
                editHistory = [];
                ui.bookOutlineText.innerText = responseData.data; 
                saveHistoryState(); 
                
                ui.editableContainer.classList.remove('hidden');
                ui.bookActions.classList.remove('hidden');
                calculateRemainingPages();
            } else if (responseData.resultType === 'text') {
                ui.resultText.innerText = responseData.data;
                ui.resultText.classList.remove('hidden');
            } else if (responseData.resultType === 'image') {
                ui.resultImage.src = responseData.data;
                ui.resultImage.classList.remove('hidden');
            }
            
            if (responseData.sourceFunction) {
                ui.sourceBadge.innerHTML = '<i class="fas fa-check-circle"></i> تم التنفيذ عبر: ' + responseData.sourceFunction;
                ui.sourceBadge.classList.remove('hidden');
            }
            ui.resultArea.classList.remove('hidden');
        } else if (responseData) {
            alert("❌ فشل: " + responseData.error);
        }
    });
}

// دالة تعديل الخطة
if (ui.refineBtn) {
    ui.refineBtn.addEventListener('click', async function() {
        const refinePrompt = ui.refinePrompt.value.trim();
        if (!refinePrompt) {
            alert("يرجى كتابة التعديلات المطلوبة!"); 
            return;
        }

        const payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            action: 'book_outline',
            bookStep: 'refine',
            provider: ui.provider.value,
            modelTier: ui.model.value,
            previousOutline: ui.bookOutlineText.innerText, 
            prompt: refinePrompt,
            bookDetails: { 
                title: document.getElementById('b-title') ? document.getElementById('b-title').value : '' 
            }
        };

        ui.refineBtn.disabled = true;
        const responseData = await executeRequest(payloadObj);
        ui.refineBtn.disabled = false;

        if (responseData && responseData.success) {
            const creditsElem = document.getElementById('user-credits');
            if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
            
            ui.bookOutlineText.innerText = responseData.data; 
            saveHistoryState(); 
            ui.refinePrompt.value = ''; 
            calculateRemainingPages();
            alert("✅ تم تعديل الخطة بنجاح!");
        } else if (responseData) {
            alert("❌ فشل التعديل: " + responseData.error);
        }
    });
}

// دالة اعتماد الخطة وكتابة المقدمة
if (ui.writeIntroBtn) {
    ui.writeIntroBtn.addEventListener('click', async function() {
        const payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            action: 'book_outline',
            bookStep: 'introduction',
            provider: ui.provider.value,
            modelTier: ui.model.value,
            previousOutline: ui.bookOutlineText.innerText, 
            bookDetails: { 
                title: document.getElementById('b-title') ? document.getElementById('b-title').value : '',
                topic: document.getElementById('b-topic') ? document.getElementById('b-topic').value : '',
                introPages: parseInt(ui.introPagesInput ? ui.introPagesInput.value : 2)
            }
        };

        ui.writeIntroBtn.disabled = true;
        ui.writeIntroBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الكتابة...';

        const responseData = await executeRequest(payloadObj);
        ui.writeIntroBtn.disabled = false;
        ui.writeIntroBtn.innerHTML = '<i class="fas fa-rocket"></i> اعتماد الخطة الحالية وكتابة المقدمة';

        if (responseData && responseData.success) {
            const creditsElem = document.getElementById('user-credits');
            if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
            
            rawIntroductionText = responseData.data; 
            bookPagesData = paginateText(rawIntroductionText);
            currentViewedPageIndex = 0;
            
            ui.introArea.style.display = 'flex'; 
            ui.introArea.classList.remove('hidden');
            renderCurrentPage();
            
            ui.introArea.scrollIntoView({ behavior: 'smooth' });
        } else if (responseData) {
            alert("❌ فشل كتابة المقدمة: " + responseData.error);
        }
    });
}

// التعديل الذكي على المقدمة
if (ui.refineIntroBtn) {
    ui.refineIntroBtn.addEventListener('click', async function() {
        const promptText = ui.refineIntroPrompt ? ui.refineIntroPrompt.value.trim() : '';
        if (!promptText) { alert("يرجى كتابة التعديل الذي تريده على المقدمة أولاً!"); return; }

        const payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            action: 'book_outline',
            bookStep: 'refine_intro', 
            provider: ui.provider.value,
            modelTier: ui.model.value,
            previousOutline: ui.bookOutlineText.innerText, 
            currentIntro: rawIntroductionText, 
            prompt: promptText, 
            bookDetails: { 
                title: document.getElementById('b-title') ? document.getElementById('b-title').value : '',
                introPages: parseInt(ui.introPagesInput ? ui.introPagesInput.value : 2)
            }
        };

        ui.refineIntroBtn.disabled = true;
        ui.refineIntroBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التعديل...';

        const responseData = await executeRequest(payloadObj);
        ui.refineIntroBtn.disabled = false;
        ui.refineIntroBtn.innerHTML = '<i class="fas fa-sync-alt"></i> إعادة كتابة المقدمة';

        if (responseData && responseData.success) {
            const creditsElem = document.getElementById('user-credits');
            if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
            
            rawIntroductionText = responseData.data;
            bookPagesData = paginateText(rawIntroductionText);
            currentViewedPageIndex = 0;
            renderCurrentPage();
            
            if (ui.refineIntroPrompt) ui.refineIntroPrompt.value = ''; 
            alert("✅ تم تعديل المقدمة بنجاح!");
        } else if (responseData) {
            alert("❌ فشل تعديل المقدمة: " + responseData.error);
        }
    });
}

// ==========================================
// 4. نظام التأليف الأوتوماتيكي والمراقبة (الجديد)
// ==========================================
let currentAutoBookId = null;
let pollingInterval = null;

const startAutoBtn = document.getElementById('start-auto-btn');
const statusBox = document.getElementById('auto-generation-status');
const newBookBtn = document.getElementById('new-book-btn');
const mainInputsWrapper = document.getElementById('main-inputs-wrapper');

// إرسال طلب البدء للباك إند
if (startAutoBtn) {
    startAutoBtn.addEventListener('click', async function() {
        if (!currentUser) { alert("يرجى تسجيل الدخول أولاً."); return; }
        if (bookPagesData.length === 0) { alert("يجب كتابة والموافقة على المقدمة أولاً قبل توليد باقي الكتاب."); return; }

        const payloadObj = {
            userId: currentUser.$id,
            action: 'start_auto_write',
            provider: ui.provider.value,
            modelTier: ui.model.value,
            outline: ui.bookOutlineText.innerText,
            introPagesArray: bookPagesData, // نرسل المصفوفة كاملة للباك إند
            targetPages: parseInt(document.getElementById('b-pages').value) || 50,
            title: document.getElementById('b-title').value || 'كتاب بدون عنوان'
        };

        startAutoBtn.disabled = true;
        startAutoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب وإعداد الذاكرة...';

        const responseData = await executeRequest(payloadObj);

        startAutoBtn.disabled = false;
        startAutoBtn.innerHTML = '<i class="fas fa-bolt"></i> بدء التأليف الأوتوماتيكي بالكامل في الخلفية';

        if (responseData && responseData.success) {
            // تحديث الرصيد
            const creditsElem = document.getElementById('user-credits');
            if (creditsElem) creditsElem.innerText = responseData.remainingTokens;

            currentAutoBookId = responseData.bookId;
            
            // إخفاء الواجهات وإظهار العداد
            mainInputsWrapper.classList.add('hidden');
            statusBox.classList.remove('hidden');
            newBookBtn.classList.remove('hidden');
            
            alert("✅ تم إرسال الطلب بنجاح وتم خصم 40 نقطة. الذكاء الاصطناعي يقوم الآن بالتأليف في الخلفية!");
            
            startPolling();
        } else if (responseData) {
            alert("❌ فشل بدء التأليف الأوتوماتيكي: " + responseData.error);
        }
    });
}

// دالة لإظهار أو إخفاء محتوى الكتاب أثناء التأليف
window.toggleMainInputs = function() {
    mainInputsWrapper.classList.toggle('hidden');
}

// دالة المراقبة التي تسأل قاعدة البيانات كل 10 ثواني
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        if (!currentAutoBookId) return;
        try {
            const bookDoc = await databases.getDocument(DB_ID, 'books', currentAutoBookId);
            
            // تحديث الرقم في الواجهة
            document.getElementById('progress-count').innerText = bookDoc.generated_pages_count || bookPagesData.length;
            
            if (bookDoc.status === 'completed') {
                document.getElementById('status-title').innerHTML = "<i class='fas fa-check-circle'></i> 🎉 اكتمل تأليف الكتاب بنجاح!";
                clearInterval(pollingInterval);
                
                // تحديث الـ array لتمكين المستخدم من قراءة جميع الصفحات الجديدة المضافة
                if(bookDoc.content_pages) {
                    const allPages = JSON.parse(bookDoc.content_pages);
                    bookPagesData = allPages; 
                    renderCurrentPage(); 
                }
            }
        } catch (err) {
            console.error("خطأ في جلب حالة الكتاب:", err);
        }
    }, 10000); // تحديث كل 10 ثوانٍ
}

// دالة زر إنشاء كتاب جديد
window.resetForNewBook = function() {
    if (pollingInterval) clearInterval(pollingInterval);
    currentAutoBookId = null;
    
    statusBox.classList.add('hidden');
    newBookBtn.classList.add('hidden');
    document.getElementById('status-title').innerHTML = "<i class='fas fa-cog fa-spin'></i> يتم الآن تأليف الكتاب في الخلفية...";
    document.getElementById('progress-count').innerText = "0";
    
    mainInputsWrapper.classList.remove('hidden');
    
    // تصفير الواجهة وإخفاء مناطق النتائج للبدء من الصفر
    bookPagesData = [];
    ui.bookOutlineText.innerText = "";
    ui.introArea.classList.add('hidden');
    ui.resultArea.classList.add('hidden');
    
    updateUI(); 
}

// ==========================================
// 5. أدوات التحويل والمصادقة
// ==========================================
function convertToBase64(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function(error) { reject(error); };
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
    } catch (error) { 
        alert("خطأ: " + error.message);
    }
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

async function logout() { 
    await account.deleteSession('current'); 
    location.reload();
}

async function fetchUserCredits() {
    try {
        const response = await databases.listDocuments(DB_ID, COLLECTION_ID, [ Query.equal('userId', currentUser.$id) ]);
        if (response.documents.length > 0) {
            document.getElementById('user-credits').innerText = response.documents[0].tokens;
        }
    } catch (error) { 
        console.error("Error fetching credits", error);
    }
}

function openModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('auth-modal').style.display = 'none'; }

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('modal-title').innerText = isLoginMode ? 'تسجيل الدخول' : 'حساب جديد';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'دخول' : 'إنشاء حساب';
    
    if (isLoginMode) {
        document.getElementById('name').classList.add('hidden');
    } else {
        document.getElementById('name').classList.remove('hidden');
    }
    document.getElementById('toggle-auth-text').innerText = isLoginMode ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول';
}

checkSession();