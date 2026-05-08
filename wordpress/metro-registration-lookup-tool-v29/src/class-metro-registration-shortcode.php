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
                                Find Trailer
                                <span>Documents &amp; Details</span>
                            </h2>
                            <p class="metro-registration-tool__lede">
                                Search trailer records by trailer number, VIN, or registration number.
                            </p>
                            <p class="metro-registration-tool__lede metro-registration-tool__lede--detail">
                                Results combine Business Central metadata with SharePoint document availability. Enter one identifier to see live matches, or paste a comma-separated list to run an exact batch lookup and review what matched before you open documents.
                            </p>
                        </div>
                        <div class="metro-registration-tool__hero-card">
                            <div class="metro-registration-tool__hero-grid" aria-hidden="true"></div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Single trailer lookup</span>
                                <strong>Start typing a trailer number, VIN, or registration number and we&apos;ll suggest matches after the first few characters.</strong>
                            </div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Multi trailer lookup</span>
                                <strong>Paste a list of identifiers to review exact matches, missing units, and available documents all at once.</strong>
                            </div>
                            <div class="metro-registration-tool__hero-stat">
                                <span class="metro-registration-tool__hero-stat-label">Vehicle details</span>
                                <strong>See the trailer description, make, year, VIN, and registration number in the same results table as the document actions.</strong>
                            </div>
                        </div>
                    </div>

                    <form class="metro-registration-tool__search" novalidate>
                        <label class="metro-registration-tool__label" for="<?php echo esc_attr($component_id); ?>-query">
                            Search trailer number, VIN, or registration number
                        </label>
                        <div class="metro-registration-tool__search-row">
                            <textarea
                                class="metro-registration-tool__input"
                                id="<?php echo esc_attr($component_id); ?>-query"
                                name="query"
                                autocomplete="off"
                                rows="2"
                                maxlength="5000"
                                placeholder="5318190, 1UYVS25391C391407, 083379T, or a comma-separated list"
                            ></textarea>
                            <button class="metro-registration-tool__button" type="submit">
                                Search
                            </button>
                        </div>
                        <p class="metro-registration-tool__hint">
                            Enter 4 or more characters for live suggestions. Paste comma-separated or multi-line identifiers
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
                    padding-top: 1rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero {
                    background: linear-gradient(135deg, rgba(9, 34, 64, 0.08), rgba(9, 34, 64, 0)), #ffffff;
                    border-radius: 24px;
                    display: grid;
                    gap: 2rem;
                    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
                    overflow: hidden;
                    padding: 2rem 1rem 1.5rem;
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
                    font-size: clamp(2rem, 3.6vw, 3.8rem);
                    font-weight: 900;
                    letter-spacing: -0.04em;
                    line-height: 0.98;
                    margin: 0;
                    max-width: 12ch;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__headline span {
                    color: var(--metro-blue);
                    display: block;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__lede {
                    color: var(--metro-ink);
                    font-size: 1.08rem;
                    line-height: 1.55;
                    margin: 1rem 0 0;
                    max-width: 46rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__lede--detail {
                    color: var(--metro-muted);
                    font-size: 1rem;
                    line-height: 1.65;
                    margin-top: 0.85rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-card {
                    background: var(--metro-soft);
                    border: 1px solid var(--metro-border);
                    border-radius: 22px;
                    min-height: 320px;
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
                    max-width: 340px;
                    padding: 1rem 1.05rem;
                    position: relative;
                    z-index: 1;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat + .metro-registration-tool__hero-stat {
                    margin-top: 0.9rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero-stat strong {
                    color: var(--metro-muted);
                    font-size: 0.93rem;
                    font-weight: 600;
                    line-height: 1.45;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results {
                    padding-left: 1rem;
                    padding-right: 1rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search {
                    padding-bottom: 0.75rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__label {
                    display: block;
                    margin-bottom: 0.8rem;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search-row {
                    align-items: center;
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
                    font-size: 1rem;
                    line-height: 1.3;
                    min-height: 52px;
                    padding: 0.6rem 0.9rem;
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
                    align-self: center;
                    min-height: 52px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__bulk-button {
                    font-weight: 600;
                    text-transform: none;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__bulk-button.is-loading {
                    opacity: 0.72;
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
                    table-layout: fixed;
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
                    overflow-wrap: normal;
                    word-break: normal;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(1),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(1) {
                    min-width: 130px;
                    width: 130px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(2),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(2) {
                    min-width: 210px;
                    width: 210px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(3),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(3) {
                    min-width: 140px;
                    width: 140px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(4),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(4) {
                    min-width: 90px;
                    width: 90px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(5),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(5) {
                    min-width: 280px;
                    width: 280px;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table th:nth-child(6),
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table td:nth-child(6) {
                    min-width: 150px;
                    width: 150px;
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
                    text-align: center;
                    min-width: 170px;
                    white-space: nowrap;
                }

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__table thead th.metro-registration-tool__doc-heading {
                    text-align: center;
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

                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-button.is-loading,
                #<?php echo esc_attr($component_id); ?> .metro-registration-tool__doc-button:disabled {
                    color: var(--metro-muted);
                    cursor: default;
                    opacity: 0.55;
                    text-decoration: none;
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
                        padding: 1.6rem 0.85rem 1.25rem;
                    }
                }

                @media (max-width: 720px) {
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__hero,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__status,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__results,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__documents {
                        padding-left: 0.7rem;
                        padding-right: 0.7rem;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__search-row,
                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__document-row {
                        grid-template-columns: 1fr;
                    }

                    #<?php echo esc_attr($component_id); ?> .metro-registration-tool__button {
                        min-height: 48px;
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
                            bulkTrailers: [],
                            bulkDownloadPhase: '',
                            availabilityByFolder: {},
                        documentsByFolder: {},
                        pendingDocumentActions: {},
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

                    function getAvailability(trailer) {
                        const folder = trailer && trailer.folder ? trailer.folder : null;
                        if (!folder || !folder.id) {
                            return {
                                has_registration_pdf: false,
                                has_fhwa_pdf: false,
                            };
                        }

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

                    function getDocumentActionKey(folderId, documentType) {
                        return `${folderId}::${documentType}`;
                    }

                    function setPendingDocumentAction(folderId, documentType, phase) {
                        const key = getDocumentActionKey(folderId, documentType);
                        if (!phase) {
                            delete state.pendingDocumentActions[key];
                            return;
                        }

                        state.pendingDocumentActions[key] = phase;
                    }

                    function getPendingDocumentAction(folderId, documentType) {
                        return state.pendingDocumentActions[getDocumentActionKey(folderId, documentType)] || null;
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
                        return `${documentType} PDF was not found for trailer ${folderName}.`;
                    }

                    function getLoadingLabel(documentType, phase) {
                        if (phase === 'opening') {
                            return 'Opening...';
                        }

                        return 'Checking...';
                    }

                    function getBulkButtonLabel() {
                        if (state.bulkDownloadPhase === 'preparing') {
                            return 'Preparing download...';
                        }

                        if (state.bulkDownloadPhase === 'starting') {
                            return 'Starting download...';
                        }

                        return 'Download all documents';
                    }

                    function renderDocButton(trailer, documentType, label) {
                        const folder = trailer && trailer.folder ? trailer.folder : null;
                        if (!folder || !folder.id) {
                            return '<span class="metro-registration-tool__doc-placeholder">No folder match</span>';
                        }

                        const availability = getAvailability(trailer);
                        const available = documentType === 'Registration'
                            ? availability.has_registration_pdf
                            : availability.has_fhwa_pdf;

                        if (available === false) {
                            return '<span class="metro-registration-tool__doc-placeholder">Not available</span>';
                        }

                        const pendingPhase = getPendingDocumentAction(folder.id, documentType);
                        if (available === true || available === null) {
                            const loadingClass = pendingPhase ? ' is-loading' : '';
                            const disabledAttr = pendingPhase ? ' disabled' : '';
                            const buttonLabel = pendingPhase ? getLoadingLabel(documentType, pendingPhase) : label;
                            return `<button class="metro-registration-tool__doc-button${loadingClass}" type="button" data-folder-id="${escapeHtml(folder.id)}" data-document-type="${escapeHtml(documentType)}"${disabledAttr}>${escapeHtml(buttonLabel)}</button>`;
                        }

                        return '';
                    }

                    function renderSingleResults(payload) {
                        state.lastRenderMode = 'single';
                        state.lastPayload = payload;
                        state.bulkFolderIds = [];
                        state.bulkTrailers = [];

                        const folders = payload.results || [];
                        if (folders.length === 0) {
                            results.innerHTML = '<div class="metro-registration-tool__empty">We didn\'t find any matching trailers. Try a shorter or longer search.</div>';
                            setStatus('No matching trailers found.');
                            return;
                        }

                        setStatus(
                            `Showing ${Number(payload.shown_count || 0).toLocaleString()} of ${Number(payload.total_matches || 0).toLocaleString()} matching trailers.`
                        );

                        results.innerHTML = `
                            <div class="metro-registration-tool__results-table">
                                <table class="metro-registration-tool__table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Trailer #</th>
                                            <th scope="col">Description</th>
                                            <th scope="col">Make</th>
                                            <th scope="col">Year</th>
                                            <th scope="col">Serial/VIN</th>
                                            <th scope="col">Registration #</th>
                                            <th scope="col" class="metro-registration-tool__doc-heading">Registration</th>
                                            <th scope="col" class="metro-registration-tool__doc-heading">Inspection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${folders.map(function (trailer) {
                                            return `
                                                <tr data-folder-id="${escapeHtml(trailer.folder && trailer.folder.id ? trailer.folder.id : '')}">
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.trailer_number || '')}</p></td>
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.description || '')}</p></td>
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.make || '')}</p></td>
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.vehicle_year || '')}</p></td>
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.serial_vin || '')}</p></td>
                                                    <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.registration_number || '')}</p></td>
                                                    <td class="metro-registration-tool__doc-cell">${renderDocButton(trailer, 'Registration', 'Open registration')}</td>
                                                    <td class="metro-registration-tool__doc-cell">${renderDocButton(trailer, 'FHWA Inspection', 'Open inspection')}</td>
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
                        state.bulkFolderIds = Array.from(new Set(rows.map(function (item) {
                            return item.trailer && item.trailer.folder ? item.trailer.folder.id : '';
                        }).filter(function (folderId) {
                            return !!folderId;
                        })));
                        state.bulkTrailers = rows.map(function (item) {
                            return item.trailer;
                        }).filter(function (trailer) {
                            return !!trailer;
                        });

                        let html = `
                            <div class="metro-registration-tool__results-toolbar">
                                <div>
                                    <p class="metro-registration-tool__subheading">${payload.requested_count === 1 ? 'Exact lookup' : 'Batch lookup'}</p>
                                    <p class="metro-registration-tool__toolbar-copy">Found ${Number(payload.matched_count || 0).toLocaleString()} matches from ${Number(payload.requested_count || 0).toLocaleString()} requested identifiers.</p>
                                </div>
                                ${payload.can_download_all ? `<button class="metro-registration-tool__bulk-button${state.bulkDownloadPhase ? ' is-loading' : ''}" type="button"${state.bulkDownloadPhase ? ' disabled' : ''}>${escapeHtml(getBulkButtonLabel())}</button>` : '<p class="metro-registration-tool__toolbar-copy">Download all documents is available when fewer than 100 folder-backed trailers are matched.</p>'}
                            </div>
                        `;

                        if (rows.length > 0) {
                            html += `
                                <div class="metro-registration-tool__results-table">
                                    <table class="metro-registration-tool__table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Requested</th>
                                                <th scope="col">Trailer #</th>
                                                <th scope="col">Description</th>
                                                <th scope="col">Make</th>
                                                <th scope="col">Year</th>
                                                <th scope="col">Serial/VIN</th>
                                                <th scope="col">Registration #</th>
                                                <th scope="col" class="metro-registration-tool__doc-heading">Registration</th>
                                                <th scope="col" class="metro-registration-tool__doc-heading">Inspection</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${rows.map(function (item) {
                                                const trailer = item.trailer;
                                                return `
                                                    <tr data-folder-id="${escapeHtml(trailer.folder && trailer.folder.id ? trailer.folder.id : '')}">
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(item.requested || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.trailer_number || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.description || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.make || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.vehicle_year || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.serial_vin || '')}</p></td>
                                                        <td><p class="metro-registration-tool__result-name">${escapeHtml(trailer.registration_number || '')}</p></td>
                                                        <td class="metro-registration-tool__doc-cell">${renderDocButton(trailer, 'Registration', 'Open registration')}</td>
                                                        <td class="metro-registration-tool__doc-cell">${renderDocButton(trailer, 'FHWA Inspection', 'Open inspection')}</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `;
                        } else {
                            html += '<div class="metro-registration-tool__empty">We didn\'t find any matching trailers from that list.</div>';
                        }

                        if ((payload.missing || []).length > 0) {
                            html += `
                                <div class="metro-registration-tool__missing-card">
                                    <p class="metro-registration-tool__subheading">Not Found</p>
                                    <p class="metro-registration-tool__missing-note">We didn't find a match for these identifiers.</p>
                                    <ul class="metro-registration-tool__missing-list">
                                        ${payload.missing.map(function (item) { return `<li>${escapeHtml(item)}</li>`; }).join('')}
                                    </ul>
                                </div>
                            `;
                        }

                        results.innerHTML = html;
                        setStatus(`Checked ${Number(payload.requested_count || 0).toLocaleString()} identifiers. Found ${Number(payload.matched_count || 0).toLocaleString()} matches and ${Number(payload.missing_count || 0).toLocaleString()} without a match.`);
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
                            throw new Error(data && data.message ? data.message : 'Something went wrong. Please try again.');
                        }

                        return data;
                    }

                    async function requestBlob(url, options) {
                        const response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
                        if (!response.ok) {
                            const data = await response.json().catch(function () { return {}; });
                            throw new Error(data && data.message ? data.message : 'We couldn\'t prepare the download.');
                        }

                        const disposition = response.headers.get('Content-Disposition') || '';
                        const match = disposition.match(/filename="?([^";]+)"?/i);
                        return {
                            blob: await response.blob(),
                            filename: match ? match[1] : 'metro-trailer-documents.zip',
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
                            setPendingDocumentAction(folderId, documentType, 'checking');
                            rerenderResults();
                            setError('');
                            const payload = await getDocuments(folderId);
                            const folderName = payload.folder && payload.folder.name ? payload.folder.name : trailerLabel;
                            const document = (payload.documents || []).find(function (item) {
                                return item.document_type === documentType && item.is_pdf;
                            });

                            if (!document) {
                                setPendingDocumentAction(folderId, documentType, null);
                                rerenderResults();
                                setError(buildMissingDocumentMessage(folderName, documentType));
                                return;
                            }

                            setPendingDocumentAction(folderId, documentType, 'opening');
                            rerenderResults();
                            window.open(`${endpoints.downloadsBase}${encodeURIComponent(document.id)}/download`, '_blank', 'noopener');
                            window.setTimeout(function () {
                                setPendingDocumentAction(folderId, documentType, null);
                                rerenderResults();
                            }, 1200);
                        } catch (requestError) {
                            setPendingDocumentAction(folderId, documentType, null);
                            rerenderResults();
                            setError(requestError.message || 'We couldn\'t open that document.');
                        }
                    }

                    async function performSingleSearch(query, silent) {
                        const normalizedQuery = String(query || '').replace(/[^A-Za-z0-9_\-\s]/g, '').trim();
                        if (normalizedQuery.length < 4 || normalizedQuery.length > 50) {
                            clearResults();
                            if (!silent) {
                                setStatus('');
                                setError('Enter at least 4 letters or numbers to search.');
                            }
                            return;
                        }

                        if (!silent) {
                            setBusy(true);
                            setError('');
                            setStatus('Searching trailers...');
                        }

                        try {
                            const payload = await requestJson(`${endpoints.search}?query=${encodeURIComponent(query)}&_metro=${Date.now()}`);
                            if (state.activeQuery !== query) {
                                return;
                            }

                            renderSingleResults(payload);
                        } catch (requestError) {
                            clearResults();
                            if (!silent) {
                                setStatus('');
                                setError(requestError.message || 'We couldn\'t search right now.');
                            }
                        } finally {
                            if (!silent) {
                                setBusy(false);
                            }
                        }
                    }

                    async function performExactSingleLookup(query) {
                        const normalizedQuery = String(query || '').replace(/[^A-Za-z0-9_\-\s]/g, '').trim();
                        if (normalizedQuery.length < 1 || normalizedQuery.length > 50) {
                            clearResults();
                            setStatus('');
                            setError('Enter a valid trailer number, VIN, or registration number.');
                            return;
                        }

                        setBusy(true);
                        setError('');
                        setStatus('Looking up exact trailer match...');

                        try {
                            const payload = await requestJson(`${endpoints.exactBatch}?_metro=${Date.now()}`, {
                                method: 'POST',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    trailers: [normalizedQuery],
                                }),
                            });

                            if (state.activeQuery !== query) {
                                return;
                            }

                            if ((payload.matched_count || 0) > 0) {
                                renderBatchResults(payload);
                                return;
                            }

                            await performSingleSearch(query, false);
                        } catch (requestError) {
                            clearResults();
                            setStatus('');
                            setError(requestError.message || 'We couldn\'t look up that trailer right now.');
                        } finally {
                            setBusy(false);
                        }
                    }

                    async function performBatchSearch(query) {
                        const trailers = parseBatchQueries(query);
                        if (trailers.length === 0) {
                            clearResults();
                            setStatus('');
                            setError('Enter at least one identifier for batch lookup.');
                            return;
                        }

                        setBusy(true);
                        setError('');
                        setStatus(`Looking up ${trailers.length} identifiers...`);

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
                            setError(requestError.message || 'We couldn\'t check that list right now.');
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

                        if (silent) {
                            await performSingleSearch(trimmed, true);
                            return;
                        }

                        await performExactSingleLookup(trimmed);
                    }

                    async function downloadBulkDocuments() {
                        if (state.bulkFolderIds.length === 0 || state.bulkFolderIds.length >= 100) {
                            return;
                        }

                        state.bulkDownloadPhase = 'preparing';
                        rerenderResults();
                        setError('');
                        setStatus(`Preparing ${state.bulkFolderIds.length} trailer folders...`);

                        try {
                            const response = await requestBlob(endpoints.bulkDownload, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    folderIds: state.bulkFolderIds,
                                    trailers: state.bulkTrailers,
                                }),
                            });

                            state.bulkDownloadPhase = 'starting';
                            rerenderResults();
                            const url = window.URL.createObjectURL(response.blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = response.filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                            setStatus('Your download is starting.');
                            window.setTimeout(function () {
                                state.bulkDownloadPhase = '';
                                rerenderResults();
                            }, 1200);
                        } catch (requestError) {
                            state.bulkDownloadPhase = '';
                            rerenderResults();
                            setError(requestError.message || 'We couldn\'t prepare the download.');
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
                            setStatus('Paste a comma-separated list and click Search to run an exact batch lookup.');
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
