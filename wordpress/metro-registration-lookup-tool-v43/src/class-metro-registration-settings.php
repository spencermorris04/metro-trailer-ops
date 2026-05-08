<?php

if (!class_exists('Metro_Registration_Settings')) {
    class Metro_Registration_Settings
    {
        public const OPTION_NAME = 'metro_registration_lookup_tool_settings';
        private const AJAX_NONCE_ACTION = 'metro_registration_lookup_refresh_index';

        private const GRAPH_FIELD_LABELS = [
            'METRO_GRAPH_TENANT_ID' => 'Tenant ID',
            'METRO_GRAPH_CLIENT_ID' => 'Client ID',
            'METRO_GRAPH_CLIENT_SECRET' => 'Client Secret',
            'METRO_SHAREPOINT_HOSTNAME' => 'SharePoint Hostname',
            'METRO_SHAREPOINT_SITE_ID' => 'SharePoint Site ID',
            'METRO_SHAREPOINT_SITE_PATH' => 'SharePoint Site Path',
            'METRO_SHAREPOINT_DRIVE_ID' => 'SharePoint Drive ID',
            'METRO_SHAREPOINT_LIBRARY_NAME' => 'Library Name',
            'METRO_SHAREPOINT_BASE_FOLDER' => 'Base Folder',
        ];

        private const BUSINESS_CENTRAL_FIELD_LABELS = [
            'METRO_BC_ENVIRONMENT' => 'Business Central Environment',
            'METRO_BC_COMPANY' => 'Business Central Company',
        ];

        public function register(): void
        {
            add_action('admin_menu', [$this, 'add_settings_page']);
            add_action('admin_init', [$this, 'register_settings']);
            add_action('wp_ajax_metro_registration_refresh_index', [$this, 'ajax_refresh_index']);
            add_action('wp_ajax_metro_registration_index_status', [$this, 'ajax_index_status']);
            add_action('wp_ajax_metro_registration_refresh_bc_index', [$this, 'ajax_refresh_bc_index']);
            add_action('wp_ajax_metro_registration_bc_index_status', [$this, 'ajax_bc_index_status']);
            add_action('wp_ajax_metro_registration_start_document_seed', [$this, 'ajax_start_document_seed']);
            add_action('wp_ajax_metro_registration_document_sync_status', [$this, 'ajax_document_sync_status']);
            add_action('wp_ajax_metro_registration_start_document_delta_sync', [$this, 'ajax_start_document_delta_sync']);
        }

        public function add_settings_page(): void
        {
            add_options_page(
                'Trailer Document Lookup Tool',
                'Trailer Document Lookup Tool',
                'manage_options',
                'metro-registration-lookup-tool',
                [$this, 'render_settings_page']
            );
        }

        public function register_settings(): void
        {
            register_setting(
                'metro_registration_lookup_tool',
                self::OPTION_NAME,
                [
                    'type' => 'array',
                    'sanitize_callback' => [$this, 'sanitize_settings'],
                    'default' => [],
                ]
            );

            add_settings_section(
                'metro_registration_lookup_tool_main',
                'Microsoft Graph and SharePoint',
                static function (): void {
                    echo '<p>Enter the Microsoft Graph app and SharePoint settings used by the trailer document lookup endpoint.</p>';
                },
                'metro-registration-lookup-tool'
            );

            foreach (self::GRAPH_FIELD_LABELS as $field_name => $label) {
                add_settings_field(
                    $field_name,
                    $label,
                    [$this, 'render_field'],
                    'metro-registration-lookup-tool',
                    'metro_registration_lookup_tool_main',
                    [
                        'field_name' => $field_name,
                        'label' => $label,
                    ]
                );
            }

            add_settings_section(
                'metro_registration_lookup_tool_business_central',
                'Business Central',
                static function (): void {
                    echo '<p>Enter the Business Central environment and company used for trailer metadata lookups.</p>';
                },
                'metro-registration-lookup-tool'
            );

            foreach (self::BUSINESS_CENTRAL_FIELD_LABELS as $field_name => $label) {
                add_settings_field(
                    $field_name,
                    $label,
                    [$this, 'render_field'],
                    'metro-registration-lookup-tool',
                    'metro_registration_lookup_tool_business_central',
                    [
                        'field_name' => $field_name,
                        'label' => $label,
                    ]
                );
            }
        }

        public function sanitize_settings($input): array
        {
            $saved = self::get_settings();
            $input = is_array($input) ? $input : [];
            $sanitized = [];

            foreach (array_keys(self::GRAPH_FIELD_LABELS + self::BUSINESS_CENTRAL_FIELD_LABELS) as $field_name) {
                $value = isset($input[$field_name]) ? trim((string) $input[$field_name]) : '';

                if ($field_name === 'METRO_GRAPH_CLIENT_SECRET' && $value === '') {
                    $sanitized[$field_name] = $saved[$field_name] ?? '';
                    continue;
                }

                $sanitized[$field_name] = $value;
            }

            add_settings_error(
                'metro_registration_lookup_tool_messages',
                'metro_registration_lookup_tool_saved',
                'Settings saved.',
                'updated'
            );

            return $sanitized;
        }

        public function render_field(array $args): void
        {
            $field_name = $args['field_name'];
            $settings = self::get_settings();
            $value = (string) ($settings[$field_name] ?? '');
            $is_secret = $field_name === 'METRO_GRAPH_CLIENT_SECRET';
            $input_type = $is_secret ? 'password' : 'text';
            $placeholder = $is_secret && $value !== '' ? 'Saved. Leave blank to keep unchanged.' : '';
            $display_value = $is_secret ? '' : $value;

            printf(
                '<input type="%s" class="regular-text" name="%s[%s]" value="%s" placeholder="%s" autocomplete="off" />',
                esc_attr($input_type),
                esc_attr(self::OPTION_NAME),
                esc_attr($field_name),
                esc_attr($display_value),
                esc_attr($placeholder)
            );

            if ($field_name === 'METRO_SHAREPOINT_BASE_FOLDER') {
                echo '<p class="description">Example: FixedAssets</p>';
            }

            if ($field_name === 'METRO_SHAREPOINT_LIBRARY_NAME') {
                echo '<p class="description">Example: WebPortal</p>';
            }

            if ($field_name === 'METRO_SHAREPOINT_SITE_ID') {
                echo '<p class="description">Optional. If set, the plugin skips site discovery.</p>';
            }

            if ($field_name === 'METRO_BC_ENVIRONMENT') {
                echo '<p class="description">Example: METR01</p>';
            }

            if ($field_name === 'METRO_BC_COMPANY') {
                echo '<p class="description">Example: Metro Trailer</p>';
            }
        }

        public function render_settings_page(): void
        {
            if (!current_user_can('manage_options')) {
                return;
            }

            $graph_client = new Metro_Registration_Graph_Client();
            $index_status = $graph_client->get_index_status();
            $bc_index_status = $graph_client->get_bc_asset_index_status();
            $document_status = $graph_client->get_document_sync_status();
            $nonce = wp_create_nonce(self::AJAX_NONCE_ACTION);
            ?>
            <div class="wrap">
                <h1>Trailer Document Lookup Tool</h1>
                <form action="options.php" method="post">
                    <?php
                    settings_errors('metro_registration_lookup_tool_messages');
                    settings_fields('metro_registration_lookup_tool');
                    do_settings_sections('metro-registration-lookup-tool');
                    submit_button('Save Settings');
                    ?>
                </form>

                <hr />

                <h2>Trailer Index</h2>
                <p>The public search uses a local WordPress trailer index for speed. Rebuild it after changing SharePoint settings, then let the nightly refresh keep it current.</p>
                <table class="form-table" role="presentation">
                    <tbody>
                    <tr>
                        <th scope="row">Status</th>
                        <td id="metro-registration-index-status"><?php echo esc_html($this->format_status_label($index_status)); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Indexed folders</th>
                        <td id="metro-registration-index-count"><?php echo esc_html(number_format_i18n((int) $index_status['row_count'])); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Last completed</th>
                        <td id="metro-registration-index-completed"><?php echo esc_html($index_status['last_completed_at'] ?: 'Not yet built'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Last error</th>
                        <td id="metro-registration-index-error"><?php echo esc_html($index_status['last_error'] ?: 'None'); ?></td>
                    </tr>
                    </tbody>
                </table>

                <p>
                    <button type="button" class="button button-primary" id="metro-registration-start-refresh">
                        Rebuild trailer index now
                    </button>
                    <span id="metro-registration-refresh-progress" style="margin-left:12px;"></span>
                </p>

                <hr />

                <h2>Business Central Asset Index</h2>
                <p>The trailer metadata search uses a local Business Central index. Rebuild it after changing Business Central settings, then let the nightly refresh keep it current.</p>
                <table class="form-table" role="presentation">
                    <tbody>
                    <tr>
                        <th scope="row">Status</th>
                        <td id="metro-registration-bc-index-status"><?php echo esc_html($this->format_status_label($bc_index_status)); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Indexed assets</th>
                        <td id="metro-registration-bc-index-count"><?php echo esc_html(number_format_i18n((int) $bc_index_status['row_count'])); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Last completed</th>
                        <td id="metro-registration-bc-index-completed"><?php echo esc_html($bc_index_status['last_completed_at'] ?: 'Not yet built'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Last error</th>
                        <td id="metro-registration-bc-index-error"><?php echo esc_html($bc_index_status['last_error'] ?: 'None'); ?></td>
                    </tr>
                    </tbody>
                </table>

                <p>
                    <button type="button" class="button button-primary" id="metro-registration-start-bc-refresh">
                        Rebuild Business Central asset index now
                    </button>
                    <span id="metro-registration-bc-refresh-progress" style="margin-left:12px;"></span>
                </p>

                <hr />

                <h2>Document Availability Sync</h2>
                <p>Seed document availability once with 8 parallel workers, then let nightly delta sync keep the registration and inspection flags current.</p>
                <table class="form-table" role="presentation">
                    <tbody>
                    <tr>
                        <th scope="row">Seed status</th>
                        <td id="metro-registration-document-seed-status"><?php echo esc_html($this->format_document_seed_status_label($document_status)); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Folders scanned</th>
                        <td id="metro-registration-document-ready-count"><?php echo esc_html(number_format_i18n((int) $document_status['ready_count'])); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Folders pending</th>
                        <td id="metro-registration-document-unknown-count"><?php echo esc_html(number_format_i18n((int) $document_status['unknown_count'])); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Seed completed</th>
                        <td id="metro-registration-document-seed-completed"><?php echo esc_html($document_status['seed_last_completed_at'] ?: 'Not yet built'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Seed error</th>
                        <td id="metro-registration-document-seed-error"><?php echo esc_html($document_status['seed_last_error'] ?: 'None'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Delta status</th>
                        <td id="metro-registration-document-delta-status"><?php echo esc_html($this->format_document_delta_status_label($document_status)); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Delta completed</th>
                        <td id="metro-registration-document-delta-completed"><?php echo esc_html($document_status['delta_last_completed_at'] ?: 'Not yet run'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Changed folders processed</th>
                        <td id="metro-registration-document-delta-folders"><?php echo esc_html(number_format_i18n((int) $document_status['delta_changed_folders'])); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Delta token</th>
                        <td id="metro-registration-document-delta-token"><?php echo esc_html(!empty($document_status['delta_link']) ? 'Saved' : 'Missing'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row">Delta error</th>
                        <td id="metro-registration-document-delta-error"><?php echo esc_html($document_status['delta_last_error'] ?: 'None'); ?></td>
                    </tr>
                    </tbody>
                </table>

                <p>
                    <button type="button" class="button button-primary" id="metro-registration-start-document-seed">
                        Seed document availability now
                    </button>
                    <button type="button" class="button" id="metro-registration-start-document-delta" style="margin-left:8px;">
                        Run delta sync now
                    </button>
                    <span id="metro-registration-document-refresh-progress" style="margin-left:12px;"></span>
                </p>

                <script>
                    (function () {
                        const ajaxUrl = <?php echo wp_json_encode(admin_url('admin-ajax.php')); ?>;
                        const nonce = <?php echo wp_json_encode($nonce); ?>;

                        function createStatusController(config) {
                            const button = document.getElementById(config.buttonId);
                            const progress = document.getElementById(config.progressId);
                            const statusEl = document.getElementById(config.statusId);
                            const countEl = document.getElementById(config.countId);
                            const completedEl = document.getElementById(config.completedId);
                            const errorEl = document.getElementById(config.errorId);

                            function applyStatus(data) {
                                statusEl.textContent = data.status_label || data.status || 'Unknown';
                                countEl.textContent = String(data.row_count || 0);
                                completedEl.textContent = data.last_completed_at || 'Not yet built';
                                errorEl.textContent = data.last_error || 'None';
                            }

                            async function post(action, payload) {
                                const response = await fetch(ajaxUrl, {
                                    method: 'POST',
                                    credentials: 'same-origin',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    },
                                    body: new URLSearchParams(Object.assign({
                                        action: action,
                                        _ajax_nonce: nonce,
                                    }, payload || {})),
                                });

                                const data = await response.json();
                                if (!response.ok || !data || !data.success) {
                                    throw new Error(data && data.data && data.data.message ? data.data.message : 'Request failed.');
                                }

                                return data.data;
                            }

                            async function runRefresh(reset) {
                                const data = await post(config.refreshAction, { reset: reset ? '1' : '0' });
                                applyStatus(data);
                                progress.textContent = data.progress_message || '';

                                if (data.status === 'running') {
                                    window.setTimeout(function () {
                                        runRefresh(false).catch(function (error) {
                                            progress.textContent = error.message || 'Refresh failed.';
                                            button.disabled = false;
                                        });
                                    }, 150);
                                    return;
                                }

                                button.disabled = false;
                            }

                            button.addEventListener('click', function () {
                                button.disabled = true;
                                progress.textContent = config.startingMessage;
                                runRefresh(true).catch(function (error) {
                                    progress.textContent = error.message || 'Refresh failed.';
                                    button.disabled = false;
                                });
                            });
                        }

                        createStatusController({
                            buttonId: 'metro-registration-start-refresh',
                            progressId: 'metro-registration-refresh-progress',
                            statusId: 'metro-registration-index-status',
                            countId: 'metro-registration-index-count',
                            completedId: 'metro-registration-index-completed',
                            errorId: 'metro-registration-index-error',
                            refreshAction: 'metro_registration_refresh_index',
                            startingMessage: 'Starting trailer index rebuild...',
                        });

                        createStatusController({
                            buttonId: 'metro-registration-start-bc-refresh',
                            progressId: 'metro-registration-bc-refresh-progress',
                            statusId: 'metro-registration-bc-index-status',
                            countId: 'metro-registration-bc-index-count',
                            completedId: 'metro-registration-bc-index-completed',
                            errorId: 'metro-registration-bc-index-error',
                            refreshAction: 'metro_registration_refresh_bc_index',
                            startingMessage: 'Starting Business Central asset index rebuild...',
                        });

                        (function createDocumentSyncController() {
                            const seedButton = document.getElementById('metro-registration-start-document-seed');
                            const deltaButton = document.getElementById('metro-registration-start-document-delta');
                            const progress = document.getElementById('metro-registration-document-refresh-progress');
                            const seedStatus = document.getElementById('metro-registration-document-seed-status');
                            const readyCount = document.getElementById('metro-registration-document-ready-count');
                            const unknownCount = document.getElementById('metro-registration-document-unknown-count');
                            const seedCompleted = document.getElementById('metro-registration-document-seed-completed');
                            const seedError = document.getElementById('metro-registration-document-seed-error');
                            const deltaStatus = document.getElementById('metro-registration-document-delta-status');
                            const deltaCompleted = document.getElementById('metro-registration-document-delta-completed');
                            const deltaFolders = document.getElementById('metro-registration-document-delta-folders');
                            const deltaToken = document.getElementById('metro-registration-document-delta-token');
                            const deltaError = document.getElementById('metro-registration-document-delta-error');
                            let polling = null;

                            function applyStatus(data) {
                                seedStatus.textContent = data.seed_status_label;
                                readyCount.textContent = String(data.ready_count || 0);
                                unknownCount.textContent = String(data.unknown_count || 0);
                                seedCompleted.textContent = data.seed_last_completed_at || 'Not yet built';
                                seedError.textContent = data.seed_last_error || 'None';
                                deltaStatus.textContent = data.delta_status_label;
                                deltaCompleted.textContent = data.delta_last_completed_at || 'Not yet run';
                                deltaFolders.textContent = String(data.delta_changed_folders || 0);
                                deltaToken.textContent = data.delta_token_label || 'Missing';
                                deltaError.textContent = data.delta_last_error || 'None';
                            }

                            async function post(action, payload) {
                                const response = await fetch(ajaxUrl, {
                                    method: 'POST',
                                    credentials: 'same-origin',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    },
                                    body: new URLSearchParams(Object.assign({
                                        action: action,
                                        _ajax_nonce: nonce,
                                    }, payload || {})),
                                });

                                const data = await response.json();
                                if (!response.ok || !data || !data.success) {
                                    throw new Error(data && data.data && data.data.message ? data.data.message : 'Request failed.');
                                }

                                return data.data;
                            }

                            function setBusy(isBusy) {
                                seedButton.disabled = isBusy;
                                deltaButton.disabled = isBusy;
                            }

                            function schedulePoll() {
                                if (polling) {
                                    window.clearTimeout(polling);
                                }

                                polling = window.setTimeout(async function () {
                                    try {
                                        const data = await post('metro_registration_document_sync_status');
                                        applyStatus(data);
                                        progress.textContent = data.progress_message || '';
                                        if (data.seed_status === 'running' || data.seed_status === 'catchup' || data.delta_status === 'running') {
                                            schedulePoll();
                                        } else {
                                            setBusy(false);
                                        }
                                    } catch (error) {
                                        progress.textContent = error.message || 'Document sync status failed.';
                                        setBusy(false);
                                    }
                                }, 2000);
                            }

                            seedButton.addEventListener('click', async function () {
                                try {
                                    setBusy(true);
                                    progress.textContent = 'Starting document availability seed...';
                                    const data = await post('metro_registration_start_document_seed', { reset: '1' });
                                    applyStatus(data);
                                    progress.textContent = data.progress_message || '';
                                    schedulePoll();
                                } catch (error) {
                                    progress.textContent = error.message || 'Document seed failed.';
                                    setBusy(false);
                                }
                            });

                            deltaButton.addEventListener('click', async function () {
                                try {
                                    setBusy(true);
                                    progress.textContent = 'Starting document delta sync...';
                                    const data = await post('metro_registration_start_document_delta_sync', { reset: '1' });
                                    applyStatus(data);
                                    progress.textContent = data.progress_message || '';
                                    schedulePoll();
                                } catch (error) {
                                    progress.textContent = error.message || 'Document delta sync failed.';
                                    setBusy(false);
                                }
                            });
                        })();
                    })();
                </script>
            </div>
            <?php
        }

        public function ajax_refresh_index(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            try {
                $graph_client = new Metro_Registration_Graph_Client();
                $status = $graph_client->refresh_index_batch(isset($_POST['reset']) && $_POST['reset'] === '1');
                $payload = $this->format_index_payload($status);

                wp_send_json_success($payload);
            } catch (Throwable $exception) {
                wp_send_json_error(['message' => $exception->getMessage()], 500);
            }
        }

        public function ajax_index_status(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            $graph_client = new Metro_Registration_Graph_Client();
            wp_send_json_success($this->format_index_payload($graph_client->get_index_status()));
        }

        public function ajax_refresh_bc_index(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            try {
                $graph_client = new Metro_Registration_Graph_Client();
                $status = $graph_client->refresh_bc_asset_index_batch(isset($_POST['reset']) && $_POST['reset'] === '1');
                $payload = $this->format_bc_index_payload($status);

                wp_send_json_success($payload);
            } catch (Throwable $exception) {
                wp_send_json_error(['message' => $exception->getMessage()], 500);
            }
        }

        public function ajax_bc_index_status(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            $graph_client = new Metro_Registration_Graph_Client();
            wp_send_json_success($this->format_bc_index_payload($graph_client->get_bc_asset_index_status()));
        }

        public function ajax_start_document_seed(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            try {
                $graph_client = new Metro_Registration_Graph_Client();
                $status = $graph_client->start_document_seed(isset($_POST['reset']) && $_POST['reset'] === '1');

                foreach ($graph_client->get_document_seed_worker_ids() as $worker_id) {
                    wp_schedule_single_event(time() + 2 + $worker_id, 'metro_registration_lookup_continue_document_seed_worker', [$worker_id]);
                }

                wp_send_json_success($this->format_document_sync_payload($status));
            } catch (Throwable $exception) {
                wp_send_json_error(['message' => $exception->getMessage()], 500);
            }
        }

        public function ajax_document_sync_status(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            $graph_client = new Metro_Registration_Graph_Client();
            wp_send_json_success($this->format_document_sync_payload($graph_client->get_document_sync_status()));
        }

        public function ajax_start_document_delta_sync(): void
        {
            check_ajax_referer(self::AJAX_NONCE_ACTION);

            if (!current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'You do not have permission to do that.'], 403);
            }

            try {
                $graph_client = new Metro_Registration_Graph_Client();
                $status = $graph_client->start_document_delta_sync(isset($_POST['reset']) && $_POST['reset'] === '1');
                wp_schedule_single_event(time() + 2, 'metro_registration_lookup_continue_document_delta_sync');
                wp_send_json_success($this->format_document_sync_payload($status));
            } catch (Throwable $exception) {
                wp_send_json_error(['message' => $exception->getMessage()], 500);
            }
        }

        private function format_index_payload(array $status): array
        {
            return [
                'status' => $status['status'],
                'status_label' => $this->format_status_label($status),
                'row_count' => (int) $status['row_count'],
                'last_completed_at' => $status['last_completed_at'],
                'last_error' => $status['last_error'],
                'progress_message' => $status['status'] === 'running'
                    ? sprintf('Indexed %s trailer folders so far...', number_format_i18n((int) $status['processed']))
                    : ($status['status'] === 'ready'
                        ? sprintf('Index ready with %s trailer folders.', number_format_i18n((int) $status['row_count']))
                        : 'Index not ready.'),
            ];
        }

        private function format_bc_index_payload(array $status): array
        {
            return [
                'status' => $status['status'],
                'status_label' => $this->format_status_label($status),
                'row_count' => (int) $status['row_count'],
                'last_completed_at' => $status['last_completed_at'],
                'last_error' => $status['last_error'],
                'progress_message' => $status['status'] === 'running'
                    ? sprintf('Indexed %s Business Central assets so far...', number_format_i18n((int) $status['processed']))
                    : ($status['status'] === 'ready'
                        ? sprintf('Index ready with %s Business Central assets.', number_format_i18n((int) $status['row_count']))
                        : 'Index not ready.'),
            ];
        }

        private function format_document_sync_payload(array $status): array
        {
            $seed_status = $status['seed_status'] ?? 'empty';
            $delta_status = $status['delta_status'] ?? 'idle';

            $progress_message = 'Document availability has not been seeded yet.';
            if ($seed_status === 'running') {
                $progress_message = sprintf(
                    'Document seed running: scanned %s of %s folders across %d workers.',
                    number_format_i18n((int) ($status['ready_count'] ?? 0)),
                    number_format_i18n((int) ($status['total_folders'] ?? 0)),
                    (int) ($status['worker_count'] ?? 0)
                );
            } elseif ($seed_status === 'catchup' || $delta_status === 'running') {
                $progress_message = sprintf(
                    'Document delta sync running: processed %s changed folders.',
                    number_format_i18n((int) ($status['delta_changed_folders'] ?? 0))
                );
            } elseif ($seed_status === 'ready') {
                $progress_message = sprintf(
                    'Document availability ready for %s folders.',
                    number_format_i18n((int) ($status['ready_count'] ?? 0))
                );
            }

            return [
                'seed_status' => $seed_status,
                'seed_status_label' => $this->format_document_seed_status_label($status),
                'seed_last_completed_at' => $status['seed_last_completed_at'],
                'seed_last_error' => $status['seed_last_error'],
                'ready_count' => (int) ($status['ready_count'] ?? 0),
                'unknown_count' => (int) ($status['unknown_count'] ?? 0),
                'worker_count' => (int) ($status['worker_count'] ?? 0),
                'delta_status' => $delta_status,
                'delta_status_label' => $this->format_document_delta_status_label($status),
                'delta_last_completed_at' => $status['delta_last_completed_at'],
                'delta_last_error' => $status['delta_last_error'],
                'delta_changed_folders' => (int) ($status['delta_changed_folders'] ?? 0),
                'delta_token_label' => !empty($status['delta_link']) ? 'Saved' : 'Missing',
                'progress_message' => $progress_message,
            ];
        }

        private function format_status_label(array $status): string
        {
            switch ($status['status']) {
                case 'running':
                    return 'Refreshing';
                case 'ready':
                    return 'Ready';
                case 'error':
                    return 'Error';
                case 'empty':
                default:
                    return 'Not built';
            }
        }

        private function format_document_seed_status_label(array $status): string
        {
            switch ($status['seed_status'] ?? 'empty') {
                case 'running':
                    return 'Seeding';
                case 'catchup':
                    return 'Finalizing';
                case 'ready':
                    return 'Ready';
                case 'error':
                    return 'Error';
                case 'empty':
                default:
                    return 'Not built';
            }
        }

        private function format_document_delta_status_label(array $status): string
        {
            switch ($status['delta_status'] ?? 'idle') {
                case 'running':
                    return 'Syncing';
                case 'ready':
                    return 'Ready';
                case 'error':
                    return 'Error';
                case 'idle':
                default:
                    return 'Idle';
            }
        }

        public static function get_settings(): array
        {
            $settings = get_option(self::OPTION_NAME, []);
            return is_array($settings) ? $settings : [];
        }
    }
}
