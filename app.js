// 1. تهيئة Appwrite
// ==========================================
const { Client, Account, Databases, Functions, Query, ID } = Appwrite;
const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '6a36cda70021ceb1f3d0';
const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);
  
const account = new Account(client);
const databases = new Databases(client);
const appwriteFunctions = new Functions(client);

const DB_ID = '6a3706880011ad5651b5'; 
const COLLECTION_ID = 'cvs_chat_cv_mab';
let currentUser = null;
let isLoginMode = true;
const FIRST_FUNCTION_ID = '6a3c7a760032067bd275';
const SECOND_FUNCTION_ID = '6a445f680013960a14c6';
const AGENT_AVATAR_URL = 'https://static.verse.works/image/source/static%2Fuploads%2F0x7c1bd459dae8ec0bb45fe3172fd58a2b53972e5c%2Fc96cf9cb-273c-4b48-b7ba-7193e06b0336.gif';
const MODEL_MEMORY_KEY = 'aklake_remembered_models_v1';
const AUTO_BOOK_VALUE = 'لم أقم بتحديدها؛ اقرأ وصف الكتاب وحددها بنفسك.';
const MODEL_CATALOG = {
    text: [
        { provider: 'cloudflare', model: 'llama', name: 'LLaMA 3.3', description: 'اقتصادي للمحادثات اليومية', cost: '5 نقاط', icon: 'fa-feather' },
        { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'اقتصادي وسريع للمهام البسيطة', cost: '8 نقاط', icon: 'fa-bolt' },
        { provider: 'openai', model: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'متوازن ودقيق للمحادثات والعمل اليومي', cost: '10 نقاط', icon: 'fa-brain' },
        { provider: 'openai', model: 'gpt-5.5', name: 'GPT-5.5', description: 'النموذج القياسي للعمل المتقن والمعقد', cost: '15 نقطة', icon: 'fa-gem' }
    ],
    book_outline: [
        { provider: 'gemini', model: 'gemini-3.5-flash', name: 'Gemini Flash', description: 'خيار اقتصادي لتجارب الكتاب', cost: '5 نقاط', icon: 'fa-feather' },
        { provider: 'cloudflare', model: 'llama', name: 'LLaMA 3.3', description: 'خيار اقتصادي للخطط والمسودات', cost: '5 نقاط', icon: 'fa-feather' },
        { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'اقتصادي للخطة والمقدمة', cost: '8 نقاط', icon: 'fa-bolt' },
        { provider: 'openai', model: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'متوازن لتأليف كتاب مترابط', cost: '10 نقاط', icon: 'fa-book-open' },
        { provider: 'openai', model: 'gpt-5.5', name: 'GPT-5.5', description: 'قياسي قوي للتحرير والبناء الطويل', cost: '15 نقطة', icon: 'fa-gem' }
    ],
    generate: [
        {
            provider: 'cloudflare',
            model: 'flux-schnell',
            modelTier: 'flux-schnell',
            quality: 'low',
            name: 'Cloudflare FLUX',
            description: 'توليد اقتصادي وسريع للصور',
            cost: '5 نقاط',
            icon: 'fa-cloud'
        },
        {
            provider: 'openai',
            model: 'gpt-image-2',
            modelTier: 'gpt-image-2',
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
            modelTier: 'gpt-image-1-mini',
            quality: 'low',
            name: 'تعديل بسيط',
            description: 'تعديل سريع واقتصادي للصورة',
            cost: '10 نقاط',
            icon: 'fa-pen'
        },
        {
            provider: 'openai',
            model: 'gpt-image-1.5',
            modelTier: 'gpt-image-1.5',
            quality: 'medium',
            name: 'تعديل متوازن',
            description: 'جودة أعلى مع تكلفة متوسطة',
            cost: '15 نقطة',
            icon: 'fa-wand-magic-sparkles'
        },
        {
            provider: 'openai',
            model: 'gpt-image-2',
            modelTier: 'gpt-image-2',
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
let lastBookOutlinePrompt = '';

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
    bookReferenceFile: document.getElementById('book-reference-file'),

    introPagesInput: document.getElementById('intro-pages-input'),
    remainingPagesDisplay: document.getElementById('remaining-pages-display'),
    refineIntroPrompt: document.getElementById('refine-intro-prompt'),
    refineIntroBtn: document.getElementById('refine-intro-btn'),
    introEditToggleBtn: document.getElementById('intro-edit-toggle-btn'),
    retryIntroBtn: document.getElementById('retry-intro-btn'),

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
    attachmentFileIcon: document.getElementById('composer-attachment-file-icon'),
    attachmentTitle: document.getElementById('composer-attachment-title'),
    attachmentName: document.getElementById('composer-attachment-name'),
    removeAttachmentBtn: document.getElementById('remove-composer-attachment-btn'),
    modelPopover: document.getElementById('model-chooser-popover'),
    modelChoicesList: document.getElementById('model-choices-list'),
    modelChooserTitle: document.getElementById('model-chooser-title'),
    modelChooserDescription: document.getElementById('model-chooser-description'),
    rememberModelToggle: document.getElementById('remember-model-toggle'),
    confirmModelBtn: document.getElementById('confirm-model-choice-btn'),
    bookQuickStart: document.getElementById('book-quick-start'),
    bookAssistantToggle: document.getElementById('book-assistant-toggle'),
    defaultWelcomeMessage: document.getElementById('default-welcome-message'),
    bookWelcomeMessage: document.getElementById('book-welcome-message')
};
const pageUI = {
    prevBtn: document.getElementById('prev-page-btn'),
    nextBtn: document.getElementById('next-page-btn'),
    indicator: document.getElementById('page-indicator'),
    pageNumber: document.getElementById('page-number'),
    continueBtn: document.getElementById('continue-writing-btn')
};

function inferBookValue(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || AUTO_BOOK_VALUE;
}

function collectBookDetails() {
    const genreSelect = document.getElementById('b-genre');
    const customGenre = document.getElementById('b-custom-genre');
    const rawGenre = genreSelect ? genreSelect.value : '';
    const structureSelect = document.getElementById('b-structure');
    const customStructure = document.getElementById('b-custom-structure');
    const rawStructure = structureSelect ? structureSelect.value : '';
    const maxPages = Math.min(400, Math.max(50, Number.parseInt(document.getElementById('b-pages')?.value, 10) || 50));
    return {
        title: inferBookValue(document.getElementById('b-title')?.value),
        topic: inferBookValue(document.getElementById('b-topic')?.value),
        genre: inferBookValue(rawGenre === 'other' ? customGenre?.value : rawGenre),
        structure: inferBookValue(rawStructure === 'other' ? customStructure?.value : rawStructure),
        maxPages,
        audience: inferBookValue(document.getElementById('b-audience')?.value),
        tone: inferBookValue(document.getElementById('b-tone')?.value),
        pov: inferBookValue(document.getElementById('b-pov')?.value),
        language: inferBookValue(document.getElementById('b-language')?.value),
        imagesType: inferBookValue(document.getElementById('b-images')?.value),
        coverPrompt: inferBookValue(document.getElementById('b-cover')?.value),
        introPages: Math.min(10, Math.max(1, Number.parseInt(ui.introPagesInput?.value, 10) || 2))
    };
}

let bookSettingsExpanded = false;
let lastUIAction = 'text';
function setBookSettingsExpanded(expanded) {
    bookSettingsExpanded = Boolean(expanded);
    if (ui.bookSettings) {
        ui.bookSettings.classList.toggle('hidden', !bookSettingsExpanded || ui.action.value !== 'book_outline');
        ui.bookSettings.setAttribute('aria-hidden', String(!bookSettingsExpanded || ui.action.value !== 'book_outline'));
    }
    if (ui.bookAssistantToggle) {
        ui.bookAssistantToggle.classList.toggle('is-open', bookSettingsExpanded);
        ui.bookAssistantToggle.setAttribute('aria-expanded', String(bookSettingsExpanded));
    }
}

function syncBookConversationState(isBookMode) {
    if (ui.bookQuickStart) ui.bookQuickStart.classList.toggle('hidden', !isBookMode);
    if (ui.defaultWelcomeMessage) ui.defaultWelcomeMessage.classList.toggle('hidden', isBookMode);
    if (ui.bookWelcomeMessage) ui.bookWelcomeMessage.classList.toggle('hidden', !isBookMode);
    if (ui.prompt) {
        if (isBookMode) {
            ui.prompt.placeholder = 'صف الكتاب الذي تريد إنشاءه… يمكنك كتابة فكرة قصيرة أو برومنت طويل';
        } else if (ui.prompt.placeholder.includes('صف الكتاب')) {
            ui.prompt.placeholder = 'اكتب رسالتك هنا...';
        }
    }
    if (typeof syncConversationThreads === 'function') syncConversationThreads();
}
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
        if (!ui.prompt) return;
        ui.prompt.placeholder = 'اكتب تعليمات إكمال الفصل أو الجزء التالي…';
        ui.prompt.focus();
        ui.prompt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// ==========================================
// واجهة المحادثة الاحترافية والتنقل بين الأدوات
// ==========================================
function updateUI() {
    const basicFirstFunctionActions = new Set(['text', 'generate', 'edit']);
    if (ui.source.value === FIRST_FUNCTION_ID && !basicFirstFunctionActions.has(ui.action.value)) {
        ui.source.value = SECOND_FUNCTION_ID;
    }
    Array.from(ui.action.options).forEach(function(opt) {
        opt.disabled = ui.source.value === FIRST_FUNCTION_ID && !basicFirstFunctionActions.has(opt.value);
    });

    const currentAction = ui.action.value;
    if (currentAction === 'book_outline' && lastUIAction !== 'book_outline') {
        bookSettingsExpanded = false;
    }
    lastUIAction = currentAction;

    if (currentAction === 'edit') {
        ui.imageUpload.classList.remove('hidden');
    } else {
        ui.imageUpload.classList.add('hidden');
    }

    const isBookMode = currentAction === 'book_outline';
    syncBookConversationState(isBookMode);
    if (isBookMode) setBookSettingsExpanded(bookSettingsExpanded);
    else if (ui.bookSettings) {
        ui.bookSettings.classList.add('hidden');
        ui.bookSettings.setAttribute('aria-hidden', 'true');
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
        ui.provider.innerHTML = '<option value="openai" selected>OpenAI</option><option value="gemini">Gemini Flash</option><option value="cloudflare">Cloudflare</option>';
    } else if (currentAction === 'art_studio') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (أقوى تعديل وتوليد)</option>';
    } else if (currentAction === 'landing_page') {
        ui.provider.innerHTML = '<option value="openai">OpenAI — الكود الوظيفي الثاني</option>';
    } else if (currentAction === 'text') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (متقدم)</option><option value="cloudflare">Cloudflare (اقتصادي)</option>';
    } else if (currentAction === 'generate') {
        ui.provider.innerHTML = '<option value="cloudflare">Cloudflare FLUX (اقتصادي)</option><option value="openai">OpenAI (توليد الصور)</option>';
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
        ui.model.innerHTML = '<option value="gpt-4o-mini">GPT-4o mini — اقتصادي (20 نقطة)</option><option value="gpt-4.1-mini" selected>GPT-4.1 mini — متوازن (40 نقطة)</option><option value="gpt-5.5">GPT-5.5 — قياسي قوي (60 نقطة)</option>';
    } else if (action === 'text' || action === 'book_outline') {
        if (provider === 'gemini') {
            ui.model.innerHTML = '<option value="gemini-3.5-flash">Gemini 3.5 Flash</option>';
        } else if (provider === 'openai') {
            ui.model.innerHTML = '<option value="gpt-4o-mini">GPT-4o mini — اقتصادي (8 نقاط)</option><option value="gpt-4.1-mini" selected>GPT-4.1 mini — متوازن (10 نقاط)</option><option value="gpt-5.5">GPT-5.5 — قياسي قوي (15 نقطة)</option>';
        } else {
            ui.model.innerHTML = '<option value="llama">LLaMA 3.3 (5 نقاط)</option>';
        }
    } else if (action === 'generate') {
        ui.model.innerHTML = provider === 'cloudflare'
            ? '<option value="flux-schnell">Cloudflare FLUX Schnell (5 نقاط)</option>'
            : '<option value="gpt-image-2">GPT Image 2 — توليد من الصفر (20 نقطة)</option>';
    } else if (action === 'edit') {
        ui.model.innerHTML = '<option value="gpt-image-1-mini">GPT Image 1 mini — تعديل بسيط (10 نقاط)</option><option value="gpt-image-1.5">GPT Image 1.5 — تعديل متوازن (15 نقطة)</option><option value="gpt-image-2">GPT Image 2 — تعديل احترافي (20 نقطة)</option>';
    }
    syncWorkspaceFromSelections();
}

if (ui.source) ui.source.addEventListener('change', updateUI);
if (ui.action) ui.action.addEventListener('change', updateUI);
if (ui.provider) ui.provider.addEventListener('change', updateModels);
if (ui.model) ui.model.addEventListener('change', syncWorkspaceFromSelections);

window.addEventListener('DOMContentLoaded', function() {
    ui.source.value = SECOND_FUNCTION_ID;
    const composer = document.querySelector('.composer');
    if (composer && ui.bookSettings) composer.before(ui.bookSettings);
    if (composer && ui.bookQuickStart) composer.before(ui.bookQuickStart);
    updateUI();
    initHomeNavigation();
    initArtStudio();
    initCreationLibrary();
    initLandingPageStudio();
    mountBookStagesInConversation();
    initBookIntroActions();

    document.querySelectorAll('[data-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.tool); });
    });
    document.querySelectorAll('[data-welcome-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.welcomeTool); });
    });

    const structureSelect = document.getElementById('b-structure');
    const customStructure = document.getElementById('b-custom-structure');
    if (structureSelect && customStructure) {
        structureSelect.addEventListener('change', function() {
            customStructure.classList.toggle('hidden', structureSelect.value !== 'other');
            if (structureSelect.value === 'other') customStructure.focus();
        });
    }

    if (ui.bookAssistantToggle) {
        ui.bookAssistantToggle.addEventListener('click', function() {
            setBookSettingsExpanded(!bookSettingsExpanded);
        });
    }

    const genreSelect = document.getElementById('b-genre');
    const customGenre = document.getElementById('b-custom-genre');
    if (genreSelect && customGenre) {
        genreSelect.addEventListener('change', function() {
            const isCustom = genreSelect.value === 'other';
            customGenre.classList.toggle('hidden', !isCustom);
            if (isCustom) {
                setBookSettingsExpanded(true);
                customGenre.focus();
            }
        });
    }

    initProfileDrawer();

    if (ui.settingsToggle) {
        ui.settingsToggle.addEventListener('click', function() {
            const action = ui.action.value;
            if (getComposerModeKey(action)) {
                openModelChooser(action, false);
            } else if (action === 'landing_page') {
                document.getElementById('landing-model-cards')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (action === 'art_studio') {
                const selectedFrame = typeof getSelectedArtFrame === 'function' ? getSelectedArtFrame() : null;
                if (selectedFrame && typeof openArtPromptDialog === 'function') {
                    openArtPromptDialog(selectedFrame, selectedFrame.imageData ? 'edit' : 'generate');
                } else if (typeof setArtStudioStatus === 'function') {
                    setArtStudioStatus('أضف لوحة أولًا، ثم ستختار نموذج الصورة داخل نافذة الإنشاء.', 'info');
                }
            }
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

    if (ui.attachBtn) ui.attachBtn.addEventListener('click', function() {
        if (ui.action.value === 'book_outline') ui.bookReferenceFile?.click();
        else ui.imageFile?.click();
    });
    if (ui.imageFile) {
        ui.imageFile.addEventListener('change', function() {
            if (ui.imageFile.files && ui.imageFile.files[0]) showComposerAttachment(ui.imageFile.files[0]);
        });
    }
    if (ui.bookReferenceFile) {
        ui.bookReferenceFile.addEventListener('change', function() {
            if (ui.bookReferenceFile.files && ui.bookReferenceFile.files[0]) showBookReferenceAttachment(ui.bookReferenceFile.files[0]);
        });
    }
    if (ui.removeAttachmentBtn) ui.removeAttachmentBtn.addEventListener('click', function() {
        if (ui.action.value === 'book_outline') clearBookReferenceAttachment();
        else clearComposerAttachment(true);
    });
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

let profileDrawerInitialized = false;
function setProfileDrawerOpen(open) {
    const drawer = document.getElementById('profile-drawer');
    const overlay = document.getElementById('profile-overlay');
    const trigger = document.getElementById('profile-header-btn');
    if (!drawer || !overlay || !trigger) return;
    drawer.classList.toggle('hidden', !open);
    overlay.classList.toggle('hidden', !open);
    drawer.setAttribute('aria-hidden', String(!open));
    overlay.setAttribute('aria-hidden', String(!open));
    trigger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('profile-drawer-open', open);
}

function showPaymentUnavailable() {
    alert('لم نوفر بوابة دفع بعد. سنضيف إمكانية شراء توكن إضافي قريبًا.');
}

function initProfileDrawer() {
    if (profileDrawerInitialized) return;
    profileDrawerInitialized = true;
    const trigger = document.getElementById('profile-header-btn');
    const closeButton = document.getElementById('profile-close-btn');
    const overlay = document.getElementById('profile-overlay');
    const profileCart = document.getElementById('profile-cart-btn');
    trigger?.addEventListener('click', function() {
        setProfileDrawerOpen(document.getElementById('profile-drawer')?.classList.contains('hidden'));
    });
    closeButton?.addEventListener('click', function() { setProfileDrawerOpen(false); });
    overlay?.addEventListener('click', function() { setProfileDrawerOpen(false); });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') setProfileDrawerOpen(false);
    });
    document.querySelectorAll('[data-add-tokens]').forEach(function(button) {
        button.addEventListener('click', showPaymentUnavailable);
    });
    const creditSource = document.getElementById('user-credits');
    const profileCreditCount = document.getElementById('profile-credit-count');
    if (creditSource && profileCreditCount) {
        const syncProfileCredits = function() { profileCreditCount.textContent = creditSource.textContent || '0'; };
        syncProfileCredits();
        new MutationObserver(syncProfileCredits).observe(creditSource, { childList: true, characterData: true, subtree: true });
    }
    profileCart?.addEventListener('click', function() {
        setProfileDrawerOpen(false);
        openWorkspace();
        const librarySection = document.getElementById('my-library-section');
        if (librarySection) librarySection.classList.remove('hidden');
        document.querySelector('[data-library-tab="cart"]')?.click();
    });
}

function mountBookStageMessage(element, options) {
    if (!element || !ui.chatMessages || document.getElementById(options.rowId)) return null;
    const row = document.createElement('div');
    row.id = options.rowId;
    row.className = 'message-row assistant-message book-stage-message hidden';
    row.dataset.conversation = 'book';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar agent-avatar';
    avatar.innerHTML = '<img src="' + AGENT_AVATAR_URL + '" alt="مؤلف AKLAKE">';

    const content = document.createElement('div');
    content.className = 'message-content book-stage-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble book-stage-bubble ' + (options.bubbleClass || '');
    const heading = document.createElement('div');
    heading.className = 'book-stage-heading';
    heading.innerHTML = '<span><i class="fas ' + options.icon + '"></i> ' + options.title + '</span><small>' + options.description + '</small>';
    const source = document.createElement('div');
    source.className = 'message-source';
    source.textContent = options.source;

    bubble.append(heading, element);
    content.append(bubble, source);
    row.append(avatar, content);
    ui.chatMessages.appendChild(row);

    const syncVisibility = function() {
        const isVisible = !element.classList.contains('hidden') && element.style.display !== 'none';
        row.dataset.stageVisible = String(isVisible);
        if (isVisible) ui.chatMessages.appendChild(row);
        if (typeof syncConversationThreads === 'function') syncConversationThreads();
    };
    new MutationObserver(syncVisibility).observe(element, { attributes: true, attributeFilter: ['class', 'style'] });
    syncVisibility();
    return row;
}

function mountBookStagesInConversation() {
    mountBookStageMessage(ui.introArea, {
        rowId: 'book-intro-chat-message',
        title: 'مقدمة الكتاب',
        description: 'راجع الصفحات ثم اختر الخطوة التالية',
        icon: 'fa-file-lines',
        source: 'مقدمة أنشأها مؤلف الكتب',
        bubbleClass: 'book-intro-bubble'
    });
    mountBookStageMessage(document.getElementById('auto-generation-status'), {
        rowId: 'book-progress-chat-message',
        title: 'مراحل إنشاء الكتاب',
        description: 'التأليف مستمر في الخلفية ويمكنك متابعة المحادثة',
        icon: 'fa-gears',
        source: 'حالة التأليف المباشرة',
        bubbleClass: 'book-progress-bubble'
    });
}

function initBookIntroActions() {
    const refineSection = document.getElementById('intro-refine-section');
    ui.introEditToggleBtn?.addEventListener('click', function() {
        if (!refineSection) return;
        const willOpen = refineSection.classList.contains('hidden');
        refineSection.classList.toggle('hidden', !willOpen);
        ui.introEditToggleBtn.innerHTML = willOpen
            ? '<i class="fas fa-xmark"></i><span>إغلاق التعديل</span>'
            : '<i class="fas fa-pen"></i><span>تعديل المقدمة</span>';
        if (willOpen) ui.refineIntroPrompt?.focus();
    });
    ui.retryIntroBtn?.addEventListener('click', function() {
        ui.writeIntroBtn?.click();
    });
}

function renderBookOutlineMessage(outline, sourceLabel) {
    if (!ui.chatMessages) return;
    openWorkspace();
    document.getElementById('book-outline-chat-message')?.remove();

    const row = document.createElement('div');
    row.id = 'book-outline-chat-message';
    row.className = 'message-row assistant-message book-outline-message';
    row.dataset.conversation = 'book';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar agent-avatar';
    const avatarImage = document.createElement('img');
    avatarImage.src = AGENT_AVATAR_URL;
    avatarImage.alt = 'مؤلف AKLAKE';
    avatar.appendChild(avatarImage);

    const content = document.createElement('div');
    content.className = 'message-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble book-outline-bubble';
    const heading = document.createElement('div');
    heading.className = 'book-outline-heading';
    heading.innerHTML = '<span><i class="fas fa-list-check"></i> خطة الكتاب</span><small>راجعها ثم اختر الخطوة التالية</small>';
    const outlineText = document.createElement('div');
    outlineText.className = 'book-outline-chat-text';
    outlineText.textContent = outline || '';
    bubble.append(heading, outlineText);

    const actions = document.createElement('div');
    actions.className = 'book-outline-chat-actions';
    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'primary';
    continueButton.innerHTML = '<i class="fas fa-arrow-left"></i><span>اعتماد وكتابة المقدمة</span>';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.innerHTML = '<i class="fas fa-pen"></i><span>تعديل</span>';
    const smartEditButton = document.createElement('button');
    smartEditButton.type = 'button';
    smartEditButton.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>تعديل ذكي</span>';
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.innerHTML = '<i class="fas fa-rotate-right"></i><span>محاولة أخرى</span>';
    actions.append(continueButton, editButton, smartEditButton, retryButton);

    const smartEditor = document.createElement('div');
    smartEditor.className = 'book-outline-smart-editor hidden';
    const smartInput = document.createElement('textarea');
    smartInput.rows = 2;
    smartInput.placeholder = 'مثال: أضف فصلًا عمليًا واجعل البداية أكثر تشويقًا…';
    const smartSubmit = document.createElement('button');
    smartSubmit.type = 'button';
    smartSubmit.innerHTML = '<i class="fas fa-arrow-up"></i>';
    smartSubmit.setAttribute('aria-label', 'إرسال التعديل الذكي');
    smartEditor.append(smartInput, smartSubmit);

    const source = document.createElement('div');
    source.className = 'message-source';
    source.textContent = sourceLabel || 'خطة أنشأها مؤلف الكتب';
    content.append(bubble, actions, smartEditor, source);
    row.append(avatar, content);
    ui.chatMessages.appendChild(row);
    if (typeof syncConversationThreads === 'function') syncConversationThreads();

    const syncOutline = function() {
        if (ui.bookOutlineText) ui.bookOutlineText.innerText = outlineText.innerText;
        saveHistoryState();
    };
    editButton.addEventListener('click', function() {
        const editing = outlineText.isContentEditable;
        if (editing) {
            outlineText.contentEditable = 'false';
            outlineText.classList.remove('is-editing');
            editButton.innerHTML = '<i class="fas fa-pen"></i><span>تعديل</span>';
            syncOutline();
        } else {
            outlineText.contentEditable = 'true';
            outlineText.classList.add('is-editing');
            outlineText.focus();
            editButton.innerHTML = '<i class="fas fa-check"></i><span>حفظ</span>';
        }
    });
    continueButton.addEventListener('click', function() {
        syncOutline();
        ui.writeIntroBtn?.click();
    });
    retryButton.addEventListener('click', function() {
        syncOutline();
        if (ui.prompt && !ui.prompt.value.trim()) {
            ui.prompt.value = lastBookOutlinePrompt || 'أنشئ خطة أخرى للكتاب مع الحفاظ على المعلومات والإعدادات نفسها.';
            autoResizeTextarea(ui.prompt);
        }
        ui.sendBtn?.click();
    });
    smartEditButton.addEventListener('click', function() {
        smartEditor.classList.toggle('hidden');
        if (!smartEditor.classList.contains('hidden')) smartInput.focus();
    });
    smartSubmit.addEventListener('click', function() {
        const request = smartInput.value.trim();
        if (!request) return smartInput.focus();
        syncOutline();
        if (ui.refinePrompt) ui.refinePrompt.value = request;
        ui.refineBtn?.click();
    });
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

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

function cleanDiagnosticValue(value, maxLength) {
    if (value === undefined || value === null || value === '') return '';
    let text = typeof value === 'string' ? value : JSON.stringify(value);
    text = text
        .replace(/(authorization|api[-_ ]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1: [مخفي]')
        .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '[بيانات صورة مخفية]');
    const limit = Number(maxLength) || 900;
    return text.length > limit ? text.slice(0, limit) + '…' : text;
}

function getExecutionFailureExplanation(details) {
    const code = Number(details.responseStatusCode || details.sdkCode || 0);
    const message = String(details.serverMessage || details.sdkMessage || '').toLowerCase();
    const hasExecution = Boolean(details.executionId || details.executionStatus);

    if (/timeout|timed out|deadline|duration/.test(message) || code === 408 || code === 504) {
        return 'وصل الطلب إلى Appwrite، لكن تنفيذ الوظيفة تجاوز المهلة المسموح بها. راجع مدة التنفيذ وسجل Runtime الخاص بالوظيفة.';
    }
    if (/cors|failed to fetch|networkerror|network error|load failed/.test(message)) {
        return 'المتصفح لم يتمكن من الوصول إلى واجهة Appwrite. افحص الشبكة، نطاق الموقع المسموح داخل Appwrite، وقيود CORS.';
    }
    if (code === 400) {
        return hasExecution
            ? 'وصل الطلب إلى الوظيفة، لكنها رفضت بيانات الطلب. افحص رسالة الوظيفة والحقول المرسلة.'
            : 'رفض Appwrite إنشاء التنفيذ لأن الطلب أو أحد إعداداته غير صالح.';
    }
    if (code === 401) {
        return 'رفض Appwrite الطلب لأن جلسة المستخدم مفقودة أو منتهية. سجّل الخروج ثم ادخل مجددًا وتحقق من صلاحية الجلسة.';
    }
    if (code === 403) {
        return 'تم الوصول إلى Appwrite، لكنه منع تنفيذ الوظيفة بسبب صلاحيات Execute. راجع صلاحيات تنفيذ الوظيفة للمستخدمين المسجلين.';
    }
    if (code === 404) {
        return 'تم الوصول إلى Appwrite، لكن المشروع أو معرّف الوظيفة أو مسار التنفيذ غير موجود. قارن المعرّفات الظاهرة أدناه بإعدادات Appwrite.';
    }
    if (code === 429) {
        return 'تم الوصول إلى Appwrite، لكن الطلبات كثيرة حاليًا وتم تفعيل حدّ الاستخدام. انتظر قليلًا ثم أعد المحاولة.';
    }
    if (code === 500) {
        return hasExecution
            ? 'تم إنشاء التنفيذ والوصول إلى الوظيفة، ثم وقع خطأ داخل الكود الوظيفي. افتح سجل Runtime للتنفيذ المبيّن أدناه.'
            : 'وصلت الواجهة إلى Appwrite، لكن المنصة لم تستطع إنشاء التنفيذ بسبب خطأ داخلي.';
    }
    if (code === 502 || code === 503) {
        return hasExecution
            ? 'نجح اتصال الواجهة بـ Appwrite وتم إنشاء تنفيذ للوظيفة، لكن الوظيفة أو Runtime أعاد حالة عدم توفر. هذا ليس انقطاعًا بين المتصفح وAppwrite؛ افحص النشر النشط وEntrypoint وRuntime Logs.'
            : 'وصلت الواجهة إلى Appwrite، لكن Appwrite لم يستطع بدء تنفيذ الوظيفة أو كانت الخدمة غير متاحة. افحص حالة النشر وRuntime ثم أعد المحاولة.';
    }
    if (details.failureKind === 'invalid_json') {
        return 'تم الوصول إلى الوظيفة واستلام رد منها، لكن الرد ليس JSON صالحًا. الخلل داخل صيغة الرد التي يعيدها الكود الوظيفي.';
    }
    if (hasExecution || details.stage === 'function_response') {
        return 'نجح اتصال الواجهة بـ Appwrite، لكن تنفيذ الوظيفة فشل. استخدم معرّف التنفيذ أدناه للعثور على السجل المطابق داخل Appwrite.';
    }
    return 'تعذر إكمال طلب إنشاء التنفيذ. التفاصيل أدناه تحدد المسار والوظيفة والمرحلة التي توقف عندها الطلب.';
}

function formatExecutionDiagnostic(details) {
    const lines = [
        'تشخيص اتصال Appwrite',
        'النتيجة: ' + details.explanation,
        '',
        'المرحلة التي توقفت: ' + details.stageLabel,
        'المسار المختار في الواجهة: ' + details.selectedFunctionLabel + ' (' + details.selectedFunctionId + ')',
        'الوظيفة التي أُرسل إليها فعليًا: ' + details.targetFunctionLabel + ' (' + details.targetFunctionId + ')',
        'سبب التوجيه: ' + details.routingNote,
        'نوع الطلب: ' + details.requestSummary,
        'مشروع Appwrite: ' + APPWRITE_PROJECT_ID,
        'Endpoint: ' + APPWRITE_ENDPOINT
    ];

    if (details.executionId) lines.push('معرّف التنفيذ: ' + details.executionId);
    if (details.executionStatus) lines.push('حالة التنفيذ: ' + details.executionStatus);
    if (details.responseStatusCode) lines.push('HTTP داخل الوظيفة: ' + details.responseStatusCode);
    if (details.sdkCode && Number(details.sdkCode) !== Number(details.responseStatusCode)) lines.push('رمز Appwrite SDK: ' + details.sdkCode);
    if (details.sdkType) lines.push('نوع خطأ Appwrite: ' + details.sdkType);
    if (details.serverMessage) lines.push('رسالة الوظيفة: ' + details.serverMessage);
    if (details.sdkMessage && details.sdkMessage !== details.serverMessage) lines.push('رسالة Appwrite: ' + details.sdkMessage);
    lines.push('مرجع التشخيص: ' + details.diagnosticId);
    return lines.join('\n');
}

function showExecutionDiagnostic(details) {
    const diagnosticText = formatExecutionDiagnostic(details);
    window.__AKLAKE_LAST_EXECUTION_ERROR__ = Object.freeze(Object.assign({}, details, {
        diagnosticText: diagnosticText
    }));

    console.group('[AKLAKE] فشل تنفيذ طلب Appwrite — ' + details.diagnosticId);
    console.error(diagnosticText);
    console.table({
        stage: details.stage,
        selectedFunctionId: details.selectedFunctionId,
        targetFunctionId: details.targetFunctionId,
        executionId: details.executionId || 'لم يُنشأ',
        executionStatus: details.executionStatus || 'غير متاح',
        responseStatusCode: details.responseStatusCode || 'غير متاح',
        sdkCode: details.sdkCode || 'غير متاح',
        sdkType: details.sdkType || 'غير متاح'
    });
    console.groupEnd();

    let panel = document.getElementById('aklake-connection-diagnostic');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'aklake-connection-diagnostic';
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-live', 'assertive');
        panel.setAttribute('dir', 'rtl');
        Object.assign(panel.style, {
            position: 'fixed',
            insetInline: '16px',
            bottom: '16px',
            zIndex: '99999',
            maxWidth: '760px',
            marginInline: 'auto',
            padding: '18px',
            border: '1px solid #f1a7a7',
            borderRadius: '16px',
            background: '#fff7f7',
            color: '#4a1010',
            boxShadow: '0 18px 50px rgba(40, 10, 10, .22)',
            fontFamily: 'inherit'
        });

        const title = document.createElement('strong');
        title.textContent = 'تعذر تنفيذ الطلب — تفاصيل التشخيص';
        title.style.display = 'block';
        title.style.marginBottom = '10px';

        const output = document.createElement('pre');
        output.dataset.diagnosticOutput = 'true';
        Object.assign(output.style, {
            margin: '0',
            maxHeight: '42vh',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontFamily: 'inherit',
            fontSize: '13px',
            lineHeight: '1.7'
        });

        const actions = document.createElement('div');
        Object.assign(actions.style, { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' });
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'نسخ تفاصيل الخطأ';
        copyButton.addEventListener('click', async function() {
            const value = panel.querySelector('[data-diagnostic-output]')?.textContent || '';
            try {
                await navigator.clipboard.writeText(value);
                copyButton.textContent = 'تم النسخ';
            } catch (copyError) {
                console.warn('[AKLAKE] تعذر نسخ التشخيص تلقائيًا.', copyError);
            }
        });
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'إغلاق';
        closeButton.addEventListener('click', function() { panel.remove(); });
        [copyButton, closeButton].forEach(function(button) {
            Object.assign(button.style, {
                border: '1px solid #d38b8b',
                borderRadius: '9px',
                background: '#ffffff',
                color: '#4a1010',
                padding: '8px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit'
            });
        });
        actions.append(copyButton, closeButton);
        panel.append(title, output, actions);
        document.body.appendChild(panel);
    }

    const output = panel.querySelector('[data-diagnostic-output]');
    if (output) output.textContent = diagnosticText;
}

async function executeRequest(payloadObj) {
    if (!currentUser) { 
        alert("يرجى تسجيل الدخول أولاً.");
        openModal(); 
        return null; 
    }

    // الكود الأول اختياري للمحادثة وصور المحادثة فقط؛ الأدوات المتخصصة تبقى على الكود الثاني.
    const selectedFunctionId = ui.source?.value || SECOND_FUNCTION_ID;
    const canUseFirstFunction = payloadObj?.action === 'legacy_chat'
        && ['text', 'generate', 'edit'].includes(payloadObj?.mode)
        && ['text', 'generate', 'edit'].includes(ui.action?.value);
    const requestedFunctionId = canUseFirstFunction ? selectedFunctionId : SECOND_FUNCTION_ID;
    const targetFunctionId = requestedFunctionId === FIRST_FUNCTION_ID ? FIRST_FUNCTION_ID : SECOND_FUNCTION_ID;
    const targetFunctionLabel = targetFunctionId === FIRST_FUNCTION_ID ? 'الكود الوظيفي الأول' : 'الكود الوظيفي الثاني';
    const selectedFunctionLabel = selectedFunctionId === FIRST_FUNCTION_ID ? 'الكود الوظيفي الأول' : 'الكود الوظيفي الثاني';
    const routingNote = selectedFunctionId === targetFunctionId
        ? 'تم احترام الاختيار الظاهر في الواجهة.'
        : 'هذه الأداة لا تعمل عبر الكود الأول؛ لذلك وجّهتها الواجهة إلى الكود الوظيفي الثاني.';
    const requestSummary = [payloadObj?.action, payloadObj?.mode, payloadObj?.provider, payloadObj?.model]
        .filter(Boolean)
        .join(' / ') || 'طلب غير مصنف';
    let execution = null;
    let stage = 'create_execution';
    if (ui.loader) ui.loader.classList.remove('hidden');

    console.info('[AKLAKE] بدء طلب Appwrite', {
        selectedFunctionId: selectedFunctionId,
        targetFunctionId: targetFunctionId,
        requestSummary: requestSummary,
        endpoint: APPWRITE_ENDPOINT,
        projectId: APPWRITE_PROJECT_ID
    });

    try {
        execution = await appwriteFunctions.createExecution(
            targetFunctionId,
            JSON.stringify(payloadObj),
            false,
            '/',
            'POST',
            { 'Content-Type': 'application/json' }
        );
        stage = 'function_response';
        let parsedBody = null;
        try {
            parsedBody = execution.responseBody ? JSON.parse(execution.responseBody) : null;
        } catch (parseError) {
            parseError.failureKind = 'invalid_json';
            parseError.message = `ردّ ${targetFunctionLabel} ليس JSON صالحًا.`;
            throw parseError;
        }
        if (execution.status === 'failed' || Number(execution.responseStatusCode || 200) >= 400) {
            const serverMessage = parsedBody && (parsedBody.error || parsedBody.message);
            const executionError = new Error(serverMessage || execution.errors || `فشل تنفيذ الوظيفة بحالة ${execution.responseStatusCode || 'غير معروفة'}.`);
            executionError.serverMessage = serverMessage || execution.errors || '';
            throw executionError;
        }
        window.__AKLAKE_LAST_EXECUTION__ = Object.freeze({
            targetFunctionId: targetFunctionId,
            targetFunctionLabel: targetFunctionLabel,
            executionId: execution.$id || '',
            status: execution.status || '',
            responseStatusCode: Number(execution.responseStatusCode || 200),
            requestSummary: requestSummary
        });
        console.info('[AKLAKE] اكتمل تنفيذ Appwrite بنجاح', window.__AKLAKE_LAST_EXECUTION__);
        return parsedBody;
    } catch (error) {
        const responseStatusCode = Number(execution?.responseStatusCode || 0);
        const sdkCode = Number(error?.code || error?.response?.code || error?.response?.status || 0);
        const serverMessage = cleanDiagnosticValue(error?.serverMessage || '', 1000);
        const sdkMessage = cleanDiagnosticValue(error?.message || error?.response?.message || 'خطأ غير معروف', 1000);
        const details = {
            diagnosticId: 'AK-' + Date.now().toString(36).toUpperCase(),
            stage: stage,
            stageLabel: stage === 'function_response'
                ? 'بعد وصول الطلب إلى الوظيفة وأثناء معالجة ردها'
                : 'أثناء طلب إنشاء التنفيذ من Appwrite',
            selectedFunctionId: selectedFunctionId,
            selectedFunctionLabel: selectedFunctionLabel,
            targetFunctionId: targetFunctionId,
            targetFunctionLabel: targetFunctionLabel,
            routingNote: routingNote,
            requestSummary: requestSummary,
            executionId: execution?.$id || '',
            executionStatus: execution?.status || '',
            responseStatusCode: responseStatusCode,
            sdkCode: sdkCode,
            sdkType: cleanDiagnosticValue(error?.type || error?.response?.type || '', 250),
            serverMessage: serverMessage,
            sdkMessage: sdkMessage,
            failureKind: error?.failureKind || ''
        };
        details.explanation = getExecutionFailureExplanation(details);
        showExecutionDiagnostic(details);
        return null;
    } finally {
        if (ui.loader) ui.loader.classList.add('hidden');
    }
}

if (ui.sendBtn) {
    ui.sendBtn.addEventListener('click', async function() {
        const actionType = ui.action.value;
        const promptSnapshot = ui.prompt.value.trim();
        const bookReference = actionType === 'book_outline' && typeof getBookReferenceAttachment === 'function'
            ? getBookReferenceAttachment()
            : null;
        const explicitBookFields = [
            document.getElementById('b-title')?.value,
            document.getElementById('b-topic')?.value,
            document.getElementById('b-genre')?.value,
            document.getElementById('b-custom-genre')?.value,
            document.getElementById('b-custom-structure')?.value,
            document.getElementById('b-cover')?.value
        ].some(function(value) { return typeof value === 'string' && value.trim(); });
        
        if (!promptSnapshot && (actionType !== 'book_outline' || (!explicitBookFields && !bookReference))) { 
            alert("يرجى إدخال نص الطلب!"); 
            return; 
        }

        if (actionType === 'book_outline') {
            const pagesInput = document.getElementById('b-pages');
            const requestedPages = Number.parseInt(pagesInput?.value, 10);
            if (!Number.isInteger(requestedPages) || requestedPages < 50 || requestedPages > 400) {
                alert('عدد الصفحات مطلوب. اختر عددًا من 50 إلى 400 صفحة.');
                pagesInput?.focus();
                return;
            }
            if (promptSnapshot) lastBookOutlinePrompt = promptSnapshot;
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
        const requestPrompt = actionType === 'book_outline' && bookReference
            ? [
                promptSnapshot || 'أنشئ الكتاب بالاعتماد على المستند المرجعي المرفق.',
                '',
                '--- بداية المستند المرجعي: ' + bookReference.name + ' ---',
                bookReference.content,
                '--- نهاية المستند المرجعي ---'
            ].join('\n')
            : promptSnapshot;
        let payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            prompt: requestPrompt,
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
            payloadObj.action = 'book_outline';
            payloadObj.bookDetails = collectBookDetails();
        } else {
            payloadObj.action = 'legacy_chat';
            payloadObj.mode = actionType;
            if (actionType === 'edit') {
                if (ui.imageFile.files.length === 0) { 
                    alert("يرجى اختيار صورة للتعديل.");
                    return; 
                }
                try {
                    payloadObj.imageBase64 = await convertToBase64(ui.imageFile.files[0]);
                } catch (imageError) {
                    alert(imageError.message || 'تعذر تجهيز الصورة للتعديل.');
                    return;
                }
            }
        }

        ui.resultArea.classList.add('hidden');
        ui.resultText.classList.add('hidden');
        ui.editableContainer.classList.add('hidden');
        ui.bookActions.classList.add('hidden');
        if (actionType === 'book_outline') ui.introArea.classList.add('hidden');
        ui.resultImage.classList.add('hidden');
        ui.sourceBadge.classList.add('hidden');
        ui.sendBtn.disabled = true;

        let typingIndicator = null;
        openWorkspace();
        const visiblePrompt = actionType === 'book_outline' && bookReference
            ? (promptSnapshot || 'أنشئ الكتاب بالاعتماد على المستند المرفق.') + '\n📎 ' + bookReference.name
            : promptSnapshot;
        appendChatMessage('user', visiblePrompt, '', 'text');
        if (actionType === 'edit' && ui.attachmentImage && ui.attachmentImage.src) {
            appendChatMessage('user', ui.attachmentImage.src, 'الصورة المرفقة للتعديل', 'image');
        }
        typingIndicator = appendTypingIndicator();
        ui.prompt.value = '';
        autoResizeTextarea(ui.prompt);

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
                renderBookOutlineMessage(responseData.data, getSourceMetadata(responseData));
                if (bookReference && typeof clearBookReferenceAttachment === 'function') clearBookReferenceAttachment();
                ui.resultArea.classList.add('hidden');
                ui.editableContainer.classList.add('hidden');
                ui.bookActions.classList.add('hidden');
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
            if (actionType === 'book_outline') ui.resultArea.classList.add('hidden');
        } else if (responseData) {
            appendChatMessage('assistant', 'تعذر تنفيذ الطلب: ' + (responseData.error || 'خطأ غير معروف'), getSourceMetadata(responseData), 'text');
            alert("❌ فشل: " + responseData.error);
        }
    });
}

async function executeBookOutlineRefinement(refinePrompt) {
    const payloadObj = {
        userId: currentUser ? currentUser.$id : null,
        action: 'book_outline',
        bookStep: 'refine',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        previousOutline: ui.bookOutlineText.innerText,
        prompt: refinePrompt,
        bookDetails: collectBookDetails()
    };
    ui.refineBtn.disabled = true;
    const typingIndicator = appendTypingIndicator();
    const responseData = await executeRequest(payloadObj);
    typingIndicator?.remove();
    ui.refineBtn.disabled = false;
    if (responseData && responseData.success) {
        const creditsElem = document.getElementById('user-credits');
        if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
        ui.bookOutlineText.innerText = responseData.data;
        saveHistoryState();
        ui.refinePrompt.value = '';
        calculateRemainingPages();
        renderBookOutlineMessage(responseData.data, getSourceMetadata(responseData));
    } else if (responseData) {
        alert("❌ فشل التعديل: " + responseData.error);
    }
}

if (ui.refineBtn) {
    ui.refineBtn.addEventListener('click', function() {
        const refinePrompt = ui.refinePrompt.value.trim();
        if (!refinePrompt) return alert("يرجى كتابة التعديلات المطلوبة!");
        runBookStepWithModel('تعديل الخطة', function() {
            return executeBookOutlineRefinement(refinePrompt);
        });
    });
}

async function executeBookIntroduction() {
    const payloadObj = {
        userId: currentUser ? currentUser.$id : null,
        action: 'book_outline',
        bookStep: 'introduction',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        previousOutline: ui.bookOutlineText.innerText,
        bookDetails: collectBookDetails()
    };
    ui.writeIntroBtn.disabled = true;
    ui.retryIntroBtn && (ui.retryIntroBtn.disabled = true);
    ui.writeIntroBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الكتابة...';
    const typingIndicator = appendTypingIndicator();
    const responseData = await executeRequest(payloadObj);
    typingIndicator?.remove();
    ui.writeIntroBtn.disabled = false;
    ui.retryIntroBtn && (ui.retryIntroBtn.disabled = false);
    ui.writeIntroBtn.innerHTML = '<i class="fas fa-rocket"></i> اعتماد الخطة الحالية وكتابة المقدمة';
    if (responseData && responseData.success) {
        const creditsElem = document.getElementById('user-credits');
        if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
        rawBookTextFull = responseData.data;
        const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 5;
        bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
        currentViewedPageIndex = 0;
        ui.introArea.style.display = 'flex';
        ui.introArea.classList.remove('hidden');
        renderCurrentPage();
        const introSource = document.querySelector('#book-intro-chat-message .message-source');
        if (introSource) introSource.textContent = getSourceMetadata(responseData);
        document.getElementById('book-intro-chat-message')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (responseData) {
        alert("❌ فشل كتابة المقدمة: " + responseData.error);
    }
}

if (ui.writeIntroBtn) {
    ui.writeIntroBtn.addEventListener('click', function() {
        runBookStepWithModel('كتابة المقدمة', executeBookIntroduction);
    });
}

async function executeIntroductionRefinement(promptText) {
    const payloadObj = {
        userId: currentUser ? currentUser.$id : null,
        action: 'book_outline',
        bookStep: 'refine_intro',
        provider: ui.provider.value,
        modelTier: ui.model.value,
        previousOutline: ui.bookOutlineText.innerText,
        currentIntro: rawBookTextFull,
        prompt: promptText,
        bookDetails: collectBookDetails()
    };
    ui.refineIntroBtn.disabled = true;
    ui.refineIntroBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التعديل...';
    const typingIndicator = appendTypingIndicator();
    const responseData = await executeRequest(payloadObj);
    typingIndicator?.remove();
    ui.refineIntroBtn.disabled = false;
    ui.refineIntroBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> تنفيذ التعديل';
    if (responseData && responseData.success) {
        const creditsElem = document.getElementById('user-credits');
        if (creditsElem) creditsElem.innerText = responseData.remainingTokens;
        rawBookTextFull = responseData.data;
        const targetPages = document.getElementById('target-pages-input') ? parseInt(document.getElementById('target-pages-input').value) : 5;
        bookPagesData = smartPaginateText(rawBookTextFull, targetPages);
        currentViewedPageIndex = 0;
        renderCurrentPage();
        if (ui.refineIntroPrompt) ui.refineIntroPrompt.value = '';
        const introSource = document.querySelector('#book-intro-chat-message .message-source');
        if (introSource) introSource.textContent = getSourceMetadata(responseData) + ' • تم تحديث المقدمة';
        document.getElementById('book-intro-chat-message')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (responseData) {
        alert("❌ فشل تعديل المقدمة: " + responseData.error);
    }
}

if (ui.refineIntroBtn) {
    ui.refineIntroBtn.addEventListener('click', function() {
        const promptText = ui.refineIntroPrompt ? ui.refineIntroPrompt.value.trim() : '';
        if (!promptText) return alert("يرجى كتابة التعديل الذي تريده على المقدمة أولاً!");
        runBookStepWithModel('تعديل المقدمة', function() {
            return executeIntroductionRefinement(promptText);
        });
    });
}

// ==========================================
// 4. نظام التأليف الأوتوماتيكي والمراقبة
// ==========================================
let currentAutoBookId = null;
let pollingInterval = null;
let isGeneratingAutoBook = false;

function getBookTargetPages() {
    return Math.min(400, Math.max(50, Number.parseInt(document.getElementById('b-pages')?.value, 10) || 50));
}

function updateBookProgress(generatedPages, totalPages) {
    const total = Math.max(1, Number.parseInt(totalPages, 10) || getBookTargetPages());
    const generated = Math.min(total, Math.max(0, Number.parseInt(generatedPages, 10) || 0));
    const percent = Math.min(100, Math.round((generated / total) * 100));
    const progressCount = document.getElementById('progress-count');
    const progressTotal = document.getElementById('progress-total');
    const progressRing = document.getElementById('book-progress-ring');
    if (progressCount) progressCount.innerText = String(generated);
    if (progressTotal) progressTotal.innerText = String(total);
    if (progressRing) {
        progressRing.style.setProperty('--book-progress', `${percent * 3.6}deg`);
        progressRing.setAttribute('aria-label', `تم إنشاء ${generated} من أصل ${total} صفحة`);
    }
}

function updateWorkingModelName() {
    const target = document.getElementById('working-model-name');
    if (!target) return;
    const selectedChoice = getSelectedCatalogChoice('book_outline');
    const fallbackName = ui.model?.selectedOptions?.[0]?.textContent || ui.model?.value || 'نموذج التأليف';
    target.textContent = selectedChoice?.name || fallbackName.replace(/\s*\([^)]*نقط[^)]*\)\s*/g, '').trim();
}

document.addEventListener('click', async function(e) {
    if (e.target && (e.target.id === 'start-auto-btn' || e.target.closest('#start-auto-btn'))) {
        
        if (isGeneratingAutoBook) return; 
        
        const startBtnElem = document.getElementById('start-auto-btn');
        
        if (!currentUser) { alert("يرجى تسجيل الدخول أولاً."); return; }
        if (bookPagesData.length === 0) { alert("يجب كتابة والموافقة على المقدمة أولاً قبل توليد باقي الكتاب."); return; }

        if (startBtnElem?.dataset.modelReady === 'true') {
            delete startBtnElem.dataset.modelReady;
        } else {
            runBookStepWithModel('تأليف الكتاب الكامل', function() {
                if (!startBtnElem) return;
                startBtnElem.dataset.modelReady = 'true';
                startBtnElem.click();
            });
            return;
        }

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

            const currentBookDetails = collectBookDetails();
            const payloadObj = {
                userId: currentUser.$id,
                action: 'start_auto_write',
                provider: ui.provider.value,
                modelTier: ui.model.value,
                outline: ui.bookOutlineText.innerText,
                introPagesArray: bookPagesData,
                targetPages: getBookTargetPages(),
                title: currentBookDetails.title,
                bookDetails: currentBookDetails
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
                
                const statusBox = document.getElementById('auto-generation-status');
                const newBtn = document.getElementById('new-book-btn');
                if(statusBox) statusBox.classList.remove('hidden');
                if(newBtn) newBtn.classList.remove('hidden');
                ui.resultArea?.classList.add('hidden');
                document.getElementById('book-progress-ring')?.classList.remove('is-complete', 'is-failed');
                const statusTitle = document.getElementById('status-title');
                if (statusTitle) statusTitle.textContent = 'يتم الآن تأليف كتابك في الخلفية';
                updateBookProgress(currentBookDetails.introPages, getBookTargetPages());
                updateWorkingModelName();
                startPolling();
                document.getElementById('book-progress-chat-message')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
            const generatedPages = Number.parseInt(bookDoc.generated_pages_count, 10);
            updateBookProgress(Number.isFinite(generatedPages) ? generatedPages : bookPagesData.length, getBookTargetPages());

            if (bookDoc.status === 'failed') {
                const statusTitle = document.getElementById('status-title');
                if (statusTitle) statusTitle.textContent = 'توقف التأليف بسبب خطأ في النموذج. يمكنك إعادة المحاولة لاحقًا.';
                document.getElementById('book-progress-ring')?.classList.add('is-failed');
                clearInterval(pollingInterval);
                pollingInterval = null;
                return;
            }
            
            if (bookDoc.status === 'completed') {
                const statusTitle = document.getElementById('status-title');
                if(statusTitle) statusTitle.textContent = 'اكتمل تأليف الكتاب بنجاح';
                updateBookProgress(getBookTargetPages(), getBookTargetPages());
                document.getElementById('book-progress-ring')?.classList.add('is-complete');
                clearInterval(pollingInterval);
                pollingInterval = null;
                
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
    if(statusTitle) statusTitle.textContent = 'يتم الآن تأليف كتابك في الخلفية';
    document.getElementById('book-progress-ring')?.classList.remove('is-complete', 'is-failed');
    updateBookProgress(0, getBookTargetPages());
    
    bookPagesData = [];
    rawBookTextFull = "";
    lastBookOutlinePrompt = '';
    ui.bookOutlineText.innerText = "";
    ui.introArea.classList.add('hidden');
    ui.introArea.style.display = 'none';
    ui.resultArea.classList.add('hidden');
    document.getElementById('book-outline-chat-message')?.remove();
    document.getElementById('intro-refine-section')?.classList.add('hidden');
    document.getElementById('start-auto-btn')?.parentElement?.classList.remove('hidden');
    if (ui.introEditToggleBtn) ui.introEditToggleBtn.innerHTML = '<i class="fas fa-pen"></i><span>تعديل المقدمة</span>';
    setBookSettingsExpanded(false);
    
    updateUI();
}

// ==========================================
// 5. أدوات التحويل والمصادقة
// ==========================================
async function convertToBase64(file) {
    if (!file) throw new Error('لم يتم اختيار صورة.');
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('استخدم صورة PNG أو JPG أو WEBP.');
    if (file.size > 50 * 1024 * 1024) throw new Error('حجم الصورة أكبر من 50MB.');
    if (typeof fileToOptimizedDataURL === 'function') {
        return fileToOptimizedDataURL(file);
    }
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
        document.getElementById('user-info').classList.remove('hidden');
        document.querySelector('.token-add-btn')?.classList.remove('hidden');
        document.getElementById('profile-header-btn')?.classList.remove('hidden');
        const displayName = currentUser.name?.trim() || currentUser.email?.split('@')[0] || 'حسابي';
        const headerName = document.getElementById('header-user-name');
        const profileName = document.getElementById('profile-user-name');
        const profileEmail = document.getElementById('profile-user-email');
        if (headerName) headerName.textContent = displayName;
        if (profileName) profileName.textContent = displayName;
        if (profileEmail) profileEmail.textContent = currentUser.email || '';
        fetchUserCredits();
        fetchUserBooks();
        if (typeof window.syncLandingProjectsFromServer === 'function') {
            window.syncLandingProjectsFromServer();
        }
    } catch (error) {
        document.getElementById('login-btn').classList.remove('hidden');
        document.getElementById('user-info').classList.add('hidden');
        document.querySelector('.token-add-btn')?.classList.add('hidden');
        document.getElementById('profile-header-btn')?.classList.add('hidden');
        setProfileDrawerOpen(false);
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
            const tokenBalance = response.documents[0].tokens;
            document.getElementById('user-credits').innerText = tokenBalance;
            const profileCreditCount = document.getElementById('profile-credit-count');
            if (profileCreditCount) profileCreditCount.innerText = tokenBalance;
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
                const card = document.createElement('div');
                card.className = 'library-book-card';

                const openButton = document.createElement('button');
                openButton.type = 'button';
                openButton.className = 'library-book-btn';
                const icon = document.createElement('i');
                icon.className = 'fas fa-book-open';
                const title = document.createElement('strong');
                title.textContent = book.title || 'كتاب بدون عنوان';
                const status = document.createElement('span');
                status.textContent = book.status === 'completed' ? 'مكتمل' : (book.status === 'failed' ? 'متوقف' : 'قيد التأليف');
                openButton.append(icon, title, status);
                openButton.addEventListener('click', () => loadBookFromLibrary(book));
                card.appendChild(openButton);

                if (book.status === 'completed') {
                    const marketingButton = document.createElement('button');
                    marketingButton.type = 'button';
                    marketingButton.className = 'book-to-landing-btn';
                    marketingButton.innerHTML = '<i class="fas fa-window-maximize"></i><span>إنشاء صفحة تسويق لهذا الكتاب</span>';
                    marketingButton.addEventListener('click', function() {
                        window.selectAITool('landing_page');
                        if (typeof window.prefillLandingFromBook === 'function') window.prefillLandingFromBook(book);
                    });
                    card.appendChild(marketingButton);
                }
                libraryList.appendChild(card);
            });
        }
        
    } catch (error) {
        console.error("Error fetching library books:", error);
    }
}

function loadBookFromLibrary(book) {
    window.selectAITool('book_outline');
    const mainInputs = document.getElementById('main-inputs-wrapper');
    const autoGenStatus = document.getElementById('auto-generation-status');
    
    if(mainInputs) mainInputs.classList.remove('hidden');
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

