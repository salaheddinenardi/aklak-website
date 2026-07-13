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
const SECOND_FUNCTION_ID = '6a445f680013960a14c6';
const AGENT_AVATAR_URL = 'https://static.verse.works/image/source/static%2Fuploads%2F0x7c1bd459dae8ec0bb45fe3172fd58a2b53972e5c%2Fc96cf9cb-273c-4b48-b7ba-7193e06b0336.gif';
const MODEL_MEMORY_KEY = 'aklake_remembered_models_v1';
const MODEL_CATALOG = {
    text: [
        { provider: 'cloudflare', model: 'llama', name: 'LLaMA 3.3', description: 'اقتصادي للمحادثات اليومية', cost: '5 نقاط', icon: 'fa-feather' },
        { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o', description: 'متوازن وسريع للمحادثة', cost: '8 نقاط', icon: 'fa-bolt' },
        { provider: 'openai', model: 'gpt-5.4-mini', name: 'GPT-5.4 mini', description: 'تفكير أقوى وتكلفة متوسطة', cost: '10 نقاط', icon: 'fa-brain' },
        { provider: 'openai', model: 'gpt-5.5', name: 'GPT-5.5', description: 'أعلى جودة ضمن الإعدادات الحالية', cost: '15 نقطة', icon: 'fa-gem' }
    ],
    generate: [
        {
            provider: 'openai',
            model: 'gpt-image-2',
            modelTier: 'pro',
            quality: 'high',
            name: 'OpenAI Image — توليد',
            description: 'إنشاء صورة جديدة من الصفر بأعلى جودة',
            cost: '20 نقطة',
            icon: 'fa-wand-magic-sparkles'
        }
    ],
    edit: [
        {
            provider: 'openai',
            model: 'gpt-image-1-mini',
            modelTier: 'light',
            quality: 'low',
            name: 'تعديل بسيط',
            description: 'تعديل سريع واقتصادي للصورة',
            cost: '10 نقاط',
            icon: 'fa-pen'
        },
        {
            provider: 'openai',
            model: 'gpt-image-2',
            modelTier: 'pro',
            quality: 'high',
            name: 'تعديل احترافي',
            description: 'أعلى دقة في الحفاظ على تفاصيل الصورة',
            cost: '20 نقطة',
            icon: 'fa-crown'
        }
    ]
};

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
// متغيرات ودوال نظام صفحات الكتاب والتعديلات الجديدة
// ==========================================
// ==========================================
let bookPagesData = []; 
let currentViewedPageIndex = 0; 
let rawBookTextFull = ""; // للاحتفاظ بالنص الخام قبل التقسيم

let currentFontSize = 1.15; // الحجم الافتراضي

// التحكم في حجم الخط
window.changeFontSize = function(direction) {
    const textContainer = document.getElementById('intro-text');
    if (direction > 0 && currentFontSize < 2.5) currentFontSize += 0.1;
    if (direction < 0 && currentFontSize > 0.8) currentFontSize -= 0.1;
    textContainer.style.fontSize = currentFontSize + 'em';
}

// التحكم في خلفية الكتاب
window.changeBookTheme = function(themeClass) {
    const container = document.getElementById('book-container');
    container.classList.remove('theme-white', 'theme-sepia', 'theme-dark');
    container.classList.add(themeClass);
}

// الدالة الذكية لتقسيم النص لصفحات مع استخراج العناوين
function smartPaginateText(rawText, targetPages) {
    // 1. استخراج أول عنوان (بين ** **) للغلاف
    const firstTitleMatch = rawText.match(/\*\*(.*?)\*\*/);
    const coverElement = document.getElementById('book-cover-display');
    if (firstTitleMatch) {
        coverElement.innerText = firstTitleMatch[1];
        coverElement.classList.remove('hidden');
    } else {
        coverElement.classList.add('hidden');
    }

    // 2. تحويل علامات ** ** إلى HTML ليكون العنوان كبيراً
    let formattedText = rawText.replace(/\*\*(.*?)\*\*/g, '<div class="book-heading">$1</div>');

    let pages = [];
    let totalLength = formattedText.length;
    
    // إذا كان المستخدم يطلب صفحة واحدة فقط، نعطيه النص كاملاً
    if (targetPages <= 1) {
        return [formattedText];
    }

    let avgCharsPerPage = Math.ceil(totalLength / targetPages);
    let currentIndex = 0;

    for (let i = 0; i < targetPages; i++) {
        if (i === targetPages - 1) {
            pages.push(formattedText.slice(currentIndex).trim());
            break;
        }

        let chunkEnd = currentIndex + avgCharsPerPage;
        if (chunkEnd >= totalLength) {
            pages.push(formattedText.slice(currentIndex).trim());
            break;
        }

        // محاولة إيجاد مكان مناسب للقطع (قبل عنوان، أو فقرة، أو مسافة)
        let chunk = formattedText.slice(currentIndex, chunkEnd + 300); 
        let headingIndex = chunk.indexOf('<div class="book-heading">');

        // إذا وجدنا عنواناً في النصف الثاني من الصفحة، نقطع قبله ليبدأ في الصفحة التالية
        if (headingIndex !== -1 && headingIndex > avgCharsPerPage * 0.4) {
            chunkEnd = currentIndex + headingIndex;
        } else {
            // محاولة القطع عند مسافة مزدوجة (نهاية فقرة)
            let lastNewline = formattedText.lastIndexOf('\n\n', chunkEnd);
            if (lastNewline > currentIndex) {
                chunkEnd = lastNewline;
            } else {
                let lastSpace = formattedText.lastIndexOf(' ', chunkEnd);
                if (lastSpace > currentIndex) chunkEnd = lastSpace;
            }
        }

        pages.push(formattedText.slice(currentIndex, chunkEnd).trim());
        currentIndex = chunkEnd;
    }
    return pages.filter(p => p.trim() !== ""); // إزالة الصفحات الفارغة إن وجدت
}

// تطبيق التقسيم بناءً على طلب المستخدم
window.recalculatePages = function() {
    if (!rawBookTextFull) return;
    const targetInput = document.getElementById('target-pages-input');
    let target = parseInt(targetInput.value) || 5;
    
    bookPagesData = smartPaginateText(rawBookTextFull, target);
    currentViewedPageIndex = 0;
    renderCurrentPage();
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
 
    introArea: document.getElementById('intro-area'),
    introText: document.getElementById('intro-text'),
    resultImage: document.getElementById('result-image'),
    sourceBadge: document.getElementById('source-badge'),
    imageFile: document.getElementById('image-file'),

    introPagesInput: document.getElementById('intro-pages-input'),
    remainingPagesDisplay: document.getElementById('remaining-pages-display'),
    refineIntroPrompt: document.getElementById('refine-intro-prompt'),
    refineIntroBtn: document.getElementById('refine-intro-btn'),

    appShell: document.getElementById('app-shell'),
    welcomeScreen: document.getElementById('welcome-screen'),
    quickPrompt: document.getElementById('quick-chat-prompt'),
    openChatBtn: document.getElementById('open-chat-btn'),
    chatMessages: document.getElementById('chat-messages'),
    advancedSettings: document.getElementById('advanced-settings'),
    settingsToggle: document.getElementById('settings-toggle-btn'),
    workspaceTitle: document.getElementById('workspace-title'),
    workspaceKicker: document.getElementById('workspace-kicker'),
    activeModelLabel: document.getElementById('active-model-label'),
    attachBtn: document.getElementById('composer-attach-btn'),
    imageModeBtn: document.getElementById('composer-image-mode-btn'),
    modelBtn: document.getElementById('composer-model-btn'),
    modeBanner: document.getElementById('composer-mode-banner'),
    modeTitle: document.getElementById('composer-mode-title'),
    modeDescription: document.getElementById('composer-mode-description'),
    modeCloseBtn: document.getElementById('composer-mode-close-btn'),
    attachmentPreview: document.getElementById('composer-attachment-preview'),
    attachmentImage: document.getElementById('composer-attachment-image'),
    attachmentName: document.getElementById('composer-attachment-name'),
    removeAttachmentBtn: document.getElementById('remove-composer-attachment-btn'),
    modelPopover: document.getElementById('model-chooser-popover'),
    modelChoicesList: document.getElementById('model-choices-list'),
    modelChooserTitle: document.getElementById('model-chooser-title'),
    modelChooserDescription: document.getElementById('model-chooser-description'),
    rememberModelToggle: document.getElementById('remember-model-toggle'),
    confirmModelBtn: document.getElementById('confirm-model-choice-btn')
};
const pageUI = {
    prevBtn: document.getElementById('prev-page-btn'),
    nextBtn: document.getElementById('next-page-btn'),
    indicator: document.getElementById('page-indicator'),
    pageNumber: document.getElementById('page-number'),
    continueBtn: document.getElementById('continue-writing-btn')
};
if (ui.undoBtn) ui.undoBtn.addEventListener('click', handleUndo);

if (ui.bookOutlineText) {
    ui.bookOutlineText.addEventListener('keyup', function(e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
            saveHistoryState();
        }
    });
}

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

// --- تعديل: إرجاع العرض لصفحة واحدة وعرض أزرار التنقل ---
function renderCurrentPage() {
    if (ui.introText && bookPagesData.length > 0) {
        ui.introText.innerHTML = bookPagesData[currentViewedPageIndex] || "";
    }
    
    // تحديث أرقام الصفحات
    if (pageUI.pageNumber) {
        pageUI.pageNumber.innerText = currentViewedPageIndex + 1;
        pageUI.pageNumber.classList.remove('hidden');
    }
    if (pageUI.indicator) {
        pageUI.indicator.innerText = `صفحة ${currentViewedPageIndex + 1} من ${bookPagesData.length}`;
        pageUI.indicator.classList.remove('hidden');
    }

    // إظهار وإخفاء أزرار التنقل بناءً على الموقع الحالي
    if (pageUI.prevBtn) {
        pageUI.prevBtn.classList.remove('hidden');
        pageUI.prevBtn.disabled = currentViewedPageIndex === 0;
        if(currentViewedPageIndex === 0) pageUI.prevBtn.style.opacity = '0.5'; else pageUI.prevBtn.style.opacity = '1';
    }
    if (pageUI.nextBtn) {
        pageUI.nextBtn.classList.remove('hidden');
        pageUI.nextBtn.disabled = currentViewedPageIndex === bookPagesData.length - 1;
        if(currentViewedPageIndex === bookPagesData.length - 1) pageUI.nextBtn.style.opacity = '0.5'; else pageUI.nextBtn.style.opacity = '1';
    }
}

if (pageUI.prevBtn) {
    pageUI.prevBtn.addEventListener('click', function() {
        if (currentViewedPageIndex > 0) {
            currentViewedPageIndex--;
            renderCurrentPage();
            document.getElementById('book-container').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

if (pageUI.nextBtn) {
    pageUI.nextBtn.addEventListener('click', function() {
        if (currentViewedPageIndex < bookPagesData.length - 1) {
            currentViewedPageIndex++;
            renderCurrentPage();
            document.getElementById('book-container').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

if (pageUI.continueBtn) {
    pageUI.continueBtn.addEventListener('click', function() {
        alert("سيتم برمجة زر الإكمال لاحقاً ليأخذ النص الحالي ويطلب من الذكاء الاصطناعي إكمال الفصل الأول.");
    });
}

// ==========================================
// واجهة المحادثة الاحترافية والتنقل بين الأدوات
// ==========================================
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

    const artStudio = document.getElementById('art-studio');
    if (artStudio) {
        artStudio.classList.toggle('hidden', currentAction !== 'art_studio');
    }
    const landingStudio = document.getElementById('landing-page-studio');
    if (landingStudio) {
        landingStudio.classList.toggle('hidden', currentAction !== 'landing_page');
    }

    if (currentAction === 'book_outline') {
        ui.provider.innerHTML = '<option value="gemini">Gemini 3.5 Flash (Free)</option><option value="openai">OpenAI</option><option value="cloudflare">Cloudflare</option>';
    } else if (currentAction === 'art_studio') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (أقوى تعديل وتوليد)</option>';
    } else if (currentAction === 'landing_page') {
        ui.provider.innerHTML = '<option value="openai">OpenAI — الكود الوظيفي الثاني</option>';
    } else if (currentAction === 'text') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (متقدم)</option><option value="cloudflare">Cloudflare (اقتصادي)</option>';
    } else if (currentAction === 'generate') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (توليد الصور)</option>';
    } else if (currentAction === 'edit') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (تعديل الصور)</option>';
    }
    
    updateModels();
    calculateRemainingPages();
    syncWorkspaceFromSelections();
}

function updateModels() {
    const action = ui.action.value;
    const provider = ui.provider.value;
    if (action === 'art_studio') {
        ui.model.innerHTML = '<option value="gpt-image-2">GPT Image 2</option>';
    } else if (action === 'landing_page') {
        ui.model.innerHTML = '<option value="gpt-4o-mini">GPT-4 اقتصادي (8 نقاط)</option><option value="gpt-4o" selected>GPT-4 متوازن (14 نقطة)</option><option value="gpt-5">GPT-5 الأفضل (24 نقطة)</option>';
    } else if (action === 'text' || action === 'book_outline') {
        if (provider === 'gemini') {
            ui.model.innerHTML = '<option value="gemini-3.5-flash">Gemini 3.5 Flash</option>';
        } else if (provider === 'openai') {
            ui.model.innerHTML = '<option value="gpt-4o">GPT-4o (8 نقاط)</option><option value="gpt-5.4-mini">GPT-5.4-mini (10 نقاط)</option><option value="gpt-5.5">GPT-5.5 (15 نقطة)</option>';
        } else {
            ui.model.innerHTML = '<option value="llama">LLaMA 3.3 (5 نقاط)</option>';
        }
    } else if (action === 'generate') {
        ui.model.innerHTML = '<option value="gpt-image-2">GPT Image 2 — توليد من الصفر (20 نقطة)</option>';
    } else if (action === 'edit') {
        ui.model.innerHTML = '<option value="gpt-image-1-mini">GPT Image 1 mini — تعديل بسيط (10 نقاط)</option><option value="gpt-image-2">GPT Image 2 — تعديل احترافي (20 نقطة)</option>';
    }
    syncWorkspaceFromSelections();
}

if (ui.source) ui.source.addEventListener('change', updateUI);
if (ui.action) ui.action.addEventListener('change', updateUI);
if (ui.provider) ui.provider.addEventListener('change', updateModels);
if (ui.model) ui.model.addEventListener('change', syncWorkspaceFromSelections);

window.addEventListener('DOMContentLoaded', function() {
    ui.source.value = SECOND_FUNCTION_ID;
    updateUI();
    initHomeNavigation();
    initArtStudio();
    initCreationLibrary();
    initLandingPageStudio();

    document.querySelectorAll('[data-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.tool); });
    });
    document.querySelectorAll('[data-welcome-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.welcomeTool); });
    });

    if (ui.settingsToggle) {
        ui.settingsToggle.addEventListener('click', function() {
            if (getComposerModeKey(ui.action.value)) openModelChooser(ui.action.value, false);
            else ui.advancedSettings.classList.toggle('hidden');
        });
    }

    if (ui.modelBtn) ui.modelBtn.addEventListener('click', function() { openModelChooser(ui.action.value, false); });
    const closeModelChooserBtn = document.getElementById('close-model-chooser-btn');
    if (closeModelChooserBtn) closeModelChooserBtn.addEventListener('click', closeModelChooser);
    if (ui.confirmModelBtn) ui.confirmModelBtn.addEventListener('click', confirmModelChoice);
    if (ui.rememberModelToggle) {
        ui.rememberModelToggle.addEventListener('change', function() {
            const icon = document.querySelector('.remember-toggle-icon');
            if (icon) {
                icon.classList.toggle('fa-toggle-on', ui.rememberModelToggle.checked);
                icon.classList.toggle('fa-toggle-off', !ui.rememberModelToggle.checked);
            }
        });
    }

    if (ui.attachBtn && ui.imageFile) ui.attachBtn.addEventListener('click', function() { ui.imageFile.click(); });
    if (ui.imageFile) {
        ui.imageFile.addEventListener('change', function() {
            if (ui.imageFile.files && ui.imageFile.files[0]) showComposerAttachment(ui.imageFile.files[0]);
        });
    }
    if (ui.removeAttachmentBtn) ui.removeAttachmentBtn.addEventListener('click', function() { clearComposerAttachment(true); });
    if (ui.imageModeBtn) {
        ui.imageModeBtn.addEventListener('click', function() {
            if (ui.action.value === 'generate') setUnifiedComposerMode('text');
            else {
                clearComposerAttachment(false);
                setUnifiedComposerMode('generate');
            }
        });
    }
    if (ui.modeCloseBtn) ui.modeCloseBtn.addEventListener('click', function() {
        clearComposerAttachment(false);
        setUnifiedComposerMode('text');
    });

    const libraryToggle = document.getElementById('library-toggle-btn');
    const librarySection = document.getElementById('my-library-section');
    if (libraryToggle && librarySection) {
        libraryToggle.addEventListener('click', function() {
            openWorkspace();
            librarySection.classList.toggle('hidden');
        });
    }
    document.querySelectorAll('[data-close-library]').forEach(function(button) {
        button.addEventListener('click', function() { librarySection.classList.add('hidden'); });
    });

    if (ui.openChatBtn) {
        ui.openChatBtn.addEventListener('click', function() {
            const firstPrompt = ui.quickPrompt ? ui.quickPrompt.value.trim() : '';
            window.selectAITool('text');
            if (firstPrompt) {
                ui.prompt.value = firstPrompt;
                autoResizeTextarea(ui.prompt);
                ui.sendBtn.click();
            }
        });
    }

    [ui.quickPrompt, ui.prompt].forEach(function(textarea) {
        if (!textarea) return;
        textarea.addEventListener('input', function() { autoResizeTextarea(textarea); });
        textarea.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (textarea === ui.quickPrompt) ui.openChatBtn.click();
                else ui.sendBtn.click();
            }
        });
    });

    const rememberedChat = readRememberedModels().text;
    if (rememberedChat) {
        const rememberedChoice = findCatalogChoice('text', rememberedChat.provider, rememberedChat.model);
        if (rememberedChoice) applyModelChoice('text', rememberedChoice);
    }
    refreshComposerModelLabel();
});

// ==========================================
// 3. التفاعل مع الخادم (Appwrite Functions)
// ==========================================
function normalizeImageResult(responseData) {
    if (!responseData) return '';
    const candidate = responseData.data || responseData.image || responseData.imageBase64 || responseData.url || '';
    if (typeof candidate !== 'string' || !candidate.trim()) return '';
    const value = candidate.trim();
    if (/^(data:image\/|https?:\/\/|blob:)/i.test(value)) return value;
    const looksLikeBase64Image = value.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(value);
    if (responseData.resultType === 'image' || responseData.image || responseData.imageBase64 || looksLikeBase64Image) {
        return 'data:image/png;base64,' + value.replace(/\s+/g, '');
    }
    return '';
}

async function executeRequest(payloadObj) {
    if (!currentUser) { 
        alert("يرجى تسجيل الدخول أولاً.");
        openModal(); 
        return null; 
    }

    // أي طلب صورة يمر حصريًا عبر الكود الوظيفي الثاني.
    const isImageRequest = payloadObj
        && payloadObj.action === 'legacy_chat'
        && (payloadObj.mode === 'generate' || payloadObj.mode === 'edit');
    const isLandingRequest = payloadObj && payloadObj.action === 'landing_page';
    const targetFunctionId = (isImageRequest || isLandingRequest) ? SECOND_FUNCTION_ID : ui.source.value;
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
        let parsedBody = null;
        try {
            parsedBody = execution.responseBody ? JSON.parse(execution.responseBody) : null;
        } catch (parseError) {
            throw new Error('ردّ السيرفر ليس JSON صالحًا. راجع سجل الكود الوظيفي الثاني.');
        }
        if (execution.status === 'failed' || Number(execution.responseStatusCode || 200) >= 400) {
            const serverMessage = parsedBody && (parsedBody.error || parsedBody.message);
            throw new Error(serverMessage || execution.errors || 'حدث خطأ داخلي في السيرفر.');
        }
        return parsedBody;
    } catch (error) {
        alert("خطأ في الاتصال بالسيرفر: " + error.message);
        return null;
    } finally {
        ui.loader.classList.add('hidden');
    }
}

if (ui.sendBtn) {
    ui.sendBtn.addEventListener('click', async function() {
        const actionType = ui.action.value;
        const promptSnapshot = ui.prompt.value.trim();
        
        if (!promptSnapshot && actionType !== 'book_outline') { 
            alert("يرجى إدخال نص الطلب!"); 
            return; 
        }

        if (getComposerModeKey(actionType)) {
            if (skipModelGateOnce) skipModelGateOnce = false;
            else if (!prepareModelForSend(actionType)) return;
        }

        // لا نفرغ الرسالة من الواجهة قبل تسجيل الدخول، حتى لا يضطر المستخدم لكتابتها من جديد.
        if (!currentUser) {
            alert("يرجى تسجيل الدخول أولاً.");
            openModal();
            return;
        }

        const selectedCatalogChoice = getSelectedCatalogChoice(actionType);
        let payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            prompt: promptSnapshot,
            provider: ui.provider.value,
            modelTier: selectedCatalogChoice && selectedCatalogChoice.modelTier
                ? selectedCatalogChoice.modelTier
                : ui.model.value
        };
        if (selectedCatalogChoice && (actionType === 'generate' || actionType === 'edit')) {
            payloadObj.model = selectedCatalogChoice.model;
            payloadObj.imageModel = selectedCatalogChoice.model;
            payloadObj.quality = selectedCatalogChoice.quality || 'auto';
            if (selectedCatalogChoice.inputFidelity) payloadObj.inputFidelity = selectedCatalogChoice.inputFidelity;
        }

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

        let typingIndicator = null;
        if (actionType !== 'book_outline') {
            openWorkspace();
            appendChatMessage('user', promptSnapshot, '', 'text');
            if (actionType === 'edit' && ui.attachmentImage && ui.attachmentImage.src) {
                appendChatMessage('user', ui.attachmentImage.src, 'الصورة المرفقة للتعديل', 'image');
            }
            typingIndicator = appendTypingIndicator();
            ui.prompt.value = '';
            autoResizeTextarea(ui.prompt);
        }

        const responseData = await executeRequest(payloadObj);
        if (typingIndicator) typingIndicator.remove();
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
                appendChatMessage('assistant', responseData.data, getSourceMetadata(responseData), 'text');
            } else if (responseData.resultType === 'image' || normalizeImageResult(responseData)) {
                appendChatMessage('assistant', normalizeImageResult(responseData), getSourceMetadata(responseData), 'image');
                if (actionType === 'edit') clearComposerAttachment(true);
            }
            
            if (actionType === 'book_outline' && responseData.sourceFunction) {
                ui.sourceBadge.innerHTML = '<i class="fas fa-check-circle"></i> تم التنفيذ عبر: ' + responseData.sourceFunction;
                ui.sourceBadge.classList.remove('hidden');
            }
            if (actionType === 'book_outline') ui.resultArea.classList.remove('hidden');
        } else if (responseData) {
            if (actionType !== 'book_outline') {
                appendChatMessage('assistant', 'تعذر تنفيذ الطلب: ' + (responseData.error || 'خطأ غير معروف'), getSourceMetadata(responseData), 'text');
            }
            alert("❌ فشل: " + responseData.error);
        }
    });
}

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
            
            rawBookTextFull = responseData.data; 
            // تحديد هدف الصفحات الافتراضي من المدخل
            const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 5;
            
            bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
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

if (ui.refineIntroBtn) {
    ui.refineIntroBtn.addEventListener('click', async function() {
        const promptText = ui.refineIntroPrompt ? ui.refineIntroPrompt.value.trim() : '';
        if (!promptText) {
            alert("يرجى كتابة التعديل الذي تريده على المقدمة أولاً!");
            return;
        }

        const payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            action: 'book_outline',
            bookStep: 'refine_intro', 
            provider: ui.provider.value,
            modelTier: ui.model.value,
            previousOutline: ui.bookOutlineText.innerText, 
            currentIntro: rawBookTextFull, 
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
            
            rawBookTextFull = responseData.data;
            const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 5; 
            bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
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
// 4. نظام التأليف الأوتوماتيكي والمراقبة
// ==========================================
let currentAutoBookId = null;
let pollingInterval = null;
let isGeneratingAutoBook = false;

document.addEventListener('click', async function(e) {
    if (e.target && (e.target.id === 'start-auto-btn' || e.target.closest('#start-auto-btn'))) {
        
        if (isGeneratingAutoBook) return; 
        
        const startBtnElem = document.getElementById('start-auto-btn');
        
        if (!currentUser) { alert("يرجى تسجيل الدخول أولاً."); return; }
        if (bookPagesData.length === 0) { alert("يجب كتابة والموافقة على المقدمة أولاً قبل توليد باقي الكتاب."); return; }

        if(startBtnElem) {
            startBtnElem.disabled = true;
            startBtnElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق من الرصيد...';
        }

        isGeneratingAutoBook = true;

        try {
            const response = await databases.listDocuments(DB_ID, COLLECTION_ID, [ Query.equal('userId', currentUser.$id) ]);
            if (response.documents.length > 0) {
                const currentCredits = response.documents[0].tokens;
                if (currentCredits < 40) {
                    alert(`عذراً، رصيدك غير كافٍ. تحتاج إلى 40 نقطة، لكن رصيدك الحالي هو ${currentCredits}.`);
                    if(startBtnElem) {
                        startBtnElem.disabled = false;
                        startBtnElem.innerHTML = '<i class="fas fa-bolt"></i> بدء التأليف الأوتوماتيكي بالكامل في الخلفية';
                    }
                    isGeneratingAutoBook = false;
                    return; 
                }
            } else {
                alert("لم يتم العثور على محفظة نقاط لهذا المستخدم.");
                isGeneratingAutoBook = false;
                return;
            }

            if(startBtnElem) {
                startBtnElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب للسيرفر...';
            }

            const payloadObj = {
                userId: currentUser.$id,
                action: 'start_auto_write',
                provider: ui.provider.value,
                modelTier: ui.model.value,
                outline: ui.bookOutlineText.innerText,
                introPagesArray: bookPagesData,
                targetPages: parseInt(document.getElementById('b-pages').value) || 50,
                title: document.getElementById('b-title').value || 'كتاب بدون عنوان'
            };

            const responseData = await executeRequest(payloadObj);
            
            if(startBtnElem) {
                startBtnElem.disabled = false;
                startBtnElem.innerHTML = '<i class="fas fa-bolt"></i> بدء التأليف الأوتوماتيكي بالكامل في الخلفية';
            }

            if (responseData && responseData.success) {
                const creditsElem = document.getElementById('user-credits');
                if (creditsElem) creditsElem.innerText = responseData.remainingTokens;

                currentAutoBookId = responseData.bookId;
                
                const mainInputs = document.getElementById('main-inputs-wrapper');
                const statusBox = document.getElementById('auto-generation-status');
                const newBtn = document.getElementById('new-book-btn');
                if(mainInputs) mainInputs.classList.add('hidden');
                if(statusBox) statusBox.classList.remove('hidden');
                if(newBtn) newBtn.classList.remove('hidden');
                
                alert("✅ تم إرسال الطلب بنجاح وتم خصم 40 نقطة. الذكاء الاصطناعي يقوم الآن بالتأليف في الخلفية!");
                startPolling();
            } else if (responseData) {
                alert("❌ فشل بدء التأليف الأوتوماتيكي: " + responseData.error);
            }
            
        } catch (err) {
            console.error("خطأ أثناء بدء التأليف:", err);
            alert("حدث خطأ غير متوقع أثناء الاتصال. يرجى المحاولة لاحقاً.");
            if(startBtnElem) {
                startBtnElem.disabled = false;
                startBtnElem.innerHTML = '<i class="fas fa-bolt"></i> بدء التأليف الأوتوماتيكي بالكامل في الخلفية';
            }
        } finally {
            isGeneratingAutoBook = false; 
        }
    }
});

window.toggleMainInputs = function() {
    const mainInputs = document.getElementById('main-inputs-wrapper');
    if(mainInputs) mainInputs.classList.toggle('hidden');
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        if (!currentAutoBookId) return;
        try {
            const bookDoc = await databases.getDocument(DB_ID, 'books', currentAutoBookId);
            const progressCount = document.getElementById('progress-count');
            
            if(progressCount) progressCount.innerText = bookDoc.generated_pages_count || bookPagesData.length;
            
            if (bookDoc.status === 'completed') {
                const statusTitle = document.getElementById('status-title');
                if(statusTitle) statusTitle.innerHTML = "<i class='fas fa-check-circle'></i> 🎉 اكتمل تأليف الكتاب بنجاح!";
                clearInterval(pollingInterval);
                
                if(bookDoc.content_pages) {
                    try {
                        let rawPages = JSON.parse(bookDoc.content_pages);
                        rawBookTextFull = rawPages.join('\n\n'); 
                        const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 10;
                        bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
                    } catch (e) {
                        rawBookTextFull = bookDoc.content_pages;
                        const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 10;
                        bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
                    }
                    renderCurrentPage(); 
                }
            }
        } catch (err) {
            console.error("خطأ في جلب حالة الكتاب:", err);
        }
    }, 10000);
}

window.resetForNewBook = function() {
    if (pollingInterval) clearInterval(pollingInterval);
    currentAutoBookId = null;
    const statusBox = document.getElementById('auto-generation-status');
    const newBtn = document.getElementById('new-book-btn');
    const mainInputs = document.getElementById('main-inputs-wrapper');
    
    if(statusBox) statusBox.classList.add('hidden');
    if(newBtn) newBtn.classList.add('hidden');
    if(mainInputs) mainInputs.classList.remove('hidden');
    const statusTitle = document.getElementById('status-title');
    const progressCount = document.getElementById('progress-count');
    if(statusTitle) statusTitle.innerHTML = "<i class='fas fa-cog fa-spin'></i> يتم الآن تأليف الكتاب في الخلفية...";
    if(progressCount) progressCount.innerText = "0";
    
    bookPagesData = [];
    rawBookTextFull = "";
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
        fetchUserBooks(); 
    } catch (error) {
        document.getElementById('login-btn').classList.remove('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
        currentUser = null;
        const libSec = document.getElementById('my-library-section');
        if (libSec) libSec.classList.add('hidden');
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

async function fetchUserBooks() {
    try {
        const response = await databases.listDocuments(DB_ID, 'books', [
            Query.equal('userId', currentUser.$id),
            Query.orderDesc('$createdAt')
        ]);
        
        const libraryList = document.getElementById('my-library-list');
        if (!libraryList) return;
        
        libraryList.innerHTML = ''; 
        
        if (response.documents.length === 0) {
            libraryList.innerHTML = '<p style="text-align:center; color:#6b7280;">لا توجد كتب حالياً في مكتبتك.</p>';
        } else {
            response.documents.forEach(book => {
                const btn = document.createElement('button');
                btn.className = 'library-book-btn';
                btn.style.cssText = 'display:block; width:100%; margin-bottom:10px; padding:12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px; text-align:right; cursor:pointer; color:#1e293b; font-weight:bold; transition: 0.2s;';
                btn.onmouseover = () => btn.style.background = '#e2e8f0';
                btn.onmouseout = () => btn.style.background = '#f8fafc';
                
                const statusText = book.status === 'completed' ? '✅ مكتمل' : '⏳ قيد التأليف';
                btn.innerHTML = `<i class="fas fa-book-open" style="color: #14539a;"></i> ${book.title || 'كتاب بدون عنوان'} <span style="float:left; font-size: 0.85em; color: #64748b;">${statusText}</span>`;
                
                btn.onclick = () => loadBookFromLibrary(book);
                libraryList.appendChild(btn);
            });
        }
        
    } catch (error) {
        console.error("Error fetching library books:", error);
    }
}

function loadBookFromLibrary(book) {
    const mainInputs = document.getElementById('main-inputs-wrapper');
    const autoGenStatus = document.getElementById('auto-generation-status');
    
    if(mainInputs) mainInputs.classList.add('hidden');
    if(autoGenStatus) autoGenStatus.classList.add('hidden');
    
    ui.resultArea.classList.add('hidden');
    
    if (book.content_pages) {
        try {
            let parsed = JSON.parse(book.content_pages);
            rawBookTextFull = parsed.join('\n\n');
        } catch(e) {
            rawBookTextFull = book.content_pages;
        }
    } else {
        rawBookTextFull = "جاري التأليف أو لا يوجد محتوى بعد...";
    }
    
    const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 10;
    bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
    currentViewedPageIndex = 0;
    
    ui.introArea.style.display = 'flex';
    ui.introArea.classList.remove('hidden');
    
    const introRefine = document.getElementById('intro-refine-section');
    if (introRefine) introRefine.classList.add('hidden');
    
    const autoBtns = document.getElementById('start-auto-btn');
    if (autoBtns && autoBtns.parentElement) autoBtns.parentElement.classList.add('hidden');
    
    renderCurrentPage();
    ui.introArea.scrollIntoView({ behavior: 'smooth' });
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