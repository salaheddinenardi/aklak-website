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

function getActiveConversationKey() {
    return ui.action && ui.action.value === 'book_outline' ? 'book' : 'chat';
}

function syncConversationThreads() {
    const activeConversation = getActiveConversationKey();
    document.querySelectorAll('#chat-messages .message-row[data-conversation]').forEach(function(row) {
        const belongsToActiveThread = row.dataset.conversation === activeConversation;
        const stageIsVisible = row.dataset.stageVisible !== 'false';
        row.classList.toggle('hidden', !belongsToActiveThread || !stageIsVisible);
    });
}
window.syncConversationThreads = syncConversationThreads;

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
    row.dataset.conversation = getActiveConversationKey();

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
    row.dataset.conversation = getActiveConversationKey();
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

// app.js defines SECOND_FUNCTION_ID after this file is loaded. Keep the initial
// value independent so workspace.js can finish loading before app.js is parsed.
let modelChooserState = {
    action: 'text',
    sendAfterChoice: false,
    selected: null,
    source: '6a5a7785002b4083d361',
    continuation: null,
    context: null
};
let skipModelGateOnce = false;
const oneShotModelChoices = {};
const activeComposerChoices = {};
const activeComposerSources = {};

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
    return ['text', 'generate', 'edit', 'book_outline'].includes(action) ? action : null;
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

function isFirstFunctionAllowed(action) {
    return ['text', 'generate', 'edit'].includes(action);
}

function normalizeFunctionSource(action, source) {
    return isFirstFunctionAllowed(action) && source === FIRST_FUNCTION_ID
        ? FIRST_FUNCTION_ID
        : SECOND_FUNCTION_ID;
}

function getAvailableModelChoices(action, source) {
    const normalizedSource = normalizeFunctionSource(action, source);
    const choices = MODEL_CATALOG[action] || [];
    if (normalizedSource !== FIRST_FUNCTION_ID) return choices;

    // الكود الوظيفي الأول مخصص للاختبارات الاقتصادية فقط.
    if (action === 'text') {
        return choices.filter(function(choice) {
            return choice.provider === 'cloudflare' || ['gpt-4o-mini', 'gpt-4.1-mini'].includes(choice.model);
        });
    }
    if (action === 'generate') {
        return choices.filter(function(choice) { return choice.provider === 'cloudflare'; });
    }
    return choices;
}

function normalizeChoiceForSource(action, choice, source) {
    const available = getAvailableModelChoices(action, source);
    if (choice && available.some(function(item) {
        return item.provider === choice.provider && item.model === choice.model;
    })) return choice;
    return available[0] || null;
}

function applyModelChoice(action, choice, source) {
    if (!choice || !getComposerModeKey(action)) return;
    activeComposerSources[action] = normalizeFunctionSource(action, source);
    choice = normalizeChoiceForSource(action, choice, activeComposerSources[action]);
    if (!choice) return;
    activeComposerChoices[action] = choice;
    ui.source.value = activeComposerSources[action];
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
        const source = activeComposerSources[action] || normalizeFunctionSource(action, remembered?.source);
        const sourceLabel = source === FIRST_FUNCTION_ID ? 'الكود 1' : 'الكود 2';
        ui.activeModelLabel.innerHTML = '<span class="active-model-name">' + choice.name + '</span> <span class="token-cost">• ' + choice.cost + ' • ' + sourceLabel + '</span>';
    } else {
        ui.activeModelLabel.textContent = 'اختيار النموذج';
    }
}

function renderFunctionSourceSelector(action) {
    const container = document.getElementById('function-source-selector');
    if (!container) return;
    const allowed = isFirstFunctionAllowed(action);
    container.classList.toggle('hidden', !allowed);
    modelChooserState.source = normalizeFunctionSource(action, modelChooserState.source);
    container.querySelectorAll('[data-function-source]').forEach(function(button) {
        const selected = button.dataset.functionSource === modelChooserState.source;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.onclick = function() {
            modelChooserState.source = normalizeFunctionSource(action, button.dataset.functionSource);
            modelChooserState.selected = normalizeChoiceForSource(action, modelChooserState.selected, modelChooserState.source);
            renderFunctionSourceSelector(action);
            renderModelChoices(action);
        };
    });
}

function renderModelChoices(action) {
    if (!ui.modelChoicesList) return;
    ui.modelChoicesList.innerHTML = '';
    const remembered = readRememberedModels()[action];
    const current = modelChooserState.selected
        || activeComposerChoices[action]
        || (remembered ? findCatalogChoice(action, remembered.provider, remembered.model) : null);

    getAvailableModelChoices(action, modelChooserState.source).forEach(function(choice) {
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

function openModelChooser(action, sendAfterChoice, continuation, context) {
    const mode = getComposerModeKey(action) || 'text';
    const remembered = readRememberedModels()[mode];
    const currentSource = activeComposerSources[mode] || remembered?.source || ui.source?.value || SECOND_FUNCTION_ID;
    modelChooserState = {
        action: mode,
        sendAfterChoice: Boolean(sendAfterChoice),
        selected: null,
        source: normalizeFunctionSource(mode, currentSource),
        continuation: typeof continuation === 'function' ? continuation : null,
        context: context || null
    };
    const titles = {
        text: ['اختر نموذج المحادثة', 'اختر النموذج، ويمكنك اختبار الكود الأول أو استخدام الكود الثاني الأساسي.'],
        generate: ['توليد صورة من الصفر', 'Cloudflare اقتصادي، وOpenAI للجودة الأعلى. يمكنك اختيار مسار التنفيذ.'],
        edit: ['اختر قوة تعديل الصورة', 'تعديل الصور داخل المحادثة يقبل اختبار الكود الأول أو استخدام الكود الثاني.'],
        book_outline: ['اختر نموذج تأليف الكتاب', 'أداة الكتب تستخدم الكود الوظيفي الثاني فقط للحفاظ على مراحل التأليف والسياق.']
    };
    if (ui.modelChooserTitle) ui.modelChooserTitle.textContent = context?.title || titles[mode][0];
    if (ui.modelChooserDescription) ui.modelChooserDescription.textContent = context?.description || titles[mode][1];
    if (ui.rememberModelToggle) ui.rememberModelToggle.checked = Boolean(remembered);
    const rememberIcon = document.querySelector('.remember-toggle-icon');
    if (rememberIcon) {
        rememberIcon.classList.toggle('fa-toggle-on', Boolean(remembered));
        rememberIcon.classList.toggle('fa-toggle-off', !remembered);
    }
    if (ui.confirmModelBtn) ui.confirmModelBtn.innerHTML = sendAfterChoice
        ? '<i class="fas fa-check"></i> متابعة وإرسال'
        : '<i class="fas fa-check"></i> اعتماد الاختيار';
    renderFunctionSourceSelector(mode);
    renderModelChoices(mode);
    if (ui.modelPopover) ui.modelPopover.classList.remove('hidden');
}

function closeModelChooser() {
    if (ui.modelPopover) ui.modelPopover.classList.add('hidden');
    modelChooserState = {
        action: 'text',
        sendAfterChoice: false,
        selected: null,
        source: SECOND_FUNCTION_ID,
        continuation: null,
        context: null
    };
}

function confirmModelChoice() {
    const choice = modelChooserState.selected;
    if (!choice) return;
    const action = modelChooserState.action;
    const sendAfterChoice = modelChooserState.sendAfterChoice;
    const continuation = modelChooserState.continuation;
    const source = normalizeFunctionSource(action, modelChooserState.source);
    applyModelChoice(action, choice, source);

    const rememberedModels = readRememberedModels();
    if (ui.rememberModelToggle && ui.rememberModelToggle.checked) {
        rememberedModels[action] = { provider: choice.provider, model: choice.model, source };
        writeRememberedModels(rememberedModels);
    } else {
        delete rememberedModels[action];
        writeRememberedModels(rememberedModels);
        if (!sendAfterChoice && !continuation) oneShotModelChoices[action] = { choice, source };
    }
    closeModelChooser();
    refreshComposerModelLabel();

    if (sendAfterChoice) {
        skipModelGateOnce = true;
        ui.sendBtn.click();
    } else if (continuation) {
        Promise.resolve().then(continuation).catch(function(error) {
            console.error('تعذر تنفيذ خطوة الكتاب بعد اختيار النموذج:', error);
            alert('تعذر بدء العملية المختارة. حاول مرة أخرى.');
        });
    }
}

function prepareModelForSend(action) {
    if (!getComposerModeKey(action)) return true;
    const remembered = readRememberedModels()[action];
    if (remembered) {
        const choice = findCatalogChoice(action, remembered.provider, remembered.model);
        if (choice) {
            applyModelChoice(action, choice, remembered.source);
            return true;
        }
    }
    if (oneShotModelChoices[action]) {
        applyModelChoice(action, oneShotModelChoices[action].choice, oneShotModelChoices[action].source);
        delete oneShotModelChoices[action];
        return true;
    }
    openModelChooser(action, true);
    return false;
}

function runBookStepWithModel(stepLabel, continuation) {
    if (typeof continuation !== 'function') return false;
    const action = 'book_outline';
    const remembered = readRememberedModels()[action];
    if (remembered) {
        const choice = findCatalogChoice(action, remembered.provider, remembered.model);
        if (choice) {
            applyModelChoice(action, choice, remembered.source);
            Promise.resolve().then(continuation);
            return true;
        }
    }
    if (oneShotModelChoices[action]) {
        const pending = oneShotModelChoices[action];
        delete oneShotModelChoices[action];
        applyModelChoice(action, pending.choice, pending.source);
        Promise.resolve().then(continuation);
        return true;
    }
    openModelChooser(action, false, continuation, {
        title: 'اختر نموذج ' + stepLabel,
        description: 'اختر النموذج لهذه الخطوة. إذا فعّلت «تذكّر اختياري» فسيُستخدم تلقائيًا في بقية مراحل الكتاب.'
    });
    return false;
}
window.runBookStepWithModel = runBookStepWithModel;

function syncComposerModeUI() {
    if (!ui.action) return;
    const action = ui.action.value;
    const isImageMode = action === 'generate' || action === 'edit';
    if (ui.modeBanner) ui.modeBanner.classList.toggle('hidden', !isImageMode);
    if (ui.imageModeBtn) ui.imageModeBtn.classList.toggle('active', action === 'generate');
    if (ui.attachBtn) ui.attachBtn.classList.toggle('active', action === 'edit' || (action === 'book_outline' && Boolean(bookReferenceAttachment)));
    if (ui.modeTitle) ui.modeTitle.textContent = action === 'edit' ? 'وضع تعديل الصورة' : 'وضع توليد الصور';
    if (ui.modeDescription) ui.modeDescription.textContent = action === 'edit'
        ? 'اكتب التعديل المطلوب على الصورة المرفقة'
        : 'اكتب وصف الصورة التي تريد إنشاءها';
    refreshComposerModelLabel();
}

function setUnifiedComposerMode(action) {
    const target = getComposerModeKey(action) || 'text';
    ui.source.value = normalizeFunctionSource(target, ui.source.value);
    ui.action.value = target;
    updateUI();
    syncComposerModeUI();
    if (ui.prompt) ui.prompt.focus();
}

function clearComposerAttachment(returnToChat) {
    if (ui.imageFile) ui.imageFile.value = '';
    if (ui.attachmentImage) ui.attachmentImage.src = '';
    if (ui.attachmentImage) ui.attachmentImage.classList.remove('hidden');
    if (ui.attachmentFileIcon) ui.attachmentFileIcon.classList.add('hidden');
    if (ui.attachmentTitle) ui.attachmentTitle.textContent = 'صورة مرفقة للتعديل';
    if (ui.attachmentPreview) ui.attachmentPreview.classList.add('hidden');
    if (returnToChat && ui.action.value === 'edit') setUnifiedComposerMode('text');
}

function showComposerAttachment(file) {
    if (!file) return;
    clearBookReferenceAttachment();
    const reader = new FileReader();
    reader.onload = function() {
        if (ui.attachmentImage) ui.attachmentImage.src = reader.result;
        if (ui.attachmentImage) ui.attachmentImage.classList.remove('hidden');
        if (ui.attachmentFileIcon) ui.attachmentFileIcon.classList.add('hidden');
        if (ui.attachmentTitle) ui.attachmentTitle.textContent = 'صورة مرفقة للتعديل';
        if (ui.attachmentName) ui.attachmentName.textContent = file.name;
        if (ui.attachmentPreview) ui.attachmentPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    setUnifiedComposerMode('edit');
}

const BOOK_REFERENCE_MAX_BYTES = 4 * 1024 * 1024;
const BOOK_REFERENCE_MAX_CHARACTERS = 60000;
const BOOK_REFERENCE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml', 'rtf']);
let bookReferenceAttachment = null;

function clearBookReferenceAttachment() {
    bookReferenceAttachment = null;
    if (ui.bookReferenceFile) ui.bookReferenceFile.value = '';
    if (ui.action && ui.action.value === 'book_outline') {
        if (ui.attachmentPreview) ui.attachmentPreview.classList.add('hidden');
        if (ui.attachmentName) ui.attachmentName.textContent = '';
        if (ui.attachBtn) ui.attachBtn.classList.remove('active');
    }
}
window.clearBookReferenceAttachment = clearBookReferenceAttachment;

function getBookReferenceAttachment() {
    return bookReferenceAttachment;
}
window.getBookReferenceAttachment = getBookReferenceAttachment;

async function showBookReferenceAttachment(file) {
    if (!file) return;
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!BOOK_REFERENCE_EXTENSIONS.has(extension)) {
        alert('يمكن إرفاق مستندات نصية مثل TXT وMD وCSV وJSON وHTML وRTF.');
        clearBookReferenceAttachment();
        return;
    }
    if (file.size > BOOK_REFERENCE_MAX_BYTES) {
        alert('حجم المستند أكبر من 4MB. اختر مستندًا أصغر حتى لا يصبح طلب الكتاب ثقيلًا.');
        clearBookReferenceAttachment();
        return;
    }

    if (ui.attachmentImage) ui.attachmentImage.classList.add('hidden');
    if (ui.attachmentFileIcon) ui.attachmentFileIcon.classList.remove('hidden');
    if (ui.attachmentTitle) ui.attachmentTitle.textContent = 'جاري قراءة المستند…';
    if (ui.attachmentName) ui.attachmentName.textContent = file.name;
    if (ui.attachmentPreview) ui.attachmentPreview.classList.remove('hidden');

    try {
        const rawText = (await file.text()).replace(/\u0000/g, '').trim();
        if (!rawText) throw new Error('المستند فارغ أو لا يحتوي على نص قابل للقراءة.');
        const content = rawText.slice(0, BOOK_REFERENCE_MAX_CHARACTERS);
        bookReferenceAttachment = {
            name: file.name,
            type: file.type || 'text/plain',
            content,
            truncated: rawText.length > content.length
        };
        if (ui.attachmentTitle) ui.attachmentTitle.textContent = 'مستند مرجعي للكتاب';
        if (ui.attachmentName) {
            ui.attachmentName.textContent = file.name + (bookReferenceAttachment.truncated ? ' · تم اعتماد أول 60 ألف حرف' : ' · جاهز');
        }
        if (ui.attachBtn) ui.attachBtn.classList.add('active');
    } catch (error) {
        alert(error.message || 'تعذر قراءة المستند.');
        clearBookReferenceAttachment();
    }
}
window.showBookReferenceAttachment = showBookReferenceAttachment;

function syncWorkspaceFromSelections() {
    if (!ui.action) return;
    const action = ui.action.value;
    if (ui.appShell) ui.appShell.dataset.action = action;
    syncConversationThreads();

    document.querySelectorAll('[data-tool]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.tool === action);
    });

    const workspaceData = {
        text: { kicker: 'AKLAKE CHAT', title: 'محادثة جديدة', placeholder: 'اكتب رسالتك هنا...' },
        generate: { kicker: 'IMAGE STUDIO', title: 'إنشاء صورة', placeholder: 'صف الصورة التي تريد إنشاءها...' },
        edit: { kicker: 'IMAGE EDITOR', title: 'تعديل صورة', placeholder: 'اشرح التعديل المطلوب على الصورة...' },
        art_studio: { kicker: 'AKLAKE ART ROOM', title: 'استوديو اللوحات الفنية', placeholder: 'صف اللوحة التي تريد إنشاءها...' },
        book_outline: { kicker: 'BOOK BUILDER', title: 'المؤلف الذكي', placeholder: 'ما شكل الكتاب الذي تريد إنجازه، أيها البشري؟' },
        landing_page: { kicker: 'AKLAKE LANDING LAB', title: 'مولد صفحات الهبوط', placeholder: 'صف صفحة الهبوط التي تريدها...' }
    };
    const data = workspaceData[action] || workspaceData.text;
    if (ui.workspaceKicker) ui.workspaceKicker.textContent = data.kicker;
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = data.title;
    if (ui.prompt) ui.prompt.placeholder = data.placeholder;
    if (ui.attachBtn) {
        const attachLabel = action === 'book_outline' ? 'إرفاق مستند مرجعي للكتاب' : 'إرفاق صورة للتعديل';
        ui.attachBtn.setAttribute('aria-label', attachLabel);
        ui.attachBtn.title = attachLabel;
    }

    const initialMessage = document.getElementById('initial-assistant-message');
    const initialSource = document.getElementById('initial-assistant-source');
    if (initialMessage) initialMessage.textContent = action === 'book_outline'
        ? 'ما شكل الكتاب الذي تريد إنجازه، أيها البشري؟ اكتب وصفًا قصيرًا أو طويلًا، وسأتولى تحويله إلى خطة كتاب.'
        : 'مرحبًا، أخبرني بما تريد إنجازه وسأبدأ معك من هنا.';
    if (initialSource) initialSource.textContent = action === 'book_outline'
        ? 'مؤلف AKLAKE جاهز — عدد الصفحات فقط إلزامي'
        : (ui.source.value === FIRST_FUNCTION_ID
            ? 'جاهز للاختبار عبر الكود الوظيفي الأول'
            : 'جاهز للمحادثة عبر الكود الوظيفي الثاني');

    refreshComposerModelLabel();
    syncComposerModeUI();
}

window.selectAITool = function(action) {
    openWorkspace();
    if (!ui.action || !ui.source) return;

    if (action !== 'edit' && ui.imageFile && ui.imageFile.files && ui.imageFile.files.length > 0) {
        clearComposerAttachment(false);
    }
    if (action !== 'book_outline' && bookReferenceAttachment) clearBookReferenceAttachment();

    const mainInputs = document.getElementById('main-inputs-wrapper');
    const libraryDrawer = document.getElementById('my-library-section');
    if (mainInputs) mainInputs.classList.remove('hidden');
    if (libraryDrawer) libraryDrawer.classList.add('hidden');

    // يبدأ كل وضع بالكود الثاني؛ ويمكن تغيير المسار من إعدادات المحادثة والصور فقط.
    ui.source.value = SECOND_FUNCTION_ID;
    ui.action.value = action;
    updateUI();
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
        if (responseData.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(responseData.remainingTokens);
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

// ==========================================
// مولد صفحات الهبوط — مساحة مستقلة + الكود الوظيفي الثاني
// ==========================================
const LANDING_STORAGE_KEY = 'aklake_landing_projects_v1';
const LANDING_MAX_PROJECTS = 20;
const LANDING_MAX_VERSIONS = 15;
const LANDING_MODEL_POINTS = Object.freeze({
    'gpt-4o-mini': 20,
    'gpt-4.1-mini': 40,
    'gpt-5.5': 60
});
const LANDING_MODEL_NAMES = Object.freeze({
    'gpt-4o-mini': 'GPT-4o mini',
    'gpt-4.1-mini': 'GPT-4.1 mini',
    'gpt-5.5': 'GPT-5.5 القياسي'
});
const LANDING_REFERENCE_MAX_BYTES = 3 * 1024 * 1024;
const LANDING_REFERENCE_TEXT_LIMIT = 60000;

const landingState = {
    projects: [],
    activeProjectId: null,
    currentVersionIndex: -1,
    sourceBookId: '',
    selectedModel: 'gpt-4.1-mini',
    selectedPoints: 40,
    busy: false,
    referenceAttachment: null,
    previewOpen: false
};

const landingUI = {};

function landingElement(id) {
    return document.getElementById(id);
}

function cacheLandingUI() {
    Object.assign(landingUI, {
        studio: landingElement('landing-page-studio'),
        projectsList: landingElement('landing-projects-list'),
        projectsPanel: landingElement('landing-projects-panel'),
        projectsToggle: landingElement('landing-projects-toggle'),
        newProjectBtn: landingElement('landing-new-project-btn'),
        conversation: landingElement('landing-conversation'),
        generationCard: landingElement('landing-generation-card'),
        progressProduct: landingElement('landing-progress-product'),
        progressModel: landingElement('landing-progress-model'),
        completeCard: landingElement('landing-complete-card'),
        completeTitle: landingElement('landing-complete-title'),
        openResultBtn: landingElement('landing-open-result-btn'),
        prompt: landingElement('landing-main-prompt'),
        productName: landingElement('landing-product-name'),
        audience: landingElement('landing-audience'),
        productDetails: landingElement('landing-product-details'),
        phone: landingElement('landing-phone'),
        whatsapp: landingElement('landing-whatsapp'),
        ctaUrl: landingElement('landing-cta-url'),
        language: landingElement('landing-language'),
        modelCards: landingElement('landing-model-cards'),
        modelToggle: landingElement('landing-model-toggle'),
        modelPopover: landingElement('landing-model-popover'),
        closeModelBtn: landingElement('landing-close-model-btn'),
        activeModel: landingElement('landing-active-model'),
        generateBtn: landingElement('landing-generate-btn'),
        generateCost: landingElement('landing-generate-cost'),
        status: landingElement('landing-status'),
        output: landingElement('landing-output-panel'),
        emptyPreview: landingElement('landing-empty-preview'),
        previewShell: landingElement('landing-preview-shell'),
        previewFrame: landingElement('landing-preview-frame'),
        previewView: landingElement('landing-preview-view'),
        codeView: landingElement('landing-code-view'),
        codeEditor: landingElement('landing-code-editor'),
        applyCodeBtn: landingElement('landing-apply-code-btn'),
        copyBtn: landingElement('landing-copy-code-btn'),
        downloadBtn: landingElement('landing-download-btn'),
        closePreviewBtn: landingElement('landing-close-preview-btn'),
        assistantToggle: landingElement('landing-assistant-toggle'),
        assistantPanel: landingElement('landing-assistant-panel'),
        referenceFile: landingElement('landing-reference-file'),
        attachBtn: landingElement('landing-attach-btn'),
        referencePreview: landingElement('landing-reference-preview'),
        referenceIcon: landingElement('landing-reference-icon'),
        referenceTitle: landingElement('landing-reference-title'),
        referenceName: landingElement('landing-reference-name'),
        removeReferenceBtn: landingElement('landing-remove-reference-btn'),
        revisionPanel: landingElement('landing-revision-panel'),
        revisionPrompt: landingElement('landing-revision-prompt'),
        reviseBtn: landingElement('landing-revise-btn'),
        prevVersionBtn: landingElement('landing-prev-version-btn'),
        nextVersionBtn: landingElement('landing-next-version-btn'),
        versionLabel: landingElement('landing-version-label')
    });
}

function setLandingAssistantOpen(open) {
    const expanded = Boolean(open);
    landingUI.assistantPanel?.classList.toggle('hidden', !expanded);
    landingUI.assistantPanel?.setAttribute('aria-hidden', String(!expanded));
    landingUI.assistantToggle?.classList.toggle('is-open', expanded);
    landingUI.assistantToggle?.setAttribute('aria-expanded', String(expanded));
}

function setLandingProjectsOpen(open) {
    const expanded = Boolean(open);
    landingUI.projectsPanel?.classList.toggle('hidden', !expanded);
    landingUI.projectsPanel?.setAttribute('aria-hidden', String(!expanded));
    landingUI.projectsToggle?.setAttribute('aria-expanded', String(expanded));
}

function setLandingModelPopoverOpen(open) {
    const expanded = Boolean(open);
    landingUI.modelPopover?.classList.toggle('hidden', !expanded);
    landingUI.modelPopover?.setAttribute('aria-hidden', String(!expanded));
    landingUI.modelToggle?.setAttribute('aria-expanded', String(expanded));
}

function setLandingPreviewOpen(open) {
    landingState.previewOpen = Boolean(open);
    landingUI.output?.classList.toggle('hidden', !landingState.previewOpen);
    if (landingState.previewOpen) {
        showLandingView('preview');
        requestAnimationFrame(function() {
            landingUI.output?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

function clearLandingDynamicMessages() {
    landingUI.conversation?.querySelectorAll('[data-landing-dynamic="true"]').forEach(function(row) { row.remove(); });
}

function appendLandingUserMessage(message, attachment) {
    if (!landingUI.conversation) return null;
    const row = document.createElement('div');
    row.className = 'message-row user-message landing-user-message';
    row.dataset.landingDynamic = 'true';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="far fa-user"></i>';
    const content = document.createElement('div');
    content.className = 'message-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message;
    content.appendChild(bubble);
    if (attachment) {
        const source = document.createElement('div');
        source.className = 'message-source';
        source.textContent = 'مرفق: ' + attachment.name;
        content.appendChild(source);
    }
    row.append(avatar, content);
    landingUI.conversation.insertBefore(row, landingUI.generationCard || null);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return row;
}

function showLandingGeneration(visible, productName, label) {
    landingUI.generationCard?.classList.toggle('hidden', !visible);
    if (!visible) return;
    landingUI.completeCard?.classList.add('hidden');
    if (landingUI.progressProduct) landingUI.progressProduct.textContent = productName || 'المنتج';
    if (landingUI.progressModel) {
        landingUI.progressModel.textContent = (label || 'إنشاء الصفحة') + ' · ' + (LANDING_MODEL_NAMES[landingState.selectedModel] || landingState.selectedModel);
    }
    landingUI.generationCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showLandingComplete(productName, shouldScroll) {
    showLandingGeneration(false);
    const title = productName || getActiveLandingProject()?.title || 'صفحة الهبوط';
    if (landingUI.completeTitle) landingUI.completeTitle.textContent = title;
    landingUI.completeCard?.classList.remove('hidden');
    if (shouldScroll !== false) landingUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearLandingReference() {
    landingState.referenceAttachment = null;
    if (landingUI.referenceFile) landingUI.referenceFile.value = '';
    landingUI.referencePreview?.classList.add('hidden');
    landingUI.attachBtn?.classList.remove('active');
}

function landingFileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(new Error('تعذر قراءة الملف المرفق.')); };
        reader.readAsDataURL(file);
    });
}

async function setLandingReferenceFile(file) {
    if (!file) return;
    if (file.size > LANDING_REFERENCE_MAX_BYTES) {
        setLandingStatus('حجم الملف المرجعي يجب ألا يتجاوز 3 ميغابايت.', 'error');
        clearLandingReference();
        return;
    }
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const isText = file.type.startsWith('text/') || ['md', 'markdown', 'csv'].includes(extension);
    const isImage = file.type.startsWith('image/');
    try {
        const attachment = {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            kind: isImage ? 'image' : (isText ? 'text' : 'file')
        };
        if (isText) {
            const text = await file.text();
            attachment.text = text.slice(0, LANDING_REFERENCE_TEXT_LIMIT);
            attachment.truncated = text.length > LANDING_REFERENCE_TEXT_LIMIT;
        } else {
            attachment.dataUrl = await landingFileToDataUrl(file);
        }
        landingState.referenceAttachment = attachment;
        landingUI.referencePreview?.classList.remove('hidden');
        landingUI.attachBtn?.classList.add('active');
        if (landingUI.referenceTitle) landingUI.referenceTitle.textContent = isImage ? 'صورة مرجعية' : 'ملف مرجعي';
        if (landingUI.referenceName) landingUI.referenceName.textContent = file.name + (attachment.truncated ? ' · تم اعتماد أول 60 ألف حرف' : '');
        if (landingUI.referenceIcon) landingUI.referenceIcon.innerHTML = isImage ? '<i class="far fa-image"></i>' : '<i class="far fa-file"></i>';
        setLandingStatus('تم إرفاق «' + file.name + '» وسيُرسل مع طلب إنشاء الصفحة.', 'success');
    } catch (error) {
        clearLandingReference();
        setLandingStatus(error.message || 'تعذر قراءة الملف المرفق.', 'error');
    }
}

function createLandingId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function loadLandingProjects() {
    try {
        const stored = JSON.parse(localStorage.getItem(LANDING_STORAGE_KEY) || '[]');
        landingState.projects = Array.isArray(stored) ? stored : [];
    } catch (error) {
        landingState.projects = [];
    }
}

function persistLandingProjects() {
    try {
        const sorted = landingState.projects
            .slice()
            .sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); })
            .slice(0, LANDING_MAX_PROJECTS)
            .map(function(project) {
                return Object.assign({}, project, {
                    versions: (project.versions || []).slice(-LANDING_MAX_VERSIONS)
                });
            });
        landingState.projects = sorted;
        localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(sorted));
    } catch (error) {
        setLandingStatus('تعذر حفظ المشروع محليًا. قد تكون مساحة المتصفح ممتلئة.', 'error');
    }
}

function replaceLandingProject(project) {
    if (!project || !project.id) return null;
    const index = landingState.projects.findIndex(function(item) { return item.id === project.id; });
    if (index >= 0) landingState.projects[index] = project;
    else landingState.projects.unshift(project);
    return project;
}

async function syncLandingProjectsFromServer() {
    if (!currentUser || typeof executeRequest !== 'function') return;
    try {
        const response = await executeRequest({
            action: 'landing_list',
            userId: currentUser.$id
        });
        if (!response || !response.success || !Array.isArray(response.projects)) return;

        const localById = new Map(landingState.projects.map(function(project) { return [project.id, project]; }));
        const serverProjects = response.projects.map(function(summary) {
            const cached = localById.get(summary.id);
            return Object.assign({}, summary, {
                versions: cached && Array.isArray(cached.versions) ? cached.versions : [],
                loadedFromServer: Boolean(cached && cached.loadedFromServer)
            });
        });
        const localOnly = landingState.projects.filter(function(project) {
            return project.id.startsWith('landing-') &&
                !serverProjects.some(function(serverProject) { return serverProject.id === project.id; });
        });
        landingState.projects = serverProjects.concat(localOnly).slice(0, LANDING_MAX_PROJECTS);
        persistLandingProjects();
        renderLandingProjects();
    } catch (error) {
        console.warn('تعذر مزامنة صفحات الهبوط:', error);
    }
}
window.syncLandingProjectsFromServer = syncLandingProjectsFromServer;

async function ensureLandingProjectLoaded(project) {
    if (!project || project.loadedFromServer || project.id.startsWith('landing-')) return project;
    const response = await executeRequest({
        action: 'landing_get',
        userId: currentUser.$id,
        projectId: project.id
    });
    if (!response || !response.success || !response.project) {
        throw new Error(response?.error || 'تعذر تحميل نسخ صفحة الهبوط.');
    }
    const loaded = Object.assign({}, response.project, { loadedFromServer: true });
    replaceLandingProject(loaded);
    persistLandingProjects();
    return loaded;
}

function getActiveLandingProject() {
    return landingState.projects.find(function(project) {
        return project.id === landingState.activeProjectId;
    }) || null;
}

function collectLandingForm() {
    return {
        prompt: landingUI.prompt ? landingUI.prompt.value.trim() : '',
        productName: landingUI.productName ? landingUI.productName.value.trim() : '',
        audience: landingUI.audience ? landingUI.audience.value.trim() : '',
        productDetails: landingUI.productDetails ? landingUI.productDetails.value.trim() : '',
        phone: landingUI.phone ? landingUI.phone.value.trim() : '',
        whatsapp: landingUI.whatsapp ? landingUI.whatsapp.value.trim() : '',
        ctaUrl: landingUI.ctaUrl ? landingUI.ctaUrl.value.trim() : '',
        language: landingUI.language ? landingUI.language.value : 'العربية',
        sourceBookId: landingState.sourceBookId || ''
    };
}

function fillLandingForm(form) {
    const data = form || {};
    if (landingUI.prompt) landingUI.prompt.value = data.prompt || '';
    if (landingUI.productName) landingUI.productName.value = data.productName || '';
    if (landingUI.audience) landingUI.audience.value = data.audience || '';
    if (landingUI.productDetails) landingUI.productDetails.value = data.productDetails || '';
    if (landingUI.phone) landingUI.phone.value = data.phone || '';
    if (landingUI.whatsapp) landingUI.whatsapp.value = data.whatsapp || '';
    if (landingUI.ctaUrl) landingUI.ctaUrl.value = data.ctaUrl || '';
    if (landingUI.language) landingUI.language.value = data.language || 'العربية';
    landingState.sourceBookId = data.sourceBookId || '';
}

function setLandingStatus(message, type) {
    if (!landingUI.status) return;
    landingUI.status.textContent = message || '';
    landingUI.status.className = 'landing-status' + (type ? ' ' + type : '');
}

function setLandingBusy(isBusy, label) {
    landingState.busy = Boolean(isBusy);
    [landingUI.generateBtn, landingUI.reviseBtn, landingUI.applyCodeBtn].forEach(function(button) {
        if (button) button.disabled = landingState.busy;
    });
    if (landingUI.generateBtn) {
        landingUI.generateBtn.classList.toggle('is-loading', landingState.busy);
        landingUI.generateBtn.innerHTML = landingState.busy
            ? '<i class="fas fa-circle-notch fa-spin"></i>'
            : '<i class="fas fa-arrow-up"></i>';
        landingUI.generateBtn.setAttribute('aria-label', landingState.busy ? (label || 'جاري الإنشاء...') : 'إرسال طلب إنشاء صفحة الهبوط');
    }
}

function renderLandingProjects() {
    if (!landingUI.projectsList) return;
    landingUI.projectsList.innerHTML = '';
    if (!landingState.projects.length) {
        landingUI.projectsList.innerHTML = '<div class="landing-projects-empty"><i class="far fa-folder-open"></i><strong>لا توجد صفحات بعد</strong><span>ابدأ مشروعك الأول من خانة المحادثة.</span></div>';
        return;
    }

    landingState.projects.forEach(function(project) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'landing-project-card';
        if (project.id === landingState.activeProjectId) button.classList.add('active');
        const title = project.title || 'صفحة هبوط بدون اسم';
        const versionCount = Number(project.versionCount || (project.versions || []).length);
        const date = new Date(project.updatedAt || Date.now()).toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' });
        button.innerHTML = '<span class="landing-project-thumb"><i class="fas fa-window-maximize"></i></span>' +
            '<span class="landing-project-copy"><strong></strong><small>' + versionCount + ' نسخة • ' + date + '</small></span>' +
            '<span class="landing-project-delete" role="button" tabindex="0" aria-label="حذف المشروع"><i class="far fa-trash-can"></i></span>';
        button.querySelector('strong').textContent = title;
        button.addEventListener('click', function(event) {
            if (event.target.closest('.landing-project-delete')) return;
            openLandingProject(project.id);
        });
        const remove = button.querySelector('.landing-project-delete');
        remove.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            deleteLandingProject(project.id);
        });
        remove.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                deleteLandingProject(project.id);
            }
        });
        landingUI.projectsList.appendChild(button);
    });
}

function startNewLandingProject() {
    landingState.activeProjectId = null;
    landingState.currentVersionIndex = -1;
    landingState.sourceBookId = '';
    landingState.previewOpen = false;
    fillLandingForm({ language: 'العربية' });
    clearLandingReference();
    clearLandingDynamicMessages();
    showLandingGeneration(false);
    landingUI.completeCard?.classList.add('hidden');
    setLandingPreviewOpen(false);
    setLandingAssistantOpen(false);
    setLandingModelPopoverOpen(false);
    setLandingModel('gpt-4.1-mini', 40);
    showLandingVersion(null);
    setLandingStatus('اكتب اسم المنتج ووصف الصفحة، ثم أرسل الطلب.', 'info');
    renderLandingProjects();
    if (landingUI.productName) landingUI.productName.focus();
}

async function openLandingProject(projectId) {
    let project = landingState.projects.find(function(item) { return item.id === projectId; });
    if (!project) return;
    try {
        project = await ensureLandingProjectLoaded(project);
    } catch (error) {
        setLandingStatus(error.message || 'تعذر فتح المشروع.', 'error');
        return;
    }
    landingState.activeProjectId = project.id;
    clearLandingReference();
    clearLandingDynamicMessages();
    showLandingGeneration(false);
    fillLandingForm(project.form || {});
    setLandingModel(project.model || 'gpt-4.1-mini', Number(project.points || 40));
    const versions = project.versions || [];
    landingState.currentVersionIndex = Math.max(0, versions.length - 1);
    showLandingVersion(versions[landingState.currentVersionIndex] || null);
    setLandingPreviewOpen(false);
    setLandingProjectsOpen(false);
    if (versions.length) showLandingComplete(project.title);
    setLandingStatus('تم فتح «' + (project.title || 'صفحة هبوط') + '».', 'success');
    renderLandingProjects();
}

async function deleteLandingProject(projectId) {
    const project = landingState.projects.find(function(item) { return item.id === projectId; });
    if (!project) return;
    const approved = window.confirm('هل تريد حذف «' + (project.title || 'صفحة الهبوط') + '» وكل نسخها؟');
    if (!approved) return;
    if (currentUser && !projectId.startsWith('landing-')) {
        const response = await executeRequest({
            action: 'landing_delete',
            userId: currentUser.$id,
            projectId: projectId
        });
        if (!response || !response.success) {
            setLandingStatus(response?.error || 'تعذر حذف المشروع من قاعدة البيانات.', 'error');
            return;
        }
    }
    landingState.projects = landingState.projects.filter(function(item) { return item.id !== projectId; });
    persistLandingProjects();
    if (landingState.activeProjectId === projectId) startNewLandingProject();
    else renderLandingProjects();
}

function setLandingModel(model, points) {
    landingState.selectedModel = Object.prototype.hasOwnProperty.call(LANDING_MODEL_POINTS, model) ? model : 'gpt-4.1-mini';
    landingState.selectedPoints = LANDING_MODEL_POINTS[landingState.selectedModel];
    if (landingUI.modelCards) {
        landingUI.modelCards.querySelectorAll('[data-landing-model]').forEach(function(card) {
            const selected = card.dataset.landingModel === landingState.selectedModel;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
    }
    if (landingUI.activeModel) landingUI.activeModel.textContent = LANDING_MODEL_NAMES[landingState.selectedModel] || landingState.selectedModel;
    if (landingUI.generateCost) landingUI.generateCost.textContent = landingState.selectedPoints + ' نقطة';
    if (typeof ui !== 'undefined' && ui.action && ui.action.value === 'landing_page') {
        ui.source.value = SECOND_FUNCTION_ID;
        ui.provider.value = 'openai';
        ui.model.value = landingState.selectedModel;
    }
}

function buildLandingGenerationPrompt(form) {
    const reference = landingState.referenceAttachment;
    const referenceLines = reference ? [
        '',
        'REFERENCE ATTACHMENT:',
        'Name: ' + reference.name,
        'Type: ' + reference.mimeType,
        reference.kind === 'image' ? 'Use the attached reference image as visual guidance when the backend makes it available to the model.' : '',
        reference.kind === 'text' && reference.text ? 'Reference text:\n' + reference.text : ''
    ].filter(Boolean) : [];
    return [
        form.prompt,
        '',
        'Product/project name: ' + (form.productName || 'Not provided'),
        'Target audience: ' + (form.audience || 'Not provided'),
        'Product details and offer: ' + (form.productDetails || 'Not provided'),
        'Phone: ' + (form.phone || 'Not provided'),
        'WhatsApp: ' + (form.whatsapp || 'Not provided'),
        'Primary CTA URL: ' + (form.ctaUrl || '#'),
        'Page language: ' + form.language,
        ...referenceLines,
        '',
        'Create a complete, polished, responsive HTML5 landing page. Return one self-contained index.html file with all CSS and JavaScript inline. Use semantic sections, persuasive copy, clear calls to action, accessible contrast, mobile-first responsive design, and professional visual hierarchy. Do not return Markdown, explanations, or code fences; return HTML only.'
    ].join('\n');
}

function buildLandingRevisionPrompt(instruction, currentHtml) {
    return [
        instruction,
        '',
        'CURRENT HTML:',
        currentHtml,
        '',
        'Do not break or remove anything unrelated. Change only what the user requested, preserve the rest of the page, and return the complete updated HTML exactly as one self-contained index.html file. Return HTML only, without Markdown or code fences.'
    ].join('\n');
}

function cleanLandingHtml(value) {
    if (typeof value !== 'string') return '';
    let html = value.trim();
    html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
    const doctypeIndex = html.search(/<!doctype\s+html/i);
    const htmlIndex = html.search(/<html[\s>]/i);
    const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
    if (startIndex > 0) html = html.slice(startIndex);
    return html.trim();
}

function extractLandingHtml(responseData) {
    if (!responseData) return '';
    const candidate = responseData.html || responseData.code || responseData.data || responseData.result || '';
    if (candidate && typeof candidate === 'object') {
        return cleanLandingHtml(candidate.html || candidate.code || candidate.content || '');
    }
    return cleanLandingHtml(candidate);
}

async function requestLandingPage(mode, form, instruction, currentHtml) {
    if (!currentUser) {
        alert('يرجى تسجيل الدخول أولاً. سيبقى ما كتبته محفوظًا في الحقول.');
        openModal();
        return null;
    }
    ui.source.value = SECOND_FUNCTION_ID;
    const finalPrompt = mode === 'revise'
        ? buildLandingRevisionPrompt(instruction, currentHtml)
        : buildLandingGenerationPrompt(form);
    const activeProject = getActiveLandingProject();
    const activeVersion = activeProject && activeProject.versions
        ? activeProject.versions[landingState.currentVersionIndex]
        : null;
    const payload = {
        action: 'landing_page',
        mode: mode,
        userId: currentUser.$id,
        provider: 'openai',
        model: landingState.selectedModel,
        modelTier: landingState.selectedModel,
        estimatedPoints: landingState.selectedPoints,
        prompt: finalPrompt,
        landingPageDetails: form
    };
    if (landingState.referenceAttachment) {
        payload.referenceAttachment = Object.assign({}, landingState.referenceAttachment);
        payload.landingPageDetails = Object.assign({}, form, {
            referenceAttachment: {
                name: landingState.referenceAttachment.name,
                mimeType: landingState.referenceAttachment.mimeType,
                size: landingState.referenceAttachment.size,
                kind: landingState.referenceAttachment.kind
            }
        });
    }
    if (activeProject && !activeProject.id.startsWith('landing-')) payload.projectId = activeProject.id;
    if (activeVersion?.id) payload.baseVersionId = activeVersion.id;
    if (mode === 'revise') {
        payload.instruction = instruction;
        payload.currentHtml = currentHtml;
    }
    return executeRequest(payload);
}

function saveLandingVersion(html, label, form) {
    let project = getActiveLandingProject();
    const now = Date.now();
    if (!project) {
        project = {
            id: createLandingId('landing'),
            title: form.productName || 'صفحة هبوط جديدة',
            createdAt: now,
            updatedAt: now,
            form: form,
            model: landingState.selectedModel,
            points: landingState.selectedPoints,
            versions: []
        };
        landingState.projects.unshift(project);
        landingState.activeProjectId = project.id;
    }
    project.title = form.productName || project.title || 'صفحة هبوط جديدة';
    project.form = form;
    project.model = landingState.selectedModel;
    project.points = landingState.selectedPoints;
    project.updatedAt = now;
    project.versions = project.versions || [];
    project.versions.push({
        id: createLandingId('version'),
        html: html,
        label: label || 'نسخة جديدة',
        createdAt: now
    });
    if (project.versions.length > LANDING_MAX_VERSIONS) project.versions = project.versions.slice(-LANDING_MAX_VERSIONS);
    landingState.currentVersionIndex = project.versions.length - 1;
    persistLandingProjects();
    renderLandingProjects();
    showLandingVersion(project.versions[landingState.currentVersionIndex]);
}

function acceptLandingProjectFromServer(serverProject, previousProjectId) {
    if (!serverProject || !serverProject.id) return false;
    const project = Object.assign({}, serverProject, { loadedFromServer: true });
    if (previousProjectId && previousProjectId !== project.id) {
        landingState.projects = landingState.projects.filter(function(item) { return item.id !== previousProjectId; });
    }
    replaceLandingProject(project);
    landingState.activeProjectId = project.id;
    landingState.currentVersionIndex = Math.max(0, (project.versions || []).length - 1);
    persistLandingProjects();
    renderLandingProjects();
    showLandingVersion(project.versions[landingState.currentVersionIndex] || null);
    return true;
}

function showLandingVersion(version) {
    const hasVersion = Boolean(version && version.html);
    if (landingUI.emptyPreview) landingUI.emptyPreview.classList.toggle('hidden', hasVersion);
    if (landingUI.previewShell) landingUI.previewShell.classList.toggle('hidden', !hasVersion);
    if (landingUI.revisionPanel) landingUI.revisionPanel.classList.toggle('hidden', !hasVersion);
    if (landingUI.previewFrame) landingUI.previewFrame.srcdoc = hasVersion ? version.html : '';
    if (landingUI.codeEditor) landingUI.codeEditor.value = hasVersion ? version.html : '';
    if (hasVersion) showLandingComplete(getActiveLandingProject()?.title, false);
    else landingUI.completeCard?.classList.add('hidden');
    updateLandingVersionNavigation();
}

function updateLandingVersionNavigation() {
    const project = getActiveLandingProject();
    const total = project && project.versions ? project.versions.length : 0;
    const current = total ? landingState.currentVersionIndex + 1 : 0;
    if (landingUI.versionLabel) landingUI.versionLabel.textContent = total ? 'النسخة ' + current + ' من ' + total : 'لا توجد نسخ';
    if (landingUI.prevVersionBtn) landingUI.prevVersionBtn.disabled = current <= 1;
    if (landingUI.nextVersionBtn) landingUI.nextVersionBtn.disabled = !total || current >= total;
}

function moveLandingVersion(direction) {
    const project = getActiveLandingProject();
    if (!project || !project.versions || !project.versions.length) return;
    const nextIndex = landingState.currentVersionIndex + direction;
    if (nextIndex < 0 || nextIndex >= project.versions.length) return;
    landingState.currentVersionIndex = nextIndex;
    showLandingVersion(project.versions[nextIndex]);
    setLandingStatus('أنت الآن تعاين: ' + (project.versions[nextIndex].label || 'نسخة محفوظة'), 'info');
}

function showLandingView(viewName) {
    const showCode = viewName === 'code';
    if (landingUI.previewView) landingUI.previewView.classList.toggle('hidden', showCode);
    if (landingUI.codeView) landingUI.codeView.classList.toggle('hidden', !showCode);
    document.querySelectorAll('[data-landing-view]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.landingView === viewName);
    });
}

function setLandingDevice(device) {
    const target = device === 'mobile' ? 'mobile' : 'desktop';
    if (landingUI.previewShell) landingUI.previewShell.dataset.device = target;
    document.querySelectorAll('[data-landing-device]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.landingDevice === target);
    });
}

async function generateLandingPage() {
    if (landingState.busy) return;
    const form = collectLandingForm();
    const requiredNameField = landingUI.productName?.closest('.landing-required-name');
    requiredNameField?.classList.remove('has-error');
    if (!form.productName) {
        requiredNameField?.classList.add('has-error');
        setLandingStatus('اكتب اسم المنتج أو العنصر أولاً؛ سيُستخدم لحفظ صفحة الهبوط وتعريفها.', 'error');
        landingUI.productName?.focus();
        return;
    }
    if (!form.prompt) {
        setLandingStatus('اكتب وصف الصفحة التي تريد إنشاءها أولاً.', 'error');
        if (landingUI.prompt) landingUI.prompt.focus();
        return;
    }
    appendLandingUserMessage(form.prompt, landingState.referenceAttachment);
    setLandingPreviewOpen(false);
    showLandingGeneration(true, form.productName, 'إنشاء الصفحة');
    setLandingAssistantOpen(false);
    setLandingModelPopoverOpen(false);
    setLandingBusy(true, 'النموذج يبني الصفحة...');
    setLandingStatus('', 'loading');
    try {
        const previousProjectId = landingState.activeProjectId;
        const responseData = await requestLandingPage('generate', form, '', '');
        if (!responseData) {
            showLandingGeneration(false);
            return;
        }
        if (!responseData.success) throw new Error(responseData.error || 'لم ينجح إنشاء الصفحة.');
        const html = extractLandingHtml(responseData);
        if (!html) throw new Error('وصل رد من الخادم لكنه لا يحتوي على كود HTML صالح.');
        if (!acceptLandingProjectFromServer(responseData.project, previousProjectId)) {
            saveLandingVersion(html, 'النسخة الأولى', form);
        }
        if (responseData.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(responseData.remainingTokens);
        showLandingView('preview');
        showLandingComplete(form.productName);
        if (landingUI.prompt) {
            landingUI.prompt.value = '';
            landingUI.prompt.style.height = 'auto';
        }
        clearLandingReference();
        setLandingStatus(responseData.storageWarning || 'تم إنشاء الصفحة وحفظ النسخة الأولى بنجاح.', responseData.storageWarning ? 'info' : 'success');
    } catch (error) {
        showLandingGeneration(false);
        setLandingStatus(error.message || 'تعذر إنشاء الصفحة.', 'error');
    } finally {
        setLandingBusy(false);
    }
}

async function reviseLandingPage() {
    if (landingState.busy) return;
    const project = getActiveLandingProject();
    const version = project && project.versions ? project.versions[landingState.currentVersionIndex] : null;
    const instruction = landingUI.revisionPrompt ? landingUI.revisionPrompt.value.trim() : '';
    if (!version || !version.html) {
        setLandingStatus('أنشئ صفحة أولاً قبل طلب التعديل.', 'error');
        return;
    }
    if (!instruction) {
        setLandingStatus('اكتب التعديل المطلوب بوضوح.', 'error');
        if (landingUI.revisionPrompt) landingUI.revisionPrompt.focus();
        return;
    }
    const form = collectLandingForm();
    if (!form.prompt && project.form?.prompt) form.prompt = project.form.prompt;
    appendLandingUserMessage(instruction, null);
    setLandingPreviewOpen(false);
    showLandingGeneration(true, form.productName || project.title, 'تعديل الصفحة');
    setLandingBusy(true, 'يتم تعديل الصفحة...');
    setLandingStatus('يعدّل النموذج المطلوب فقط مع الحفاظ على بقية الصفحة.', 'loading');
    try {
        const previousProjectId = landingState.activeProjectId;
        const responseData = await requestLandingPage('revise', form, instruction, version.html);
        if (!responseData) {
            showLandingGeneration(false);
            return;
        }
        if (!responseData.success) throw new Error(responseData.error || 'لم ينجح تعديل الصفحة.');
        const html = extractLandingHtml(responseData);
        if (!html) throw new Error('لم يُرجع الخادم كود HTML صالحًا بعد التعديل.');
        if (!acceptLandingProjectFromServer(responseData.project, previousProjectId)) {
            saveLandingVersion(html, 'تعديل: ' + instruction.slice(0, 55), form);
        }
        if (landingUI.revisionPrompt) landingUI.revisionPrompt.value = '';
        if (responseData.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(responseData.remainingTokens);
        showLandingView('preview');
        showLandingComplete(form.productName || project.title);
        setLandingStatus(responseData.storageWarning || 'تم حفظ التعديل كنسخة جديدة، والنسخة القديمة ما زالت متاحة.', responseData.storageWarning ? 'info' : 'success');
    } catch (error) {
        showLandingGeneration(false);
        showLandingComplete(form.productName || project.title);
        setLandingStatus(error.message || 'تعذر تعديل الصفحة.', 'error');
    } finally {
        setLandingBusy(false);
    }
}

async function applyLandingCodeManually() {
    const html = cleanLandingHtml(landingUI.codeEditor ? landingUI.codeEditor.value : '');
    if (!html || !/<html[\s>]/i.test(html)) {
        setLandingStatus('المحرر لا يحتوي على وثيقة HTML كاملة صالحة للمعاينة.', 'error');
        return;
    }
    const form = collectLandingForm();
    const project = getActiveLandingProject();
    const baseVersion = project && project.versions ? project.versions[landingState.currentVersionIndex] : null;
    if (currentUser) {
        setLandingBusy(true, 'جاري حفظ الكود...');
        const payload = {
            action: 'landing_save_manual',
            userId: currentUser.$id,
            html,
            label: 'تعديل يدوي على الكود',
            landingPageDetails: form,
            modelTier: landingState.selectedModel
        };
        if (project && !project.id.startsWith('landing-')) payload.projectId = project.id;
        if (baseVersion?.id) payload.baseVersionId = baseVersion.id;
        const response = await executeRequest(payload);
        setLandingBusy(false);
        if (response && response.success && acceptLandingProjectFromServer(response.project, project?.id)) {
            showLandingView('preview');
            setLandingStatus('تم تطبيق الكود وحفظه كنسخة جديدة في حسابك.', 'success');
            return;
        }
    }
    saveLandingVersion(html, 'تعديل يدوي على الكود', form);
    showLandingView('preview');
    setLandingStatus('تم تطبيق الكود وحفظه محليًا كنسخة جديدة.', 'info');
}

async function copyLandingCode() {
    const code = landingUI.codeEditor ? landingUI.codeEditor.value : '';
    if (!code) {
        setLandingStatus('لا يوجد كود لنسخه بعد.', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(code);
        setLandingStatus('تم نسخ كود HTML.', 'success');
    } catch (error) {
        landingUI.codeEditor.focus();
        landingUI.codeEditor.select();
        document.execCommand('copy');
        setLandingStatus('تم نسخ كود HTML.', 'success');
    }
}

function downloadLandingCode() {
    const code = landingUI.codeEditor ? landingUI.codeEditor.value : '';
    if (!code) {
        setLandingStatus('لا يوجد كود لتنزيله بعد.', 'error');
        return;
    }
    const project = getActiveLandingProject();
    const safeName = ((project && project.title) || 'aklake-landing-page')
        .replace(/[^\w\u0600-\u06FF-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'aklake-landing-page';
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = safeName + '.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
    setLandingStatus('تم تجهيز ملف HTML للتنزيل.', 'success');
}

window.prefillLandingFromBook = function(book) {
    startNewLandingProject();
    const title = book?.title || 'الكتاب';
    landingState.sourceBookId = book?.$id || book?.id || '';
    fillLandingForm({
        sourceBookId: landingState.sourceBookId,
        productName: title,
        prompt: 'أنشئ صفحة هبوط احترافية ومقنعة لتسويق هذا الكتاب، مع إبراز فائدته للقارئ، نبذة جذابة، ما الذي سيتعلمه، أقسام الثقة، وأسئلة شائعة وزر شراء واضح.',
        audience: 'القراء المهتمون بموضوع الكتاب',
        productDetails: safeLandingBookDetails(book),
        language: 'العربية'
    });
    setLandingStatus('تم جلب معلومات «' + title + '». أضف السعر ورابط الشراء ثم أنشئ الصفحة.', 'success');
    landingUI.prompt?.focus();
};

function safeLandingBookDetails(book) {
    const outline = typeof book?.outline === 'string' ? book.outline.trim() : '';
    return [
        'عنوان الكتاب: ' + (book?.title || 'غير محدد'),
        outline ? 'خطة أو ملخص الكتاب:\n' + outline.slice(0, 6000) : ''
    ].filter(Boolean).join('\n\n');
}

function initLandingPageStudio() {
    cacheLandingUI();
    if (!landingUI.studio || landingUI.studio.dataset.initialized === 'true') return;
    landingUI.studio.dataset.initialized = 'true';
    loadLandingProjects();
    if (currentUser) syncLandingProjectsFromServer();

    if (landingUI.newProjectBtn) landingUI.newProjectBtn.addEventListener('click', startNewLandingProject);
    if (landingUI.projectsToggle) landingUI.projectsToggle.addEventListener('click', function() {
        setLandingProjectsOpen(landingUI.projectsPanel?.classList.contains('hidden'));
    });
    if (landingUI.assistantToggle) landingUI.assistantToggle.addEventListener('click', function() {
        setLandingAssistantOpen(landingUI.assistantPanel?.classList.contains('hidden'));
    });
    if (landingUI.modelToggle) landingUI.modelToggle.addEventListener('click', function() {
        setLandingModelPopoverOpen(landingUI.modelPopover?.classList.contains('hidden'));
    });
    if (landingUI.closeModelBtn) landingUI.closeModelBtn.addEventListener('click', function() { setLandingModelPopoverOpen(false); });
    if (landingUI.openResultBtn) landingUI.openResultBtn.addEventListener('click', function() { setLandingPreviewOpen(true); });
    if (landingUI.closePreviewBtn) landingUI.closePreviewBtn.addEventListener('click', function() {
        setLandingPreviewOpen(false);
        landingUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (landingUI.attachBtn) landingUI.attachBtn.addEventListener('click', function() { landingUI.referenceFile?.click(); });
    if (landingUI.referenceFile) landingUI.referenceFile.addEventListener('change', function() {
        if (landingUI.referenceFile.files && landingUI.referenceFile.files[0]) setLandingReferenceFile(landingUI.referenceFile.files[0]);
    });
    if (landingUI.removeReferenceBtn) landingUI.removeReferenceBtn.addEventListener('click', clearLandingReference);
    if (landingUI.productName) landingUI.productName.addEventListener('input', function() {
        landingUI.productName.closest('.landing-required-name')?.classList.remove('has-error');
    });
    if (landingUI.modelCards) {
        landingUI.modelCards.querySelectorAll('[data-landing-model]').forEach(function(card) {
            card.addEventListener('click', function() {
                setLandingModel(card.dataset.landingModel, Number(card.dataset.points));
                setLandingModelPopoverOpen(false);
            });
        });
    }
    if (landingUI.generateBtn) landingUI.generateBtn.addEventListener('click', generateLandingPage);
    if (landingUI.reviseBtn) landingUI.reviseBtn.addEventListener('click', reviseLandingPage);
    if (landingUI.applyCodeBtn) landingUI.applyCodeBtn.addEventListener('click', applyLandingCodeManually);
    if (landingUI.copyBtn) landingUI.copyBtn.addEventListener('click', copyLandingCode);
    if (landingUI.downloadBtn) landingUI.downloadBtn.addEventListener('click', downloadLandingCode);
    if (landingUI.prevVersionBtn) landingUI.prevVersionBtn.addEventListener('click', function() { moveLandingVersion(-1); });
    if (landingUI.nextVersionBtn) landingUI.nextVersionBtn.addEventListener('click', function() { moveLandingVersion(1); });

    document.querySelectorAll('[data-landing-view]').forEach(function(button) {
        button.addEventListener('click', function() { showLandingView(button.dataset.landingView); });
    });
    document.querySelectorAll('[data-landing-device]').forEach(function(button) {
        button.addEventListener('click', function() { setLandingDevice(button.dataset.landingDevice); });
    });
    if (landingUI.revisionPrompt) {
        landingUI.revisionPrompt.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                reviseLandingPage();
            }
        });
    }
    if (landingUI.prompt) {
        landingUI.prompt.addEventListener('input', function() {
            landingUI.prompt.style.height = 'auto';
            landingUI.prompt.style.height = Math.min(landingUI.prompt.scrollHeight, 180) + 'px';
        });
        landingUI.prompt.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                generateLandingPage();
            }
        });
    }

    setLandingModel('gpt-4.1-mini', 40);
    setLandingAssistantOpen(false);
    setLandingProjectsOpen(false);
    setLandingModelPopoverOpen(false);
    setLandingPreviewOpen(false);
    renderLandingProjects();
    if (landingState.projects.length) openLandingProject(landingState.projects[0].id);
    else startNewLandingProject();
}

window.initLandingPageStudio = initLandingPageStudio;
