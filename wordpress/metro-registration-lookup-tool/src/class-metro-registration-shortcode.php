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
            $documents_base = rest_url('metro/v1/trailers/');
            $downloads_base = rest_url('metro/v1/documents/');

            ob_start();
            ?>
            <section class="metro-registration-tool" id="<?php echo esc_attr($component_id); ?>">
                <div class="metro-registration-tool__shell">
                    <div class="metro-registration-tool__hero">
                        <div class="metro-registration-tool__hero-copy">
                            <p class="metro-registration-tool__eyebrow">Metro Trailer</p>
                            <h2 class="metro-registration-tool__headline">
                                FIND YOUR
                                <span>REGISTRATION DOCUMENTS</span>
                                FAST
                            </h2>
                            <p class="metro-registration-tool__lede">
                                Search the trailer archive by full or partial unit number, review the matching folders first,
                                and then choose which document to open.
                            </p>
                        </div>
                        <div class="metro-registration-tool__hero-card">
                            <div class="metro-registration-tool__hero-grid" aria-hidden="true"></div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Search behavior</span>
                                <strong>Partial, exact, and normalized matching</strong>
                            </div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Designed for</span>
                                <strong>Mixed numeric and alphanumeric trailer folders</strong>
                            </div>
                        </div>
                    </div>

                    <form class="metro-registration-tool__search" novalidate>
                        <label class="metro-registration-tool__label" for="<?php echo esc_attr($component_id); ?>-query">
                            Search trailer number
                        </label>
                        <div class="metro-registration-tool__search-row">
                            <input
                                class="metro-registration-tool__input"
                                id="<?php echo esc_attr($component_id); ?>-query"
                                name="query"
                                type="text"
                                autocomplete="off"
                                inputmode="text"
                                maxlength="50"
                                placeholder="Try 5318, 8190, MTRZ, 53-0"
                            />
                            <button class="metro-registration-tool__button" type="submit">
                                Search folders
                            </button>
                        </div>
                        <p class="metro-registration-tool__hint">
                            Enter at least 4 characters. Suggestions update as you type and document links stay on the next step.
                        </p>
                        <p class="metro-registration-tool__error" hidden></p>
                    </form>

                    <div class="metro-registration-tool__status" aria-live="polite"></div>
                    <div class="metro-registration-tool__results"></div>
                    <div class="metro-registration-tool__documents" hidden></div>
                </div>
            </section>
            <style>
                #<?php echo esc_attr($component_id); ?> {
                    --metro-navy: #092240;
                    --metro-blue: #092240;
                    --metro-ink: #08111f;
                    --metro-muted: #566273;
                    --metro-border: rgba(13, 47, 99, 0.12);
                    --metro-surface: #ffffff;
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
                    border: 1px solid var(--metro-border);
                    border-radius: 24px;
                    box-shadow: var(--metro-shadow);
                    margin: 0 auto;
                    max-width: 1180px;
                    overflow: hidden;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero {
                    background:
                        linear-gradient(135deg, rgba(9, 34, 64, 0.08), rgba(9, 34, 64, 0)),
                        #ffffff;
                    display: grid;
                    gap: 2rem;
                    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
                    padding: 2.5rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__eyebrow {
                    color: var(--metro-blue);
                    font-size: 0.8rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    margin: 0 0 0.8rem;
                    text-transform: uppercase;
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
                    max-width: 40rem;
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
                    background-position: 0 0;
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

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat-label {
                    color: var(--metro-muted);
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat strong {
                    color: var(--metro-navy);
                    font-size: 1rem;
                    line-height: 1.35;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents {
                    padding-left: 2.5rem;
                    padding-right: 2.5rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search {
                    padding-bottom: 0.75rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__label {
                    color: var(--metro-navy);
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    margin-bottom: 0.8rem;
                    text-transform: uppercase;
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
                    min-height: 60px;
                    padding: 0.95rem 1rem;
                    width: 100%;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__input:focus {
                    border-color: var(--metro-blue);
                    box-shadow: 0 0 0 4px rgba(9, 34, 64, 0.14);
                    outline: none;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__result-button,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-button {
                    appearance: none;
                    background: var(--metro-navy);
                    border: 0;
                    border-radius: 0;
                    color: #ffffff;
                    cursor: pointer;
                    display: inline-flex;
                    font: inherit;
                    font-size: 1rem;
                    font-weight: 800;
                    justify-content: center;
                    letter-spacing: 0.01em;
                    min-height: 60px;
                    padding: 0.95rem 1.4rem;
                    text-transform: uppercase;
                    transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button:hover,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__result-button:hover,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-button:hover {
                    background: var(--metro-blue);
                    transform: translateY(-1px);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hint,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__error {
                    font-size: 0.95rem;
                    margin: 0.7rem 0 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hint {
                    color: var(--metro-muted);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__error {
                    color: #ab1024;
                    font-weight: 700;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status {
                    color: var(--metro-muted);
                    font-size: 0.98rem;
                    min-height: 1.5rem;
                    padding-bottom: 0.75rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results {
                    padding-bottom: 1.8rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results-table,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-card {
                    background: #ffffff;
                    border: 1px solid var(--metro-border);
                    border-radius: 20px;
                    box-shadow: 0 10px 28px rgba(5, 18, 44, 0.05);
                    overflow: hidden;
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
                    font-size: 0.8rem;
                    font-weight: 800;
                    letter-spacing: 0.14em;
                    padding: 1rem 1.25rem;
                    text-align: left;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table tbody tr {
                    border-top: 1px solid rgba(13, 47, 99, 0.08);
                    transition: background 120ms ease;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table tbody tr.is-selected {
                    background: rgba(9, 34, 64, 0.06);
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td {
                    padding: 1rem 1.25rem;
                    vertical-align: middle;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:last-child,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:last-child {
                    text-align: right;
                    white-space: nowrap;
                    width: 1%;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__result-name {
                    color: var(--metro-ink);
                    font-size: 1.08rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    margin: 0;
                    word-break: break-word;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__result-button,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-button {
                    border-radius: 14px;
                    min-height: 52px;
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

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-title {
                    color: var(--metro-navy);
                    font-size: 0.82rem;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                    margin: 0;
                    text-transform: uppercase;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-folder {
                    color: var(--metro-ink);
                    font-size: 1.45rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    margin: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-copy {
                    color: var(--metro-muted);
                    margin: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents-list {
                    display: grid;
                    gap: 0;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-row {
                    align-items: center;
                    border-top: 1px solid rgba(13, 47, 99, 0.08);
                    display: grid;
                    gap: 1rem;
                    grid-template-columns: minmax(0, 1fr) auto;
                    padding: 1rem 1.35rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-name {
                    color: var(--metro-ink);
                    font-size: 1.04rem;
                    font-weight: 700;
                    margin: 0 0 0.35rem;
                    word-break: break-word;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-meta .metro-registration-tool__badge {
                    background: rgba(13, 47, 99, 0.06);
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

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-card {
                        min-height: 180px;
                    }
                }

                @media (max-width: 720px) {
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents {
                        padding-left: 1.2rem;
                        padding-right: 1.2rem;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero {
                        padding-top: 1.5rem;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search-row {
                        grid-template-columns: 1fr;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button {
                        width: 100%;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td {
                        padding-left: 0.9rem;
                        padding-right: 0.9rem;
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
                        documentsBase: <?php echo wp_json_encode($documents_base); ?>,
                        downloadsBase: <?php echo wp_json_encode($downloads_base); ?>,
                    };

                    const form = root.querySelector('.metro-registration-tool__search');
                    const input = root.querySelector('.metro-registration-tool__input');
                    const status = root.querySelector('.metro-registration-tool__status');
                    const error = root.querySelector('.metro-registration-tool__error');
                    const results = root.querySelector('.metro-registration-tool__results');
                    const documents = root.querySelector('.metro-registration-tool__documents');

                    const state = {
                        activeQuery: '',
                        selectedFolderId: null,
                        debounceTimer: null,
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

                    function clearDocuments() {
                        documents.hidden = true;
                        documents.innerHTML = '';
                        state.selectedFolderId = null;
                    }

                    function renderResults(payload) {
                        const totalFolders = payload.inventory && payload.inventory.total_folders
                            ? Number(payload.inventory.total_folders).toLocaleString()
                            : null;
                        const totalMatches = Number(payload.total_matches || 0).toLocaleString();
                        const shownCount = Number(payload.shown_count || 0).toLocaleString();

                        if (!payload.results || payload.results.length === 0) {
                            results.innerHTML = '<div class=\"metro-registration-tool__empty\">No trailer folders matched that search. Try more or fewer characters.</div>';
                            setStatus(totalFolders ? `No matches found in ${totalFolders} indexed folders.` : 'No matches found.');
                            return;
                        }

                        const summary = totalFolders
                            ? `Showing ${shownCount} of ${totalMatches} matching folders from ${totalFolders} indexed SharePoint folders.`
                            : `Showing ${shownCount} of ${totalMatches} matching folders.`;
                        setStatus(summary);

                        results.innerHTML = `
                            <div class=\"metro-registration-tool__results-table\">
                                <table class=\"metro-registration-tool__table\">
                                    <thead>
                                        <tr>
                                            <th scope=\"col\">Trailer Name</th>
                                            <th scope=\"col\">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${payload.results.map(function (folder) {
                                            const selectedClass = state.selectedFolderId === folder.id ? ' class=\"is-selected\"' : '';
                                            return `
                                                <tr data-folder-id=\"${escapeHtml(folder.id)}\"${selectedClass}>
                                                    <td>
                                                        <p class=\"metro-registration-tool__result-name\">${escapeHtml(folder.name)}</p>
                                                    </td>
                                                    <td>
                                                        <button class=\"metro-registration-tool__result-button\" type=\"button\" data-folder-id=\"${escapeHtml(folder.id)}\">
                                                            Show registration documents
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }

                    function renderDocuments(payload) {
                        const folder = payload.folder;
                        const docs = payload.documents || [];
                        documents.hidden = false;

                        if (docs.length === 0) {
                            documents.innerHTML = `
                                <section class=\"metro-registration-tool__documents-card\">
                                    <div class=\"metro-registration-tool__documents-head\">
                                        <p class=\"metro-registration-tool__documents-title\">Document options</p>
                                        <h3 class=\"metro-registration-tool__documents-folder\">${escapeHtml(folder.name)}</h3>
                                        <p class=\"metro-registration-tool__documents-copy\">This folder is present, but no files were returned from SharePoint.</p>
                                    </div>
                                </section>
                            `;
                            return;
                        }

                        documents.innerHTML = `
                            <section class=\"metro-registration-tool__documents-card\">
                                <div class=\"metro-registration-tool__documents-head\">
                                    <p class=\"metro-registration-tool__documents-title\">Document options</p>
                                    <h3 class=\"metro-registration-tool__documents-folder\">${escapeHtml(folder.name)}</h3>
                                    <p class=\"metro-registration-tool__documents-copy\">Choose which file to open. This step stays separate from search so more document types can be added later.</p>
                                </div>
                                <div class=\"metro-registration-tool__documents-list\">
                                    ${docs.map(function (doc) {
                                        return `
                                            <div class=\"metro-registration-tool__document-row\">
                                                <div>
                                                    <p class=\"metro-registration-tool__document-name\">${escapeHtml(doc.name)}</p>
                                                    <div class=\"metro-registration-tool__document-meta\">
                                                        <span class=\"metro-registration-tool__badge\">${escapeHtml(doc.document_type || 'Document')}</span>
                                                        <span class=\"metro-registration-tool__badge\">${escapeHtml(doc.is_pdf ? 'PDF' : (doc.content_type || 'File'))}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    class=\"metro-registration-tool__document-button\"
                                                    type=\"button\"
                                                    data-document-id=\"${escapeHtml(doc.id)}\"
                                                >
                                                    Open document
                                                </button>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </section>
                        `;
                    }

                    async function requestJson(url) {
                        const response = await fetch(url, {
                            credentials: 'same-origin',
                            headers: {
                                'Accept': 'application/json',
                            },
                        });

                        const data = await response.json().catch(function () {
                            return {};
                        });

                        if (!response.ok) {
                            const message = data && data.message
                                ? data.message
                                : (data && data.error)
                                    ? data.error
                                    : 'Request failed.';
                            throw new Error(message);
                        }

                        return data;
                    }

                    async function performSearch(query) {
                        const trimmed = String(query || '').trim();
                        state.activeQuery = trimmed;
                        clearDocuments();

                        if (trimmed.length === 0) {
                            results.innerHTML = '';
                            setStatus('');
                            setError('');
                            return;
                        }

                        if (!/^[A-Za-z0-9_\\-\\s]{4,50}$/.test(trimmed)) {
                            results.innerHTML = '';
                            setStatus('');
                            setError('Enter at least 4 valid characters using letters, numbers, spaces, underscores, or dashes.');
                            return;
                        }

                        setError('');
                        setStatus('Searching SharePoint folder index...');

                        try {
                            const payload = await requestJson(`${endpoints.search}?query=${encodeURIComponent(trimmed)}`);
                            if (state.activeQuery !== trimmed) {
                                return;
                            }

                            renderResults(payload);
                        } catch (requestError) {
                            results.innerHTML = '';
                            clearDocuments();
                            setStatus('');
                            setError(requestError.message || 'Search failed.');
                        }
                    }

                    async function loadDocuments(folderId) {
                        state.selectedFolderId = folderId;
                        root.querySelectorAll('.metro-registration-tool__table tbody tr').forEach(function (row) {
                            row.classList.toggle('is-selected', row.getAttribute('data-folder-id') === folderId);
                        });

                        documents.hidden = false;
                        documents.innerHTML = `
                            <section class=\"metro-registration-tool__documents-card\">
                                <div class=\"metro-registration-tool__documents-head\">
                                    <p class=\"metro-registration-tool__documents-title\">Document options</p>
                                    <h3 class=\"metro-registration-tool__documents-folder\">Loading documents...</h3>
                                    <p class=\"metro-registration-tool__documents-copy\">Fetching files from SharePoint.</p>
                                </div>
                            </section>
                        `;

                        try {
                            const payload = await requestJson(`${endpoints.documentsBase}${encodeURIComponent(folderId)}/documents`);
                            if (state.selectedFolderId !== folderId) {
                                return;
                            }

                            renderDocuments(payload);
                        } catch (requestError) {
                            documents.hidden = false;
                            documents.innerHTML = `
                                <section class=\"metro-registration-tool__documents-card\">
                                    <div class=\"metro-registration-tool__documents-head\">
                                        <p class=\"metro-registration-tool__documents-title\">Document options</p>
                                        <h3 class=\"metro-registration-tool__documents-folder\">Unable to load documents</h3>
                                        <p class=\"metro-registration-tool__documents-copy\">${escapeHtml(requestError.message || 'Document lookup failed.')}</p>
                                    </div>
                                </section>
                            `;
                        }
                    }

                    form.addEventListener('submit', function (event) {
                        event.preventDefault();
                        performSearch(input.value);
                    });

                    input.addEventListener('input', function () {
                        window.clearTimeout(state.debounceTimer);

                        const trimmed = String(input.value || '').trim();
                        if (trimmed.length === 0) {
                            results.innerHTML = '';
                            setStatus('');
                            setError('');
                            clearDocuments();
                            return;
                        }

                        if (trimmed.length < 4) {
                            results.innerHTML = '';
                            setStatus(`Keep typing to search. ${4 - trimmed.length} more character${4 - trimmed.length === 1 ? '' : 's'} needed.`);
                            setError('');
                            clearDocuments();
                            return;
                        }

                        state.debounceTimer = window.setTimeout(function () {
                            performSearch(input.value);
                        }, 180);
                    });

                    root.addEventListener('click', function (event) {
                        const resultButton = event.target.closest('.metro-registration-tool__result-button');
                        if (resultButton) {
                            loadDocuments(String(resultButton.getAttribute('data-folder-id') || ''));
                            return;
                        }

                        const documentButton = event.target.closest('.metro-registration-tool__document-button');
                        if (documentButton) {
                            const documentId = String(documentButton.getAttribute('data-document-id') || '');
                            if (documentId) {
                                window.open(`${endpoints.downloadsBase}${encodeURIComponent(documentId)}/download`, '_blank', 'noopener');
                            }
                        }
                    });
                })();
            </script>
            <?php

            return (string) ob_get_clean();
        }
    }
}
