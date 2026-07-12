
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
// متغيرات ودوال نظام صفحات الكتاب والتعديلات الجديدة
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
    activeModelLabel: document.getElementById('active-model-label')
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
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' ? '<i class="far fa-user"></i>' : '<i class="fas fa-sparkles"></i>';

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
        <div class="message-avatar"><i class="fas fa-sparkles"></i></div>
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
        book_outline: { kicker: 'BOOK BUILDER', title: 'إنشاء كتاب طويل', placeholder: 'ملاحظات إضافية عن الكتاب (اختياري)...' }
    };
    const data = workspaceData[action] || workspaceData.text;
    if (ui.workspaceKicker) ui.workspaceKicker.textContent = data.kicker;
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = data.title;
    if (ui.prompt) ui.prompt.placeholder = data.placeholder;

    if (ui.activeModelLabel && ui.source && ui.provider && ui.model) {
        const sourceShort = ui.source.value === '6a3c7a760032067bd275' ? 'الكود الأول' : 'الكود الثاني';
        const providerShort = ui.provider.options[ui.provider.selectedIndex] ? ui.provider.options[ui.provider.selectedIndex].text : '';
        const modelShort = ui.model.options[ui.model.selectedIndex] ? ui.model.options[ui.model.selectedIndex].text : '';
        ui.activeModelLabel.textContent = `${sourceShort} • ${providerShort} • ${modelShort}`;
    }
}

window.selectAITool = function(action) {
    openWorkspace();
    if (!ui.action || !ui.source) return;

    // تأليف الكتاب يحتاج إلى الكود الثاني كما كان في المشروع الأصلي.
    // المحادثة والصور تبدأ اقتصاديًا من الكود الأول، ويمكن تغيير المصدر من الإعدادات.
    ui.source.value = action === 'book_outline' ? '6a445f680013960a14c6' : '6a3c7a760032067bd275';
    ui.action.value = action;
    updateUI();
    if (action === 'text' && ui.prompt) ui.prompt.focus();
};

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
    syncWorkspaceFromSelections();
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
    syncWorkspaceFromSelections();
}

if (ui.source) ui.source.addEventListener('change', updateUI);
if (ui.action) ui.action.addEventListener('change', updateUI);
if (ui.provider) ui.provider.addEventListener('change', updateModels);
if (ui.model) ui.model.addEventListener('change', syncWorkspaceFromSelections);

window.addEventListener('DOMContentLoaded', function() {
    updateUI();

    document.querySelectorAll('[data-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.tool); });
    });
    document.querySelectorAll('[data-welcome-tool]').forEach(function(button) {
        button.addEventListener('click', function() { window.selectAITool(button.dataset.welcomeTool); });
    });

    if (ui.settingsToggle) {
        ui.settingsToggle.addEventListener('click', function() {
            ui.advancedSettings.classList.toggle('hidden');
        });
    }

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
});

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

if (ui.sendBtn) {
    ui.sendBtn.addEventListener('click', async function() {
        const actionType = ui.action.value;
        const promptSnapshot = ui.prompt.value.trim();
        
        if (!promptSnapshot && actionType !== 'book_outline') { 
            alert("يرجى إدخال نص الطلب!"); 
            return; 
        }

        // لا نفرغ الرسالة من الواجهة قبل تسجيل الدخول، حتى لا يضطر المستخدم لكتابتها من جديد.
        if (!currentUser) {
            alert("يرجى تسجيل الدخول أولاً.");
            openModal();
            return;
        }

        let payloadObj = {
            userId: currentUser ? currentUser.$id : null,
            prompt: promptSnapshot,
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

        let typingIndicator = null;
        if (actionType !== 'book_outline') {
            openWorkspace();
            appendChatMessage('user', promptSnapshot, '', 'text');
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
            } else if (responseData.resultType === 'image') {
                appendChatMessage('assistant', responseData.data, getSourceMetadata(responseData), 'image');
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
        
        const librarySection = document.getElementById('my-library-section');
        if(librarySection) librarySection.classList.remove('hidden');
        
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