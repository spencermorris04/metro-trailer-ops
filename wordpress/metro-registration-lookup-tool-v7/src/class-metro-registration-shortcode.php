<?php

if (!class_exists('Metro_Registration_Shortcode')) {
    class Metro_Registration_Shortcode
    {
        public function register(): void
        {
            add_shortcode('metro_registration_lookup', [$this, 'render']);
        }

        public function render(): string
        {
            $component_id = 'metro-registration-lookup-' . wp_generate_uuid4();
            $search_endpoint = rest_url('metro/v1/trailers');
            $exact_batch_endpoint = rest_url('metro/v1/trailers/exact-batch');
            $documents_base = rest_url('metro/v1/trailers/');
            $downloads_base = rest_url('metro/v1/documents/');
            $bulk_download_endpoint = rest_url('metro/v1/registrations/bulk-download');

            ob_start();
            ?>
            <section class="metro-registration-tool" id="<?php echo esc_attr($component_id); ?>">
                <div class="metro-registration-tool__shell">
                    <div class="metro-registration-tool__hero">
                        <div class="metro-registration-tool__hero-copy">
                            <h2 class="metro-registration-tool__headline">
                                FIND YOUR
                                <span>REGISTRATION DOCUMENTS</span>
                                FAST
                            </h2>
                            <p class="metro-registration-tool__lede">
                                Search a single trailer with live suggestions, or paste a comma-separated list to run exact matching,
                                see missing trailers, and download registration PDFs in bulk.
                            </p>
                        </div>
                        <div class="metro-registration-tool__hero-card">
                            <div class="metro-registration-tool__hero-grid" aria-hidden="true"></div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Single trailer</span>
                                <strong>Live suggestions after 4 characters</strong>
                            </div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Available files</span>
                                <strong>Known availability is hidden automatically, and unknown trailers are checked when you click a document link</strong>
                            </div>
                        </div>
                    </div>

                    <form class="metro-registration-tool__search" novalidate>
                        <label class="metro-registration-tool__label" for="<?php echo esc_attr($component_id); ?>-query">
                            Search trailer number
                        </label>
                        <div class="metro-registration-tool__search-row">
                            <textarea
                                class="metro-registration-tool__input"
                                id="<?php echo esc_attr($component_id); ?>-query"
                                name="query"
                                autocomplete="off"
                                rows="3"
                                maxlength="5000"
                                placeholder="Single search: 5318&#10;Batch exact search: 5318190, 5327599, MTRZ281643"
                            ></textarea>
                            <button class="metro-registration-tool__button" type="submit">
                                Search
                            </button>
                        </div>
                        <p class="metro-registration-tool__hint">
                            Enter 4 or more characters for live suggestions. Paste comma-separated or multi-line trailer numbers
                            and click Search to run an exact batch lookup.
                        </p>
                        <p class="metro-registration-tool__error" hidden></p>
                    </form>

                    <div class="metro-registration-tool__status" aria-live="polite"></div>
                    <div class="metro-registration-tool__results"></div>
                </div>
            </section>
            <style>
                #<?php echo esc_attr($component_id); ?> {
                    --metro-navy: #092240;
                    --metro-blue: #092240;
                    --metro-ink: #08111f;
                    --metro-muted: #566273;
                    --metro-border: rgba(13, 47, 99, 0.12);
                    --metro-soft: #f3f6fb;
                    --metro-shadow: 0 18px 45px rgba(5, 18, 44, 0.08);
                    background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
                    color: var(--metro-ink);
                    font-family: Arial, Helvetica, sans-serif;
                    padding: 0;
                }

                #<?php echo esc_attr($component_id); ?>,
                #<?php echo esc_attr($component_id); ?> * {
                    box-sizing: border-box;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__shell {
                    margin: 0 auto;
                    max-width: 1180px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero {
                    background: linear-gradient(135deg, rgba(9, 34, 64, 0.08), rgba(9, 34, 64, 0)), #ffffff;
                    display: grid;
                    gap: 2rem;
                    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
                    padding: 2rem 0 1.5rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__eyebrow,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__label,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__subheading,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-title,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat-label {
                    color: var(--metro-blue);
                    font-size: 0.8rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__eyebrow {
                    margin: 0 0 0.8rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__headline {
                    color: var(--metro-ink);
                    font-size: clamp(2.3rem, 4vw, 4.4rem);
                    font-weight: 900;
                    letter-spacing: -0.04em;
                    line-height: 0.94;
                    margin: 0;
                    max-width: 9ch;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__headline span {
                    color: var(--metro-blue);
                    display: block;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__lede {
                    color: var(--metro-ink);
                    font-size: 1.15rem;
                    line-height: 1.55;
                    margin: 1.5rem 0 0;
                    max-width: 42rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-card {
                    background: var(--metro-soft);
                    border: 1px solid var(--metro-border);
                    border-radius: 22px;
                    min-height: 260px;
                    overflow: hidden;
                    padding: 1.4rem;
                    position: relative;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-grid {
                    background-image: radial-gradient(circle, rgba(13, 47, 99, 0.15) 0 3px, transparent 4px);
                    background-size: 22px 22px;
                    inset: 0;
                    opacity: 0.8;
                    position: absolute;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(13, 47, 99, 0.08);
                    border-radius: 18px;
                    box-shadow: 0 14px 30px rgba(13, 47, 99, 0.08);
                    display: grid;
                    gap: 0.25rem;
                    margin-left: auto;
                    max-width: 320px;
                    padding: 1rem 1.05rem;
                    position: relative;
                    z-index: 1;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat + .metro-registration-tool__hero-stat {
                    margin-top: 0.9rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat strong {
                    color: var(--metro-navy);
                    font-size: 1rem;
                    line-height: 1.35;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results {
                    padding-left: 0;
                    padding-right: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search {
                    padding-bottom: 0.75rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__label {
                    display: block;
                    margin-bottom: 0.8rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search-row {
                    display: grid;
                    gap: 0.9rem;
                    grid-template-columns: minmax(0, 1fr) auto;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__input {
                    appearance: none;
                    background: #ffffff;
                    border: 2px solid rgba(13, 47, 99, 0.18);
                    border-radius: 14px;
                    color: var(--metro-ink);
                    font: inherit;
                    font-size: 1.05rem;
                    min-height: 92px;
                    padding: 0.95rem 1rem;
                    resize: vertical;
                    width: 100%;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__input:focus {
                    border-color: var(--metro-blue);
                    box-shadow: 0 0 0 4px rgba(9, 34, 64, 0.14);
                    outline: none;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__bulk-button {
                    appearance: none;
                    background: var(--metro-navy);
                    border: 0;
                    border-radius: 14px;
                    color: #ffffff;
                    cursor: pointer;
                    display: inline-flex;
                    font: inherit;
                    font-size: 0.95rem;
                    font-weight: 800;
                    justify-content: center;
                    letter-spacing: 0.01em;
                    min-height: 52px;
                    padding: 0.85rem 1.15rem;
                    text-transform: uppercase;
                    transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button {
                    min-height: 92px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button:hover,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__bulk-button:hover {
                    background: var(--metro-blue);
                    transform: translateY(-1px);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button:disabled,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__bulk-button:disabled {
                    cursor: default;
                    opacity: 0.55;
                    transform: none;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hint,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__error,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__toolbar-copy,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__missing-note,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-copy {
                    color: var(--metro-muted);
                    font-size: 0.95rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__error {
                    color: #ab1024;
                    font-weight: 700;
                    margin: 0.7rem 0 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hint {
                    margin: 0.7rem 0 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status {
                    min-height: 1.5rem;
                    padding-bottom: 0.75rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results {
                    display: grid;
                    gap: 1rem;
                    padding-bottom: 1.8rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-toolbar,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__missing-card,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-table,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-card {
                    background: #ffffff;
                    border: 1px solid var(--metro-border);
                    border-radius: 20px;
                    box-shadow: 0 10px 28px rgba(5, 18, 44, 0.05);
                    overflow: hidden;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-toolbar,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__missing-card {
                    padding: 1.2rem 1.25rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-toolbar {
                    align-items: center;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    justify-content: space-between;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__subheading {
                    margin: 0 0 0.45rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__toolbar-copy,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__missing-note,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-copy {
                    margin: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-table {
                    overflow-x: auto;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table {
                    border-collapse: collapse;
                    min-width: 100%;
                    width: 100%;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table thead th {
                    background: rgba(9, 34, 64, 0.04);
                    color: var(--metro-navy);
                    font-size: 0.74rem;
                    font-weight: 800;
                    letter-spacing: 0.14em;
                    padding: 0.75rem 1rem;
                    text-align: left;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table tbody tr {
                    border-top: 1px solid rgba(13, 47, 99, 0.08);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td {
                    padding: 0.7rem 1rem;
                    vertical-align: middle;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__result-name {
                    color: var(--metro-ink);
                    font-size: 0.96rem;
                    font-weight: 500;
                    letter-spacing: 0;
                    line-height: 1.3;
                    margin: 0;
                    word-break: break-word;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-folder,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-name {
                    color: var(--metro-ink);
                    font-weight: 800;
                    margin: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-folder {
                    font-size: 1.45rem;
                    letter-spacing: -0.02em;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-name {
                    font-size: 1.02rem;
                    margin-bottom: 0.35rem;
                    word-break: break-word;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents {
                    padding-bottom: 2.5rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-card {
                    background: linear-gradient(180deg, rgba(9, 34, 64, 0.04), rgba(9, 34, 64, 0));
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-head {
                    border-bottom: 1px solid var(--metro-border);
                    display: grid;
                    gap: 0.4rem;
                    padding: 1.3rem 1.35rem 1rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-list {
                    display: grid;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-row {
                    align-items: center;
                    border-top: 1px solid rgba(13, 47, 99, 0.08);
                    display: grid;
                    gap: 1rem;
                    grid-template-columns: minmax(0, 1fr) auto;
                    padding: 1rem 1.35rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__badge {
                    background: rgba(9, 34, 64, 0.08);
                    border-radius: 999px;
                    color: var(--metro-navy);
                    display: inline-flex;
                    font-size: 0.76rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    padding: 0.45rem 0.65rem;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-cell {
                    min-width: 140px;
                    white-space: nowrap;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-button {
                    appearance: none;
                    background: transparent;
                    border: 0;
                    color: var(--metro-blue);
                    cursor: pointer;
                    display: inline;
                    font: inherit;
                    font-size: 0.9rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    min-height: 0;
                    padding: 0;
                    text-decoration: underline;
                    text-transform: none;
                    transition: color 120ms ease, opacity 120ms ease;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-button:hover {
                    color: var(--metro-navy);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-button:disabled {
                    cursor: default;
                    opacity: 0.55;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-placeholder {
                    color: var(--metro-muted);
                    display: inline-block;
                    font-size: 0.86rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__missing-list {
                    display: grid;
                    gap: 0.45rem;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    margin: 0.8rem 0 0;
                    padding-left: 1.1rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__empty {
                    border: 1px dashed rgba(13, 47, 99, 0.18);
                    border-radius: 18px;
                    color: var(--metro-muted);
                    padding: 1.2rem;
                }

                @media (max-width: 960px) {
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-row {
                        grid-template-columns: 1fr;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero {
                        padding: 1.6rem 0 1.25rem;
                    }
                }

                @media (max-width: 720px) {
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents {
                        padding-left: 0;
                        padding-right: 0;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search-row,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-row {
                        grid-template-columns: 1fr;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button {
                        min-height: 60px;
                    }
                }
            </style>
            <script>
                (function () {
                    const root = document.getElementById(<?php echo wp_json_encode($component_id); ?>);
                    if (!root) {
                        return;
                    }

                    const endpoints = {
                        search: <?php echo wp_json_encode($search_endpoint); ?>,
                        exactBatch: <?php echo wp_json_encode($exact_batch_endpoint); ?>,
                        documentsBase: <?php echo wp_json_encode($documents_base); ?>,
                        downloadsBase: <?php echo wp_json_encode($downloads_base); ?>,
                        bulkDownload: <?php echo wp_json_encode($bulk_download_endpoint); ?>,
                    };

                    const form = root.querySelector('.metro-registration-tool__search');
                    const input = root.querySelector('.metro-registration-tool__input');
                    const status = root.querySelector('.metro-registration-tool__status');
                    const error = root.querySelector('.metro-registration-tool__error');
                    const results = root.querySelector('.metro-registration-tool__results');
                    const searchButton = form.querySelector('.metro-registration-tool__button');

                    const state = {
                        activeQuery: '',
                        debounceTimer: null,
                        bulkFolderIds: [],
                        availabilityByFolder: {},
                        documentsByFolder: {},
                        lastRenderMode: '',
                        lastPayload: null,
                    };

                    function escapeHtml(value) {
                        return String(value)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                    }

                    function setError(message) {
                        if (!message) {
                            error.hidden = true;
                            error.textContent = '';
                            return;
                        }

                        error.hidden = false;
                        error.textContent = message;
                    }

                    function setStatus(message) {
                        status.textContent = message || '';
                    }

                    function setBusy(isBusy) {
                        searchButton.disabled = isBusy;
                    }

                    function clearDocuments() {
                        return;
                    }

                    function clearResults() {
                        results.innerHTML = '';
                        state.bulkFolderIds = [];
                    }

                    function isBatchQuery(value) {
                        return /[,;\n\r]/.test(String(value || ''));
                    }

                    function parseBatchQueries(value) {
                        return String(value || '')
                            .split(/[\n\r,;]+/)
                            .map(function (entry) { return entry.trim(); })
                            .filter(function (entry) { return entry.length > 0; });
                    }

                    function getAvailability(folder) {
                        const cached = state.availabilityByFolder[folder.id] || {};
                        const registration = typeof folder.has_registration_pdf === 'boolean'
                            ? folder.has_registration_pdf
                            : (typeof cached.has_registration_pdf === 'boolean' ? cached.has_registration_pdf : null);
                        const fhwa = typeof folder.has_fhwa_pdf === 'boolean'
                            ? folder.has_fhwa_pdf
                            : (typeof cached.has_fhwa_pdf === 'boolean' ? cached.has_fhwa_pdf : null);

                        return {
                            has_registration_pdf: registration,
                            has_fhwa_pdf: fhwa,
                        };
                    }

                    function setAvailability(folderId, availability) {
                        state.availabilityByFolder[folderId] = {
                            has_registration_pdf: availability.has_registration_pdf,
                            has_fhwa_pdf: availability.has_fhwa_pdf,
                        };
                    }

                    function rerenderResults() {
                        if (state.lastRenderMode === 'single' && state.lastPayload) {
                            renderSingleResults(state.lastPayload);
                        } else if (state.lastRenderMode === 'batch' && state.lastPayload) {
                            renderBatchResults(state.lastPayload);
                        }
                    }

                    function syncAvailabilityFromDocuments(folderId, payload) {
                        const documents = Array.isArray(payload && payload.documents) ? payload.documents : [];
                        const availability = {
                            has_registration_pdf: documents.some(function (item) {
                                return item.document_type === 'Registration' && !!item.is_pdf;
                            }),
                            has_fhwa_pdf: documents.some(function (item) {
                                return item.document_type === 'FHWA Inspection' && !!item.is_pdf;
                            }),
                        };

                        setAvailability(folderId, availability);
                        return availability;
                    }

                    function buildMissingDocumentMessage(folderName, documentType) {
                        return `${documentType} PDF was not found for trailer ${folderName}. This row will now show that document as not available.`;
                    }

                    function renderDocButton(folderId, documentType, label, available) {
                        if (available === false) {
                            return '<span class="metro-registration-tool__doc-placeholder">Not available</span>';
                        }

                        if (available === true || available === null) {
                            return `<button class="metro-registration-tool__doc-button" type="button" data-folder-id="${escapeHtml(folderId)}" data-document-type="${escapeHtml(documentType)}">${escapeHtml(label)}</button>`;
                        }

                        return '';
                    }

                    function renderSingleResults(payload) {
                        state.lastRenderMode = 'single';
                        state.lastPayload = payload;
                        state.bulkFolderIds = [];

                        const folders = payload.results || [];
                        if (folders.length === 0) {
                            results.innerHTML = '<div class="metro-registration-tool__empty">No trailer folders matched that search. Try more or fewer characters.</div>';
                            setStatus(payload.inventory && payload.inventory.total_folders
                                ? `No matches found in ${Number(payload.inventory.total_folders).toLocaleString()} indexed folders.`
                                : 'No matches found.');
                            return;
                        }

                        setStatus(
                            payload.inventory && payload.inventory.total_folders
                                ? `Showing ${Number(payload.shown_count || 0).toLocaleString()} of ${Number(payload.total_matches || 0).toLocaleString()} matching folders from ${Number(payload.inventory.total_folders).toLocaleString()} indexed SharePoint folders.`
                                : `Showing ${Number(payload.shown_count || 0).toLocaleString()} of ${Number(payload.total_matches || 0).toLocaleString()} matching folders.`
                        );

                        results.innerHTML = `
                            <div class="metro-registration-tool__results-table">
                                <table class="metro-registration-tool__table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Trailer Name</th>
                                            <th scope="col">Registration</th>
                                            <th scope="col">FHWA Inspection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${folders.map(function (folder) {
                                            const availability = getAvailability(folder);
                                            return `
                                                <tr data-folder-id="${escapeHtml(folder.id)}">
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(folder.name)}</p></td>
                                                    <td class="metro-registration-tool__doc-cell">${renderDocButton(folder.id, 'Registration', 'Open registration', availability.has_registration_pdf)}</td>
                                                    <td class="metro-registration-tool__doc-cell">${renderDocButton(folder.id, 'FHWA Inspection', 'Open FHWA', availability.has_fhwa_pdf)}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }

                    function renderBatchResults(payload) {
                        state.lastRenderMode = 'batch';
                        state.lastPayload = payload;
                        const rows = payload.results || [];
                        state.bulkFolderIds = rows.map(function (item) {
                            return item.folder.id;
                        });

                        let html = `
                            <div class="metro-registration-tool__results-toolbar">
                                <div>
                                    <p class="metro-registration-tool__subheading">Batch exact lookup</p>
                                    <p class="metro-registration-tool__toolbar-copy">Matched ${Number(payload.matched_count || 0).toLocaleString()} of ${Number(payload.requested_count || 0).toLocaleString()} requested trailer numbers.</p>
                                </div>
                                ${payload.can_download_all ? '<button class="metro-registration-tool__bulk-button" type="button">Download all registration PDFs</button>' : '<p class="metro-registration-tool__toolbar-copy">Bulk ZIP download is only available when fewer than 100 trailers are matched.</p>'}
                            </div>
                        `;

                        if (rows.length > 0) {
                            html += `
                                <div class="metro-registration-tool__results-table">
                                    <table class="metro-registration-tool__table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Requested Trailer</th>
                                                <th scope="col">Matched Trailer</th>
                                                <th scope="col">Registration</th>
                                                <th scope="col">FHWA Inspection</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${rows.map(function (item) {
                                                const folder = item.folder;
                                                const availability = getAvailability(folder);
                                                return `
                                                    <tr data-folder-id="${escapeHtml(folder.id)}">
                                                        <td>${escapeHtml(item.requested)}</td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(folder.name)}</p></td>
                                                        <td class="metro-registration-tool__doc-cell">${renderDocButton(folder.id, 'Registration', 'Open registration', availability.has_registration_pdf)}</td>
                                                        <td class="metro-registration-tool__doc-cell">${renderDocButton(folder.id, 'FHWA Inspection', 'Open FHWA', availability.has_fhwa_pdf)}</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `;
                        } else {
                            html += '<div class="metro-registration-tool__empty">No exact trailer matches were found for this batch.</div>';
                        }

                        if ((payload.missing || []).length > 0) {
                            html += `
                                <div class="metro-registration-tool__missing-card">
                                    <p class="metro-registration-tool__subheading">Not Found</p>
                                    <p class="metro-registration-tool__missing-note">These trailer numbers did not resolve to an exact SharePoint folder match.</p>
                                    <ul class="metro-registration-tool__missing-list">
                                        ${payload.missing.map(function (item) { return `<li>${escapeHtml(item)}</li>`; }).join('')}
                                    </ul>
                                </div>
                            `;
                        }

                        results.innerHTML = html;
                        setStatus(`Checked ${Number(payload.requested_count || 0).toLocaleString()} trailer numbers. Found ${Number(payload.matched_count || 0).toLocaleString()} exact matches and ${Number(payload.missing_count || 0).toLocaleString()} without a match.`);
                    }

                    async function requestJson(url, options) {
                        const response = await fetch(url, Object.assign({
                            credentials: 'same-origin',
                            headers: {
                                'Accept': 'application/json',
                            },
                        }, options || {}));

                        const data = await response.json().catch(function () { return {}; });
                        if (!response.ok) {
                            throw new Error(data && data.message ? data.message : 'Request failed.');
                        }

                        return data;
                    }

                    async function requestBlob(url, options) {
                        const response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
                        if (!response.ok) {
                            const data = await response.json().catch(function () { return {}; });
                            throw new Error(data && data.message ? data.message : 'Download failed.');
                        }

                        const disposition = response.headers.get('Content-Disposition') || '';
                        const match = disposition.match(/filename="?([^";]+)"?/i);
                        return {
                            blob: await response.blob(),
                            filename: match ? match[1] : 'metro-registration-documents.zip',
                        };
                    }

                    async function getDocuments(folderId) {
                        if (state.documentsByFolder[folderId]) {
                            syncAvailabilityFromDocuments(folderId, state.documentsByFolder[folderId]);
                            return state.documentsByFolder[folderId];
                        }

                        const payload = await requestJson(`${endpoints.documentsBase}${encodeURIComponent(folderId)}/documents`);
                        state.documentsByFolder[folderId] = payload;
                        syncAvailabilityFromDocuments(folderId, payload);
                        return payload;
                    }

                    async function openDocumentByType(folderId, documentType) {
                        const trailerLabel = folderId;

                        try {
                            setError('');
                            setStatus(`Checking ${documentType.toLowerCase()} for trailer ${trailerLabel}...`);
                            const payload = await getDocuments(folderId);
                            const folderName = payload.folder && payload.folder.name ? payload.folder.name : trailerLabel;
                            const availability = getAvailability({
                                id: folderId,
                                has_registration_pdf: null,
                                has_fhwa_pdf: null,
                            });
                            rerenderResults();
                            const document = (payload.documents || []).find(function (item) {
                                return item.document_type === documentType && item.is_pdf;
                            });

                            if (!document) {
                                setStatus('');
                                setError(buildMissingDocumentMessage(folderName, documentType));
                                return;
                            }

                            setStatus(`Opening ${documentType.toLowerCase()} for trailer ${folderName}...`);
                            window.open(`${endpoints.downloadsBase}${encodeURIComponent(document.id)}/download`, '_blank', 'noopener');
                        } catch (requestError) {
                            setStatus('');
                            setError(requestError.message || 'Document lookup failed.');
                        }
                    }

                    async function performSingleSearch(query, silent) {
                        if (!/^[A-Za-z0-9_\-\s]{4,50}$/.test(query)) {
                            clearResults();
                            if (!silent) {
                                setStatus('');
                                setError('Enter at least 4 valid characters using letters, numbers, spaces, underscores, or dashes.');
                            }
                            return;
                        }

                        if (!silent) {
                            setBusy(true);
                            setError('');
                            setStatus('Searching SharePoint folder index...');
                        }

                        try {
                            const payload = await requestJson(`${endpoints.search}?query=${encodeURIComponent(query)}`);
                            if (state.activeQuery !== query) {
                                return;
                            }

                            renderSingleResults(payload);
                        } catch (requestError) {
                            clearResults();
                            if (!silent) {
                                setStatus('');
                                setError(requestError.message || 'Search failed.');
                            }
                        } finally {
                            if (!silent) {
                                setBusy(false);
                            }
                        }
                    }

                    async function performBatchSearch(query) {
                        const trailers = parseBatchQueries(query);
                        if (trailers.length === 0) {
                            clearResults();
                            setStatus('');
                            setError('Enter at least one trailer number for exact batch lookup.');
                            return;
                        }

                        setBusy(true);
                        setError('');
                        setStatus(`Checking ${trailers.length} trailer numbers for exact matches...`);

                        try {
                            const payload = await requestJson(endpoints.exactBatch, {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    trailers: trailers,
                                }),
                            });

                            if (state.activeQuery !== query) {
                                return;
                            }

                            renderBatchResults(payload);
                        } catch (requestError) {
                            clearResults();
                            setStatus('');
                            setError(requestError.message || 'Batch lookup failed.');
                        } finally {
                            setBusy(false);
                        }
                    }

                    async function performSearch(query, silent) {
                        const trimmed = String(query || '').trim();
                        state.activeQuery = trimmed;
                        clearDocuments();

                        if (trimmed.length === 0) {
                            clearResults();
                            setStatus('');
                            setError('');
                            return;
                        }

                        if (isBatchQuery(trimmed)) {
                            if (!silent) {
                                await performBatchSearch(trimmed);
                            }
                            return;
                        }

                        await performSingleSearch(trimmed, !!silent);
                    }

                    async function downloadBulkDocuments() {
                        if (state.bulkFolderIds.length === 0 || state.bulkFolderIds.length >= 100) {
                            return;
                        }

                        const bulkButton = root.querySelector('.metro-registration-tool__bulk-button');
                        if (bulkButton) {
                            bulkButton.disabled = true;
                        }

                        setError('');
                        setStatus(`Preparing ${state.bulkFolderIds.length} registration PDFs...`);

                        try {
                            const response = await requestBlob(endpoints.bulkDownload, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    folderIds: state.bulkFolderIds,
                                }),
                            });

                            const url = window.URL.createObjectURL(response.blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = response.filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                            setStatus(`Downloaded ${state.bulkFolderIds.length} registration PDFs as a ZIP file.`);
                        } catch (requestError) {
                            setError(requestError.message || 'Bulk download failed.');
                        } finally {
                            if (bulkButton) {
                                bulkButton.disabled = false;
                            }
                        }
                    }

                    form.addEventListener('submit', function (event) {
                        event.preventDefault();
                        performSearch(input.value, false);
                    });

                    input.addEventListener('input', function () {
                        window.clearTimeout(state.debounceTimer);

                        const trimmed = String(input.value || '').trim();
                        state.activeQuery = trimmed;

                        if (trimmed.length === 0) {
                            clearResults();
                            clearDocuments();
                            setStatus('');
                            setError('');
                            return;
                        }

                        if (isBatchQuery(trimmed)) {
                            clearResults();
                            clearDocuments();
                            setError('');
                            setStatus('Comma-separated lists run as an exact batch lookup when you click Search.');
                            return;
                        }

                        if (trimmed.length < 4) {
                            clearResults();
                            clearDocuments();
                            setError('');
                            setStatus(`Keep typing to search. ${4 - trimmed.length} more character${4 - trimmed.length === 1 ? '' : 's'} needed.`);
                            return;
                        }

                        if (!/^[A-Za-z0-9_\-\s]{4,50}$/.test(trimmed)) {
                            clearResults();
                            clearDocuments();
                            setStatus('');
                            setError('Enter at least 4 valid characters using letters, numbers, spaces, underscores, or dashes.');
                            return;
                        }

                        state.debounceTimer = window.setTimeout(function () {
                            performSingleSearch(trimmed, false);
                        }, 180);
                    });

                    root.addEventListener('click', function (event) {
                        const docButton = event.target.closest('.metro-registration-tool__doc-button');
                        if (docButton) {
                            openDocumentByType(
                                String(docButton.getAttribute('data-folder-id') || ''),
                                String(docButton.getAttribute('data-document-type') || '')
                            );
                            return;
                        }

                        const bulkButton = event.target.closest('.metro-registration-tool__bulk-button');
                        if (bulkButton) {
                            downloadBulkDocuments();
                        }
                    });
                })();
            </script>
            <?php

            return (string) ob_get_clean();
        }
    }
}
