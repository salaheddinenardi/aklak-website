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
        art_studio: { kicker: 'AKLAKE ART ROOM', title: 'استوديو اللوحات الفنية', placeholder: 'صف اللوحة التي تريد إنشاءها...' },
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

    const mainInputs = document.getElementById('main-inputs-wrapper');
    const libraryDrawer = document.getElementById('my-library-section');
    if (mainInputs) mainInputs.classList.remove('hidden');
    if (libraryDrawer) libraryDrawer.classList.add('hidden');

    // تأليف الكتاب يحتاج إلى الكود الثاني كما كان في المشروع الأصلي.
    // المحادثة والصور تبدأ اقتصاديًا من الكود الأول، ويمكن تغيير المصدر من الإعدادات.
    ui.source.value = action === 'book_outline' ? '6a445f680013960a14c6' : '6a3c7a760032067bd275';
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
// الخلفية التفاعلية مع حركة الماوس والتمرير
// ==========================================
function initBackgroundParallax() {
    let pointerX = 0;
    let pointerY = 0;
    let scrollY = 0;
    let scheduled = false;

    function paintBackgroundPosition() {
        scheduled = false;
        document.body.style.setProperty('--parallax-x', pointerX.toFixed(1) + 'px');
        document.body.style.setProperty('--parallax-y', (pointerY + scrollY).toFixed(1) + 'px');
    }

    function schedulePaint() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(paintBackgroundPosition);
    }

    window.addEventListener('pointermove', function(event) {
        pointerX = ((event.clientX / Math.max(window.innerWidth, 1)) - 0.5) * 22;
        pointerY = ((event.clientY / Math.max(window.innerHeight, 1)) - 0.5) * 14;
        schedulePaint();
    }, { passive: true });

    window.addEventListener('scroll', function() {
        scrollY = Math.max(-55, Math.min(55, window.scrollY * -0.045));
        schedulePaint();
    }, { passive: true });
}

// ==========================================
// استوديو اللوحات — Front-end + نفس مسار الصور القديم
// ==========================================
const ARTWORKS_STORAGE_KEY = 'aklake_artworks_v1';
const ART_CART_STORAGE_KEY = 'aklake_art_cart_v1';
const ART_SIZE_INFO = {
    large: { label: 'لوحة كبيرة', width: 29, height: 40, price: 79 },
    medium: { label: 'لوحة متوسطة', width: 23, height: 32, price: 59 },
    small: { label: 'لوحة صغيرة', width: 17, height: 24, price: 39 }
};

let artFrames = [];
let selectedArtFrameId = null;
let artFrameCounter = 0;
let artDragState = null;

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
    const space = typeof gap === 'number' ? gap : 2;
    return !(
        a.x + a.width + space <= b.x ||
        b.x + b.width + space <= a.x ||
        a.y + a.height + space <= b.y ||
        b.y + b.height + space <= a.y
    );
}

function positionCollides(frameId, x, y, size) {
    const info = ART_SIZE_INFO[size];
    const candidate = { x: x, y: y, width: info.width, height: info.height };
    return artFrames.some(function(other) {
        if (other.id === frameId) return false;
        const otherInfo = ART_SIZE_INFO[other.size];
        return artRectsOverlap(candidate, {
            x: other.x,
            y: other.y,
            width: otherInfo.width,
            height: otherInfo.height
        }, 2);
    });
}

function findAvailableArtPosition(size) {
    const info = ART_SIZE_INFO[size];
    const candidates = [
        [5, 8], [38, 8], [70, 8],
        [8, 52], [40, 52], [72, 52],
        [23, 28], [55, 30]
    ];

    for (let i = 0; i < candidates.length; i++) {
        const x = Math.min(candidates[i][0], 100 - info.width);
        const y = Math.min(candidates[i][1], 100 - info.height);
        if (!positionCollides('', x, y, size)) return { x: x, y: y };
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
    const canvas = frame.element.querySelector('.art-frame-canvas');
    canvas.innerHTML = '';

    if (frame.imageData) {
        const image = document.createElement('img');
        image.src = frame.imageData;
        image.alt = frame.title;
        canvas.appendChild(image);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'art-frame-placeholder';
        placeholder.innerHTML = '<i class="far fa-image"></i><span>ارفع صورة</span>';
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

function createArtFrame(size) {
    const layer = document.getElementById('art-frames-layer');
    if (!layer || !ART_SIZE_INFO[size]) return null;

    const position = findAvailableArtPosition(size);
    if (!position) {
        setArtStudioStatus('لا توجد مساحة كافية للوحة جديدة. حرّك اللوحات الحالية أو احذف واحدة.', 'error');
        return null;
    }

    artFrameCounter += 1;
    const frame = {
        id: 'art-frame-' + Date.now() + '-' + artFrameCounter,
        title: 'اللوحة ' + artFrameCounter,
        size: size,
        x: position.x,
        y: position.y,
        imageData: '',
        prompt: '',
        element: document.createElement('div')
    };

    frame.element.className = 'art-frame ' + size;
    frame.element.dataset.frameId = frame.id;
    frame.element.style.left = frame.x + '%';
    frame.element.style.top = frame.y + '%';
    frame.element.innerHTML = '<div class="art-frame-canvas"></div>';
    frame.element.addEventListener('pointerdown', beginArtFrameDrag);
    frame.element.addEventListener('click', function(event) {
        event.stopPropagation();
        selectArtFrame(frame.id);
    });

    artFrames.push(frame);
    layer.appendChild(frame.element);
    renderArtFrame(frame);
    selectArtFrame(frame.id);
    updateEmptyWallHint();
    setArtStudioStatus('أضيفت ' + ART_SIZE_INFO[size].label + '. اسحبها لاختيار مكانها.', 'success');
    return frame;
}

function selectArtFrame(frameId) {
    selectedArtFrameId = frameId;
    artFrames.forEach(function(frame) {
        frame.element.classList.toggle('selected', frame.id === frameId);
    });

    const selected = getSelectedArtFrame();
    const empty = document.getElementById('art-editor-empty');
    const active = document.getElementById('art-editor-active');
    if (!empty || !active) return;

    empty.classList.toggle('hidden', Boolean(selected));
    active.classList.toggle('hidden', !selected);
    if (selected) {
        const title = document.getElementById('selected-art-title');
        const prompt = document.getElementById('art-prompt');
        if (title) title.textContent = selected.title + ' • ' + ART_SIZE_INFO[selected.size].label;
        if (prompt) prompt.value = selected.prompt || '';
    }
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
    const info = ART_SIZE_INFO[state.frame.size];
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

function deleteSelectedArtFrame() {
    const selected = getSelectedArtFrame();
    if (!selected) return;
    selected.element.remove();
    artFrames = artFrames.filter(function(frame) { return frame.id !== selected.id; });
    selectedArtFrameId = null;
    selectArtFrame(null);
    updateEmptyWallHint();
    setArtStudioStatus('حُذفت اللوحة من الحائط.', 'success');
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
        renderArtFrame(selected);
        setArtStudioStatus('ظهرت الصورة داخل اللوحة. اكتب الآن أسلوب التحويل المطلوب.', 'success');
    } catch (error) {
        setArtStudioStatus('تعذر قراءة الصورة. جرّب ملفًا آخر.', 'error');
    }
}

function setSelectedFrameProcessing(processing) {
    const selected = getSelectedArtFrame();
    if (!selected) return;
    selected.element.classList.toggle('processing', processing);
    ['art-transform-btn', 'art-generate-btn'].forEach(function(id) {
        const button = document.getElementById(id);
        if (button) button.disabled = processing;
    });
}

async function runArtAI(mode) {
    const selected = getSelectedArtFrame();
    const promptInput = document.getElementById('art-prompt');
    const prompt = promptInput ? promptInput.value.trim() : '';
    if (!selected) {
        setArtStudioStatus('أضف لوحة وحددها أولًا.', 'error');
        return;
    }
    if (!prompt) {
        setArtStudioStatus('اكتب وصفًا واضحًا للشكل الفني المطلوب.', 'error');
        if (promptInput) promptInput.focus();
        return;
    }
    if (mode === 'edit' && !selected.imageData) {
        setArtStudioStatus('ارفع صورة داخل اللوحة قبل طلب تحويلها.', 'error');
        return;
    }
    if (!currentUser) {
        setArtStudioStatus('سجّل الدخول أولًا لتجربة نموذج OpenAI.', 'error');
        openModal();
        return;
    }

    selected.prompt = prompt;
    ui.source.value = '6a3c7a760032067bd275';
    setSelectedFrameProcessing(true);
    setArtStudioStatus(mode === 'edit' ? 'الفرشاة تعمل الآن على تحويل صورتك...' : 'يتم الآن رسم لوحة جديدة من وصفك...');

    const payloadObj = {
        userId: currentUser.$id,
        action: 'legacy_chat',
        mode: mode === 'edit' ? 'edit' : 'generate',
        prompt: prompt,
        provider: 'openai',
        modelTier: 'pro'
    };
    if (mode === 'edit') payloadObj.imageBase64 = selected.imageData;

    const responseData = await executeRequest(payloadObj);
    setSelectedFrameProcessing(false);
    if (responseData && responseData.success && responseData.resultType === 'image' && responseData.data) {
        selected.imageData = responseData.data;
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
        price: info.price,
        imageData: frame.imageData,
        prompt: frame.prompt || '',
        createdAt: new Date().toISOString()
    };
}

function saveSelectedArtwork() {
    const selected = getSelectedArtFrame();
    if (!selected || !selected.imageData) {
        setArtStudioStatus('أضف صورة أو أنشئ لوحة قبل الحفظ.', 'error');
        return;
    }
    try {
        const artworks = safeReadLocalList(ARTWORKS_STORAGE_KEY);
        artworks.unshift(buildArtworkRecord(selected));
        safeWriteLocalList(ARTWORKS_STORAGE_KEY, artworks.slice(0, 20));
        renderArtworksLibrary();
        setArtStudioStatus('حُفظت اللوحة محليًا في قسم «اللوحات».', 'success');
    } catch (error) {
        setArtStudioStatus('تعذر الحفظ المحلي؛ قد تكون الصورة كبيرة جدًا لمساحة المتصفح.', 'error');
    }
}

function addSelectedArtworkToCart() {
    const selected = getSelectedArtFrame();
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
    if (promptInput) {
        promptInput.addEventListener('input', function() {
            const selected = getSelectedArtFrame();
            if (selected) selected.prompt = promptInput.value;
        });
    }
    document.querySelectorAll('[data-art-prompt]').forEach(function(button) {
        button.addEventListener('click', function() {
            if (!promptInput) return;
            promptInput.value = button.dataset.artPrompt;
            const selected = getSelectedArtFrame();
            if (selected) selected.prompt = promptInput.value;
        });
    });

    const transform = document.getElementById('art-transform-btn');
    const generate = document.getElementById('art-generate-btn');
    const save = document.getElementById('save-artwork-btn');
    const cart = document.getElementById('add-art-to-cart-btn');
    const remove = document.getElementById('delete-art-frame-btn');
    if (transform) transform.addEventListener('click', function() { runArtAI('edit'); });
    if (generate) generate.addEventListener('click', function() { runArtAI('generate'); });
    if (save) save.addEventListener('click', saveSelectedArtwork);
    if (cart) cart.addEventListener('click', addSelectedArtworkToCart);
    if (remove) remove.addEventListener('click', deleteSelectedArtFrame);

    // بداية بسيطة تجعل المستخدم يفهم الأداة مباشرة، ويمكن حذفها لاحقًا إن رغبت.
    createArtFrame('medium');
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
    if (action === 'art_studio') {
        ui.model.innerHTML = '<option value="pro">OpenAI Pro (أعلى جودة)</option>';
    } else if (action === 'text' || action === 'book_outline') {
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
    initBackgroundParallax();
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