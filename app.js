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
function openWorkspace() {
    if (ui.welcomeScreen) ui.welcomeScreen.classList.add('is-hidden');
    if (ui.appShell) ui.appShell.classList.remove('is-collapsed');
    document.body.classList.add('workspace-open');
}
window.openWorkspace = openWorkspace;

function showHomeScreen() {
    if (ui.welcomeScreen) ui.welcomeScreen.classList.remove('is-hidden');
    if (ui.appShell) ui.appShell.classList.add('is-collapsed');
    document.body.classList.remove('workspace-open');
    const libraryDrawer = document.getElementById('my-library-section');
    if (libraryDrawer) libraryDrawer.classList.add('hidden');
    if (typeof closeArtDialogs === 'function') closeArtDialogs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showHomeScreen = showHomeScreen;

function initHomeNavigation() {
    const homeButton = document.getElementById('home-btn');
    const brandLink = document.getElementById('brand-link');
    if (homeButton) homeButton.addEventListener('click', showHomeScreen);
    if (brandLink) {
        brandLink.addEventListener('click', function(event) {
            if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                showHomeScreen();
            }
        });
    }
}

function scrollChatToBottom() {
    if (!ui.chatMessages) return;
    requestAnimationFrame(function() {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
}

function appendChatMessage(role, content, metadata, resultType) {
    if (!ui.chatMessages) return null;

    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-message' : 'assistant-message'}`;

    const avatar = document.createElement('div');
    avatar.className = role === 'user' ? 'message-avatar' : 'message-avatar agent-avatar';
    avatar.innerHTML = role === 'user'
        ? '<i class="far fa-user"></i>'
        : '<img src="' + AGENT_AVATAR_URL + '" alt="وكيل AKLAKE">';

    const contentWrap = document.createElement('div');
    contentWrap.className = 'message-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (resultType === 'image') {
        const image = document.createElement('img');
        image.className = 'message-image';
        image.src = content;
        image.alt = 'صورة مولدة بالذكاء الاصطناعي';
        bubble.appendChild(image);
    } else {
        bubble.textContent = content || '';
    }

    contentWrap.appendChild(bubble);
    if (metadata) {
        const source = document.createElement('div');
        source.className = 'message-source';
        source.textContent = metadata;
        contentWrap.appendChild(source);
    }

    row.appendChild(avatar);
    row.appendChild(contentWrap);
    ui.chatMessages.appendChild(row);
    scrollChatToBottom();
    return row;
}

function appendTypingIndicator() {
    if (!ui.chatMessages) return null;
    const row = document.createElement('div');
    row.className = 'message-row assistant-message typing-row';
    row.innerHTML = `
        <div class="message-avatar agent-avatar"><img src="https://static.verse.works/image/source/static%2Fuploads%2F0x7c1bd459dae8ec0bb45fe3172fd58a2b53972e5c%2Fc96cf9cb-273c-4b48-b7ba-7193e06b0336.gif" alt="وكيل AKLAKE"></div>
        <div class="message-content">
            <div class="message-bubble typing-bubble" aria-label="النموذج يكتب">
                <i></i><i></i><i></i><i></i>
            </div>
            <div class="message-source">يفكر ويكتب الآن...</div>
        </div>`;
    ui.chatMessages.appendChild(row);
    scrollChatToBottom();
    return row;
}

function getSourceMetadata(responseData) {
    const sourceName = responseData && responseData.sourceFunction
        ? responseData.sourceFunction
        : (ui.source.value === '6a3c7a760032067bd275' ? 'الكود الوظيفي الأول' : 'الكود الوظيفي الثاني');
    const providerName = ui.provider.options[ui.provider.selectedIndex]
        ? ui.provider.options[ui.provider.selectedIndex].text
        : ui.provider.value;
    const modelName = ui.model.options[ui.model.selectedIndex]
        ? ui.model.options[ui.model.selectedIndex].text
        : ui.model.value;
    return `المصدر: ${sourceName} • ${providerName} • ${modelName}`;
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
}

let modelChooserState = { action: 'text', sendAfterChoice: false, selected: null };
let skipModelGateOnce = false;
const oneShotModelChoices = {};
const activeComposerChoices = {};

function readRememberedModels() {
    try {
        const value = JSON.parse(localStorage.getItem(MODEL_MEMORY_KEY) || '{}');
        return value && typeof value === 'object' ? value : {};
    } catch (error) {
        return {};
    }
}

function writeRememberedModels(value) {
    localStorage.setItem(MODEL_MEMORY_KEY, JSON.stringify(value));
}

function getComposerModeKey(action) {
    return ['text', 'generate', 'edit'].includes(action) ? action : null;
}

function findCatalogChoice(action, provider, model) {
    return (MODEL_CATALOG[action] || []).find(function(choice) {
        return choice.provider === provider && choice.model === model;
    }) || null;
}

function getSelectedCatalogChoice(action) {
    if (!ui.provider || !ui.model) return null;
    return findCatalogChoice(action, ui.provider.value, ui.model.value);
}

function applyModelChoice(action, choice) {
    if (!choice || !getComposerModeKey(action)) return;
    activeComposerChoices[action] = choice;
    ui.source.value = SECOND_FUNCTION_ID;
    ui.action.value = action;
    updateUI();
    ui.provider.value = choice.provider;
    updateModels();
    ui.model.value = choice.model;
    syncWorkspaceFromSelections();
    refreshComposerModelLabel();
}

function refreshComposerModelLabel() {
    if (!ui.activeModelLabel || !ui.action) return;
    const action = getComposerModeKey(ui.action.value);
    if (!action) {
        ui.activeModelLabel.textContent = 'إعدادات الأداة';
        return;
    }
    const remembered = readRememberedModels()[action];
    const choice = activeComposerChoices[action]
        || (remembered ? findCatalogChoice(action, remembered.provider, remembered.model) : null);
    if (choice) {
        ui.activeModelLabel.innerHTML = '<span class="active-model-name">' + choice.name + '</span> <span class="token-cost">• ' + choice.cost + '</span>';
    } else {
        ui.activeModelLabel.textContent = 'اختيار النموذج';
    }
}

function renderModelChoices(action) {
    if (!ui.modelChoicesList) return;
    ui.modelChoicesList.innerHTML = '';
    const remembered = readRememberedModels()[action];
    const current = modelChooserState.selected
        || activeComposerChoices[action]
        || (remembered ? findCatalogChoice(action, remembered.provider, remembered.model) : null);

    (MODEL_CATALOG[action] || []).forEach(function(choice) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'model-choice-card';
        if (current && current.provider === choice.provider && current.model === choice.model) {
            button.classList.add('selected');
            modelChooserState.selected = choice;
        }
        button.innerHTML = `
            <span class="model-choice-icon"><i class="fas ${choice.icon}"></i></span>
            <span class="model-choice-copy"><strong>${choice.name}</strong><small>${choice.description}</small></span>
            <span class="model-choice-cost">${choice.cost}</span>`;
        button.addEventListener('click', function() {
            modelChooserState.selected = choice;
            ui.modelChoicesList.querySelectorAll('.model-choice-card').forEach(function(card) { card.classList.remove('selected'); });
            button.classList.add('selected');
            if (ui.confirmModelBtn) ui.confirmModelBtn.disabled = false;
        });
        ui.modelChoicesList.appendChild(button);
    });
    if (ui.confirmModelBtn) ui.confirmModelBtn.disabled = !modelChooserState.selected;
}

function openModelChooser(action, sendAfterChoice) {
    const mode = getComposerModeKey(action) || 'text';
    modelChooserState = { action: mode, sendAfterChoice: Boolean(sendAfterChoice), selected: null };
    const titles = {
        text: ['اختر نموذج المحادثة', 'جميع هذه النماذج تُستدعى من الكود الوظيفي الثاني.'],
        generate: ['توليد صورة من الصفر', 'يُستخدم GPT Image 2 من OpenAI عبر الكود الوظيفي الثاني فقط.'],
        edit: ['اختر قوة تعديل الصورة', 'اختر تعديلًا بسيطًا أو احترافيًا؛ كلاهما من OpenAI وعبر الكود الوظيفي الثاني فقط.']
    };
    if (ui.modelChooserTitle) ui.modelChooserTitle.textContent = titles[mode][0];
    if (ui.modelChooserDescription) ui.modelChooserDescription.textContent = titles[mode][1];
    const remembered = readRememberedModels()[mode];
    if (ui.rememberModelToggle) ui.rememberModelToggle.checked = Boolean(remembered);
    const rememberIcon = document.querySelector('.remember-toggle-icon');
    if (rememberIcon) {
        rememberIcon.classList.toggle('fa-toggle-on', Boolean(remembered));
        rememberIcon.classList.toggle('fa-toggle-off', !remembered);
    }
    if (ui.confirmModelBtn) ui.confirmModelBtn.innerHTML = sendAfterChoice
        ? '<i class="fas fa-check"></i> متابعة وإرسال'
        : '<i class="fas fa-check"></i> اعتماد الاختيار';
    renderModelChoices(mode);
    if (ui.modelPopover) ui.modelPopover.classList.remove('hidden');
}

function closeModelChooser() {
    if (ui.modelPopover) ui.modelPopover.classList.add('hidden');
    modelChooserState = { action: 'text', sendAfterChoice: false, selected: null };
}

function confirmModelChoice() {
    const choice = modelChooserState.selected;
    if (!choice) return;
    const action = modelChooserState.action;
    const sendAfterChoice = modelChooserState.sendAfterChoice;
    applyModelChoice(action, choice);

    const rememberedModels = readRememberedModels();
    if (ui.rememberModelToggle && ui.rememberModelToggle.checked) {
        rememberedModels[action] = { provider: choice.provider, model: choice.model };
        writeRememberedModels(rememberedModels);
    } else {
        delete rememberedModels[action];
        writeRememberedModels(rememberedModels);
        if (!sendAfterChoice) oneShotModelChoices[action] = choice;
    }
    closeModelChooser();
    refreshComposerModelLabel();

    if (sendAfterChoice) {
        skipModelGateOnce = true;
        ui.sendBtn.click();
    }
}

function prepareModelForSend(action) {
    if (!getComposerModeKey(action)) return true;
    const remembered = readRememberedModels()[action];
    if (remembered) {
        const choice = findCatalogChoice(action, remembered.provider, remembered.model);
        if (choice) {
            applyModelChoice(action, choice);
            return true;
        }
    }
    if (oneShotModelChoices[action]) {
        applyModelChoice(action, oneShotModelChoices[action]);
        delete oneShotModelChoices[action];
        return true;
    }
    openModelChooser(action, true);
    return false;
}

function syncComposerModeUI() {
    if (!ui.action) return;
    const action = ui.action.value;
    const isImageMode = action === 'generate' || action === 'edit';
    if (ui.modeBanner) ui.modeBanner.classList.toggle('hidden', !isImageMode);
    if (ui.imageModeBtn) ui.imageModeBtn.classList.toggle('active', action === 'generate');
    if (ui.attachBtn) ui.attachBtn.classList.toggle('active', action === 'edit');
    if (ui.modeTitle) ui.modeTitle.textContent = action === 'edit' ? 'وضع تعديل الصورة' : 'وضع توليد الصور';
    if (ui.modeDescription) ui.modeDescription.textContent = action === 'edit'
        ? 'اكتب التعديل المطلوب على الصورة المرفقة'
        : 'اكتب وصف الصورة التي تريد إنشاءها';
    refreshComposerModelLabel();
}

function setUnifiedComposerMode(action) {
    const target = getComposerModeKey(action) || 'text';
    ui.source.value = SECOND_FUNCTION_ID;
    ui.action.value = target;
    updateUI();
    syncComposerModeUI();
    if (ui.prompt) ui.prompt.focus();
}

function clearComposerAttachment(returnToChat) {
    if (ui.imageFile) ui.imageFile.value = '';
    if (ui.attachmentImage) ui.attachmentImage.src = '';
    if (ui.attachmentPreview) ui.attachmentPreview.classList.add('hidden');
    if (returnToChat && ui.action.value === 'edit') setUnifiedComposerMode('text');
}

function showComposerAttachment(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function() {
        if (ui.attachmentImage) ui.attachmentImage.src = reader.result;
        if (ui.attachmentName) ui.attachmentName.textContent = file.name;
        if (ui.attachmentPreview) ui.attachmentPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    setUnifiedComposerMode('edit');
}

function syncWorkspaceFromSelections() {
    if (!ui.action) return;
    const action = ui.action.value;
    if (ui.appShell) ui.appShell.dataset.action = action;

    document.querySelectorAll('[data-tool]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.tool === action);
    });

    const workspaceData = {
        text: { kicker: 'AKLAKE CHAT', title: 'محادثة جديدة', placeholder: 'اكتب رسالتك هنا...' },
        generate: { kicker: 'IMAGE STUDIO', title: 'إنشاء صورة', placeholder: 'صف الصورة التي تريد إنشاءها...' },
        edit: { kicker: 'IMAGE EDITOR', title: 'تعديل صورة', placeholder: 'اشرح التعديل المطلوب على الصورة...' },
        art_studio: { kicker: 'AKLAKE ART ROOM', title: 'استوديو اللوحات الفنية', placeholder: 'صف اللوحة التي تريد إنشاءها...' },
        book_outline: { kicker: 'BOOK BUILDER', title: 'إنشاء كتاب طويل', placeholder: 'ملاحظات إضافية عن الكتاب (اختياري)...' }
    };
    const data = workspaceData[action] || workspaceData.text;
    if (ui.workspaceKicker) ui.workspaceKicker.textContent = data.kicker;
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = data.title;
    if (ui.prompt) ui.prompt.placeholder = data.placeholder;

    refreshComposerModelLabel();
    syncComposerModeUI();
}

window.selectAITool = function(action) {
    openWorkspace();
    if (!ui.action || !ui.source) return;

    if (action !== 'edit' && ui.imageFile && ui.imageFile.files && ui.imageFile.files.length > 0) {
        clearComposerAttachment(false);
    }

    const mainInputs = document.getElementById('main-inputs-wrapper');
    const libraryDrawer = document.getElementById('my-library-section');
    if (mainInputs) mainInputs.classList.remove('hidden');
    if (libraryDrawer) libraryDrawer.classList.add('hidden');

    // المحادثة والصور والكتب واللوحات تمر الآن عبر الكود الوظيفي الثاني.
    ui.source.value = SECOND_FUNCTION_ID;
    ui.action.value = action;
    updateUI();
    if (action === 'art_studio') {
        if (ui.resultArea) ui.resultArea.classList.add('hidden');
        if (ui.introArea) ui.introArea.classList.add('hidden');
        const autoStatus = document.getElementById('auto-generation-status');
        if (autoStatus) autoStatus.classList.add('hidden');
    }
    if (action === 'text' && ui.prompt) ui.prompt.focus();
};

// ==========================================
// استوديو اللوحات — Front-end + نفس مسار الصور القديم
// ==========================================
const ARTWORKS_STORAGE_KEY = 'aklake_artworks_v1';
const ART_CART_STORAGE_KEY = 'aklake_art_cart_v1';
const ART_SIZE_INFO = {
    large: { label: 'لوحة كبيرة', width: 44, height: 60, verticalWidth: 21, verticalHeight: 73, price: 79 },
    medium: { label: 'لوحة متوسطة', width: 36, height: 49, verticalWidth: 18, verticalHeight: 63, price: 59 },
    small: { label: 'لوحة صغيرة', width: 30, height: 41, verticalWidth: 15, verticalHeight: 52, price: 39 }
};

let artFrames = [];
let selectedArtFrameId = null;
let artFrameCounter = 0;
let artDragState = null;
let pendingArtOperation = null;

function safeReadLocalList(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (error) {
        return [];
    }
}

function safeWriteLocalList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getArtFrame(id) {
    return artFrames.find(function(frame) { return frame.id === id; }) || null;
}

function getSelectedArtFrame() {
    return getArtFrame(selectedArtFrameId);
}

function artRectsOverlap(a, b, gap) {
    const space = typeof gap === 'number' ? gap : 0.15;
    return !(
        a.x + a.width + space <= b.x ||
        b.x + b.width + space <= a.x ||
        a.y + a.height + space <= b.y ||
        b.y + b.height + space <= a.y
    );
}

function getArtFrameMetrics(frameOrSize, orientation) {
    const frame = typeof frameOrSize === 'object' ? frameOrSize : null;
    const size = frame ? frame.size : frameOrSize;
    const direction = frame ? frame.orientation : (orientation || 'horizontal');
    const info = ART_SIZE_INFO[size] || ART_SIZE_INFO.medium;
    const layer = document.getElementById('art-frames-layer');

    if (frame && frame.element && layer && layer.clientWidth > 0 && layer.clientHeight > 0) {
        const rect = frame.element.querySelector('.art-frame-canvas')
            ? frame.element.querySelector('.art-frame-canvas').getBoundingClientRect()
            : frame.element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return {
                width: (rect.width / layer.clientWidth) * 100,
                height: (rect.height / layer.clientHeight) * 100
            };
        }
    }

    if (window.innerWidth <= 720) {
        const mobile = {
            large: { horizontal: [60, 33], vertical: [33, 44] },
            medium: { horizontal: [52, 28], vertical: [28, 38] },
            small: { horizontal: [44, 24], vertical: [24, 33] }
        }[size];
        return { width: mobile[direction][0], height: mobile[direction][1] };
    }
    if (window.innerWidth <= 980) {
        const tablet = {
            large: { horizontal: [52, 55], vertical: [30, 82] },
            medium: { horizontal: [44, 47], vertical: [25, 69] },
            small: { horizontal: [36, 38], vertical: [21, 58] }
        }[size];
        return { width: tablet[direction][0], height: tablet[direction][1] };
    }

    return direction === 'vertical'
        ? { width: info.verticalWidth, height: info.verticalHeight }
        : { width: info.width, height: info.height };
}

function positionCollides(frameId, x, y, size, orientation) {
    const candidateFrame = getArtFrame(frameId);
    const metrics = getArtFrameMetrics(candidateFrame || size, candidateFrame ? candidateFrame.orientation : (orientation || 'horizontal'));
    const candidate = { x: x, y: y, width: metrics.width, height: metrics.height };
    return artFrames.some(function(other) {
        if (other.id === frameId) return false;
        const otherInfo = getArtFrameMetrics(other);
        return artRectsOverlap(candidate, {
            x: other.x,
            y: other.y,
            width: otherInfo.width,
            height: otherInfo.height
        }, 0.15);
    });
}

function findAvailableArtPosition(size, orientation, preferredFrame) {
    const info = getArtFrameMetrics(size, orientation || 'horizontal');
    const preferred = preferredFrame ? getArtFrameMetrics(preferredFrame) : null;
    const candidates = preferredFrame ? [
        [preferredFrame.x + preferred.width + .25, preferredFrame.y],
        [preferredFrame.x - info.width - .25, preferredFrame.y],
        [preferredFrame.x, preferredFrame.y + preferred.height + .25]
    ] : [];

    for (let y = 2; y <= 100 - info.height; y += 1) {
        for (let x = 1; x <= 100 - info.width; x += .25) candidates.push([x, y]);
    }

    for (let i = 0; i < candidates.length; i++) {
        const x = Math.max(0, Math.min(candidates[i][0], 100 - info.width));
        const y = Math.max(0, Math.min(candidates[i][1], 100 - info.height));
        if (!positionCollides('', x, y, size, orientation)) return { x: x, y: y };
    }
    return null;
}

function setArtStudioStatus(message, type) {
    const status = document.getElementById('art-studio-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'art-studio-status' + (type ? ' ' + type : '');
}

function renderArtFrame(frame) {
    frame.element.className = [
        'art-frame', frame.size,
        'orientation-' + frame.orientation,
        'frame-style-' + frame.frameStyle,
        frame.id === selectedArtFrameId ? 'selected' : '',
        frame.processing ? 'processing' : ''
    ].filter(Boolean).join(' ');

    frame.element.innerHTML = `
        <div class="art-frame-toolbar">
            <button type="button" class="frame-drag-handle" data-frame-action="drag" title="أمسك واسحب اللوحة"><i class="fas fa-hand"></i></button>
            <button type="button" class="frame-size-btn ${frame.size === 'small' ? 'active' : ''}" data-frame-action="resize" data-frame-size="small" title="لوحة صغيرة"><span>S</span></button>
            <button type="button" class="frame-size-btn ${frame.size === 'medium' ? 'active' : ''}" data-frame-action="resize" data-frame-size="medium" title="لوحة متوسطة"><span>M</span></button>
            <button type="button" class="frame-size-btn ${frame.size === 'large' ? 'active' : ''}" data-frame-action="resize" data-frame-size="large" title="لوحة كبيرة"><span>L</span></button>
            <button type="button" data-frame-action="rotate" title="تدوير أفقي أو عمودي"><i class="fas fa-rotate"></i></button>
            <button type="button" data-frame-action="style" title="تغيير شكل الحواف"><i class="fas fa-border-all"></i></button>
            <button type="button" class="frame-delete-btn" data-frame-action="delete" title="حذف اللوحة"><i class="far fa-trash-can"></i></button>
        </div>
        <div class="art-frame-canvas"></div>
        <div class="art-frame-actions"></div>`;

    const canvas = frame.element.querySelector('.art-frame-canvas');
    const actions = frame.element.querySelector('.art-frame-actions');
    if (frame.imageData) {
        const image = document.createElement('img');
        image.src = frame.imageData;
        image.alt = frame.title;
        canvas.appendChild(image);
        actions.innerHTML = `
            <button type="button" class="frame-transform-btn" data-frame-action="edit"><i class="fas fa-wand-magic-sparkles"></i><span>تحويل</span></button>
            <button type="button" data-frame-action="generate"><i class="fas fa-sparkles"></i><span>إنشاء جديد</span></button>
            <button type="button" class="frame-save-btn ${frame.saved ? 'saved' : ''}" data-frame-action="save"><i class="far fa-bookmark"></i><span>${frame.saved ? 'محفوظة' : 'حفظ'}</span></button>
            <button type="button" class="frame-cart-btn" data-frame-action="cart"><i class="fas fa-bag-shopping"></i><span>السلة</span></button>`;
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'frame-placeholder-actions';
        placeholder.innerHTML = `
            <button type="button" data-frame-action="upload"><i class="fas fa-cloud-arrow-up"></i><span>رفع صورة</span></button>
            <button type="button" data-frame-action="generate"><i class="fas fa-sparkles"></i><span>إنشاء من الصفر</span></button>`;
        canvas.appendChild(placeholder);
    }

    const brushes = document.createElement('div');
    brushes.className = 'brush-loader';
    brushes.setAttribute('aria-label', 'يتم رسم اللوحة');
    brushes.innerHTML = '<i></i><i></i><i></i>';
    canvas.appendChild(brushes);
}

function updateEmptyWallHint() {
    const hint = document.getElementById('empty-wall-hint');
    if (hint) hint.classList.toggle('hidden', artFrames.length > 0);
}

function createArtFrame(size, options) {
    const layer = document.getElementById('art-frames-layer');
    if (!layer || !ART_SIZE_INFO[size]) return null;

    const settings = options || {};
    const orientation = settings.orientation || 'horizontal';

    const position = findAvailableArtPosition(size, orientation, settings.preferredNear || null);
    if (!position) {
        setArtStudioStatus('لا توجد مساحة كافية للوحة جديدة. حرّك اللوحات الحالية أو احذف واحدة.', 'error');
        return null;
    }

    artFrameCounter += 1;
    const frame = {
        id: 'art-frame-' + Date.now() + '-' + artFrameCounter,
        title: 'اللوحة ' + artFrameCounter,
        size: size,
        orientation: orientation,
        frameStyle: settings.frameStyle || 'classic',
        x: position.x,
        y: position.y,
        imageData: settings.imageData || '',
        hasGenerated: Boolean(settings.hasGenerated),
        prompt: settings.prompt || '',
        saved: false,
        processing: false,
        element: document.createElement('div')
    };

    frame.element.dataset.frameId = frame.id;
    frame.element.style.left = frame.x + '%';
    frame.element.style.top = frame.y + '%';
    frame.element.addEventListener('pointerdown', function(event) {
        if (event.target.closest('.frame-drag-handle')) beginArtFrameDrag(event);
    });
    frame.element.addEventListener('click', handleArtFrameClick);

    artFrames.push(frame);
    layer.appendChild(frame.element);
    renderArtFrame(frame);
    selectArtFrame(frame.id);
    updateEmptyWallHint();
    setArtStudioStatus('أضيفت ' + ART_SIZE_INFO[size].label + '. استخدم مقبض اليد فوقها لتحريكها.', 'success');
    return frame;
}

function selectArtFrame(frameId) {
    selectedArtFrameId = frameId;
    artFrames.forEach(function(frame) {
        frame.element.classList.toggle('selected', frame.id === frameId);
    });
}

function handleArtFrameClick(event) {
    event.stopPropagation();
    const frame = getArtFrame(event.currentTarget.dataset.frameId);
    if (!frame) return;
    selectArtFrame(frame.id);
    const actionButton = event.target.closest('[data-frame-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.frameAction;
    if (action === 'drag') return;
    if (action === 'upload') {
        const upload = document.getElementById('art-image-upload');
        if (upload) upload.click();
    } else if (action === 'generate') {
        openArtPromptDialog(frame, 'generate');
    } else if (action === 'edit') {
        openArtPromptDialog(frame, 'edit');
    } else if (action === 'resize') {
        resizeArtFrame(frame, actionButton.dataset.frameSize);
    } else if (action === 'rotate') {
        rotateArtFrame(frame);
    } else if (action === 'style') {
        cycleArtFrameStyle(frame);
    } else if (action === 'delete') {
        deleteArtFrame(frame);
    } else if (action === 'save') {
        saveSelectedArtwork(frame);
    } else if (action === 'cart') {
        addSelectedArtworkToCart(frame);
    }
}

function resizeArtFrame(frame, nextSize) {
    if (!frame || !ART_SIZE_INFO[nextSize] || frame.size === nextSize) return;
    const previousSize = frame.size;
    const previousX = frame.x;
    const previousY = frame.y;

    frame.size = nextSize;
    renderArtFrame(frame);

    const metrics = getArtFrameMetrics(frame);
    frame.x = Math.max(0, Math.min(frame.x, 100 - metrics.width));
    frame.y = Math.max(0, Math.min(frame.y, 100 - metrics.height));

    if (positionCollides(frame.id, frame.x, frame.y, frame.size, frame.orientation)) {
        frame.size = previousSize;
        frame.x = previousX;
        frame.y = previousY;
        renderArtFrame(frame);
        setArtStudioStatus('لا توجد مساحة كافية لهذا المقاس. حرّك اللوحة ثم جرّب مجددًا.', 'error');
        return;
    }

    frame.element.style.left = frame.x + '%';
    frame.element.style.top = frame.y + '%';
    renderArtFrame(frame);
    setArtStudioStatus('تم تغيير المقاس إلى ' + ART_SIZE_INFO[nextSize].label + '.', 'success');
}

function beginArtFrameDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const frame = getArtFrame(event.currentTarget.dataset.frameId);
    const layer = document.getElementById('art-frames-layer');
    if (!frame || !layer) return;

    selectArtFrame(frame.id);
    const layerRect = layer.getBoundingClientRect();
    const frameRect = frame.element.getBoundingClientRect();
    artDragState = {
        frame: frame,
        layerRect: layerRect,
        offsetX: event.clientX - frameRect.left,
        offsetY: event.clientY - frameRect.top,
        startX: frame.x,
        startY: frame.y,
        collides: false
    };
    if (frame.element.setPointerCapture) frame.element.setPointerCapture(event.pointerId);
    event.preventDefault();
}

function moveArtFrame(event) {
    if (!artDragState) return;
    const state = artDragState;
    const info = getArtFrameMetrics(state.frame);
    const width = Math.max(state.layerRect.width, 1);
    const height = Math.max(state.layerRect.height, 1);
    let x = ((event.clientX - state.layerRect.left - state.offsetX) / width) * 100;
    let y = ((event.clientY - state.layerRect.top - state.offsetY) / height) * 100;
    x = Math.max(0, Math.min(100 - info.width, x));
    y = Math.max(0, Math.min(100 - info.height, y));

    state.frame.x = x;
    state.frame.y = y;
    state.frame.element.style.left = x + '%';
    state.frame.element.style.top = y + '%';
    state.collides = positionCollides(state.frame.id, x, y, state.frame.size);
    state.frame.element.classList.toggle('collision', state.collides);
}

function endArtFrameDrag() {
    if (!artDragState) return;
    const state = artDragState;
    if (state.collides) {
        state.frame.x = state.startX;
        state.frame.y = state.startY;
        state.frame.element.style.left = state.startX + '%';
        state.frame.element.style.top = state.startY + '%';
        setArtStudioStatus('لا يمكن وضع لوحة فوق لوحة أخرى. أعدتها إلى مكانها السابق.', 'error');
    } else {
        setArtStudioStatus('تم تثبيت اللوحة في مكانها الجديد.', 'success');
    }
    state.frame.element.classList.remove('collision');
    artDragState = null;
}

function rotateArtFrame(frame) {
    if (!frame || frame.processing) return;
    const previousOrientation = frame.orientation;
    const previousX = frame.x;
    const previousY = frame.y;
    frame.orientation = frame.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    renderArtFrame(frame);

    requestAnimationFrame(function() {
        const metrics = getArtFrameMetrics(frame);
        frame.x = Math.max(0, Math.min(100 - metrics.width, frame.x));
        frame.y = Math.max(0, Math.min(100 - metrics.height, frame.y));
        frame.element.style.left = frame.x + '%';
        frame.element.style.top = frame.y + '%';
        if (positionCollides(frame.id, frame.x, frame.y, frame.size, frame.orientation)) {
            frame.orientation = previousOrientation;
            frame.x = previousX;
            frame.y = previousY;
            frame.element.style.left = frame.x + '%';
            frame.element.style.top = frame.y + '%';
            renderArtFrame(frame);
            setArtStudioStatus('لا توجد مساحة كافية لتدوير اللوحة هنا. حرّكها قليلًا ثم حاول مجددًا.', 'error');
        } else {
            setArtStudioStatus(frame.orientation === 'vertical' ? 'أصبحت اللوحة عمودية.' : 'أصبحت اللوحة أفقية.', 'success');
        }
    });
}

function cycleArtFrameStyle(frame) {
    if (!frame) return;
    const styles = ['classic', 'thin', 'frameless'];
    const index = styles.indexOf(frame.frameStyle);
    frame.frameStyle = styles[(index + 1) % styles.length];
    renderArtFrame(frame);
    const labels = { classic: 'إطار كلاسيكي حاد', thin: 'حافة رفيعة', frameless: 'بدون حواف' };
    setArtStudioStatus('شكل اللوحة الآن: ' + labels[frame.frameStyle] + '.', 'success');
}

function deleteArtFrame(frame) {
    if (!frame) return;
    frame.element.remove();
    artFrames = artFrames.filter(function(item) { return item.id !== frame.id; });
    if (selectedArtFrameId === frame.id) selectedArtFrameId = null;
    selectArtFrame(null);
    updateEmptyWallHint();
    setArtStudioStatus('حُذفت اللوحة من الحائط.', 'success');
}

function deleteSelectedArtFrame() {
    const selected = getSelectedArtFrame();
    deleteArtFrame(selected);
}

function fileToOptimizedDataURL(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function() {
            const image = new Image();
            image.onerror = reject;
            image.onload = function() {
                const maxSide = 1200;
                const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext('2d');
                if (!context) {
                    resolve(reader.result);
                    return;
                }
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', .84));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function loadImageIntoSelectedFrame(file) {
    const selected = getSelectedArtFrame();
    if (!selected || !file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        setArtStudioStatus('اختر صورة بصيغة PNG أو JPG أو WEBP.', 'error');
        return;
    }
    try {
        selected.imageData = await fileToOptimizedDataURL(file);
        selected.hasGenerated = false;
        selected.saved = false;
        renderArtFrame(selected);
        setArtStudioStatus('ظهرت الصورة داخل اللوحة. اضغط «تحويل» أسفلها عندما تصبح جاهزًا.', 'success');
    } catch (error) {
        setArtStudioStatus('تعذر قراءة الصورة. جرّب ملفًا آخر.', 'error');
    }
}

function setArtFrameProcessing(frame, processing) {
    if (!frame) return;
    frame.processing = processing;
    renderArtFrame(frame);
}

function closeArtDialogs(clearPending) {
    const promptModal = document.getElementById('art-prompt-modal');
    const replaceModal = document.getElementById('art-replace-modal');
    if (promptModal) promptModal.classList.add('hidden');
    if (replaceModal) replaceModal.classList.add('hidden');
    if (clearPending !== false) pendingArtOperation = null;
}

function getArtModelChoices(mode) {
    return MODEL_CATALOG[mode === 'edit' ? 'edit' : 'generate'] || [];
}

function renderArtModelChoices(mode) {
    const list = document.getElementById('art-model-choices');
    const label = document.getElementById('art-model-choice-label');
    if (!list || !pendingArtOperation) return;

    const choices = getArtModelChoices(mode);
    if (!pendingArtOperation.modelChoice && choices.length) pendingArtOperation.modelChoice = choices[0];
    if (label) label.textContent = mode === 'edit' ? 'اختر قوة التعديل' : 'نموذج التوليد';
    list.innerHTML = '';

    choices.forEach(function(choice) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'art-model-choice';
        if (pendingArtOperation.modelChoice && pendingArtOperation.modelChoice.model === choice.model) {
            button.classList.add('selected');
        }
        button.innerHTML = `
            <span class="art-model-choice-icon"><i class="fas ${choice.icon}"></i></span>
            <span class="art-model-choice-copy"><strong>${choice.name}</strong><small>${choice.description}</small></span>
            <span class="model-choice-cost">${choice.cost}</span>`;
        button.addEventListener('click', function() {
            pendingArtOperation.modelChoice = choice;
            list.querySelectorAll('.art-model-choice').forEach(function(card) { card.classList.remove('selected'); });
            button.classList.add('selected');
        });
        list.appendChild(button);
    });
}

function openArtPromptDialog(frame, mode) {
    if (!frame) return;
    if (mode === 'edit' && !frame.imageData) {
        setArtStudioStatus('ارفع صورة داخل اللوحة أولًا.', 'error');
        return;
    }
    selectArtFrame(frame.id);
    pendingArtOperation = {
        frameId: frame.id,
        mode: mode,
        prompt: '',
        modelChoice: getArtModelChoices(mode)[0] || null
    };
    const promptInput = document.getElementById('art-prompt');
    const title = document.getElementById('art-prompt-modal-title');
    if (promptInput) promptInput.value = frame.prompt || '';
    if (title) title.textContent = mode === 'edit' ? 'كيف تريد تحويل هذه الصورة؟' : 'صف اللوحة التي تريد إنشاءها';
    renderArtModelChoices(mode);
    const modal = document.getElementById('art-prompt-modal');
    if (modal) modal.classList.remove('hidden');
    if (promptInput) setTimeout(function() { promptInput.focus(); }, 30);
}

function confirmArtPrompt() {
    if (!pendingArtOperation) return;
    const frame = getArtFrame(pendingArtOperation.frameId);
    const promptInput = document.getElementById('art-prompt');
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!frame) {
        closeArtDialogs();
        return;
    }
    if (!prompt) {
        setArtStudioStatus('اكتب وصفًا واضحًا للشكل الفني المطلوب.', 'error');
        if (promptInput) promptInput.focus();
        return;
    }
    if (!pendingArtOperation.modelChoice) {
        setArtStudioStatus('اختر نموذج الصورة أولًا.', 'error');
        return;
    }
    frame.prompt = prompt;
    pendingArtOperation.prompt = prompt;
    const promptModal = document.getElementById('art-prompt-modal');
    if (promptModal) promptModal.classList.add('hidden');

    if (frame.hasGenerated && frame.imageData) {
        const replaceModal = document.getElementById('art-replace-modal');
        if (replaceModal) replaceModal.classList.remove('hidden');
    } else {
        const operation = pendingArtOperation;
        pendingArtOperation = null;
        runArtAI(operation, frame);
    }
}

function continueArtOperation(replaceOld) {
    if (!pendingArtOperation) return;
    const sourceFrame = getArtFrame(pendingArtOperation.frameId);
    if (!sourceFrame) {
        closeArtDialogs();
        return;
    }
    const operation = pendingArtOperation;
    pendingArtOperation = null;
    closeArtDialogs(false);

    if (replaceOld) {
        runArtAI(operation, sourceFrame);
        return;
    }

    const duplicate = createArtFrame(sourceFrame.size, {
        orientation: sourceFrame.orientation,
        frameStyle: sourceFrame.frameStyle,
        imageData: operation.mode === 'edit' ? sourceFrame.imageData : '',
        hasGenerated: false,
        prompt: operation.prompt,
        preferredNear: sourceFrame
    });
    if (!duplicate) return;
    duplicate.prompt = operation.prompt;
    runArtAI(operation, duplicate);
}

async function runArtAI(operation, targetFrame) {
    const mode = typeof operation === 'string' ? operation : operation.mode;
    const modelChoice = (operation && operation.modelChoice)
        || getArtModelChoices(mode)[0]
        || null;
    const selected = targetFrame || getSelectedArtFrame();
    const prompt = selected ? (selected.prompt || '').trim() : '';
    if (!selected) return;
    if (!currentUser) {
        setArtStudioStatus('سجّل الدخول أولًا لتجربة نموذج OpenAI.', 'error');
        openModal();
        return;
    }

    ui.source.value = SECOND_FUNCTION_ID;
    selected.saved = false;
    setArtFrameProcessing(selected, true);
    setArtStudioStatus(mode === 'edit' ? 'الفرشاة تعمل الآن على تحويل صورتك...' : 'يتم الآن رسم لوحة جديدة من وصفك...');

    const payloadObj = {
        userId: currentUser.$id,
        action: 'legacy_chat',
        mode: mode === 'edit' ? 'edit' : 'generate',
        prompt: prompt,
        provider: 'openai',
        model: modelChoice ? modelChoice.model : 'gpt-image-2',
        imageModel: modelChoice ? modelChoice.model : 'gpt-image-2',
        modelTier: modelChoice ? modelChoice.modelTier : 'pro',
        quality: modelChoice ? modelChoice.quality : 'high',
        clientFeature: 'art_studio'
    };
    if (modelChoice && modelChoice.inputFidelity) payloadObj.inputFidelity = modelChoice.inputFidelity;
    if (mode === 'edit') payloadObj.imageBase64 = selected.imageData;

    const responseData = await executeRequest(payloadObj);
    setArtFrameProcessing(selected, false);
    const imageResult = normalizeImageResult(responseData);
    if (responseData && responseData.success && imageResult) {
        selected.imageData = imageResult;
        selected.hasGenerated = true;
        renderArtFrame(selected);
        const credits = document.getElementById('user-credits');
        if (credits && responseData.remainingTokens !== undefined) credits.textContent = responseData.remainingTokens;
        setArtStudioStatus('اكتملت اللوحة وأصبحت جاهزة للحفظ أو الإضافة إلى السلة.', 'success');
    } else if (responseData) {
        setArtStudioStatus('لم يكتمل التحويل: ' + (responseData.error || 'لم يرجع الخادم صورة.'), 'error');
    } else {
        setArtStudioStatus('تعذر الوصول إلى النموذج. لم يتم تغيير اللوحة.', 'error');
    }
}

function buildArtworkRecord(frame) {
    const info = ART_SIZE_INFO[frame.size];
    return {
        id: 'artwork-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        title: frame.title,
        size: frame.size,
        sizeLabel: info.label,
        orientation: frame.orientation,
        frameStyle: frame.frameStyle,
        price: info.price,
        imageData: frame.imageData,
        prompt: frame.prompt || '',
        createdAt: new Date().toISOString()
    };
}

function saveSelectedArtwork(targetFrame) {
    const selected = targetFrame || getSelectedArtFrame();
    if (!selected || !selected.imageData) {
        setArtStudioStatus('أضف صورة أو أنشئ لوحة قبل الحفظ.', 'error');
        return;
    }
    try {
        const artworks = safeReadLocalList(ARTWORKS_STORAGE_KEY);
        artworks.unshift(buildArtworkRecord(selected));
        safeWriteLocalList(ARTWORKS_STORAGE_KEY, artworks.slice(0, 20));
        selected.saved = true;
        renderArtFrame(selected);
        renderArtworksLibrary();
        setArtStudioStatus('حُفظت اللوحة محليًا في قسم «اللوحات».', 'success');
    } catch (error) {
        setArtStudioStatus('تعذر الحفظ المحلي؛ قد تكون الصورة كبيرة جدًا لمساحة المتصفح.', 'error');
    }
}

function addSelectedArtworkToCart(targetFrame) {
    const selected = targetFrame || getSelectedArtFrame();
    if (!selected || !selected.imageData) {
        setArtStudioStatus('أنشئ اللوحة أولًا قبل إضافتها إلى السلة.', 'error');
        return;
    }
    try {
        const cart = safeReadLocalList(ART_CART_STORAGE_KEY);
        cart.unshift(buildArtworkRecord(selected));
        safeWriteLocalList(ART_CART_STORAGE_KEY, cart.slice(0, 20));
        renderArtCart();
        setArtStudioStatus('أضيفت اللوحة إلى السلة ويمكنك إكمالها لاحقًا.', 'success');
    } catch (error) {
        setArtStudioStatus('تعذر تحديث السلة المحلية.', 'error');
    }
}

function removeStoredArtwork(id) {
    const artworks = safeReadLocalList(ARTWORKS_STORAGE_KEY).filter(function(item) { return item.id !== id; });
    safeWriteLocalList(ARTWORKS_STORAGE_KEY, artworks);
    renderArtworksLibrary();
}

function removeCartArtwork(id) {
    const cart = safeReadLocalList(ART_CART_STORAGE_KEY).filter(function(item) { return item.id !== id; });
    safeWriteLocalList(ART_CART_STORAGE_KEY, cart);
    renderArtCart();
}

function renderArtworksLibrary() {
    const list = document.getElementById('artworks-library-list');
    if (!list) return;
    list.innerHTML = '';
    const artworks = safeReadLocalList(ARTWORKS_STORAGE_KEY);
    if (artworks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-library';
        empty.textContent = 'لا توجد لوحات محفوظة بعد.';
        list.appendChild(empty);
        return;
    }

    artworks.forEach(function(item) {
        const card = document.createElement('article');
        card.className = 'artwork-library-card';
        const image = document.createElement('img');
        image.src = item.imageData;
        image.alt = item.title || 'لوحة محفوظة';
        const meta = document.createElement('div');
        meta.className = 'artwork-card-meta';
        const label = document.createElement('span');
        label.textContent = item.sizeLabel || 'لوحة فنية';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'حذف اللوحة');
        remove.innerHTML = '<i class="far fa-trash-can"></i>';
        remove.addEventListener('click', function() { removeStoredArtwork(item.id); });
        meta.appendChild(label);
        meta.appendChild(remove);
        card.appendChild(image);
        card.appendChild(meta);
        list.appendChild(card);
    });
}

function renderArtCart() {
    const list = document.getElementById('cart-list');
    const total = document.getElementById('cart-total');
    const count = document.getElementById('cart-count');
    const drawerCount = document.getElementById('drawer-cart-count');
    const cart = safeReadLocalList(ART_CART_STORAGE_KEY);
    if (count) count.textContent = cart.length;
    if (drawerCount) drawerCount.textContent = cart.length;
    if (total) total.textContent = cart.reduce(function(sum, item) { return sum + (Number(item.price) || 0); }, 0).toFixed(2) + ' $';
    if (!list) return;
    list.innerHTML = '';

    if (cart.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-library';
        empty.textContent = 'سلة اللوحات فارغة حاليًا.';
        list.appendChild(empty);
        return;
    }

    cart.forEach(function(item) {
        const row = document.createElement('div');
        row.className = 'cart-item';
        const image = document.createElement('img');
        image.src = item.imageData;
        image.alt = item.title || 'لوحة في السلة';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.sizeLabel || 'لوحة فنية';
        const price = document.createElement('span');
        price.textContent = Number(item.price || 0).toFixed(2) + ' $';
        info.appendChild(title);
        info.appendChild(price);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'حذف من السلة');
        remove.innerHTML = '<i class="far fa-trash-can"></i>';
        remove.addEventListener('click', function() { removeCartArtwork(item.id); });
        row.appendChild(image);
        row.appendChild(info);
        row.appendChild(remove);
        list.appendChild(row);
    });
}

function openCreationLibraryTab(tabName) {
    const drawer = document.getElementById('my-library-section');
    if (drawer) drawer.classList.remove('hidden');
    document.querySelectorAll('[data-library-tab]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.libraryTab === tabName);
    });
    document.querySelectorAll('[data-library-panel]').forEach(function(panel) {
        panel.classList.toggle('hidden', panel.dataset.libraryPanel !== tabName);
    });
}

function initCreationLibrary() {
    renderArtworksLibrary();
    renderArtCart();

    document.querySelectorAll('[data-library-tab]').forEach(function(button) {
        button.addEventListener('click', function() { openCreationLibraryTab(button.dataset.libraryTab); });
    });

    const headerCart = document.getElementById('cart-header-btn');
    if (headerCart) {
        headerCart.addEventListener('click', function() {
            openWorkspace();
            openCreationLibraryTab('cart');
        });
    }

    const checkout = document.getElementById('checkout-btn');
    if (checkout) {
        checkout.addEventListener('click', function() {
            alert('تم تجهيز السلة في الواجهة. سنربط زر الشراء بالدفع والكود الوظيفي في المرحلة التالية.');
        });
    }
}

function initArtStudio() {
    document.querySelectorAll('[data-add-frame]').forEach(function(button) {
        button.addEventListener('click', function() { createArtFrame(button.dataset.addFrame); });
    });
    document.addEventListener('pointermove', moveArtFrame);
    document.addEventListener('pointerup', endArtFrameDrag);
    document.addEventListener('pointercancel', endArtFrameDrag);

    const stage = document.getElementById('art-wall-stage');
    if (stage) stage.addEventListener('click', function() { selectArtFrame(null); });

    const upload = document.getElementById('art-image-upload');
    if (upload) {
        upload.addEventListener('change', function() {
            if (upload.files && upload.files[0]) loadImageIntoSelectedFrame(upload.files[0]);
            upload.value = '';
        });
    }

    const promptInput = document.getElementById('art-prompt');
    document.querySelectorAll('[data-art-prompt]').forEach(function(button) {
        button.addEventListener('click', function() {
            if (!promptInput) return;
            promptInput.value = button.dataset.artPrompt;
        });
    });

    const confirmPrompt = document.getElementById('art-prompt-confirm-btn');
    const replaceOld = document.getElementById('replace-old-art-btn');
    const duplicate = document.getElementById('duplicate-art-btn');
    if (confirmPrompt) confirmPrompt.addEventListener('click', confirmArtPrompt);
    if (replaceOld) replaceOld.addEventListener('click', function() { continueArtOperation(true); });
    if (duplicate) duplicate.addEventListener('click', function() { continueArtOperation(false); });
    document.querySelectorAll('[data-close-art-dialog]').forEach(function(button) {
        button.addEventListener('click', function() { closeArtDialogs(); });
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeArtDialogs();
    });

    // يبدأ الحائط فارغًا؛ زر «إضافة لوحة» ينشئ لوحة متوسطة يمكن تغيير مقاسها من أزرار S / M / L.
    updateEmptyWallHint();
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

    const artStudio = document.getElementById('art-studio');
    if (artStudio) {
        artStudio.classList.toggle('hidden', currentAction !== 'art_studio');
    }

    if (currentAction === 'book_outline') {
        ui.provider.innerHTML = '<option value="gemini">Gemini 3.5 Flash (Free)</option><option value="openai">OpenAI</option><option value="cloudflare">Cloudflare</option>';
    } else if (currentAction === 'art_studio') {
        ui.provider.innerHTML = '<option value="openai">OpenAI (أقوى تعديل وتوليد)</option>';
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
    const targetFunctionId = isImageRequest ? SECOND_FUNCTION_ID : ui.source.value;
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