function syncWorkspaceChrome(inWorkspace) {
    const nav = document.querySelector('.nav');
    const brandNavigation = document.querySelector('.brand-navigation');
    const accountActions = document.querySelector('.account-actions');
    const brandSlot = document.getElementById('workspace-brand-slot');
    const accountSlot = document.getElementById('workspace-account-slot');

    if (!nav || !brandNavigation || !accountActions || !brandSlot || !accountSlot) return;

    if (inWorkspace) {
        if (brandNavigation.parentElement !== brandSlot) brandSlot.appendChild(brandNavigation);
        if (accountActions.parentElement !== accountSlot) accountSlot.appendChild(accountActions);
        nav.setAttribute('aria-hidden', 'true');
    } else {
        if (brandNavigation.parentElement !== nav) nav.appendChild(brandNavigation);
        if (accountActions.parentElement !== nav) nav.appendChild(accountActions);
        nav.removeAttribute('aria-hidden');
    }
}
window.syncWorkspaceChrome = syncWorkspaceChrome;

function openWorkspace() {
    if (ui.welcomeScreen) ui.welcomeScreen.classList.add('is-hidden');
    if (ui.appShell) ui.appShell.classList.remove('is-collapsed');
    document.body.classList.add('workspace-open');
    syncWorkspaceChrome(true);
}
window.openWorkspace = openWorkspace;

function showHomeScreen() {
    if (ui.welcomeScreen) ui.welcomeScreen.classList.remove('is-hidden');
    if (ui.appShell) ui.appShell.classList.add('is-collapsed');
    document.body.classList.remove('workspace-open');
    syncWorkspaceChrome(false);
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
        landing_page: { kicker: 'AKLAKE LANDING LAB', title: 'مولد صفحات الهبوط', placeholder: 'صف صفحة الهبوط التي تريدها...' },
        cv_builder: { kicker: 'AKLAKE CV LAB', title: 'منشئ السيرة الذاتية', placeholder: 'صف السيرة الذاتية التي تريد إنشاءها...' },
        website_builder: { kicker: 'AKLAKE WEBSITE LAB', title: 'منشئ المواقع', placeholder: 'صف الموقع الذي تريد إنشاءه...' }
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

    if (action === 'website_builder' && ui.action.value === 'website_builder' &&
        typeof window.restoreWebsiteChatPanel === 'function' && window.restoreWebsiteChatPanel()) {
        return;
    }
    if (action === 'landing_page' && ui.action.value === 'landing_page' &&
        typeof window.restoreLandingChatPanel === 'function' && window.restoreLandingChatPanel()) {
        return;
    }
    if (action === 'cv_builder' && ui.action.value === 'cv_builder' &&
        typeof window.restoreCVChatPanel === 'function' && window.restoreCVChatPanel()) {
        return;
    }

    if (action !== 'website_builder' && ui.action.value === 'website_builder' &&
        typeof window.closeWebsitePreviewWorkspace === 'function') {
        window.closeWebsitePreviewWorkspace();
    }
    if (action !== 'landing_page' && ui.action.value === 'landing_page' &&
        typeof window.closeLandingPreviewWorkspace === 'function') {
        window.closeLandingPreviewWorkspace();
    }
    if (action !== 'cv_builder' && ui.action.value === 'cv_builder' &&
        typeof window.closeCVPreviewWorkspace === 'function') {
        window.closeCVPreviewWorkspace();
    }

    if (action !== 'edit' && ui.imageFile && ui.imageFile.files && ui.imageFile.files.length > 0) {
        clearComposerAttachment(false);
    }
    if (action !== 'book_outline' && bookReferenceAttachment) clearBookReferenceAttachment();

    const mainInputs = document.getElementById('main-inputs-wrapper');
    const libraryDrawer = document.getElementById('my-library-section');
    if (mainInputs) mainInputs.classList.remove('hidden');
    if (libraryDrawer) libraryDrawer.classList.add('hidden');

    // منشئ المواقع وCV يستخدمان الكود الوظيفي الأول حصريًا؛ بقية الأدوات تبقى على مساراتها الحالية.
    ui.source.value = ['website_builder', 'cv_builder'].includes(action) ? FIRST_FUNCTION_ID : SECOND_FUNCTION_ID;
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
    large: { label: 'لوحة كبيرة', width: 44, height: 60, verticalWidth: 27.5, verticalHeight: 96, price: 79 },
    medium: { label: 'لوحة متوسطة', width: 36, height: 49, verticalWidth: 22.5, verticalHeight: 78.4, price: 59 },
    small: { label: 'لوحة صغيرة', width: 30, height: 41, verticalWidth: 18.75, verticalHeight: 65.6, price: 39 }
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
            large: { horizontal: [60, 33], vertical: [37.5, 52.8] },
            medium: { horizontal: [52, 28], vertical: [32.5, 44.8] },
            small: { horizontal: [44, 24], vertical: [27.5, 38.4] }
        }[size];
        return { width: mobile[direction][0], height: mobile[direction][1] };
    }
    if (window.innerWidth <= 980) {
        const tablet = {
            large: { horizontal: [52, 55], vertical: [32.5, 88] },
            medium: { horizontal: [44, 47], vertical: [27.5, 75.2] },
            small: { horizontal: [36, 38], vertical: [22.5, 60.8] }
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
    syncArtFrameImageOrientation(frame);
}

function syncArtFrameImageOrientation(frame) {
    if (!frame || !frame.element) return;
    const canvas = frame.element.querySelector('.art-frame-canvas');
    const image = canvas ? canvas.querySelector('img') : null;
    if (!canvas || !image) return;

    image.style.cssText = '';
    if (frame.orientation !== 'vertical') return;

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    image.style.position = 'absolute';
    image.style.left = '50%';
    image.style.top = '50%';
    image.style.width = canvasHeight + 'px';
    image.style.height = canvasWidth + 'px';
    image.style.maxWidth = 'none';
    image.style.maxHeight = 'none';
    image.style.transformOrigin = 'center center';
    image.style.transform = 'translate(-50%, -50%) rotate(90deg)';
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
    const previousMetrics = getArtFrameMetrics(frame);
    const centerX = previousX + (previousMetrics.width / 2);
    const centerY = previousY + (previousMetrics.height / 2);

    frame.orientation = frame.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    renderArtFrame(frame);

    requestAnimationFrame(function() {
        const metrics = getArtFrameMetrics(frame);
        const cannotFit = metrics.width > 100 || metrics.height > 100;
        frame.x = Math.max(0, Math.min(100 - metrics.width, centerX - (metrics.width / 2)));
        frame.y = Math.max(0, Math.min(100 - metrics.height, centerY - (metrics.height / 2)));
        frame.element.style.left = frame.x + '%';
        frame.element.style.top = frame.y + '%';
        syncArtFrameImageOrientation(frame);

        if (cannotFit || positionCollides(frame.id, frame.x, frame.y, frame.size, frame.orientation)) {
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
    window.addEventListener('resize', function() {
        artFrames.forEach(syncArtFrameImageOrientation);
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
    pendingModel: 'gpt-4.1-mini',
    pendingPoints: 40,
    busy: false,
    referenceAttachment: null,
    assets: [],
    activeAssetPath: '',
    previewOpen: false,
    chatCollapsed: false,
    activeView: 'preview'
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
        closeChatBtn: landingElement('landing-close-chat-btn'),
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
        rememberModelToggle: landingElement('landing-remember-model-toggle'),
        rememberModelIcon: document.querySelector('.landing-remember-toggle-icon'),
        confirmModelBtn: landingElement('landing-confirm-model-btn'),
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
    if (expanded) {
        setLandingPendingModel(landingState.selectedModel);
        syncLandingRememberModelUI();
    }
    landingUI.modelPopover?.classList.toggle('hidden', !expanded);
    landingUI.modelPopover?.setAttribute('aria-hidden', String(!expanded));
    landingUI.modelToggle?.setAttribute('aria-expanded', String(expanded));
}

function syncLandingWorkspaceLayout() {
    const active = Boolean(
        landingState.previewOpen &&
        ui?.action?.value === 'landing_page'
    );

    ui?.appShell?.classList.toggle('landing-preview-layout', active);
    landingUI.studio?.classList.toggle('is-preview-mode', active);
    landingUI.studio?.classList.toggle('is-chat-collapsed', active && landingState.chatCollapsed);
    document.body.classList.toggle('landing-preview-open', active);

    if (landingUI.closeChatBtn) {
        landingUI.closeChatBtn.setAttribute('aria-hidden', String(!active));
        landingUI.closeChatBtn.tabIndex = active ? 0 : -1;
    }
}

function setLandingPreviewOpen(open) {
    landingState.previewOpen = Boolean(open);
    landingUI.output?.classList.toggle('hidden', !landingState.previewOpen);
    if (landingState.previewOpen) {
        landingState.chatCollapsed = false;
        landingState.activeView = 'preview';
        showLandingView('preview');
    } else {
        landingState.chatCollapsed = false;
    }
    syncLandingWorkspaceLayout();
}

function collapseLandingChatPanel() {
    if (!landingState.previewOpen) return false;
    landingState.chatCollapsed = true;
    syncLandingWorkspaceLayout();
    return true;
}

window.restoreLandingChatPanel = function() {
    if (!landingState.previewOpen || !landingState.chatCollapsed) return false;
    landingState.chatCollapsed = false;
    syncLandingWorkspaceLayout();
    requestAnimationFrame(function() { landingUI.prompt?.focus(); });
    return true;
};

window.closeLandingPreviewWorkspace = function() {
    setLandingPreviewOpen(false);
};

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
        landingState.projects = Array.isArray(stored)
            ? stored.map(function(project) { return normalizeLandingProject(project); })
            : [];
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
    const loaded = normalizeLandingProject(Object.assign({}, response.project, { loadedFromServer: true }));
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
    const rememberedModel = readLandingRememberedModel();
    setLandingModel(rememberedModel ? rememberedModel.model : 'gpt-4.1-mini');
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
    if (versions.length) {
        setLandingStatus('تم فتح «' + (project.title || 'صفحة هبوط') + '».', 'success');
    } else if (project.blockedVersionCount) {
        setLandingStatus('تم فتح المشروع، لكن أُخفيت النسخة غير الآمنة لأنها تحتوي على واجهة AKLAKE الأصلية.', 'error');
    } else {
        setLandingStatus('تم فتح المشروع، ولا توجد نسخة HTML محفوظة فيه بعد.', 'info');
    }
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

function readLandingRememberedModel() {
    const remembered = readRememberedModels().landing_page;
    if (!remembered || remembered.provider !== 'openai') return null;
    return Object.prototype.hasOwnProperty.call(LANDING_MODEL_POINTS, remembered.model)
        ? remembered
        : null;
}

function syncLandingRememberModelUI() {
    const remembered = readLandingRememberedModel();
    if (landingUI.rememberModelToggle) landingUI.rememberModelToggle.checked = Boolean(remembered);
    if (landingUI.rememberModelIcon) {
        landingUI.rememberModelIcon.classList.toggle('fa-toggle-on', Boolean(remembered));
        landingUI.rememberModelIcon.classList.toggle('fa-toggle-off', !remembered);
    }
}

function updateLandingRememberModelIcon() {
    const checked = Boolean(landingUI.rememberModelToggle?.checked);
    if (landingUI.rememberModelIcon) {
        landingUI.rememberModelIcon.classList.toggle('fa-toggle-on', checked);
        landingUI.rememberModelIcon.classList.toggle('fa-toggle-off', !checked);
    }
}

function setLandingPendingModel(model) {
    landingState.pendingModel = Object.prototype.hasOwnProperty.call(LANDING_MODEL_POINTS, model)
        ? model
        : landingState.selectedModel;
    landingState.pendingPoints = LANDING_MODEL_POINTS[landingState.pendingModel];
    if (landingUI.modelCards) {
        landingUI.modelCards.querySelectorAll('[data-landing-model]').forEach(function(card) {
            const selected = card.dataset.landingModel === landingState.pendingModel;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
    }
    if (landingUI.confirmModelBtn) landingUI.confirmModelBtn.disabled = !landingState.pendingModel;
}

function rememberLandingModelChoice() {
    const rememberedModels = readRememberedModels();
    if (landingUI.rememberModelToggle?.checked) {
        rememberedModels.landing_page = {
            provider: 'openai',
            model: landingState.selectedModel,
            source: SECOND_FUNCTION_ID
        };
    } else {
        delete rememberedModels.landing_page;
    }
    writeRememberedModels(rememberedModels);
    syncLandingRememberModelUI();
}

function confirmLandingModelChoice() {
    setLandingModel(landingState.pendingModel || landingState.selectedModel);
    rememberLandingModelChoice();
    setLandingModelPopoverOpen(false);
    setLandingStatus('تم اعتماد نموذج «' + (LANDING_MODEL_NAMES[landingState.selectedModel] || landingState.selectedModel) + '».', 'success');
}

function setLandingModel(model) {
    landingState.selectedModel = Object.prototype.hasOwnProperty.call(LANDING_MODEL_POINTS, model) ? model : 'gpt-4.1-mini';
    landingState.selectedPoints = LANDING_MODEL_POINTS[landingState.selectedModel];
    landingState.pendingModel = landingState.selectedModel;
    landingState.pendingPoints = landingState.selectedPoints;
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

function validateLandingHtml(value) {
    const html = cleanLandingHtml(value);
    if (!html || !/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
        return {
            valid: false,
            html: '',
            error: 'النتيجة ليست وثيقة HTML كاملة، لذلك لم تُعرض داخل المعاينة.'
        };
    }

    const aklakeShellMarkers = [
        /id\s*=\s*["']app-shell["']/i,
        /id\s*=\s*["']main-inputs-wrapper["']/i,
        /id\s*=\s*["']landing-page-studio["']/i,
        /id\s*=\s*["']source-select["']/i,
        /<script[^>]+src\s*=\s*["'][^"']*(?:app|workspace)\.js(?:[?#][^"']*)?["']/i
    ];
    if (aklakeShellMarkers.some(function(marker) { return marker.test(html); })) {
        return {
            valid: false,
            html: '',
            error: 'تم منع هذه النسخة لأنها تحتوي على واجهة موقع AKLAKE الأصلية بدل كود صفحة الهبوط.'
        };
    }

    return { valid: true, html: html, error: '' };
}

function extractLandingHtml(responseData) {
    if (!responseData) return '';
    const candidate = responseData.html || responseData.code || responseData.content ||
        responseData.output || responseData.data || responseData.result || '';
    let value = candidate;
    if (candidate && typeof candidate === 'object') {
        value = candidate.html || candidate.code || candidate.content || candidate.output || '';
    }
    const validation = validateLandingHtml(value);
    if (!validation.valid) throw new Error(validation.error);
    return validation.html;
}

function normalizeLandingProject(sourceProject, fallbackHtml) {
    const project = Object.assign({}, sourceProject || {});
    const sourceVersions = Array.isArray(project.versions) ? project.versions : [];
    const safeVersions = [];
    let blockedVersionCount = 0;

    sourceVersions.forEach(function(version) {
        const validation = validateLandingHtml(version && version.html);
        if (!validation.valid) {
            blockedVersionCount += 1;
            return;
        }
        safeVersions.push(Object.assign({}, version, { html: validation.html }));
    });

    const fallbackValidation = validateLandingHtml(fallbackHtml);
    if (fallbackValidation.valid && !safeVersions.some(function(version) {
        return version.html === fallbackValidation.html;
    })) {
        safeVersions.push({
            id: createLandingId('version'),
            html: fallbackValidation.html,
            label: safeVersions.length ? 'النسخة الأحدث' : 'النسخة الأولى',
            createdAt: Date.now()
        });
    }

    project.versions = safeVersions;
    project.versionCount = safeVersions.length;
    project.blockedVersionCount = blockedVersionCount;
    return project;
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
    const validation = validateLandingHtml(html);
    if (!validation.valid) throw new Error(validation.error);
    html = validation.html;
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

function acceptLandingProjectFromServer(serverProject, previousProjectId, fallbackHtml) {
    if (!serverProject || !serverProject.id) return false;
    const project = normalizeLandingProject(
        Object.assign({}, serverProject, { loadedFromServer: true }),
        fallbackHtml
    );
    if (!project.versions.length) return false;
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
    const validation = validateLandingHtml(version && version.html);
    const hasVersion = validation.valid;
    if (landingUI.emptyPreview) landingUI.emptyPreview.classList.toggle('hidden', hasVersion);
    if (landingUI.previewShell) landingUI.previewShell.classList.toggle('hidden', !hasVersion);
    if (landingUI.revisionPanel) landingUI.revisionPanel.classList.toggle('hidden', !hasVersion);
    if (landingUI.previewFrame) landingUI.previewFrame.srcdoc = hasVersion ? validation.html : '';
    if (landingUI.codeEditor) landingUI.codeEditor.value = hasVersion ? validation.html : '';
    if (hasVersion) showLandingComplete(getActiveLandingProject()?.title, false);
    else {
        landingUI.completeCard?.classList.add('hidden');
        if (version && version.html) setLandingStatus(validation.error, 'error');
    }
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
    landingState.activeView = viewName === 'code' ? 'code' : 'preview';
    const showCode = landingState.activeView === 'code';
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

    const activeProject = getActiveLandingProject();
    const activeVersion = activeProject && activeProject.versions
        ? activeProject.versions[landingState.currentVersionIndex]
        : null;
    const composerInstruction = landingUI.prompt ? landingUI.prompt.value.trim() : '';

    // داخل مساحة المعاينة تصبح خانة الشات نفسها خانة تعديل للنسخة الحالية،
    // مثل منشئ المواقع، بدل إنشاء مشروع جديد بالخطأ.
    if (landingState.previewOpen && activeVersion?.html) {
        if (!composerInstruction) {
            setLandingStatus('اكتب التعديل المطلوب على النسخة الحالية.', 'error');
            landingUI.prompt?.focus();
            return;
        }
        if (landingUI.revisionPrompt) landingUI.revisionPrompt.value = composerInstruction;
        if (landingUI.prompt) {
            landingUI.prompt.value = '';
            landingUI.prompt.style.height = 'auto';
        }
        return reviseLandingPage();
    }

    const form = collectLandingForm();
    const requiredNameField = landingUI.productName?.closest('.landing-required-name');
    requiredNameField?.classList.remove('has-error');
    if (!form.productName) {
        requiredNameField?.classList.add('has-error');
        setLandingStatus('', '');
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
        if (!acceptLandingProjectFromServer(responseData.project, previousProjectId, html)) {
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
        if (!acceptLandingProjectFromServer(responseData.project, previousProjectId, html)) {
            saveLandingVersion(html, 'تعديل: ' + instruction.slice(0, 55), form);
        }
        if (landingUI.revisionPrompt) landingUI.revisionPrompt.value = '';
        if (responseData.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(responseData.remainingTokens);
        setLandingPreviewOpen(true);
        showLandingView('preview');
        showLandingComplete(form.productName || project.title, false);
        setLandingStatus(responseData.storageWarning || 'تم حفظ التعديل كنسخة جديدة، والنسخة القديمة ما زالت متاحة.', responseData.storageWarning ? 'info' : 'success');
    } catch (error) {
        showLandingGeneration(false);
        if (landingState.previewOpen) showLandingComplete(form.productName || project.title, false);
        setLandingStatus(error.message || 'تعذر تعديل الصفحة.', 'error');
    } finally {
        setLandingBusy(false);
    }
}

async function applyLandingCodeManually() {
    const validation = validateLandingHtml(landingUI.codeEditor ? landingUI.codeEditor.value : '');
    if (!validation.valid) {
        setLandingStatus(validation.error, 'error');
        return;
    }
    const html = validation.html;
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
        if (response && response.success && acceptLandingProjectFromServer(response.project, project?.id, html)) {
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
    if (landingUI.closeChatBtn) landingUI.closeChatBtn.addEventListener('click', collapseLandingChatPanel);
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
                setLandingPendingModel(card.dataset.landingModel);
            });
        });
    }
    if (landingUI.rememberModelToggle) {
        landingUI.rememberModelToggle.addEventListener('change', updateLandingRememberModelIcon);
    }
    if (landingUI.confirmModelBtn) landingUI.confirmModelBtn.addEventListener('click', confirmLandingModelChoice);
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

    const rememberedModel = readLandingRememberedModel();
    setLandingModel(rememberedModel ? rememberedModel.model : 'gpt-4.1-mini');
    syncLandingRememberModelUI();
    setLandingAssistantOpen(false);
    setLandingProjectsOpen(false);
    setLandingModelPopoverOpen(false);
    setLandingPreviewOpen(false);
    renderLandingProjects();
    if (landingState.projects.length) openLandingProject(landingState.projects[0].id);
    else startNewLandingProject();
}

window.initLandingPageStudio = initLandingPageStudio;


// ==========================================
// منشئ السيرة الذاتية — HTML واحد عبر الكود الوظيفي الأول
// ==========================================
const CV_STORAGE_KEY = 'aklake_cv_projects_v1';
const CV_MODEL_MEMORY_KEY = 'aklake_cv_model_v1';
const CV_MAX_PROJECTS = 24;
const CV_MAX_VERSIONS = 20;
const CV_MODEL_INFO = Object.freeze({
    'cloudflare:llama': { provider: 'cloudflare', model: 'llama', points: 5, label: 'LLaMA 3.3' },
    'openai:gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', points: 8, label: 'GPT-4o mini' },
    'openai:gpt-4.1-mini': { provider: 'openai', model: 'gpt-4.1-mini', points: 10, label: 'GPT-4.1 mini' }
});

const cvState = {
    projects: [],
    activeProjectId: null,
    currentVersionIndex: -1,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    points: 10,
    pendingKey: 'openai:gpt-4.1-mini',
    busy: false,
    previewOpen: false,
    chatCollapsed: false,
    activeView: 'preview',
    profileImage: null
};

const cvUI = {};
function cvElement(id) { return document.getElementById(id); }

function cacheCVUI() {
    Object.assign(cvUI, {
        studio: cvElement('cv-builder-studio'),
        conversation: cvElement('cv-conversation'),
        generationCard: cvElement('cv-generation-card'),
        completeCard: cvElement('cv-complete-card'),
        progressName: cvElement('cv-progress-name'),
        progressModel: cvElement('cv-progress-model'),
        completeTitle: cvElement('cv-complete-title'),
        openResultBtn: cvElement('cv-open-result-btn'),
        projectsToggle: cvElement('cv-projects-toggle'),
        projectsPanel: cvElement('cv-projects-panel'),
        projectsList: cvElement('cv-projects-list'),
        newProjectBtn: cvElement('cv-new-project-btn'),
        closeChatBtn: cvElement('cv-close-chat-btn'),
        output: cvElement('cv-output-panel'),
        previewView: cvElement('cv-preview-view'),
        emptyPreview: cvElement('cv-empty-preview'),
        previewShell: cvElement('cv-preview-shell'),
        previewFrame: cvElement('cv-preview-frame'),
        codeView: cvElement('cv-code-view'),
        codeEditor: cvElement('cv-code-editor'),
        applyCodeBtn: cvElement('cv-apply-code-btn'),
        copyBtn: cvElement('cv-copy-code-btn'),
        downloadBtn: cvElement('cv-download-btn'),
        closePreviewBtn: cvElement('cv-close-preview-btn'),
        revisionPanel: cvElement('cv-revision-panel'),
        revisionPrompt: cvElement('cv-revision-prompt'),
        reviseBtn: cvElement('cv-revise-btn'),
        prevVersionBtn: cvElement('cv-prev-version-btn'),
        nextVersionBtn: cvElement('cv-next-version-btn'),
        versionLabel: cvElement('cv-version-label'),
        fullName: cvElement('cv-full-name'),
        jobTitle: cvElement('cv-job-title'),
        language: cvElement('cv-language'),
        birthDate: cvElement('cv-birth-date'),
        age: cvElement('cv-age'),
        email: cvElement('cv-email'),
        phone: cvElement('cv-phone'),
        location: cvElement('cv-location'),
        links: cvElement('cv-links'),
        summary: cvElement('cv-summary'),
        experience: cvElement('cv-experience'),
        education: cvElement('cv-education'),
        certifications: cvElement('cv-certifications'),
        skills: cvElement('cv-skills'),
        languages: cvElement('cv-languages'),
        extra: cvElement('cv-extra'),
        assistantToggle: cvElement('cv-assistant-toggle'),
        assistantPanel: cvElement('cv-assistant-panel'),
        profileFile: cvElement('cv-profile-image-file'),
        profilePreview: cvElement('cv-profile-image-preview'),
        profileThumb: cvElement('cv-profile-image-thumb'),
        profileName: cvElement('cv-profile-image-name'),
        removeProfileBtn: cvElement('cv-remove-profile-image-btn'),
        attachBtn: cvElement('cv-attach-btn'),
        prompt: cvElement('cv-main-prompt'),
        generateBtn: cvElement('cv-generate-btn'),
        modelToggle: cvElement('cv-model-toggle'),
        modelPopover: cvElement('cv-model-popover'),
        modelCards: cvElement('cv-model-cards'),
        activeModel: cvElement('cv-active-model'),
        generateCost: cvElement('cv-generate-cost'),
        rememberModelToggle: cvElement('cv-remember-model-toggle'),
        rememberIcon: document.querySelector('.cv-remember-toggle-icon'),
        confirmModelBtn: cvElement('cv-confirm-model-btn'),
        closeModelBtn: cvElement('cv-close-model-btn'),
        status: cvElement('cv-status')
    });
}

function createCVId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + '-' + window.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function loadCVProjects() {
    try {
        const stored = JSON.parse(localStorage.getItem(CV_STORAGE_KEY) || '[]');
        cvState.projects = Array.isArray(stored) ? stored.filter(Boolean).slice(0, CV_MAX_PROJECTS) : [];
    } catch (_) {
        cvState.projects = [];
    }
}

function persistCVProjects() {
    try {
        const sorted = cvState.projects.slice().sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); }).slice(0, CV_MAX_PROJECTS);
        cvState.projects = sorted;
        localStorage.setItem(CV_STORAGE_KEY, JSON.stringify(sorted));
    } catch (error) {
        console.warn('تعذر حفظ مشاريع CV محليًا:', error);
        setCVStatus('تم إنشاء السيرة، لكن مساحة التخزين المحلية ممتلئة. نزّل الملف للاحتفاظ به.', 'info');
    }
}

function getActiveCVProject() {
    return cvState.projects.find(function(project) { return project.id === cvState.activeProjectId; }) || null;
}

function setCVStatus(message, type) {
    if (!cvUI.status) return;
    cvUI.status.textContent = message || '';
    cvUI.status.className = 'landing-status' + (type ? ' is-' + type : '');
}

function setCVBusy(busy, message) {
    cvState.busy = Boolean(busy);
    if (cvUI.generateBtn) cvUI.generateBtn.disabled = cvState.busy;
    if (cvUI.reviseBtn) cvUI.reviseBtn.disabled = cvState.busy;
    if (cvState.busy && message) setCVStatus(message, 'loading');
}

function setCVAssistantOpen(open) {
    const expanded = Boolean(open);
    cvUI.assistantPanel?.classList.toggle('hidden', !expanded);
    cvUI.assistantPanel?.setAttribute('aria-hidden', String(!expanded));
    cvUI.assistantToggle?.classList.toggle('is-open', expanded);
    cvUI.assistantToggle?.setAttribute('aria-expanded', String(expanded));
}

function setCVProjectsOpen(open) {
    const expanded = Boolean(open);
    cvUI.projectsPanel?.classList.toggle('hidden', !expanded);
    cvUI.projectsPanel?.setAttribute('aria-hidden', String(!expanded));
    cvUI.projectsToggle?.setAttribute('aria-expanded', String(expanded));
}

function readCVRememberedModel() {
    try {
        const data = JSON.parse(localStorage.getItem(CV_MODEL_MEMORY_KEY) || 'null');
        const key = data && data.provider && data.model ? data.provider + ':' + data.model : '';
        return CV_MODEL_INFO[key] ? CV_MODEL_INFO[key] : null;
    } catch (_) { return null; }
}

function updateCVRememberIcon() {
    const enabled = Boolean(cvUI.rememberModelToggle?.checked);
    cvUI.rememberIcon?.classList.toggle('fa-toggle-on', enabled);
    cvUI.rememberIcon?.classList.toggle('fa-toggle-off', !enabled);
}

function setCVPendingModel(key) {
    if (!CV_MODEL_INFO[key]) return;
    cvState.pendingKey = key;
    cvUI.modelCards?.querySelectorAll('[data-cv-model]').forEach(function(card) {
        const cardKey = card.dataset.cvProvider + ':' + card.dataset.cvModel;
        const selected = cardKey === key;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-checked', String(selected));
    });
}

function applyCVModel(info) {
    if (!info) return;
    cvState.provider = info.provider;
    cvState.model = info.model;
    cvState.points = info.points;
    cvState.pendingKey = info.provider + ':' + info.model;
    if (cvUI.activeModel) cvUI.activeModel.textContent = info.label;
    if (cvUI.generateCost) cvUI.generateCost.textContent = info.points + ' نقاط';
    setCVPendingModel(cvState.pendingKey);
}

function setCVModelPopoverOpen(open) {
    const expanded = Boolean(open);
    if (expanded) setCVPendingModel(cvState.provider + ':' + cvState.model);
    cvUI.modelPopover?.classList.toggle('hidden', !expanded);
    cvUI.modelPopover?.setAttribute('aria-hidden', String(!expanded));
    cvUI.modelToggle?.setAttribute('aria-expanded', String(expanded));
}
window.setCVModelPopoverOpen = setCVModelPopoverOpen;

function confirmCVModelChoice() {
    const info = CV_MODEL_INFO[cvState.pendingKey];
    if (!info) return;
    applyCVModel(info);
    if (cvUI.rememberModelToggle?.checked) {
        localStorage.setItem(CV_MODEL_MEMORY_KEY, JSON.stringify({ provider: info.provider, model: info.model }));
    } else {
        localStorage.removeItem(CV_MODEL_MEMORY_KEY);
    }
    setCVModelPopoverOpen(false);
    setCVStatus('تم اعتماد ' + info.label + ' عبر الكود الوظيفي الأول.', 'success');
}

function collectCVForm() {
    return {
        fullName: cvUI.fullName?.value.trim() || '',
        jobTitle: cvUI.jobTitle?.value.trim() || '',
        language: cvUI.language?.value || 'العربية',
        birthDate: cvUI.birthDate?.value || '',
        age: cvUI.age?.value.trim() || '',
        email: cvUI.email?.value.trim() || '',
        phone: cvUI.phone?.value.trim() || '',
        location: cvUI.location?.value.trim() || '',
        links: cvUI.links?.value.trim() || '',
        summary: cvUI.summary?.value.trim() || '',
        experience: cvUI.experience?.value.trim() || '',
        education: cvUI.education?.value.trim() || '',
        certifications: cvUI.certifications?.value.trim() || '',
        skills: cvUI.skills?.value.trim() || '',
        languages: cvUI.languages?.value.trim() || '',
        extra: cvUI.extra?.value.trim() || '',
        prompt: cvUI.prompt?.value.trim() || '',
        profilePhotoPath: cvState.profileImage?.path || '',
        profilePhotoName: cvState.profileImage?.name || ''
    };
}

function fillCVForm(form) {
    const f = form || {};
    const map = {
        fullName: cvUI.fullName, jobTitle: cvUI.jobTitle, birthDate: cvUI.birthDate, age: cvUI.age,
        email: cvUI.email, phone: cvUI.phone, location: cvUI.location, links: cvUI.links,
        summary: cvUI.summary, experience: cvUI.experience, education: cvUI.education,
        certifications: cvUI.certifications, skills: cvUI.skills, languages: cvUI.languages,
        extra: cvUI.extra, prompt: cvUI.prompt
    };
    Object.keys(map).forEach(function(key) { if (map[key]) map[key].value = f[key] || ''; });
    if (cvUI.language) cvUI.language.value = f.language || 'العربية';
    if (cvUI.prompt) {
        cvUI.prompt.style.height = 'auto';
        cvUI.prompt.style.height = Math.min(cvUI.prompt.scrollHeight, 180) + 'px';
    }
}

function clearCVProfileImage() {
    cvState.profileImage = null;
    if (cvUI.profileFile) cvUI.profileFile.value = '';
    if (cvUI.profileThumb) cvUI.profileThumb.removeAttribute('src');
    if (cvUI.profileName) cvUI.profileName.textContent = '';
    cvUI.profilePreview?.classList.add('hidden');
}

function setCVProfileImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
        setCVStatus('اختر صورة PNG أو JPG أو WEBP للصورة الشخصية.', 'error');
        return;
    }
    if (file.size > 6 * 1024 * 1024) {
        setCVStatus('حجم الصورة كبير. اختر صورة أقل من 6MB.', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function() {
        cvState.profileImage = {
            name: file.name,
            path: 'assets/profile-photo.jpg',
            dataUrl: String(reader.result || '')
        };
        const activeProject = getActiveCVProject();
        if (activeProject) {
            activeProject.profileImage = Object.assign({}, cvState.profileImage);
            activeProject.updatedAt = Date.now();
            persistCVProjects();
        }
        if (cvUI.profileThumb) cvUI.profileThumb.src = cvState.profileImage.dataUrl;
        if (cvUI.profileName) cvUI.profileName.textContent = file.name + ' · سيصل للنموذج المسار ' + cvState.profileImage.path;
        cvUI.profilePreview?.classList.remove('hidden');
        setCVStatus('تم تجهيز الصورة محليًا. لن يُرسل ملف الصورة إلى النموذج؛ سيصله المسار فقط.', 'success');
    };
    reader.onerror = function() { setCVStatus('تعذر قراءة الصورة الشخصية.', 'error'); };
    reader.readAsDataURL(file);
}

function cvField(label, value) {
    const clean = String(value || '').trim();
    return clean ? label + ': ' + clean : '';
}

function buildCVGenerationPrompt(form) {
    const fields = [
        cvField('الاسم الكامل', form.fullName),
        cvField('المسمى الوظيفي المستهدف', form.jobTitle),
        cvField('تاريخ الازدياد', form.birthDate),
        cvField('العمر', form.age),
        cvField('البريد الإلكتروني', form.email),
        cvField('الهاتف', form.phone),
        cvField('الموقع', form.location),
        cvField('LinkedIn / Portfolio', form.links),
        cvField('النبذة المهنية', form.summary),
        cvField('الخبرات والوظائف السابقة', form.experience),
        cvField('الدراسة والشهادات الأكاديمية', form.education),
        cvField('الشهادات والدورات', form.certifications),
        cvField('المهارات', form.skills),
        cvField('اللغات', form.languages),
        cvField('معلومات إضافية', form.extra)
    ].filter(Boolean).join('\n\n');
    const photoRule = form.profilePhotoPath
        ? 'توجد صورة شخصية. استخدم هذا المسار حرفيًا داخل src للصورة: ' + form.profilePhotoPath + '. لا تطلب الصورة ولا تحولها إلى Base64 ولا تخترع رابطًا آخر.'
        : 'لا توجد صورة شخصية مرفقة؛ لا تضف صورة وهمية ولا صورة من الإنترنت.';
    return [
        'أنت مصمم سير ذاتية ومهندس واجهات محترف داخل AKLAKE.',
        'أنشئ سيرة ذاتية احترافية جدًا كوثيقة HTML واحدة كاملة تبدأ بـ <!DOCTYPE html> وتحتوي CSS داخل <style> ويمكن أن تحتوي JavaScript داخليًا عند الحاجة فقط.',
        'الوثيقة يجب أن تكون جاهزة للعرض والطباعة على A4، متجاوبة، نظيفة، سهلة القراءة، وتستخدم البيانات المقدمة فقط دون اختراع خبرات أو شهادات أو أرقام أو جهات عمل.',
        'اختر RTL تلقائيًا للعربية وLTR للغات الأخرى. اجعل التصميم مناسبًا للتوظيف واحترافيًا أكثر من كونه صفحة تسويق.',
        'مهم جدًا: أعد HTML فقط دون Markdown ودون ``` ودون شرح قبل أو بعد الكود.',
        photoRule,
        '',
        'لغة السيرة: ' + (form.language || 'العربية'),
        '',
        'تعليمات المستخدم:',
        form.prompt || 'أنشئ CV احترافيًا اعتمادًا على المعلومات المتوفرة.',
        '',
        'معلومات السيرة:',
        fields || 'لم تُدخل معلومات إضافية غير الاسم.'
    ].join('\n');
}

function buildCVRevisionPrompt(instruction, currentHtml, form) {
    const photoRule = form.profilePhotoPath
        ? 'حافظ على مسار الصورة الشخصية حرفيًا: ' + form.profilePhotoPath + '.'
        : 'لا تضف صورة شخصية غير مقدمة.';
    return [
        'أنت تعدّل سيرة ذاتية HTML جاهزة داخل AKLAKE.',
        'نفّذ طلب التعديل المحدد فقط، وحافظ على جميع المعلومات الصحيحة وبقية التصميم والروابط والوظائف التي لم يطلب المستخدم تغييرها.',
        'لا تخترع بيانات مهنية أو شهادات أو أرقامًا جديدة.',
        photoRule,
        'أعد وثيقة HTML كاملة فقط دون Markdown ودون شرح.',
        '',
        'طلب التعديل:',
        instruction,
        '',
        'HTML الحالي:',
        currentHtml
    ].join('\n');
}

function cleanCVHtml(raw) {
    let html = String(raw || '').trim();
    const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenced) html = fenced[1].trim();
    const doctypeIndex = html.search(/<!doctype\s+html/i);
    const htmlIndex = html.search(/<html\b/i);
    const start = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
    if (start > 0) html = html.slice(start);
    const end = html.toLowerCase().lastIndexOf('</html>');
    if (end >= 0) html = html.slice(0, end + 7);
    return html.trim();
}

function validateCVHtml(raw) {
    const html = cleanCVHtml(raw);
    if (!html || !/<html\b/i.test(html) || !/<body\b/i.test(html)) {
        return { valid: false, html: '', error: 'رد النموذج لا يحتوي على وثيقة HTML كاملة للسيرة الذاتية.' };
    }
    if (/id\s*=\s*["'](?:app-shell|main-inputs-wrapper|cv-builder-studio)["']/i.test(html)) {
        return { valid: false, html: '', error: 'تم منع النتيجة لأنها أعادت واجهة AKLAKE بدل السيرة الذاتية.' };
    }
    return { valid: true, html: html, error: '' };
}

function hydrateCVPhoto(html, project) {
    let output = String(html || '');
    const photo = project?.profileImage || cvState.profileImage;
    if (!photo?.path || !photo?.dataUrl) return output;
    return output.split(photo.path).join(photo.dataUrl);
}

function extractCVHtml(responseData) {
    if (!responseData) return '';
    const candidate = responseData.data || responseData.html || responseData.code || responseData.content || responseData.output || responseData.result || '';
    const value = candidate && typeof candidate === 'object'
        ? (candidate.html || candidate.code || candidate.content || candidate.output || '')
        : candidate;
    const validation = validateCVHtml(value);
    if (!validation.valid) throw new Error(validation.error);
    return validation.html;
}

async function requestCVFromFirstFunction(mode, form, instruction, currentHtml) {
    if (!currentUser) {
        alert('يرجى تسجيل الدخول أولاً. ستبقى المعلومات التي كتبتها في مكانها.');
        openModal();
        return null;
    }
    ui.source.value = FIRST_FUNCTION_ID;
    const prompt = mode === 'revise'
        ? buildCVRevisionPrompt(instruction, currentHtml, form)
        : buildCVGenerationPrompt(form);
    const payload = {
        userId: currentUser.$id,
        action: 'legacy_chat',
        mode: 'text',
        prompt: prompt,
        provider: cvState.provider,
        model: cvState.model,
        modelTier: cvState.model,
        cvRequest: true
    };
    const execution = await appwriteFunctions.createExecution(
        FIRST_FUNCTION_ID,
        JSON.stringify(payload),
        false,
        '/',
        'POST',
        { 'Content-Type': 'application/json' }
    );
    let data = null;
    try { data = execution.responseBody ? JSON.parse(execution.responseBody) : null; }
    catch (_) { throw new Error('رد الكود الوظيفي الأول ليس JSON صالحًا.'); }
    if (execution.status === 'failed' || Number(execution.responseStatusCode || 200) >= 400 || data?.success === false) {
        throw new Error(data?.error || execution.errors || 'تعذر إنشاء السيرة عبر الكود الوظيفي الأول.');
    }
    return data || {};
}

function appendCVUserMessage(message, hasPhoto) {
    if (!cvUI.conversation) return;
    const row = document.createElement('div');
    row.className = 'message-row user-message landing-user-message';
    row.dataset.cvDynamic = 'true';
    row.innerHTML = '<div class="message-avatar"><i class="far fa-user"></i></div><div class="message-content"><div class="message-bubble"></div>' +
        (hasPhoto ? '<div class="message-source"><i class="far fa-image"></i> صورة شخصية مرفقة كمسار</div>' : '') + '</div>';
    row.querySelector('.message-bubble').textContent = message;
    cvUI.conversation.insertBefore(row, cvUI.generationCard || null);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function clearCVDynamicMessages() {
    cvUI.conversation?.querySelectorAll('[data-cv-dynamic="true"]').forEach(function(row) { row.remove(); });
}

function showCVGeneration(visible, name, label) {
    cvUI.generationCard?.classList.toggle('hidden', !visible);
    if (!visible) return;
    cvUI.completeCard?.classList.add('hidden');
    if (cvUI.progressName) cvUI.progressName.textContent = name || 'السيرة الجديدة';
    if (cvUI.progressModel) cvUI.progressModel.textContent = (label || 'إنشاء CV') + ' · ' + (CV_MODEL_INFO[cvState.provider + ':' + cvState.model]?.label || cvState.model) + ' · الكود 1';
    cvUI.generationCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showCVComplete(name, shouldScroll) {
    showCVGeneration(false);
    if (cvUI.completeTitle) cvUI.completeTitle.textContent = name || getActiveCVProject()?.title || 'CV جاهز';
    cvUI.completeCard?.classList.remove('hidden');
    if (shouldScroll !== false) cvUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function saveCVVersion(html, label, form, operation) {
    const validation = validateCVHtml(html);
    if (!validation.valid) throw new Error(validation.error);
    const now = Date.now();
    let project = getActiveCVProject();
    if (!project) {
        project = {
            id: createCVId('cv'),
            title: form.fullName || 'CV جديد',
            createdAt: now,
            updatedAt: now,
            form: {},
            profileImage: null,
            versions: []
        };
        cvState.projects.unshift(project);
        cvState.activeProjectId = project.id;
    }
    project.title = form.fullName || project.title || 'CV جديد';
    project.form = Object.assign({}, form, { prompt: form.prompt || project.form?.prompt || '' });
    if (cvState.profileImage) project.profileImage = Object.assign({}, cvState.profileImage);
    project.updatedAt = now;
    project.versions = Array.isArray(project.versions) ? project.versions : [];
    project.versions.push({
        id: createCVId('cv-version'),
        html: validation.html,
        label: label || 'نسخة جديدة',
        operation: operation || 'generate',
        instruction: operation === 'revise' ? (label || '') : (form.prompt || ''),
        createdAt: now
    });
    if (project.versions.length > CV_MAX_VERSIONS) project.versions = project.versions.slice(-CV_MAX_VERSIONS);
    cvState.currentVersionIndex = project.versions.length - 1;
    persistCVProjects();
    renderCVProjects();
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
    return project;
}

function renderCVProjects() {
    if (!cvUI.projectsList) return;
    cvUI.projectsList.innerHTML = '';
    if (!cvState.projects.length) {
        cvUI.projectsList.innerHTML = '<div class="landing-empty-projects"><i class="far fa-id-card"></i><span>لا توجد سير محفوظة بعد.</span></div>';
        return;
    }
    cvState.projects.forEach(function(project) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'landing-project-card' + (project.id === cvState.activeProjectId ? ' active' : '');
        const count = Array.isArray(project.versions) ? project.versions.length : 0;
        button.innerHTML = '<span class="landing-project-icon"><i class="far fa-id-card"></i></span><span class="landing-project-copy"><strong></strong><small></small></span><span class="landing-project-count"></span>';
        button.querySelector('strong').textContent = project.title || 'CV بدون اسم';
        button.querySelector('small').textContent = new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleDateString('ar-MA');
        button.querySelector('.landing-project-count').textContent = count + ' نسخة';
        button.addEventListener('click', function() { openCVProject(project.id); });
        cvUI.projectsList.appendChild(button);
    });
}

function showCVView(viewName) {
    cvState.activeView = viewName === 'code' ? 'code' : 'preview';
    const showCode = cvState.activeView === 'code';
    cvUI.previewView?.classList.toggle('hidden', showCode);
    cvUI.codeView?.classList.toggle('hidden', !showCode);
    document.querySelectorAll('[data-cv-view]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.cvView === cvState.activeView);
    });
}

function setCVDevice(device) {
    const target = device === 'mobile' ? 'mobile' : 'desktop';
    if (cvUI.previewShell) cvUI.previewShell.dataset.device = target;
    document.querySelectorAll('[data-cv-device]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.cvDevice === target);
    });
}

function updateCVVersionNavigation() {
    const project = getActiveCVProject();
    const total = project?.versions?.length || 0;
    const current = total ? cvState.currentVersionIndex + 1 : 0;
    if (cvUI.versionLabel) cvUI.versionLabel.textContent = total ? 'النسخة ' + current + ' من ' + total : 'لا توجد نسخ';
    if (cvUI.prevVersionBtn) cvUI.prevVersionBtn.disabled = current <= 1;
    if (cvUI.nextVersionBtn) cvUI.nextVersionBtn.disabled = !total || current >= total;
}

function showCVVersion(version) {
    const validation = validateCVHtml(version?.html || '');
    const hasVersion = validation.valid;
    const project = getActiveCVProject();
    cvUI.emptyPreview?.classList.toggle('hidden', hasVersion);
    cvUI.previewShell?.classList.toggle('hidden', !hasVersion);
    cvUI.revisionPanel?.classList.toggle('hidden', !hasVersion);
    if (cvUI.previewFrame) cvUI.previewFrame.srcdoc = hasVersion ? hydrateCVPhoto(validation.html, project) : '';
    if (cvUI.codeEditor) cvUI.codeEditor.value = hasVersion ? validation.html : '';
    if (hasVersion) showCVComplete(project?.title, false);
    else cvUI.completeCard?.classList.add('hidden');
    updateCVVersionNavigation();
}

function syncCVWorkspaceLayout() {
    const active = Boolean(cvState.previewOpen && ui?.action?.value === 'cv_builder');
    ui?.appShell?.classList.toggle('landing-preview-layout', active);
    cvUI.studio?.classList.toggle('is-preview-mode', active);
    cvUI.studio?.classList.toggle('is-chat-collapsed', active && cvState.chatCollapsed);
    document.body.classList.toggle('cv-preview-open', active);
    if (cvUI.closeChatBtn) {
        cvUI.closeChatBtn.setAttribute('aria-hidden', String(!active));
        cvUI.closeChatBtn.tabIndex = active ? 0 : -1;
    }
}

function setCVPreviewOpen(open) {
    cvState.previewOpen = Boolean(open);
    cvUI.output?.classList.toggle('hidden', !cvState.previewOpen);
    if (cvState.previewOpen) {
        cvState.chatCollapsed = false;
        showCVView('preview');
    } else {
        cvState.chatCollapsed = false;
    }
    syncCVWorkspaceLayout();
}

function collapseCVChatPanel() {
    if (!cvState.previewOpen) return false;
    cvState.chatCollapsed = true;
    syncCVWorkspaceLayout();
    return true;
}

window.restoreCVChatPanel = function() {
    if (!cvState.previewOpen || !cvState.chatCollapsed) return false;
    cvState.chatCollapsed = false;
    syncCVWorkspaceLayout();
    requestAnimationFrame(function() { cvUI.prompt?.focus(); });
    return true;
};
window.closeCVPreviewWorkspace = function() { setCVPreviewOpen(false); };

function startNewCVProject() {
    cvState.activeProjectId = null;
    cvState.currentVersionIndex = -1;
    cvState.profileImage = null;
    fillCVForm({ language: 'العربية' });
    clearCVProfileImage();
    clearCVDynamicMessages();
    showCVGeneration(false);
    cvUI.completeCard?.classList.add('hidden');
    setCVPreviewOpen(false);
    setCVAssistantOpen(false);
    setCVProjectsOpen(false);
    setCVStatus('', '');
    renderCVProjects();
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
    requestAnimationFrame(function() { cvUI.fullName?.focus(); });
}

function openCVProject(projectId, versionId) {
    const project = cvState.projects.find(function(item) { return item.id === projectId; });
    if (!project) return;
    cvState.activeProjectId = project.id;
    fillCVForm(project.form || {});
    cvState.profileImage = project.profileImage ? Object.assign({}, project.profileImage) : null;
    if (cvState.profileImage?.dataUrl) {
        if (cvUI.profileThumb) cvUI.profileThumb.src = cvState.profileImage.dataUrl;
        if (cvUI.profileName) cvUI.profileName.textContent = cvState.profileImage.name || cvState.profileImage.path;
        cvUI.profilePreview?.classList.remove('hidden');
    } else clearCVProfileImage();
    const versions = project.versions || [];
    let index = versionId ? versions.findIndex(function(v) { return v.id === versionId; }) : versions.length - 1;
    if (index < 0) index = Math.max(0, versions.length - 1);
    cvState.currentVersionIndex = versions.length ? index : -1;
    clearCVDynamicMessages();
    showCVVersion(versions[index] || null);
    setCVPreviewOpen(Boolean(versions[index]?.html));
    renderCVProjects();
    setCVProjectsOpen(false);
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
}
window.openCVProject = openCVProject;

function moveCVVersion(direction) {
    const project = getActiveCVProject();
    if (!project?.versions?.length) return;
    const next = cvState.currentVersionIndex + direction;
    if (next < 0 || next >= project.versions.length) return;
    cvState.currentVersionIndex = next;
    showCVVersion(project.versions[next]);
    setCVStatus('تم فتح ' + (project.versions[next].label || 'نسخة محفوظة') + '.', 'info');
}

async function generateCV() {
    if (cvState.busy) return;
    const activeProject = getActiveCVProject();
    const activeVersion = activeProject?.versions?.[cvState.currentVersionIndex];
    const currentPrompt = cvUI.prompt?.value.trim() || '';
    if (cvState.previewOpen && activeVersion?.html) {
        if (!currentPrompt) {
            setCVStatus('اكتب التعديل المطلوب على السيرة الحالية.', 'error');
            cvUI.prompt?.focus();
            return;
        }
        if (cvUI.revisionPrompt) cvUI.revisionPrompt.value = currentPrompt;
        if (cvUI.prompt) { cvUI.prompt.value = ''; cvUI.prompt.style.height = 'auto'; }
        return reviseCV();
    }
    const form = collectCVForm();
    const required = cvUI.fullName?.closest('.landing-required-name');
    required?.classList.remove('has-error');
    if (!form.fullName) {
        required?.classList.add('has-error');
        setCVStatus('أدخل الاسم الكامل أولاً.', 'error');
        cvUI.fullName?.focus();
        return;
    }
    const hasUsefulDetails = [form.jobTitle, form.summary, form.experience, form.education, form.skills, form.prompt].some(Boolean);
    if (!hasUsefulDetails) {
        setCVStatus('أضف وصفًا أو بعض الخبرات/الدراسة/المهارات حتى تكون السيرة مفيدة.', 'error');
        cvUI.prompt?.focus();
        return;
    }
    appendCVUserMessage(form.prompt || 'أنشئ سيرة ذاتية احترافية من المعلومات التي أدخلتها.', Boolean(cvState.profileImage));
    setCVPreviewOpen(false);
    showCVGeneration(true, form.fullName, 'إنشاء السيرة');
    setCVAssistantOpen(false);
    setCVModelPopoverOpen(false);
    setCVBusy(true, 'النموذج يصمم السيرة عبر الكود الوظيفي الأول...');
    try {
        const response = await requestCVFromFirstFunction('generate', form, '', '');
        if (!response) { showCVGeneration(false); return; }
        const html = extractCVHtml(response);
        saveCVVersion(html, 'النسخة الأولى', form, 'generate');
        if (response.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(response.remainingTokens);
        showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
        showCVComplete(form.fullName);
        setCVStatus('تم إنشاء السيرة وحفظ النسخة الأولى. يمكنك معاينتها أو طلب تعديل جديد.', 'success');
        if (cvUI.prompt) { cvUI.prompt.value = ''; cvUI.prompt.style.height = 'auto'; }
    } catch (error) {
        showCVGeneration(false);
        setCVStatus(error.message || 'تعذر إنشاء السيرة الذاتية.', 'error');
    } finally {
        setCVBusy(false);
    }
}

async function reviseCV() {
    if (cvState.busy) return;
    const project = getActiveCVProject();
    const version = project?.versions?.[cvState.currentVersionIndex];
    const instruction = cvUI.revisionPrompt?.value.trim() || '';
    if (!version?.html) return setCVStatus('أنشئ سيرة أولاً قبل طلب التعديل.', 'error');
    if (!instruction) {
        setCVStatus('اكتب التعديل المطلوب بوضوح.', 'error');
        cvUI.revisionPrompt?.focus();
        return;
    }
    const form = Object.assign({}, project.form || collectCVForm());
    form.profilePhotoPath = project.profileImage?.path || cvState.profileImage?.path || '';
    appendCVUserMessage(instruction, false);
    showCVGeneration(true, project.title, 'تعديل السيرة');
    setCVBusy(true, 'يتم تعديل السيرة مع الحفاظ على بقية المعلومات...');
    try {
        const response = await requestCVFromFirstFunction('revise', form, instruction, version.html);
        if (!response) { showCVGeneration(false); return; }
        const html = extractCVHtml(response);
        saveCVVersion(html, 'تعديل: ' + instruction.slice(0, 55), form, 'revise');
        if (response.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(response.remainingTokens);
        if (cvUI.revisionPrompt) cvUI.revisionPrompt.value = '';
        setCVPreviewOpen(true);
        showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
        showCVComplete(project.title, false);
        setCVStatus('تم حفظ التعديل كنسخة جديدة، والنسخة السابقة ما زالت متاحة.', 'success');
    } catch (error) {
        showCVGeneration(false);
        setCVStatus(error.message || 'تعذر تعديل السيرة.', 'error');
    } finally {
        setCVBusy(false);
    }
}

function applyCVCodeManually() {
    const validation = validateCVHtml(cvUI.codeEditor?.value || '');
    if (!validation.valid) return setCVStatus(validation.error, 'error');
    const project = getActiveCVProject();
    const form = project?.form || collectCVForm();
    saveCVVersion(validation.html, 'تعديل يدوي على الكود', form, 'manual');
    showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
    showCVView('preview');
    setCVStatus('تم تطبيق الكود وحفظه كنسخة جديدة.', 'success');
}

async function copyCVCode() {
    const project = getActiveCVProject();
    const code = hydrateCVPhoto(cvUI.codeEditor?.value || '', project);
    if (!code) return setCVStatus('لا يوجد كود لنسخه بعد.', 'error');
    try { await navigator.clipboard.writeText(code); }
    catch (_) {
        cvUI.codeEditor?.focus();
        cvUI.codeEditor?.select();
        document.execCommand('copy');
    }
    setCVStatus('تم نسخ كود السيرة، متضمنًا الصورة محليًا عند وجودها.', 'success');
}

function downloadCVCode() {
    const project = getActiveCVProject();
    const code = hydrateCVPhoto(cvUI.codeEditor?.value || '', project);
    if (!code) return setCVStatus('لا يوجد CV لتنزيله بعد.', 'error');
    const safeName = (project?.title || 'aklake-cv').replace(/[^\w\u0600-\u06FF-]+/g, '-').replace(/^-+|-+$/g, '') || 'aklake-cv';
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName + '-cv.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    setCVStatus('تم تجهيز ملف HTML للسيرة الذاتية.', 'success');
}

function initCVStudio() {
    cacheCVUI();
    if (!cvUI.studio || cvUI.studio.dataset.initialized === 'true') return;
    cvUI.studio.dataset.initialized = 'true';
    loadCVProjects();

    cvUI.newProjectBtn?.addEventListener('click', startNewCVProject);
    cvUI.closeChatBtn?.addEventListener('click', collapseCVChatPanel);
    cvUI.projectsToggle?.addEventListener('click', function() { setCVProjectsOpen(cvUI.projectsPanel?.classList.contains('hidden')); });
    cvUI.assistantToggle?.addEventListener('click', function() { setCVAssistantOpen(cvUI.assistantPanel?.classList.contains('hidden')); });
    cvUI.attachBtn?.addEventListener('click', function() { cvUI.profileFile?.click(); });
    cvUI.profileFile?.addEventListener('change', function() { if (cvUI.profileFile.files?.[0]) setCVProfileImage(cvUI.profileFile.files[0]); });
    cvUI.removeProfileBtn?.addEventListener('click', clearCVProfileImage);
    cvUI.fullName?.addEventListener('input', function() { cvUI.fullName.closest('.landing-required-name')?.classList.remove('has-error'); });
    cvUI.modelToggle?.addEventListener('click', function() { setCVModelPopoverOpen(cvUI.modelPopover?.classList.contains('hidden')); });
    cvUI.closeModelBtn?.addEventListener('click', function() { setCVModelPopoverOpen(false); });
    cvUI.modelCards?.querySelectorAll('[data-cv-model]').forEach(function(card) {
        card.addEventListener('click', function() { setCVPendingModel(card.dataset.cvProvider + ':' + card.dataset.cvModel); });
    });
    cvUI.rememberModelToggle?.addEventListener('change', updateCVRememberIcon);
    cvUI.confirmModelBtn?.addEventListener('click', confirmCVModelChoice);
    cvUI.generateBtn?.addEventListener('click', generateCV);
    cvUI.openResultBtn?.addEventListener('click', function() { setCVPreviewOpen(true); });
    cvUI.closePreviewBtn?.addEventListener('click', function() { setCVPreviewOpen(false); cvUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    cvUI.reviseBtn?.addEventListener('click', reviseCV);
    cvUI.applyCodeBtn?.addEventListener('click', applyCVCodeManually);
    cvUI.copyBtn?.addEventListener('click', copyCVCode);
    cvUI.downloadBtn?.addEventListener('click', downloadCVCode);
    cvUI.prevVersionBtn?.addEventListener('click', function() { moveCVVersion(-1); });
    cvUI.nextVersionBtn?.addEventListener('click', function() { moveCVVersion(1); });

    document.querySelectorAll('[data-cv-view]').forEach(function(button) {
        button.addEventListener('click', function() { showCVView(button.dataset.cvView); });
    });
    document.querySelectorAll('[data-cv-device]').forEach(function(button) {
        button.addEventListener('click', function() { setCVDevice(button.dataset.cvDevice); });
    });
    cvUI.prompt?.addEventListener('input', function() {
        cvUI.prompt.style.height = 'auto';
        cvUI.prompt.style.height = Math.min(cvUI.prompt.scrollHeight, 180) + 'px';
    });
    cvUI.prompt?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); generateCV(); }
    });
    cvUI.revisionPrompt?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); reviseCV(); }
    });

    const remembered = readCVRememberedModel();
    applyCVModel(remembered || CV_MODEL_INFO['openai:gpt-4.1-mini']);
    if (cvUI.rememberModelToggle) cvUI.rememberModelToggle.checked = Boolean(remembered);
    updateCVRememberIcon();
    setCVAssistantOpen(false);
    setCVProjectsOpen(false);
    setCVModelPopoverOpen(false);
    setCVPreviewOpen(false);
    renderCVProjects();
    startNewCVProject();
}
window.initCVStudio = initCVStudio;



// ==========================================
// منشئ المواقع — مشروع متعدد الملفات عبر الكود الوظيفي الأول
// ==========================================
const WEBSITE_MODEL_MEMORY_KEY = 'aklake_website_builder_model_v1';
const websiteState = {
    initialized: false,
    busy: false,
    provider: 'openai',
    model: 'gpt-5.4-mini',
    points: 10,
    project: null,
    activeFilePath: '',
    changedFiles: [],
    referenceAttachment: null,
    assets: [],
    activeAssetPath: '',
    previewOpen: false,
    chatCollapsed: false,
    activeView: 'preview',
    revising: false,
    versions: [],
    activeVersionId: '',
    versionSequence: 0,
    previewRenderToken: '',
    previewRuntimeErrors: []
};

const WEBSITE_MODEL_INFO = {
    'cloudflare:llama': { provider: 'cloudflare', model: 'llama', points: 5, label: 'LLaMA 3.3' },
    'openai:gpt-4o': { provider: 'openai', model: 'gpt-4o', points: 8, label: 'GPT-4o' },
    'openai:gpt-5.4-mini': { provider: 'openai', model: 'gpt-5.4-mini', points: 10, label: 'GPT-5.4 mini' },
    'openai:gpt-5.5': { provider: 'openai', model: 'gpt-5.5', points: 15, label: 'GPT-5.5' }
};

function getWebsiteUI() {
    return {
        studio: document.getElementById('website-builder-studio'),
        conversation: document.getElementById('website-conversation'),
        generationCard: document.getElementById('website-generation-card'),
        completeCard: document.getElementById('website-complete-card'),
        completeTitle: document.getElementById('website-complete-title'),
        completeMeta: document.getElementById('website-complete-meta'),
        progressModel: document.getElementById('website-progress-model'),
        progressTitle: document.getElementById('website-progress-title'),
        output: document.getElementById('website-output-panel'),
        outputStage: document.querySelector('#website-output-panel .website-output-stage'),
        revisionOverlay: document.getElementById('website-revision-overlay'),
        previewView: document.getElementById('website-preview-view'),
        filesView: document.getElementById('website-files-view'),
        previewShell: document.getElementById('website-preview-shell'),
        previewFrame: document.getElementById('website-preview-frame'),
        previewDiagnostics: document.getElementById('website-preview-diagnostics'),
        previewHealthHtml: document.getElementById('website-preview-health-html'),
        previewHealthCss: document.getElementById('website-preview-health-css'),
        previewHealthJs: document.getElementById('website-preview-health-js'),
        previewRuntimeMessage: document.getElementById('website-preview-runtime-message'),
        previewErrorLog: document.getElementById('website-preview-error-log'),
        fileTree: document.getElementById('website-file-tree'),
        activeFilePath: document.getElementById('website-active-file-path'),
        activeFileLanguage: document.getElementById('website-active-file-language'),
        codeEditor: document.getElementById('website-code-editor'),
        prompt: document.getElementById('website-main-prompt'),
        generateBtn: document.getElementById('website-generate-btn'),
        attachBtn: document.getElementById('website-attach-btn'),
        referenceFile: document.getElementById('website-reference-file'),
        assetsTray: document.getElementById('website-assets-tray'),
        assetsList: document.getElementById('website-assets-list'),
        assetsCount: document.getElementById('website-assets-count'),
        modelToggle: document.getElementById('website-model-toggle'),
        modelPopover: document.getElementById('website-model-popover'),
        modelCards: document.getElementById('website-model-cards'),
        activeModel: document.getElementById('website-active-model'),
        generateCost: document.getElementById('website-generate-cost'),
        rememberModelToggle: document.getElementById('website-remember-model-toggle'),
        rememberIcon: document.querySelector('.website-remember-toggle-icon'),
        confirmModelBtn: document.getElementById('website-confirm-model-btn'),
        closeModelBtn: document.getElementById('website-close-model-btn'),
        status: document.getElementById('website-status'),
        newProjectBtn: document.getElementById('website-new-project-btn'),
        openResultBtn: document.getElementById('website-open-result-btn'),
        closeChatBtn: document.getElementById('website-close-chat-btn'),
        closePreviewBtn: document.getElementById('website-close-preview-btn'),
        refreshPreviewBtn: document.getElementById('website-refresh-preview-btn'),
        openBrowserBtn: document.getElementById('website-open-browser-btn'),
        copyCodeBtn: document.getElementById('website-copy-code-btn'),
        downloadBtn: document.getElementById('website-download-btn'),
        applyCodeBtn: document.getElementById('website-apply-code-btn'),
        assetViewer: document.getElementById('website-asset-viewer'),
        assetPreview: document.getElementById('website-asset-preview'),
        activeAssetName: document.getElementById('website-active-asset-name'),
        activeAssetMeta: document.getElementById('website-active-asset-meta'),
        copyAssetPathBtn: document.getElementById('website-copy-asset-path-btn'),
        removeAssetBtn: document.getElementById('website-remove-asset-btn'),
        revisionPrompt: document.getElementById('website-revision-prompt'),
        reviseBtn: document.getElementById('website-revise-btn')
    };
}

function setWebsiteStatus(message, type) {
    const el = document.getElementById('website-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'website-status' + (type ? ' ' + type : '');
}

function setWebsiteBusy(value, label) {
    websiteState.busy = Boolean(value);
    const w = getWebsiteUI();
    [w.generateBtn, w.reviseBtn, w.applyCodeBtn, w.attachBtn].forEach(function(btn) { if (btn) btn.disabled = websiteState.busy; });
    [w.prompt, w.revisionPrompt].forEach(function(input) { if (input) input.disabled = websiteState.busy; });
    if (w.generateBtn) {
        w.generateBtn.classList.toggle('is-loading', websiteState.busy);
        w.generateBtn.innerHTML = websiteState.busy ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-arrow-up"></i>';
        w.generateBtn.setAttribute('aria-label', websiteState.busy ? (label || 'جاري الإنشاء...') : 'إرسال طلب إنشاء الموقع');
    }
    if (w.reviseBtn) {
        w.reviseBtn.classList.toggle('is-loading', websiteState.busy && websiteState.revising);
        w.reviseBtn.innerHTML = websiteState.busy && websiteState.revising
            ? '<i class="fas fa-spinner fa-spin"></i><span>يعدّل</span>'
            : '<i class="fas fa-arrow-up"></i><span>تعديل</span>';
    }
}

function setWebsiteRevisionLoading(value) {
    websiteState.revising = Boolean(value);
    const w = getWebsiteUI();
    w.studio?.classList.toggle('is-revising', websiteState.revising);
    w.output?.classList.toggle('is-revising', websiteState.revising);
    w.revisionOverlay?.classList.toggle('hidden', !websiteState.revising);
    w.revisionOverlay?.setAttribute('aria-hidden', String(!websiteState.revising));
}

function syncWebsiteWorkspaceLayout() {
    const w = getWebsiteUI();
    const active = Boolean(
        websiteState.previewOpen &&
        websiteState.project &&
        ui?.action?.value === 'website_builder'
    );

    ui?.appShell?.classList.toggle('website-preview-layout', active);
    w.studio?.classList.toggle('is-preview-mode', active);
    w.studio?.classList.toggle('is-chat-collapsed', active && websiteState.chatCollapsed);
    w.studio?.classList.toggle('is-revising', websiteState.revising);
    w.output?.classList.toggle('is-revising', websiteState.revising);
    w.revisionOverlay?.classList.toggle('hidden', !websiteState.revising);
    w.revisionOverlay?.setAttribute('aria-hidden', String(!websiteState.revising));
    document.body.classList.toggle('website-preview-open', active);

    if (w.closeChatBtn) {
        w.closeChatBtn.setAttribute('aria-hidden', String(!active));
        w.closeChatBtn.tabIndex = active ? 0 : -1;
    }
}

function openWebsitePreviewWorkspace(view) {
    if (!websiteState.project) {
        setWebsiteStatus('أنشئ موقعًا أولًا قبل فتح المعاينة.', 'error');
        return false;
    }
    const w = getWebsiteUI();
    websiteState.previewOpen = true;
    websiteState.chatCollapsed = false;
    websiteState.activeView = view === 'files' ? 'files' : 'preview';
    w.output?.classList.remove('hidden');
    showWebsiteView(websiteState.activeView);
    syncWebsiteWorkspaceLayout();
    requestAnimationFrame(function() { refreshWebsitePreview(); });
    return true;
}

function closeWebsitePreviewWorkspace() {
    const w = getWebsiteUI();
    websiteState.previewOpen = false;
    websiteState.chatCollapsed = false;
    w.output?.classList.add('hidden');
    syncWebsiteWorkspaceLayout();
}

function collapseWebsiteChatPanel() {
    if (!websiteState.previewOpen || !websiteState.project) return false;
    websiteState.chatCollapsed = true;
    syncWebsiteWorkspaceLayout();
    return true;
}

window.restoreWebsiteChatPanel = function() {
    if (!websiteState.previewOpen || !websiteState.chatCollapsed) return false;
    websiteState.chatCollapsed = false;
    syncWebsiteWorkspaceLayout();
    const w = getWebsiteUI();
    requestAnimationFrame(function() { w.prompt?.focus(); });
    return true;
};

window.closeWebsitePreviewWorkspace = closeWebsitePreviewWorkspace;

window.setWebsiteModelPopoverOpen = function(open) {
    const w = getWebsiteUI();
    const expanded = Boolean(open);
    w.modelPopover?.classList.toggle('hidden', !expanded);
    w.modelPopover?.setAttribute('aria-hidden', String(!expanded));
    w.modelToggle?.setAttribute('aria-expanded', String(expanded));
};

function syncWebsiteModelUI() {
    const w = getWebsiteUI();
    const key = websiteState.provider + ':' + websiteState.model;
    const info = WEBSITE_MODEL_INFO[key] || WEBSITE_MODEL_INFO['openai:gpt-5.4-mini'];
    websiteState.provider = info.provider;
    websiteState.model = info.model;
    websiteState.points = info.points;
    if (w.activeModel) w.activeModel.textContent = info.label;
    if (w.generateCost) w.generateCost.textContent = info.points + (info.points === 1 ? ' نقطة' : ' نقاط');
    w.modelCards?.querySelectorAll('[data-website-model]').forEach(function(card) {
        const selected = card.dataset.websiteProvider === info.provider && card.dataset.websiteModel === info.model;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    if (ui?.action?.value === 'website_builder') {
        ui.source.value = FIRST_FUNCTION_ID;
        ui.provider.value = info.provider;
        updateModels();
        ui.model.value = info.model;
    }
}

function restoreWebsiteModelChoice() {
    try {
        const saved = JSON.parse(localStorage.getItem(WEBSITE_MODEL_MEMORY_KEY) || 'null');
        const key = saved && saved.provider + ':' + saved.model;
        if (key && WEBSITE_MODEL_INFO[key]) {
            websiteState.provider = saved.provider;
            websiteState.model = saved.model;
            websiteState.points = WEBSITE_MODEL_INFO[key].points;
            const w = getWebsiteUI();
            if (w.rememberModelToggle) w.rememberModelToggle.checked = true;
            if (w.rememberIcon) { w.rememberIcon.classList.add('fa-toggle-on'); w.rememberIcon.classList.remove('fa-toggle-off'); }
        }
    } catch (error) {}
    syncWebsiteModelUI();
}

function safeWebsitePath(path) {
    const value = String(path || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!value || value.startsWith('/') || value.split('/').some(function(part) { return !part || part === '.' || part === '..'; })) return '';
    return value;
}

function ensureWebsiteIndexLinks(inputHtml) {
    let html = String(inputHtml || '').trim();
    html = html.replace(/href=(["'])(?:\.\/)?(?:styles\/)?style\.css\1/ig, 'href="style.css"');
    html = html.replace(/src=(["'])(?:\.\/)?(?:scripts\/)?app\.js\1/ig, 'src="app.js"');
    if (!/href=["']style\.css["']/i.test(html)) {
        const link = '\n<link rel="stylesheet" href="style.css">\n';
        html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, link + '</head>') : link + html;
    }
    if (!/src=["']app\.js["']/i.test(html)) {
        const script = '\n<script src="app.js" defer></script>\n';
        html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, script + '</body>') : html + script;
    }
    return html;
}

function normalizeWebsiteProject(candidate) {
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.files)) return null;

    function findFile(exactName, extensionRegex) {
        return candidate.files.find(function(file) {
            const path = safeWebsitePath(file?.path);
            return path && path.split('/').pop().toLowerCase() === exactName.toLowerCase();
        }) || candidate.files.find(function(file) {
            return extensionRegex.test(safeWebsitePath(file?.path));
        }) || null;
    }

    const htmlFile = findFile('index.html', /\.html?$/i);
    const cssFile = findFile('style.css', /\.css$/i);
    const jsFile = findFile('app.js', /\.(?:js|mjs)$/i);
    if (!htmlFile || !cssFile || !jsFile) return null;

    const html = ensureWebsiteIndexLinks(String(htmlFile.content ?? ''));
    const css = String(cssFile.content ?? '').trim();
    const js = String(jsFile.content ?? '').trim();

    if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) return null;
    if (!css || !js) return null;

    return {
        name: String(candidate.name || 'aklake-website').slice(0, 80),
        entry: 'index.html',
        files: [
            { path: 'index.html', content: html },
            { path: 'style.css', content: css },
            { path: 'app.js', content: js }
        ]
    };
}

function fencedTextToWebsiteProject(value) {
    if (typeof value !== 'string') return null;

    const blocks = [];
    const regex = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
        const rawInfo = String(match[1] || '').trim().replace(/\*/g, '').toLowerCase();
        const first = rawInfo.split(/\s+/).filter(Boolean)[0] || '';
        let type = '';

        if (['html', 'htm'].includes(first) || /\.html?$/.test(first) || rawInfo.includes('index.html')) type = 'html';
        else if (first === 'css' || /\.css$/.test(first) || rawInfo.includes('style.css')) type = 'css';
        else if (['javascript', 'js', 'mjs', 'ecmascript'].includes(first) || /\.(?:js|mjs)$/.test(first) || rawInfo.includes('app.js')) type = 'js';

        blocks.push({
            type,
            content: String(match[2] || '').replace(/\s+$/, '')
        });
    }

    let html = blocks.find(function(block) { return block.type === 'html'; }) || null;
    let css = blocks.find(function(block) { return block.type === 'css'; }) || null;
    let js = blocks.find(function(block) { return block.type === 'js'; }) || null;

    if ((!html || !css || !js) && blocks.length === 3) {
        html = html || blocks[0];
        css = css || blocks[1];
        js = js || blocks[2];
    }

    if (!html || !css || !js) return null;
    if (!html.content.trim() || !css.content.trim() || !js.content.trim()) return null;

    return normalizeWebsiteProject({
        name: 'aklake-website',
        files: [
            { path: 'index.html', content: html.content },
            { path: 'style.css', content: css.content },
            { path: 'app.js', content: js.content }
        ]
    });
}

function legacyHtmlToWebsiteProject(value) {
    if (typeof value !== 'string') return null;

    let html = value.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
    const start = html.search(/<!doctype\s+html|<html[\s>]/i);
    if (start < 0 || !/<body[\s>]/i.test(html)) return null;
    if (start > 0) html = html.slice(start);

    const cssParts = [];
    html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, function(_all, css) {
        const clean = String(css || '').trim();
        if (clean) cssParts.push(clean);
        return '';
    });

    const jsParts = [];
    html = html.replace(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi, function(_all, js) {
        const clean = String(js || '').trim();
        if (clean) jsParts.push(clean);
        return '';
    });

    // لا نصنع style.css أو app.js وهميين إذا لم يرسلهما النموذج.
    if (!cssParts.length || !jsParts.length) return null;

    return normalizeWebsiteProject({
        name: 'aklake-website',
        files: [
            { path: 'index.html', content: ensureWebsiteIndexLinks(html) },
            { path: 'style.css', content: cssParts.join('\n\n') },
            { path: 'app.js', content: jsParts.join('\n\n') }
        ]
    });
}

function extractWebsiteProject(responseData) {
    const candidate = responseData?.data ?? responseData?.project ?? responseData?.content ?? responseData?.result;
    const structured = normalizeWebsiteProject(candidate);
    if (structured) return structured;

    if (typeof candidate === 'string') {
        const fenced = fencedTextToWebsiteProject(candidate);
        if (fenced) return fenced;
        const legacy = legacyHtmlToWebsiteProject(candidate);
        if (legacy) return legacy;
    }

    throw new Error('لم يتم استلام ثلاثة ملفات حقيقية منفصلة. يجب أن يحتوي الرد على ```html و ```css و ```javascript، وكل ملف غير فارغ.');
}

function getWebsiteFile(path) {
    if (!websiteState.project) return null;
    return websiteState.project.files.find(function(file) { return file.path === path; }) || null;
}

function getWebsiteLanguage(path) {
    const ext = String(path || '').split('.').pop().toLowerCase();
    const names = { html: 'HTML', htm: 'HTML', css: 'CSS', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', json: 'JSON', svg: 'SVG', md: 'Markdown', txt: 'Text' };
    return names[ext] || ext.toUpperCase() || 'Text';
}

function normalizeWebsiteAssetPath(value) {
    try { value = decodeURIComponent(String(value || '')); } catch (error) {}
    return safeWebsitePath(value.split('#')[0].split('?')[0].replace(/^\.\//, ''));
}

function escapeWebsiteInlineScript(value) {
    return String(value || '').replace(/<\/script/gi, '<\\/script');
}

const WEBSITE_ASSET_MAX_BYTES = 15 * 1024 * 1024;
const WEBSITE_ASSET_TOTAL_MAX_BYTES = 50 * 1024 * 1024;

function sanitizeWebsiteAssetFileName(name) {
    const raw = String(name || 'asset').trim().replace(/\\/g, '/').split('/').pop() || 'asset';
    const dot = raw.lastIndexOf('.');
    const base = (dot > 0 ? raw.slice(0, dot) : raw)
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'asset';
    const ext = dot > 0 ? raw.slice(dot + 1).replace(/[^A-Za-z0-9]+/g, '').slice(0, 12).toLowerCase() : '';
    return base + (ext ? '.' + ext : '');
}

function createUniqueWebsiteAssetPath(name) {
    const safeName = sanitizeWebsiteAssetFileName(name);
    const dot = safeName.lastIndexOf('.');
    const base = dot > 0 ? safeName.slice(0, dot) : safeName;
    const ext = dot > 0 ? safeName.slice(dot) : '';
    let path = 'assets/' + safeName;
    let counter = 2;
    const used = new Set(websiteState.assets.map(function(asset) { return asset.path; }));
    while (used.has(path)) {
        path = 'assets/' + base + '-' + counter + ext;
        counter += 1;
    }
    return path;
}

function formatWebsiteAssetSize(bytes) {
    const size = Number(bytes || 0);
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(size < 10 * 1024 ? 1 : 0) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

function getWebsiteAsset(path) {
    return websiteState.assets.find(function(asset) { return asset.path === path; }) || null;
}

function getWebsiteAssetIcon(asset) {
    const type = String(asset?.mimeType || '');
    if (/^image\//i.test(type)) return 'far fa-image';
    if (/^audio\//i.test(type)) return 'fas fa-wave-square';
    if (/^video\//i.test(type)) return 'fas fa-film';
    if (/pdf/i.test(type)) return 'far fa-file-pdf';
    return 'far fa-file';
}

function renderWebsiteAssetsTray() {
    const w = getWebsiteUI();
    const assets = websiteState.assets;
    w.assetsTray?.classList.toggle('hidden', !assets.length);
    if (w.assetsCount) w.assetsCount.textContent = assets.length + (assets.length === 1 ? ' ملف' : ' ملفات');
    if (!w.assetsList) return;
    w.assetsList.innerHTML = '';
    assets.forEach(function(asset) {
        const chip = document.createElement('div');
        chip.className = 'website-asset-chip';
        chip.innerHTML = '<i class="' + getWebsiteAssetIcon(asset) + '"></i><span></span><small></small><button type="button" aria-label="إزالة الملف"><i class="fas fa-xmark"></i></button>';
        chip.querySelector('span').textContent = asset.path;
        chip.querySelector('small').textContent = formatWebsiteAssetSize(asset.size);
        chip.querySelector('button').addEventListener('click', function() { removeWebsiteAsset(asset.path); });
        chip.addEventListener('click', function(event) {
            if (event.target.closest('button')) return;
            if (websiteState.project) {
                openWebsitePreviewWorkspace('files');
                selectWebsiteAsset(asset.path);
            }
        });
        w.assetsList.appendChild(chip);
    });
}

function appendWebsiteAssetPathsToPrompt(paths) {
    const w = getWebsiteUI();
    const target = websiteState.previewOpen && w.revisionPrompt ? w.revisionPrompt : w.prompt;
    if (!target || !paths.length) return;
    const missing = paths.filter(function(path) { return !target.value.includes(path); });
    if (!missing.length) return;
    const line = missing.length === 1
        ? 'استخدم ملف المشروع: ' + missing[0]
        : 'استخدم ملفات المشروع: ' + missing.join('، ');
    target.value = (target.value.trim() ? target.value.trimEnd() + '\n' : '') + line;
    autoResizeTextarea(target);
}

async function fileToWebsiteAsset(file) {
    if (!file) return null;
    if (file.size > WEBSITE_ASSET_MAX_BYTES) throw new Error('الملف ' + file.name + ' أكبر من 15MB.');
    const dataUrl = await new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('تعذر قراءة الملف.')); };
        reader.readAsDataURL(file);
    });
    return {
        id: 'asset-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        path: createUniqueWebsiteAssetPath(file.name),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: dataUrl
    };
}

async function addWebsiteAssets(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const currentBytes = websiteState.assets.reduce(function(total, asset) { return total + Number(asset.size || 0); }, 0);
    const incomingBytes = files.reduce(function(total, file) { return total + Number(file.size || 0); }, 0);
    if (currentBytes + incomingBytes > WEBSITE_ASSET_TOTAL_MAX_BYTES) {
        throw new Error('إجمالي ملفات assets يتجاوز 50MB. احذف بعض الملفات أو استخدم ملفات أصغر.');
    }
    const added = [];
    for (const file of files) {
        const asset = await fileToWebsiteAsset(file);
        if (asset) {
            websiteState.assets.push(asset);
            added.push(asset.path);
        }
    }
    renderWebsiteAssetsTray();
    renderWebsiteFileTree();
    appendWebsiteAssetPathsToPrompt(added);
    if (websiteState.project) refreshWebsitePreview();
    setWebsiteStatus('تمت إضافة ' + added.length + ' من ملفات المشروع داخل assets/. المسارات جاهزة للنموذج والمعاينة.', 'success');
}

function removeWebsiteAsset(path) {
    const index = websiteState.assets.findIndex(function(asset) { return asset.path === path; });
    if (index < 0) return;
    websiteState.assets.splice(index, 1);
    if (websiteState.activeAssetPath === path) {
        websiteState.activeAssetPath = '';
        const fallback = websiteState.activeFilePath || websiteState.project?.entry;
        if (fallback) selectWebsiteFile(fallback);
    }
    renderWebsiteAssetsTray();
    renderWebsiteFileTree();
    if (websiteState.project) refreshWebsitePreview();
    setWebsiteStatus('تمت إزالة ' + path + ' من أصول المشروع.', 'success');
}

function replaceWebsiteAssetReferences(value) {
    let output = String(value || '');
    websiteState.assets.forEach(function(asset) {
        if (!asset.path || !asset.dataUrl) return;
        const variants = ['./' + asset.path, asset.path];
        variants.forEach(function(path) {
            output = output.split(path).join(asset.dataUrl);
        });
    });
    return output;
}

function buildWebsiteAssetManifest() {
    return websiteState.assets.map(function(asset) {
        return { path: asset.path, name: asset.name, mimeType: asset.mimeType, size: asset.size };
    });
}

function selectWebsiteAsset(path) {
    const asset = getWebsiteAsset(path);
    if (!asset) return;
    websiteState.activeAssetPath = asset.path;
    websiteState.activeFilePath = '';
    const w = getWebsiteUI();
    if (w.activeFilePath) w.activeFilePath.textContent = asset.path;
    if (w.activeFileLanguage) w.activeFileLanguage.textContent = asset.mimeType || 'Asset';
    if (w.codeEditor) w.codeEditor.classList.add('hidden');
    w.applyCodeBtn?.classList.add('hidden');
    w.assetViewer?.classList.remove('hidden');
    if (w.activeAssetName) w.activeAssetName.textContent = asset.name || asset.path;
    if (w.activeAssetMeta) w.activeAssetMeta.textContent = asset.path + ' · ' + formatWebsiteAssetSize(asset.size) + ' · ' + (asset.mimeType || 'ملف');
    if (w.assetPreview) {
        w.assetPreview.innerHTML = '';
        let node;
        if (/^image\//i.test(asset.mimeType)) {
            node = document.createElement('img'); node.src = asset.dataUrl; node.alt = asset.name;
        } else if (/^audio\//i.test(asset.mimeType)) {
            node = document.createElement('audio'); node.src = asset.dataUrl; node.controls = true;
        } else if (/^video\//i.test(asset.mimeType)) {
            node = document.createElement('video'); node.src = asset.dataUrl; node.controls = true;
        } else {
            node = document.createElement('div'); node.className = 'website-asset-generic'; node.innerHTML = '<i class="' + getWebsiteAssetIcon(asset) + '"></i><strong></strong><small></small>';
            node.querySelector('strong').textContent = asset.name;
            node.querySelector('small').textContent = asset.mimeType || 'ملف مشروع';
        }
        w.assetPreview.appendChild(node);
    }
    renderWebsiteFileTree();
}

function buildWebsitePreviewBridge(renderToken) {
    const token = JSON.stringify(String(renderToken || ''));
    const bridge = `
(function () {
    var AKLAKE_TOKEN = ${token};
    var runtimeErrors = 0;
    function send(type, payload) {
        try {
            window.parent.postMessage(Object.assign({
                source: 'aklake-website-preview',
                token: AKLAKE_TOKEN,
                type: type
            }, payload || {}), '*');
        } catch (_) {}
    }
    function makeMemoryStorage() {
        var data = Object.create(null);
        return {
            get length() { return Object.keys(data).length; },
            key: function(index) { return Object.keys(data)[Number(index)] || null; },
            getItem: function(key) { key = String(key); return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
            setItem: function(key, value) { data[String(key)] = String(value); },
            removeItem: function(key) { delete data[String(key)]; },
            clear: function() { data = Object.create(null); }
        };
    }
    ['localStorage', 'sessionStorage'].forEach(function(name) {
        try {
            void window[name];
        } catch (_) {
            try { Object.defineProperty(window, name, { value: makeMemoryStorage(), configurable: true }); } catch (__) {}
        }
    });
    window.addEventListener('error', function(event) {
        if (!event || !event.message) return;
        runtimeErrors += 1;
        send('runtime-error', {
            message: String(event.message || 'JavaScript runtime error'),
            filename: String(event.filename || 'app.js'),
            line: Number(event.lineno || 0),
            column: Number(event.colno || 0)
        });
    });
    window.addEventListener('unhandledrejection', function(event) {
        runtimeErrors += 1;
        var reason = event && event.reason;
        send('runtime-error', {
            message: reason && reason.message ? String(reason.message) : String(reason || 'Unhandled promise rejection'),
            filename: 'app.js',
            line: 0,
            column: 0
        });
    });
    document.addEventListener('DOMContentLoaded', function() { send('dom-ready'); });
    window.addEventListener('load', function() { send('loaded', { runtimeErrors: runtimeErrors }); });
    send('boot');
})();`;
    return '<script data-aklake-preview-bridge>\n' + escapeWebsiteInlineScript(bridge) + '\n</script>';
}

function buildWebsitePreviewDocument(project, renderToken, options) {
    const previewOptions = options || {};
    const normalized = normalizeWebsiteProject(project);
    if (!normalized) return '';
    const entryFile = normalized.files.find(function(file) { return file.path === normalized.entry; });
    if (!entryFile) return '';
    const map = new Map(normalized.files.map(function(file) { return [file.path, file.content]; }));
    let html = replaceWebsiteAssetReferences(String(entryFile.content || ''));
    const usedCss = new Set();

    // srcdoc يعمل داخل sandbox آمن. أي CSP مولد داخل المشروع قد يمنع الأكواد المدمجة الخاصة بالمعاينة، لذلك نحذفه من نسخة المعاينة فقط.
    html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, function(full, before, href) {
        const path = normalizeWebsiteAssetPath(href);
        if (!path || !map.has(path) || !/\.css$/i.test(path)) return full;
        usedCss.add(path);
        return '<style data-aklake-file="' + path.replace(/"/g, '&quot;') + '">\n' + replaceWebsiteAssetReferences(map.get(path)) + '\n</style>';
    });

    // نحذف مراجع JavaScript المحلية من أماكنها الأصلية. وسم defer لا يعمل عند تحويل السكربت إلى inline،
    // لذلك نضع app.js في نهاية body، وهو سلوك مكافئ لملف خارجي مع defer من ناحية توفر عناصر DOM.
    html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, function(full, before, src) {
        const path = normalizeWebsiteAssetPath(src);
        if (!path || !map.has(path) || !/\.(?:js|mjs)$/i.test(path)) return full;
        return '<!-- AKLAKE_PREVIEW_SCRIPT_MOVED:' + path.replace(/-->/g, '') + ' -->';
    });

    const unusedCss = normalized.files.filter(function(file) { return /\.css$/i.test(file.path) && !usedCss.has(file.path); });
    if (unusedCss.length) {
        const styles = unusedCss.map(function(file) {
            return '<style data-aklake-file="' + file.path.replace(/"/g, '&quot;') + '">\n' + replaceWebsiteAssetReferences(file.content) + '\n</style>';
        }).join('\n');
        html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, styles + '\n</head>') : styles + html;
    }

    if (previewOptions.bridge !== false) {
        const bridge = buildWebsitePreviewBridge(renderToken);
        html = /<head\b[^>]*>/i.test(html)
            ? html.replace(/<head\b[^>]*>/i, function(head) { return head + '\n' + bridge; })
            : bridge + '\n' + html;
    }

    const scripts = normalized.files.filter(function(file) { return /\.(?:js|mjs)$/i.test(file.path); }).map(function(file) {
        return '<script data-aklake-file="' + file.path.replace(/"/g, '&quot;') + '">\n' +
            escapeWebsiteInlineScript(replaceWebsiteAssetReferences(String(file.content || ''))) +
            '\n//# sourceURL=' + file.path.replace(/[\r\n]/g, '') +
            '\n</script>';
    }).join('\n');

    html = /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, scripts + '\n</body>')
        : html + '\n' + scripts;

    return html;
}

function createWebsiteTreeNode(label, iconClass, className) {
    const row = document.createElement('div');
    row.className = className;
    const icon = document.createElement('i');
    icon.className = iconClass;
    const text = document.createElement('span');
    text.textContent = label;
    row.append(icon, text);
    return row;
}

function renderWebsiteFileTree() {
    const w = getWebsiteUI();
    if (!w.fileTree) return;
    w.fileTree.innerHTML = '';
    const project = websiteState.project;
    if (!project) return;

    const order = ['index.html', 'style.css', 'app.js'];
    order.forEach(function(path) {
        const file = project.files.find(function(item) { return item.path === path; });
        if (!file) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'website-tree-file';
        button.dataset.websiteFile = file.path;
        button.classList.toggle('active', file.path === websiteState.activeFilePath && !websiteState.activeAssetPath);
        button.classList.toggle('changed', websiteState.changedFiles.includes(file.path));

        const icon = document.createElement('i');
        icon.className = path === 'index.html'
            ? 'fab fa-html5'
            : (path === 'style.css' ? 'fab fa-css3-alt' : 'fab fa-js');

        const label = document.createElement('span');
        label.textContent = path;
        button.append(icon, label);
        button.addEventListener('click', function() { selectWebsiteFile(path); });
        w.fileTree.appendChild(button);
    });

    if (websiteState.assets.length) {
        const folder = createWebsiteTreeNode('assets', 'fas fa-folder-open', 'website-tree-folder');
        w.fileTree.appendChild(folder);
        websiteState.assets.forEach(function(asset) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'website-tree-file website-tree-asset';
            button.classList.toggle('active', asset.path === websiteState.activeAssetPath);
            const icon = document.createElement('i');
            icon.className = getWebsiteAssetIcon(asset);
            const label = document.createElement('span');
            label.textContent = asset.path.replace(/^assets\//, '');
            button.append(icon, label);
            button.addEventListener('click', function() { selectWebsiteAsset(asset.path); });
            w.fileTree.appendChild(button);
        });
    }
}

function selectWebsiteFile(path) {
    const file = getWebsiteFile(path);
    if (!file) return;
    websiteState.activeFilePath = file.path;
    websiteState.activeAssetPath = '';
    const w = getWebsiteUI();
    w.assetViewer?.classList.add('hidden');
    if (w.codeEditor) { w.codeEditor.classList.remove('hidden'); w.codeEditor.value = file.content; }
    w.applyCodeBtn?.classList.remove('hidden');
    if (w.activeFilePath) w.activeFilePath.textContent = file.path;
    if (w.activeFileLanguage) w.activeFileLanguage.textContent = getWebsiteLanguage(file.path);
    w.applyCodeBtn?.classList.remove('has-changes');
    renderWebsiteFileTree();
}

function cloneWebsiteProject(project) {
    const normalized = normalizeWebsiteProject(project);
    if (!normalized) return null;
    return {
        name: normalized.name,
        entry: normalized.entry,
        files: normalized.files.map(function(file) {
            return { path: file.path, content: String(file.content ?? '') };
        })
    };
}

function getActualWebsiteChanges(beforeProject, afterProject) {
    const before = normalizeWebsiteProject(beforeProject);
    const after = normalizeWebsiteProject(afterProject);
    if (!before || !after) return [];
    const beforeMap = new Map(before.files.map(function(file) { return [file.path, file.content]; }));
    return after.files.filter(function(file) {
        return beforeMap.get(file.path) !== file.content;
    }).map(function(file) { return file.path; });
}

function websiteShortFingerprint(content) {
    let hash = 2166136261;
    const text = String(content ?? '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildWebsiteLocalFileChanges(beforeProject, afterProject) {
    const before = normalizeWebsiteProject(beforeProject);
    const after = normalizeWebsiteProject(afterProject);
    if (!after) return [];
    const beforeMap = new Map((before?.files || []).map(function(file) { return [file.path, file.content]; }));
    return after.files.map(function(file) {
        const previous = beforeMap.has(file.path) ? String(beforeMap.get(file.path)) : null;
        const current = String(file.content ?? '');
        return {
            path: file.path,
            changed: previous === null || previous !== current,
            beforeHash: previous === null ? null : websiteShortFingerprint(previous),
            afterHash: websiteShortFingerprint(current),
            beforeChars: previous === null ? 0 : previous.length,
            afterChars: current.length
        };
    }).filter(function(item) { return item.changed; });
}

function syncWebsiteVersionCards() {
    const w = getWebsiteUI();
    if (!w.conversation) return;
    w.conversation.querySelectorAll('[data-website-version-id]').forEach(function(card) {
        card.classList.toggle('is-active', card.dataset.websiteVersionId === websiteState.activeVersionId);
    });
}

function setWebsitePreviewHealthBadge(element, state) {
    if (!element) return;
    element.classList.remove('is-idle', 'is-loading', 'is-ok', 'is-error');
    element.classList.add('is-' + (state || 'idle'));
    element.dataset.status = state || 'idle';
}

function resetWebsitePreviewDiagnostics(state, message) {
    const w = getWebsiteUI();
    websiteState.previewRuntimeErrors = [];
    const hasProject = Boolean(websiteState.project);
    const currentState = state || (hasProject ? 'loading' : 'idle');
    if (w.previewDiagnostics) { w.previewDiagnostics.dataset.state = currentState; w.previewDiagnostics.classList.toggle('hidden', currentState !== 'error'); }
    setWebsitePreviewHealthBadge(w.previewHealthHtml, hasProject ? 'ok' : 'idle');
    setWebsitePreviewHealthBadge(w.previewHealthCss, hasProject ? 'ok' : 'idle');
    setWebsitePreviewHealthBadge(w.previewHealthJs, hasProject ? 'loading' : 'idle');
    if (w.previewRuntimeMessage) {
        w.previewRuntimeMessage.textContent = message || (hasProject ? 'يتم تشغيل JavaScript والتحقق من التفاعل...' : 'جاهز لتشغيل المعاينة.');
    }
    if (w.previewErrorLog) {
        w.previewErrorLog.textContent = '';
        w.previewErrorLog.classList.add('hidden');
    }
}

function handleWebsitePreviewMessage(event) {
    const w = getWebsiteUI();
    if (!w.previewFrame || event.source !== w.previewFrame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== 'aklake-website-preview' || data.token !== websiteState.previewRenderToken) return;

    if (data.type === 'boot') {
        if (w.previewRuntimeMessage) w.previewRuntimeMessage.textContent = 'تم تحميل ملفات المعاينة، ويجري تشغيل app.js...';
        return;
    }

    if (data.type === 'dom-ready') {
        if (!websiteState.previewRuntimeErrors.length && w.previewRuntimeMessage) {
            w.previewRuntimeMessage.textContent = 'تم بناء عناصر الصفحة. يتم التحقق من اكتمال التشغيل...';
        }
        return;
    }

    if (data.type === 'runtime-error') {
        const message = String(data.message || 'JavaScript runtime error');
        const filename = String(data.filename || 'app.js').split('/').pop() || 'app.js';
        const line = Number(data.line || 0);
        const column = Number(data.column || 0);
        const location = line ? ' (' + filename + ':' + line + (column ? ':' + column : '') + ')' : ' (' + filename + ')';
        const entry = message + location;
        if (!websiteState.previewRuntimeErrors.includes(entry)) websiteState.previewRuntimeErrors.push(entry);
        if (w.previewDiagnostics) { w.previewDiagnostics.dataset.state = 'error'; w.previewDiagnostics.classList.remove('hidden'); }
        setWebsitePreviewHealthBadge(w.previewHealthJs, 'error');
        if (w.previewRuntimeMessage) w.previewRuntimeMessage.textContent = 'المعاينة تعمل، لكن app.js يحتوي على خطأ يحتاج إصلاحًا.';
        if (w.previewErrorLog) {
            w.previewErrorLog.textContent = websiteState.previewRuntimeErrors.join('\n');
            w.previewErrorLog.classList.remove('hidden');
        }
        setWebsiteStatus('تم رصد خطأ JavaScript داخل المعاينة. راجع الخطأ الظاهر أسفل شريط المعاينة.', 'error');
        return;
    }

    if (data.type === 'loaded') {
        if (websiteState.previewRuntimeErrors.length || Number(data.runtimeErrors || 0) > 0) return;
        if (w.previewDiagnostics) { w.previewDiagnostics.dataset.state = 'ok'; w.previewDiagnostics.classList.add('hidden'); }
        setWebsitePreviewHealthBadge(w.previewHealthJs, 'ok');
        if (w.previewRuntimeMessage) w.previewRuntimeMessage.textContent = 'HTML وCSS وJavaScript تعمل معًا في هذه النسخة.';
    }
}

function refreshWebsitePreview() {
    const w = getWebsiteUI();
    if (!w.previewFrame) return;
    websiteState.previewRenderToken = 'aklake-preview-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    resetWebsitePreviewDiagnostics(websiteState.project ? 'loading' : 'idle');
    const doc = websiteState.project ? buildWebsitePreviewDocument(websiteState.project, websiteState.previewRenderToken) : '';
    if (!doc) {
        setWebsitePreviewHealthBadge(w.previewHealthHtml, 'error');
        setWebsitePreviewHealthBadge(w.previewHealthCss, 'error');
        setWebsitePreviewHealthBadge(w.previewHealthJs, 'error');
        if (w.previewDiagnostics) { w.previewDiagnostics.dataset.state = 'error'; w.previewDiagnostics.classList.remove('hidden'); }
        if (w.previewRuntimeMessage) w.previewRuntimeMessage.textContent = 'تعذر بناء وثيقة المعاينة من الملفات الحالية.';
        w.previewFrame.srcdoc = '';
        return;
    }
    // بصمة جديدة في كل تشغيل تمنع بقاء نسخة iframe السابقة بعد التعديل أو الرجوع إلى نسخة قديمة.
    w.previewFrame.srcdoc = doc + '\n<!-- AKLAKE_RENDER_' + websiteState.previewRenderToken + ' -->';
}

function openWebsiteInExternalTab() {
    if (!websiteState.project) return setWebsiteStatus('أنشئ موقعًا أولًا قبل فتحه في تبويب مستقل.', 'error');
    const doc = buildWebsitePreviewDocument(websiteState.project, '', { bridge: false });
    if (!doc) return setWebsiteStatus('تعذر تجهيز الموقع للفتح الخارجي.', 'error');

    // التبويب الخارجي يملأ الشاشة، لكن كود الموقع يبقى داخل sandbox مستقل حتى لا يحصل الموقع المولد
    // على صلاحيات أصل AKLAKE أو بيانات الجلسة أثناء التجربة.
    const safeDoc = JSON.stringify(doc).replace(/<\/script/gi, '<\\/script');
    const wrapper = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>AKLAKE Preview</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block;background:#fff}body{overflow:hidden}</style></head><body>' +
        '<iframe id="aklake-external-preview" sandbox="allow-scripts allow-forms allow-modals allow-downloads" referrerpolicy="no-referrer"></iframe>' +
        '<script>document.getElementById("aklake-external-preview").srcdoc=' + safeDoc + ';<\\/script></body></html>';
    const blob = new Blob([wrapper], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
        URL.revokeObjectURL(url);
        return setWebsiteStatus('المتصفح منع فتح التبويب الجديد. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مجددًا.', 'error');
    }
    try { opened.opener = null; } catch (_) {}
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
    setWebsiteStatus('تم فتح النسخة الحالية في تبويب مستقل كامل المساحة مع عزل آمن عن حساب AKLAKE.', 'success');
}

function activateWebsiteProject(project, changedFiles) {
    const normalized = normalizeWebsiteProject(project);
    if (!normalized) throw new Error('تعذر قراءة ملفات المشروع الناتج.');
    websiteState.project = cloneWebsiteProject(normalized);
    websiteState.changedFiles = Array.isArray(changedFiles) ? changedFiles.filter(Boolean) : [];
    if (!getWebsiteFile(websiteState.activeFilePath)) websiteState.activeFilePath = normalized.entry;
    const w = getWebsiteUI();
    renderWebsiteAssetsTray();
    renderWebsiteFileTree();
    selectWebsiteFile(websiteState.activeFilePath || normalized.entry);
    refreshWebsitePreview();
    w.generationCard?.classList.add('hidden');
    w.completeCard?.classList.add('hidden');

    if (websiteState.previewOpen) {
        w.output?.classList.remove('hidden');
        showWebsiteView(websiteState.activeView || 'preview');
    } else {
        w.output?.classList.add('hidden');
    }
    syncWebsiteWorkspaceLayout();
    syncWebsiteVersionCards();
    return normalized;
}

function appendWebsiteVersionCard(version) {
    const w = getWebsiteUI();
    if (!w.conversation || !version) return;

    const row = document.createElement('div');
    row.className = 'message-row assistant-message website-state-row website-version-card';
    row.dataset.websiteDynamic = 'true';
    row.dataset.websiteVersionId = version.id;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar agent-avatar';
    avatar.innerHTML = '<img src="' + AGENT_AVATAR_URL + '" alt="وكيل AKLAKE">';

    const content = document.createElement('div');
    content.className = 'message-content website-state-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble website-complete-bubble website-version-bubble';

    const icon = document.createElement('span');
    icon.className = 'website-complete-icon';
    icon.innerHTML = '<i class="fas fa-check"></i>';

    const copy = document.createElement('div');
    const badge = document.createElement('span');
    badge.textContent = 'النسخة ' + version.number + (version.operation === 'revise' ? ' · تعديل' : ' · الأصلية');
    const title = document.createElement('strong');
    title.textContent = version.title || ('نسخة ' + version.number);
    const meta = document.createElement('small');
    const changed = version.changedFiles || [];
    const assetMeta = websiteState.assets.length ? (' · ' + websiteState.assets.length + ' assets') : '';
    meta.textContent = version.operation === 'revise'
        ? ((changed.length ? 'استبدال فعلي: ' + changed.join('، ') : 'لم يُسجل تغيير فعلي') + assetMeta)
        : ('3 ملفات كود · النسخة الأولى' + assetMeta);
    copy.append(badge, title, meta);

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'website-version-open-btn';
    openButton.innerHTML = '<i class="far fa-eye"></i><span>عرض</span>';
    openButton.addEventListener('click', function() { openWebsiteVersion(version.id); });

    bubble.append(icon, copy, openButton);
    content.appendChild(bubble);

    if (Array.isArray(version.fileChanges) && version.fileChanges.length) {
        const proof = document.createElement('div');
        proof.className = 'message-source website-version-proof';
        const summaries = version.fileChanges.map(function(change) {
            const before = change.beforeHash ? String(change.beforeHash).slice(0, 8) : 'جديد';
            const after = change.afterHash ? String(change.afterHash).slice(0, 8) : '—';
            return change.path + ': ' + before + ' → ' + after;
        });
        proof.textContent = 'تحقق الملفات · ' + summaries.join(' · ');
        content.appendChild(proof);
    }

    row.append(avatar, content);
    w.conversation.insertBefore(row, w.generationCard || null);
    syncWebsiteVersionCards();
}

function recordWebsiteVersion(project, options) {
    const normalized = cloneWebsiteProject(project);
    if (!normalized) throw new Error('تعذر حفظ نسخة الموقع الجديدة.');
    const opts = options || {};
    websiteState.versionSequence += 1;
    const version = {
        id: 'website-version-' + Date.now() + '-' + websiteState.versionSequence,
        number: websiteState.versionSequence,
        title: opts.title || normalized.name || ('نسخة ' + websiteState.versionSequence),
        operation: opts.operation === 'revise' ? 'revise' : 'generate',
        instruction: String(opts.instruction || ''),
        parentVersionId: opts.parentVersionId || '',
        changedFiles: Array.isArray(opts.changedFiles) ? opts.changedFiles.slice() : [],
        fileChanges: Array.isArray(opts.fileChanges) ? opts.fileChanges.map(function(change) { return Object.assign({}, change); }) : [],
        patchMode: opts.patchMode || '',
        project: normalized,
        createdAt: new Date().toISOString()
    };
    websiteState.versions.push(version);
    websiteState.activeVersionId = version.id;
    appendWebsiteVersionCard(version);
    return version;
}

function openWebsiteVersion(versionId) {
    const version = websiteState.versions.find(function(item) { return item.id === versionId; });
    if (!version) return setWebsiteStatus('تعذر العثور على هذه النسخة.', 'error');
    websiteState.activeVersionId = version.id;
    activateWebsiteProject(version.project, version.changedFiles);
    openWebsitePreviewWorkspace('preview');
    setWebsiteStatus('تم فتح النسخة ' + version.number + '. أي تعديل جديد سيبدأ من هذه النسخة.', 'success');
}
window.openWebsiteVersion = openWebsiteVersion;

function showWebsiteProject(project, title, changedFiles, options) {
    const opts = options || {};
    const normalized = activateWebsiteProject(project, changedFiles);
    if (opts.record === false) return normalized;

    const version = recordWebsiteVersion(normalized, {
        title: title,
        operation: opts.operation,
        instruction: opts.instruction,
        parentVersionId: opts.parentVersionId,
        changedFiles: changedFiles,
        fileChanges: opts.fileChanges,
        patchMode: opts.patchMode
    });
    websiteState.activeVersionId = version.id;
    syncWebsiteVersionCards();
    return normalized;
}

function appendWebsiteUserMessage(content, attachmentName) {
    const w = getWebsiteUI();
    if (!w.conversation) return;
    const row = document.createElement('div');
    row.className = 'message-row user-message website-user-message';
    row.dataset.websiteDynamic = 'true';
    row.innerHTML = '<div class="message-avatar"><i class="far fa-user"></i></div><div class="message-content"><div class="message-bubble"></div>' +
        (attachmentName ? '<div class="message-source"><i class="fas fa-paperclip"></i> ' + attachmentName.replace(/[<>&]/g, '') + '</div>' : '') + '</div>';
    row.querySelector('.message-bubble').textContent = content;
    w.conversation.insertBefore(row, w.generationCard || null);
}

function showWebsiteView(view) {
    const w = getWebsiteUI();
    const normalizedView = view === 'files' ? 'files' : 'preview';
    websiteState.activeView = normalizedView;
    const showFiles = normalizedView === 'files';
    w.previewView?.classList.toggle('hidden', showFiles);
    w.filesView?.classList.toggle('hidden', !showFiles);
    document.querySelectorAll('[data-website-view]').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.websiteView === normalizedView);
    });
}

function createWebsiteJobId() {
    const random = Math.random().toString(36).slice(2, 10);
    return 'web_' + Date.now().toString(36) + '_' + random;
}

function waitWebsiteMs(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function prepareWebsiteJob(jobId, operation) {
    const execution = await appwriteFunctions.createExecution(
        FIRST_FUNCTION_ID,
        JSON.stringify({
            userId: currentUser.$id,
            mode: 'website_job_prepare',
            operation: operation,
            jobId: jobId
        }),
        false,
        '/',
        'POST',
        { 'Content-Type': 'application/json' }
    );

    let data = null;
    try {
        data = execution.responseBody ? JSON.parse(execution.responseBody) : null;
    } catch (_) {
        throw new Error('تعذر قراءة نتيجة تجهيز مهمة الموقع.');
    }

    if (execution.status === 'failed' || Number(execution.responseStatusCode || 200) >= 400 || data?.success === false) {
        throw new Error(data?.error || execution.errors || 'تعذر تجهيز مهمة إنشاء الموقع.');
    }

    return data || {};
}

async function readWebsiteJobStatus(jobId) {
    const statusExecution = await appwriteFunctions.createExecution(
        FIRST_FUNCTION_ID,
        JSON.stringify({
            userId: currentUser.$id,
            mode: 'website_job_status',
            jobId: jobId
        }),
        false,
        '/',
        'POST',
        { 'Content-Type': 'application/json' }
    );

    let data = null;
    try {
        data = statusExecution.responseBody ? JSON.parse(statusExecution.responseBody) : null;
    } catch (error) {
        throw new Error('تعذر قراءة حالة مهمة إنشاء الموقع.');
    }

    if (statusExecution.status === 'failed' || Number(statusExecution.responseStatusCode || 200) >= 400) {
        throw new Error(data?.error || statusExecution.errors || 'تعذر فحص حالة إنشاء الموقع.');
    }
    return data || {};
}

async function waitForWebsiteJob(jobId, executionId) {
    const startedAt = Date.now();
    const maxWaitMs = 6 * 60 * 1000;
    let completedExecutionSeenAt = 0;

    while (Date.now() - startedAt < maxWaitMs) {
        if (executionId && typeof appwriteFunctions.getExecution === 'function') {
            try {
                const execution = await appwriteFunctions.getExecution(FIRST_FUNCTION_ID, executionId);

                if (execution?.status === 'failed') {
                    throw new Error(execution.errors || 'فشل تنفيذ الكود الوظيفي أثناء إنشاء الموقع.');
                }

                if (execution?.status === 'completed' && !completedExecutionSeenAt) {
                    completedExecutionSeenAt = Date.now();
                }
            } catch (error) {
                if (/فشل تنفيذ الكود الوظيفي/.test(String(error?.message || ''))) throw error;
            }
        }

        const data = await readWebsiteJobStatus(jobId);

        if (data.jobStatus === 'completed') {
            if (data.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') {
                syncCreditDisplays(data.remainingTokens);
            }
            return data;
        }

        if (data.jobStatus === 'failed' || data.success === false) {
            throw new Error(data.error || 'فشلت مهمة إنشاء الموقع.');
        }

        if (completedExecutionSeenAt && Date.now() - completedExecutionSeenAt > 12000) {
            throw new Error('انتهى تنفيذ الكود الوظيفي لكن لم يتم حفظ نتيجة الموقع. تحقق من سجل التنفيذ في Appwrite.');
        }

        if (data.stage === 'calling_model') {
            setWebsiteStatus('النموذج يكتب الآن ملفات index.html و style.css و app.js...', 'loading');
        } else if (data.stage === 'saving_result') {
            setWebsiteStatus('اكتمل التوليد، يتم الآن حفظ الملفات الثلاثة...', 'loading');
        } else if (data.jobStatus === 'processing') {
            setWebsiteStatus('بدأ تنفيذ مهمة إنشاء الموقع...', 'loading');
        } else {
            setWebsiteStatus('تم وضع المهمة في قائمة التنفيذ...', 'loading');
        }

        await waitWebsiteMs(2200);
    }

    throw new Error('استغرقت مهمة إنشاء الموقع وقتًا أطول من 6 دقائق وتم إيقاف الانتظار.');
}

async function requestWebsiteFromFirstFunction(operation, prompt) {
    if (!currentUser) {
        alert('يرجى تسجيل الدخول أولاً. سيبقى البرومنت كما هو.');
        openModal();
        return null;
    }

    ui.source.value = FIRST_FUNCTION_ID;

    const reference = websiteState.referenceAttachment ? {
        name: websiteState.referenceAttachment.name,
        mimeType: websiteState.referenceAttachment.mimeType,
        text: websiteState.referenceAttachment.text || ''
    } : null;
    const websiteAssets = buildWebsiteAssetManifest();

    const jobId = createWebsiteJobId();

    // أولاً ننشئ سجل المهمة في طلب قصير ومؤكد.
    setWebsiteStatus('يتم تجهيز سجل مهمة الموقع...', 'loading');
    await prepareWebsiteJob(jobId, operation);

    // بعدها فقط نطلق عملية التوليد الطويلة Async.
    setWebsiteStatus('تم تجهيز المهمة، جارٍ بدء النموذج...', 'loading');
    const execution = await appwriteFunctions.createExecution(
        FIRST_FUNCTION_ID,
        JSON.stringify({
            userId: currentUser.$id,
            prompt: prompt,
            provider: websiteState.provider,
            mode: 'website',
            operation: operation,
            modelTier: websiteState.model,
            project: operation === 'revise' ? websiteState.project : undefined,
            referenceAttachment: reference,
            websiteAssets: websiteAssets,
            jobId: jobId
        }),
        true,
        '/',
        'POST',
        { 'Content-Type': 'application/json' }
    );

    if (execution?.status === 'failed') {
        throw new Error(execution.errors || 'تعذر بدء مهمة إنشاء الموقع.');
    }

    return waitForWebsiteJob(jobId, execution?.$id || execution?.id || '');
}

async function generateWebsite() {
    const w = getWebsiteUI();
    const prompt = w.prompt?.value.trim() || '';
    if (!prompt) { setWebsiteStatus('اكتب وصف الموقع الذي تريد إنشاءه.', 'error'); w.prompt?.focus(); return; }

    if (websiteState.previewOpen && websiteState.project) {
        return reviseWebsiteWithInstruction(prompt, w.prompt);
    }

    appendWebsiteUserMessage(prompt, websiteState.assets.length ? (websiteState.assets.length + ' من ملفات assets') : websiteState.referenceAttachment?.name);
    setWebsiteRevisionLoading(false);
    w.completeCard?.classList.add('hidden');
    w.output?.classList.add('hidden');
    w.generationCard?.classList.remove('hidden');
    if (w.progressTitle) w.progressTitle.textContent = 'من البرومنت الذي أرسلته';
    if (w.progressModel) w.progressModel.textContent = (WEBSITE_MODEL_INFO[websiteState.provider + ':' + websiteState.model]?.label || websiteState.model) + ' · 3 ملفات';
    setWebsiteBusy(true, 'يتم إنشاء الملفات الثلاثة...');
    setWebsiteStatus('يتم إنشاء index.html و style.css و app.js في رد واحد...', 'loading');
    try {
        const response = await requestWebsiteFromFirstFunction('generate', prompt);
        if (!response) return;
        const project = extractWebsiteProject(response);
        showWebsiteProject(project, prompt.slice(0, 55), response.changedFiles, {
            operation: 'generate',
            instruction: prompt,
            fileChanges: Array.isArray(response.fileChanges) ? response.fileChanges : buildWebsiteLocalFileChanges(null, project),
            patchMode: response.patchMode || 'generated'
        });
        setWebsiteStatus('اكتمل الموقع وحُفظت النسخة 1 داخل المحادثة. يمكنك فتحها لاحقًا في أي وقت.', 'success');
    } catch (error) {
        w.generationCard?.classList.add('hidden');
        setWebsiteStatus(error.message || 'تعذر إنشاء الموقع.', 'error');
    } finally { setWebsiteBusy(false); }
}

async function reviseWebsiteWithInstruction(instruction, sourceInput) {
    const w = getWebsiteUI();
    const cleanInstruction = String(instruction || '').trim();
    if (!websiteState.project) {
        setWebsiteStatus('أنشئ موقعًا أولًا قبل طلب التعديل.', 'error');
        return;
    }
    if (!cleanInstruction) {
        setWebsiteStatus('اكتب التعديل المطلوب.', 'error');
        sourceInput?.focus();
        return;
    }

    appendWebsiteUserMessage(cleanInstruction, websiteState.assets.length ? (websiteState.assets.length + ' من ملفات assets') : null);
    w.generationCard?.classList.remove('hidden');
    w.completeCard?.classList.add('hidden');
    if (w.progressTitle) w.progressTitle.textContent = 'يتم الآن تعديل الموقع الحالي';
    if (w.progressModel) {
        w.progressModel.textContent = 'تعديل الملفات المطلوبة فقط · ' +
            (WEBSITE_MODEL_INFO[websiteState.provider + ':' + websiteState.model]?.label || websiteState.model);
    }
    setWebsiteRevisionLoading(true);
    setWebsiteBusy(true, 'يتم تعديل ملفات المشروع...');
    setWebsiteStatus('يتم إرسال الملفات الحالية للنموذج وتطبيق التعديل المطلوب فقط...', 'loading');

    const baseProject = cloneWebsiteProject(websiteState.project);
    const parentVersionId = websiteState.activeVersionId;

    try {
        const response = await requestWebsiteFromFirstFunction('revise', cleanInstruction);
        if (!response) return;
        const project = extractWebsiteProject(response);
        const actualChanged = getActualWebsiteChanges(baseProject, project);
        if (!actualChanged.length) {
            throw new Error('وصلت نتيجة التعديل، لكن الملفات الجديدة مطابقة للنسخة السابقة حرفيًا. لم يتم إنشاء نسخة وهمية.');
        }
        const reportedChanged = Array.isArray(response.changedFiles) ? response.changedFiles : [];
        const changed = actualChanged;
        const fileChanges = Array.isArray(response.fileChanges) && response.fileChanges.length
            ? response.fileChanges.filter(function(change) { return changed.includes(change.path); })
            : buildWebsiteLocalFileChanges(baseProject, project);
        showWebsiteProject(project, 'نسخة معدلة · ' + (websiteState.versionSequence + 1), changed, {
            operation: 'revise',
            instruction: cleanInstruction,
            parentVersionId: parentVersionId,
            fileChanges: fileChanges,
            patchMode: response.patchMode || 'revision'
        });

        if (reportedChanged.length && reportedChanged.some(function(path) { return !changed.includes(path); })) {
            setWebsiteStatus('تم التعديل، مع تجاهل ملفات أعادها النموذج دون تغيير فعلي.', 'success');
        }

        if (sourceInput) {
            sourceInput.value = '';
            if (sourceInput === w.prompt) autoResizeTextarea(sourceInput);
        }
        if (w.revisionPrompt && w.revisionPrompt !== sourceInput) w.revisionPrompt.value = '';

        const label = ' تم استبدال فعليًا: ' + changed.join('، ');
        setWebsiteStatus('تم إنشاء نسخة جديدة مستقلة مع الحفاظ على النسخة السابقة.' + label, 'success');
    } catch (error) {
        w.generationCard?.classList.add('hidden');
        setWebsiteStatus(error.message || 'تعذر تعديل الموقع.', 'error');
    } finally {
        setWebsiteRevisionLoading(false);
        setWebsiteBusy(false);
    }
}

async function reviseWebsite() {
    const w = getWebsiteUI();
    return reviseWebsiteWithInstruction(w.revisionPrompt?.value || '', w.revisionPrompt);
}

async function readWebsiteReference(file) {
    // توافق مع النسخ القديمة: الملف المرفق الجديد يضاف إلى مكتبة assets بدل أن يبقى مرجعًا مؤقتًا واحدًا.
    await addWebsiteAssets(file ? [file] : []);
}

function clearWebsiteReference() {
    websiteState.referenceAttachment = null;
    const w = getWebsiteUI();
    if (w.referenceFile) w.referenceFile.value = '';
}

function resetWebsiteBuilder() {
    const w = getWebsiteUI();
    websiteState.previewOpen = false;
    websiteState.chatCollapsed = false;
    websiteState.activeView = 'preview';
    websiteState.revising = false;
    websiteState.project = null;
    websiteState.activeFilePath = '';
    websiteState.changedFiles = [];
    websiteState.versions = [];
    websiteState.activeVersionId = '';
    websiteState.versionSequence = 0;
    websiteState.previewRenderToken = '';
    websiteState.previewRuntimeErrors = [];
    websiteState.assets = [];
    websiteState.activeAssetPath = '';
    clearWebsiteReference();
    renderWebsiteAssetsTray();
    if (w.prompt) w.prompt.value = '';
    if (w.revisionPrompt) w.revisionPrompt.value = '';
    if (w.previewFrame) w.previewFrame.srcdoc = '';
    resetWebsitePreviewDiagnostics('idle', 'جاهز لتشغيل المعاينة.');
    if (w.codeEditor) w.codeEditor.value = '';
    w.applyCodeBtn?.classList.remove('has-changes');
    if (w.fileTree) w.fileTree.innerHTML = '';
    if (w.activeFilePath) w.activeFilePath.textContent = 'اختر ملفًا';
    w.output?.classList.add('hidden');
    w.output?.classList.remove('is-revising');
    w.studio?.classList.remove('is-revising');
    w.revisionOverlay?.classList.add('hidden');
    w.revisionOverlay?.setAttribute('aria-hidden', 'true');
    w.completeCard?.classList.add('hidden');
    w.generationCard?.classList.add('hidden');
    w.conversation?.querySelectorAll('[data-website-dynamic="true"]').forEach(function(row) { row.remove(); });
    setWebsiteStatus('', '');
    syncWebsiteWorkspaceLayout();
    w.prompt?.focus();
}

function updateActiveWebsiteFileFromEditor() {
    const w = getWebsiteUI();
    if (!websiteState.project || !websiteState.activeFilePath) return setWebsiteStatus('اختر ملفًا أولًا.', 'error');
    const file = getWebsiteFile(websiteState.activeFilePath);
    if (!file) return setWebsiteStatus('تعذر العثور على الملف المحدد.', 'error');
    const nextContent = w.codeEditor?.value ?? '';
    if (file.path === websiteState.project.entry && (!/<html[\s>]/i.test(nextContent) || !/<body[\s>]/i.test(nextContent))) {
        return setWebsiteStatus('ملف الدخول الرئيسي يجب أن يبقى وثيقة HTML صالحة.', 'error');
    }
    if (!String(nextContent).trim()) {
        return setWebsiteStatus('لا يمكن حفظ ' + file.path + ' فارغًا.', 'error');
    }
    if (file.content === nextContent) {
        w.applyCodeBtn?.classList.remove('has-changes');
        return setWebsiteStatus('لا يوجد تغيير جديد داخل ' + file.path + '.', '');
    }

    const baseProject = cloneWebsiteProject(websiteState.project);
    const candidateProject = cloneWebsiteProject(baseProject);
    const candidateFile = candidateProject?.files.find(function(item) { return item.path === file.path; });
    if (!candidateFile) return setWebsiteStatus('تعذر تجهيز نسخة آمنة من الملف للحفظ.', 'error');
    candidateFile.content = nextContent;

    const normalizedCandidate = normalizeWebsiteProject(candidateProject);
    if (!normalizedCandidate) {
        return setWebsiteStatus('تعذر حفظ الملف لأن المشروع الناتج لم يعد يحتوي الملفات الثلاثة بصورة صالحة.', 'error');
    }

    const parentVersionId = websiteState.activeVersionId;
    const fileChanges = buildWebsiteLocalFileChanges(baseProject, normalizedCandidate);
    const changed = fileChanges.map(function(change) { return change.path; });
    if (!changed.length) return setWebsiteStatus('لم يتم العثور على تغيير فعلي للحفظ.', '');

    showWebsiteProject(normalizedCandidate, 'تعديل يدوي · ' + (websiteState.versionSequence + 1), changed, {
        operation: 'revise',
        instruction: 'تعديل يدوي للملف ' + file.path,
        parentVersionId: parentVersionId,
        fileChanges: fileChanges,
        patchMode: 'manual_edit'
    });
    w.applyCodeBtn?.classList.remove('has-changes');
    setWebsiteStatus('تم حفظ ' + file.path + ' كنسخة جديدة مستقلة وتشغيلها في المعاينة.', 'success');
}

window.initWebsiteBuilder = function() {
    if (websiteState.initialized) return;
    const w = getWebsiteUI();
    if (!w.studio) return;
    websiteState.initialized = true;
    window.addEventListener('message', handleWebsitePreviewMessage);
    restoreWebsiteModelChoice();
    w.prompt?.addEventListener('input', function() { autoResizeTextarea(w.prompt); });
    w.prompt?.addEventListener('keydown', function(event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); generateWebsite(); } });
    w.revisionPrompt?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            reviseWebsite();
        }
    });
    w.generateBtn?.addEventListener('click', generateWebsite);
    w.attachBtn?.addEventListener('click', function() { w.referenceFile?.click(); });
    w.referenceFile?.addEventListener('change', async function() {
        if (!w.referenceFile.files?.length) return;
        try { await addWebsiteAssets(w.referenceFile.files); }
        catch (e) { setWebsiteStatus(e.message || 'تعذر قراءة ملفات المشروع.', 'error'); }
        finally { w.referenceFile.value = ''; }
    });
    w.modelToggle?.addEventListener('click', function() { setWebsiteModelPopoverOpen(w.modelPopover?.classList.contains('hidden')); });
    w.closeModelBtn?.addEventListener('click', function() { setWebsiteModelPopoverOpen(false); });
    w.modelCards?.querySelectorAll('[data-website-model]').forEach(function(card) {
        card.addEventListener('click', function() {
            websiteState.provider = card.dataset.websiteProvider;
            websiteState.model = card.dataset.websiteModel;
            websiteState.points = Number(card.dataset.points || 0);
            syncWebsiteModelUI();
        });
    });
    w.rememberModelToggle?.addEventListener('change', function() {
        if (w.rememberIcon) { w.rememberIcon.classList.toggle('fa-toggle-on', w.rememberModelToggle.checked); w.rememberIcon.classList.toggle('fa-toggle-off', !w.rememberModelToggle.checked); }
    });
    w.confirmModelBtn?.addEventListener('click', function() {
        if (w.rememberModelToggle?.checked) localStorage.setItem(WEBSITE_MODEL_MEMORY_KEY, JSON.stringify({ provider: websiteState.provider, model: websiteState.model }));
        else localStorage.removeItem(WEBSITE_MODEL_MEMORY_KEY);
        setWebsiteModelPopoverOpen(false);
        syncWebsiteModelUI();
        setWebsiteStatus('تم اعتماد النموذج.', 'success');
    });
    document.querySelectorAll('[data-website-view]').forEach(function(btn) { btn.addEventListener('click', function() { showWebsiteView(btn.dataset.websiteView); }); });
    document.querySelectorAll('[data-website-device]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-website-device]').forEach(function(item) { item.classList.toggle('active', item === btn); });
            if (w.previewShell) w.previewShell.dataset.device = btn.dataset.websiteDevice;
        });
    });
    w.openResultBtn?.addEventListener('click', function() { openWebsitePreviewWorkspace('preview'); });
    w.closeChatBtn?.addEventListener('click', collapseWebsiteChatPanel);
    w.closePreviewBtn?.addEventListener('click', closeWebsitePreviewWorkspace);
    w.openBrowserBtn?.addEventListener('click', openWebsiteInExternalTab);
    w.refreshPreviewBtn?.addEventListener('click', function() {
        refreshWebsitePreview();
        setWebsiteStatus('تم تحديث المعاينة.', 'success');
    });
    w.copyCodeBtn?.addEventListener('click', async function() {
        const asset = getWebsiteAsset(websiteState.activeAssetPath);
        const file = getWebsiteFile(websiteState.activeFilePath || (!asset ? websiteState.project?.entry : ''));
        const value = asset ? asset.path : file?.content;
        if (!value) return setWebsiteStatus('لا يوجد ملف أو مسار لنسخه.', 'error');
        try { await navigator.clipboard.writeText(value); setWebsiteStatus(asset ? ('تم نسخ مسار ' + asset.path + '.') : ('تم نسخ ' + file.path + '.'), 'success'); }
        catch (e) { if (file && w.codeEditor) { w.codeEditor.focus(); w.codeEditor.select(); document.execCommand('copy'); } }
    });
    w.downloadBtn?.addEventListener('click', function() {
        const asset = getWebsiteAsset(websiteState.activeAssetPath);
        const file = getWebsiteFile(websiteState.activeFilePath || (!asset ? websiteState.project?.entry : ''));
        if (!asset && !file) return setWebsiteStatus('لا يوجد ملف لتنزيله.', 'error');
        const link = document.createElement('a');
        if (asset) {
            link.href = asset.dataUrl;
            link.download = asset.name || asset.path.split('/').pop() || 'asset';
        } else {
            const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
            link.href = URL.createObjectURL(blob);
            link.download = file.path.split('/').pop() || 'website-file.txt';
        }
        document.body.appendChild(link); link.click(); link.remove();
        if (!asset) setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
    });
    w.copyAssetPathBtn?.addEventListener('click', async function() {
        const asset = getWebsiteAsset(websiteState.activeAssetPath);
        if (!asset) return;
        try { await navigator.clipboard.writeText(asset.path); setWebsiteStatus('تم نسخ مسار ' + asset.path + '.', 'success'); } catch (_) {}
    });
    w.removeAssetBtn?.addEventListener('click', function() {
        if (websiteState.activeAssetPath) removeWebsiteAsset(websiteState.activeAssetPath);
    });
    w.codeEditor?.addEventListener('input', function() {
        const activeFile = getWebsiteFile(websiteState.activeFilePath);
        const dirty = Boolean(activeFile && w.codeEditor.value !== activeFile.content);
        w.applyCodeBtn?.classList.toggle('has-changes', dirty);
    });
    w.codeEditor?.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            updateActiveWebsiteFileFromEditor();
        }
    });
    w.applyCodeBtn?.addEventListener('click', updateActiveWebsiteFileFromEditor);
    w.reviseBtn?.addEventListener('click', reviseWebsite);
    w.newProjectBtn?.addEventListener('click', resetWebsiteBuilder);
    syncWebsiteWorkspaceLayout();
};

// ==========================================
// CONTEXT HISTORY RAIL — سجل المحادثات والمشاريع حسب الأداة
// ==========================================
const CONTEXT_WEBSITE_PROJECTS_KEY = 'aklake_website_projects_history_v1';
const CONTEXT_WEBSITE_MAX_PROJECTS = 12;
const CONTEXT_WEBSITE_MAX_CONVERSATIONS = 24;
let contextHistoryTab = 'conversations';
let contextBookCache = [];
let contextBookCacheUserId = '';
let contextBookLoading = false;

function getContextHistoryUI() {
    return {
        shell: document.getElementById('app-shell'),
        panel: document.getElementById('context-history-panel'),
        title: document.getElementById('context-history-title'),
        kicker: document.getElementById('context-history-kicker'),
        list: document.getElementById('context-history-list'),
        empty: document.getElementById('context-history-empty'),
        refresh: document.getElementById('context-history-refresh-btn')
    };
}

function contextDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '—';
    try {
        return date.toLocaleDateString('ar-MA', { day: 'numeric', month: 'short' });
    } catch (_) {
        return date.toLocaleDateString();
    }
}

function contextTime(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    try {
        return date.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

function readContextWebsiteProjects() {
    try {
        const value = JSON.parse(localStorage.getItem(CONTEXT_WEBSITE_PROJECTS_KEY) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function writeContextWebsiteProjects(projects) {
    const normalized = (Array.isArray(projects) ? projects : [])
        .slice()
        .sort(function(a, b) { return Number(new Date(b.updatedAt || 0)) - Number(new Date(a.updatedAt || 0)); })
        .slice(0, CONTEXT_WEBSITE_MAX_PROJECTS)
        .map(function(item) {
            return Object.assign({}, item, {
                conversations: (item.conversations || []).slice(-CONTEXT_WEBSITE_MAX_CONVERSATIONS)
            });
        });
    try {
        localStorage.setItem(CONTEXT_WEBSITE_PROJECTS_KEY, JSON.stringify(normalized));
        return normalized;
    } catch (error) {
        // إذا امتلأت localStorage نحافظ على أحدث المشاريع مع نسخة الكود الأخيرة فقط.
        try {
            const compact = normalized.slice(0, 6).map(function(item) {
                return Object.assign({}, item, { conversations: (item.conversations || []).slice(-8) });
            });
            localStorage.setItem(CONTEXT_WEBSITE_PROJECTS_KEY, JSON.stringify(compact));
            return compact;
        } catch (_) {
            return normalized;
        }
    }
}

function persistContextWebsiteProject(version) {
    if (!version || !version.project) return;
    if (!websiteState.historyProjectId) {
        websiteState.historyProjectId = 'website-project-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }
    const projects = readContextWebsiteProjects();
    let record = projects.find(function(item) { return item.id === websiteState.historyProjectId; });
    const now = version.createdAt || new Date().toISOString();
    if (!record) {
        record = {
            id: websiteState.historyProjectId,
            title: version.project.name || version.title || 'موقع بدون اسم',
            createdAt: now,
            updatedAt: now,
            versionCount: 0,
            latestProject: null,
            assetCount: 0,
            conversations: []
        };
        projects.unshift(record);
    }
    record.title = version.project.name || version.title || record.title || 'موقع بدون اسم';
    record.updatedAt = now;
    record.versionCount = Math.max(Number(record.versionCount || 0), Number(version.number || 0), websiteState.versionSequence || 0);
    record.latestProject = cloneWebsiteProject(version.project);
    record.assetCount = websiteState.assets.length;
    record.conversations = Array.isArray(record.conversations) ? record.conversations : [];
    record.conversations.push({
        id: version.id,
        number: version.number,
        operation: version.operation,
        instruction: String(version.instruction || ''),
        changedFiles: Array.isArray(version.changedFiles) ? version.changedFiles.slice() : [],
        createdAt: now
    });
    if (record.conversations.length > CONTEXT_WEBSITE_MAX_CONVERSATIONS) {
        record.conversations = record.conversations.slice(-CONTEXT_WEBSITE_MAX_CONVERSATIONS);
    }
    writeContextWebsiteProjects(projects);
}

function contextHistoryVisibleForAction(action) {
    if (!['website_builder', 'landing_page', 'cv_builder', 'book_outline'].includes(action)) return false;
    if (action === 'website_builder') return !websiteState.previewOpen && !websiteState.project;
    if (action === 'landing_page') return !landingState.previewOpen && !landingState.activeProjectId;
    if (action === 'cv_builder') return !cvState.previewOpen && !cvState.activeProjectId;
    if (action === 'book_outline') {
        const viewer = document.getElementById('intro-area');
        const progress = document.getElementById('auto-generation-status');
        const viewerOpen = Boolean(viewer && !viewer.classList.contains('hidden') && viewer.classList.contains('is-book-viewer'));
        const generating = Boolean(progress && !progress.classList.contains('hidden'));
        return !viewerOpen && !generating;
    }
    return false;
}

function getContextToolMeta(action) {
    if (action === 'website_builder') return { title: 'مواقعك', kicker: 'WEBSITE HISTORY', icon: 'fa-code' };
    if (action === 'landing_page') return { title: 'صفحات الهبوط', kicker: 'LANDING HISTORY', icon: 'fa-window-maximize' };
    if (action === 'cv_builder') return { title: 'السير الذاتية', kicker: 'CV HISTORY', icon: 'fa-id-card' };
    return { title: 'كتبك', kicker: 'BOOK HISTORY', icon: 'fa-book-open' };
}

function contextHistoryCard(item, options) {
    const opts = options || {};
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'context-history-card' + (opts.conversation ? ' is-conversation' : '');
    button.innerHTML = '<span class="context-history-card-icon"><i class="fas ' + (opts.icon || 'fa-folder') + '"></i></span>' +
        '<span class="context-history-card-copy"><strong></strong><small></small></span>' +
        '<span class="context-history-card-meta"></span>';
    button.querySelector('strong').textContent = item.title || 'بدون عنوان';
    button.querySelector('small').textContent = item.subtitle || '';
    button.querySelector('.context-history-card-meta').textContent = item.meta || '';
    if (typeof item.onClick === 'function') button.addEventListener('click', item.onClick);
    return button;
}

async function loadContextBooks(force) {
    const userId = currentUser?.$id || '';
    if (!userId) {
        contextBookCache = [];
        contextBookCacheUserId = '';
        return;
    }
    if (!force && contextBookCacheUserId === userId && contextBookCache.length) return;
    if (contextBookLoading) return;
    contextBookLoading = true;
    try {
        const response = await databases.listDocuments(DB_ID, 'books', [
            Query.equal('userId', userId),
            Query.orderDesc('$createdAt'),
            Query.limit(30)
        ]);
        contextBookCache = Array.isArray(response.documents) ? response.documents : [];
        contextBookCacheUserId = userId;
    } catch (error) {
        console.warn('تعذر تحميل سجل الكتب الجانبي:', error);
        contextBookCache = [];
    } finally {
        contextBookLoading = false;
    }
}

async function openContextLandingVersion(projectId, versionId) {
    let project = landingState.projects.find(function(item) { return item.id === projectId; });
    if (!project) return;
    try { project = await ensureLandingProjectLoaded(project); }
    catch (error) { setLandingStatus(error.message || 'تعذر فتح الصفحة.', 'error'); return; }
    landingState.activeProjectId = project.id;
    fillLandingForm(project.form || {});
    setLandingModel(project.model || 'gpt-4.1-mini', Number(project.points || 40));
    const versions = project.versions || [];
    let index = versions.findIndex(function(version) { return version.id === versionId; });
    if (index < 0) index = Math.max(0, versions.length - 1);
    landingState.currentVersionIndex = index;
    clearLandingReference();
    clearLandingDynamicMessages();
    showLandingVersion(versions[index] || null);
    setLandingPreviewOpen(Boolean(versions[index]?.html));
    if (versions[index]?.html) showLandingView('preview');
    renderLandingProjects();
}

function openContextWebsiteProject(record, conversation) {
    if (!record?.latestProject) return;
    resetWebsiteBuilder();
    websiteState.historyProjectId = record.id;
    websiteState.versionSequence = Math.max(1, Number(record.versionCount || 1));
    const restoredVersion = {
        id: 'restored-' + record.id + '-' + Date.now(),
        number: websiteState.versionSequence,
        title: record.title || record.latestProject.name || 'موقع محفوظ',
        operation: conversation?.operation === 'revise' ? 'revise' : 'generate',
        instruction: conversation?.instruction || '',
        parentVersionId: '',
        changedFiles: Array.isArray(conversation?.changedFiles) ? conversation.changedFiles.slice() : [],
        fileChanges: [],
        patchMode: 'restored_local',
        project: cloneWebsiteProject(record.latestProject),
        createdAt: conversation?.createdAt || record.updatedAt || new Date().toISOString()
    };
    websiteState.versions = [restoredVersion];
    websiteState.activeVersionId = restoredVersion.id;
    activateWebsiteProject(restoredVersion.project, restoredVersion.changedFiles);
    appendWebsiteVersionCard(restoredVersion);
    openWebsitePreviewWorkspace('preview');
    if (Number(record.assetCount || 0) > 0) {
        setWebsiteStatus('تم فتح كود الموقع المحفوظ. ملفات assets القديمة لا يمكن استعادتها من المتصفح بعد إغلاق الجلسة؛ أعد رفعها عند الحاجة.', 'info');
    } else {
        setWebsiteStatus('تم فتح الموقع المحفوظ من سجل المشاريع.', 'success');
    }
}

async function renderContextHistory(forceBooks) {
    const c = getContextHistoryUI();
    if (!c.panel || !c.shell || !ui?.action) return;
    const action = ui.action.value;
    const visible = contextHistoryVisibleForAction(action);
    c.panel.classList.toggle('hidden', !visible);
    c.shell.classList.toggle('has-context-history', visible);
    if (!visible) return;

    const meta = getContextToolMeta(action);
    if (c.title) c.title.textContent = meta.title;
    if (c.kicker) c.kicker.textContent = meta.kicker;
    document.querySelectorAll('[data-context-history-tab]').forEach(function(tab) {
        const active = tab.dataset.contextHistoryTab === contextHistoryTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
    });
    c.list.innerHTML = '';
    c.empty?.classList.add('hidden');

    if (action === 'book_outline') {
        if (contextBookLoading) c.list.innerHTML = '<div class="context-history-loading"><i class="fas fa-spinner fa-spin"></i></div>';
        await loadContextBooks(Boolean(forceBooks));
        c.list.innerHTML = '';
        contextBookCache.forEach(function(book) {
            const title = book.title || 'كتاب بدون عنوان';
            const status = book.status === 'completed' ? 'مكتمل' : (book.status === 'failed' ? 'متوقف' : 'قيد التأليف');
            const isConversation = contextHistoryTab === 'conversations';
            c.list.appendChild(contextHistoryCard({
                title: isConversation ? ('جلسة تأليف · ' + title) : title,
                subtitle: isConversation ? ('آخر حالة: ' + status) : status,
                meta: contextDate(book.$updatedAt || book.$createdAt),
                onClick: function() {
                    if (typeof loadBookFromLibrary === 'function') loadBookFromLibrary(book);
                }
            }, { conversation: isConversation, icon: isConversation ? 'fa-message' : 'fa-book-open' }));
        });
    } else if (action === 'landing_page') {
        const projects = (landingState.projects || []).slice().sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); });
        if (contextHistoryTab === 'projects') {
            projects.forEach(function(project) {
                const count = Number(project.versionCount || (project.versions || []).length || 0);
                c.list.appendChild(contextHistoryCard({
                    title: project.title || 'صفحة هبوط بدون اسم',
                    subtitle: count + ' نسخة محفوظة',
                    meta: contextDate(project.updatedAt),
                    onClick: async function() {
                        await openLandingProject(project.id);
                        const opened = getActiveLandingProject();
                        if (opened?.versions?.length) setLandingPreviewOpen(true);
                        renderContextHistory(false);
                    }
                }, { icon: 'fa-window-maximize' }));
            });
        } else {
            const conversations = [];
            projects.forEach(function(project) {
                (project.versions || []).forEach(function(version, index) {
                    conversations.push({ project, version, index });
                });
            });
            conversations.sort(function(a, b) { return Number(b.version.createdAt || 0) - Number(a.version.createdAt || 0); });
            conversations.slice(0, 40).forEach(function(entry) {
                c.list.appendChild(contextHistoryCard({
                    title: entry.version.label || ('محادثة · ' + (entry.project.title || 'صفحة هبوط')),
                    subtitle: entry.project.title || 'صفحة هبوط',
                    meta: contextDate(entry.version.createdAt) + ' ' + contextTime(entry.version.createdAt),
                    onClick: function() { openContextLandingVersion(entry.project.id, entry.version.id); }
                }, { conversation: true, icon: 'fa-message' }));
            });
        }
    } else if (action === 'cv_builder') {
        const projects = (cvState.projects || []).slice().sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); });
        if (contextHistoryTab === 'projects') {
            projects.forEach(function(project) {
                const count = project.versions?.length || 0;
                c.list.appendChild(contextHistoryCard({
                    title: project.title || 'CV بدون اسم',
                    subtitle: count + ' نسخة محفوظة',
                    meta: contextDate(project.updatedAt),
                    onClick: function() { openCVProject(project.id); renderContextHistory(false); }
                }, { icon: 'fa-id-card' }));
            });
        } else {
            const conversations = [];
            projects.forEach(function(project) {
                (project.versions || []).forEach(function(version) { conversations.push({ project, version }); });
            });
            conversations.sort(function(a, b) { return Number(b.version.createdAt || 0) - Number(a.version.createdAt || 0); });
            conversations.slice(0, 50).forEach(function(entry) {
                const isRevise = entry.version.operation === 'revise';
                c.list.appendChild(contextHistoryCard({
                    title: isRevise ? (entry.version.label || 'تعديل السيرة') : ('إنشاء · ' + (entry.project.title || 'CV')),
                    subtitle: entry.project.title || 'CV',
                    meta: contextDate(entry.version.createdAt) + ' ' + contextTime(entry.version.createdAt),
                    onClick: function() { openCVProject(entry.project.id, entry.version.id); }
                }, { conversation: true, icon: 'fa-message' }));
            });
        }
    } else if (action === 'website_builder') {
        const projects = readContextWebsiteProjects();
        if (contextHistoryTab === 'projects') {
            projects.forEach(function(record) {
                c.list.appendChild(contextHistoryCard({
                    title: record.title || 'موقع بدون اسم',
                    subtitle: Number(record.versionCount || 1) + ' نسخة' + (record.assetCount ? ' · ' + record.assetCount + ' assets' : ''),
                    meta: contextDate(record.updatedAt),
                    onClick: function() { openContextWebsiteProject(record, null); }
                }, { icon: 'fa-code' }));
            });
        } else {
            const conversations = [];
            projects.forEach(function(record) {
                (record.conversations || []).forEach(function(conversation) {
                    conversations.push({ record, conversation });
                });
            });
            conversations.sort(function(a, b) {
                return Number(new Date(b.conversation.createdAt || 0)) - Number(new Date(a.conversation.createdAt || 0));
            });
            conversations.slice(0, 50).forEach(function(entry) {
                const conv = entry.conversation;
                const instruction = String(conv.instruction || '').trim();
                c.list.appendChild(contextHistoryCard({
                    title: conv.operation === 'revise' ? (instruction || 'تعديل الموقع') : ('إنشاء · ' + (entry.record.title || 'موقع')),
                    subtitle: entry.record.title || 'موقع',
                    meta: contextDate(conv.createdAt) + ' ' + contextTime(conv.createdAt),
                    onClick: function() { openContextWebsiteProject(entry.record, conv); }
                }, { conversation: true, icon: 'fa-message' }));
            });
        }
    }

    const hasItems = Boolean(c.list.children.length);
    c.empty?.classList.toggle('hidden', hasItems);
}

function syncContextHistoryPanel() {
    renderContextHistory(false).catch(function(error) { console.warn('تعذر تحديث سجل الأداة:', error); });
}
window.syncContextHistoryPanel = syncContextHistoryPanel;

// ربط السجل بالتنقل من دون تغيير منطق الأدوات نفسه.
const _syncWorkspaceFromSelectionsForHistory = syncWorkspaceFromSelections;
syncWorkspaceFromSelections = function() {
    const result = _syncWorkspaceFromSelectionsForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.syncWorkspaceFromSelections = syncWorkspaceFromSelections;

const _recordWebsiteVersionForHistory = recordWebsiteVersion;
recordWebsiteVersion = function(project, options) {
    const version = _recordWebsiteVersionForHistory.apply(this, arguments);
    persistContextWebsiteProject(version);
    syncContextHistoryPanel();
    return version;
};
window.recordWebsiteVersion = recordWebsiteVersion;

const _resetWebsiteBuilderForHistory = resetWebsiteBuilder;
resetWebsiteBuilder = function() {
    const result = _resetWebsiteBuilderForHistory.apply(this, arguments);
    websiteState.historyProjectId = '';
    syncContextHistoryPanel();
    return result;
};
window.resetWebsiteBuilder = resetWebsiteBuilder;

const _openWebsitePreviewWorkspaceForHistory = openWebsitePreviewWorkspace;
openWebsitePreviewWorkspace = function() {
    const result = _openWebsitePreviewWorkspaceForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.openWebsitePreviewWorkspace = openWebsitePreviewWorkspace;

const _closeWebsitePreviewWorkspaceForHistory = closeWebsitePreviewWorkspace;
closeWebsitePreviewWorkspace = function() {
    const result = _closeWebsitePreviewWorkspaceForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.closeWebsitePreviewWorkspace = closeWebsitePreviewWorkspace;

const _setLandingPreviewOpenForHistory = setLandingPreviewOpen;
setLandingPreviewOpen = function(open) {
    const result = _setLandingPreviewOpenForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.setLandingPreviewOpen = setLandingPreviewOpen;

const _startNewLandingProjectForHistory = startNewLandingProject;
startNewLandingProject = function() {
    const result = _startNewLandingProjectForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.startNewLandingProject = startNewLandingProject;

const _saveLandingVersionForHistory = saveLandingVersion;
saveLandingVersion = function() {
    const result = _saveLandingVersionForHistory.apply(this, arguments);
    syncContextHistoryPanel();
    return result;
};
window.saveLandingVersion = saveLandingVersion;

function initContextHistoryPanel() {
    const c = getContextHistoryUI();
    if (!c.panel) return;
    document.querySelectorAll('[data-context-history-tab]').forEach(function(tab) {
        tab.addEventListener('click', function() {
            contextHistoryTab = tab.dataset.contextHistoryTab === 'projects' ? 'projects' : 'conversations';
            syncContextHistoryPanel();
        });
    });
    c.refresh?.addEventListener('click', function() {
        renderContextHistory(true).catch(function(error) { console.warn(error); });
    });
    const introArea = document.getElementById('intro-area');
    const autoGenerationStatus = document.getElementById('auto-generation-status');
    const observer = new MutationObserver(syncContextHistoryPanel);
    if (introArea) observer.observe(introArea, { attributes: true, attributeFilter: ['class'] });
    if (autoGenerationStatus) observer.observe(autoGenerationStatus, { attributes: true, attributeFilter: ['class'] });
    syncContextHistoryPanel();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initContextHistoryPanel);
else initContextHistoryPanel();
