<?php

if (!class_exists('Metro_Registration_Graph_Client')) {
    class Metro_Registration_Graph_Client
    {
        private const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
        private const DEFAULT_BASE_FOLDER = 'FixedAssets';
        private const DOCUMENTS_TRANSIENT_PREFIX = 'metro_registration_documents_';
        private const CONTEXT_TRANSIENT_PREFIX = 'metro_registration_context_';
        private const DOCUMENTS_TTL = 900;
        private const CONTEXT_TTL = 3600;
        private const SEARCH_LIMIT_DEFAULT = 24;
        private const SEARCH_LIMIT_MAX = 60;
        private const SEARCH_QUERY_ROW_LIMIT = 250;
        private const BATCH_QUERY_LIMIT = 250;
        private const BULK_DOWNLOAD_LIMIT = 99;
        private const INDEX_TABLE_SUFFIX = 'metro_registration_lookup_index';
        private const INDEX_STATE_OPTION = 'metro_registration_lookup_tool_index_state';
        private const INDEX_BATCH_SIZE = 999;

        public static function install_schema(): void
        {
            global $wpdb;

            require_once ABSPATH . 'wp-admin/includes/upgrade.php';

            $table_name = self::get_index_table_name();
            $charset_collate = $wpdb->get_charset_collate();
            $sql = "CREATE TABLE {$table_name} (
                folder_id varchar(191) NOT NULL,
                folder_name varchar(191) NOT NULL,
                normalized_name varchar(191) NOT NULL,
                compact_name varchar(191) NOT NULL,
                pattern varchar(32) NOT NULL,
                folder_length smallint unsigned NOT NULL,
                has_letters tinyint(1) NOT NULL DEFAULT 0,
                has_separator tinyint(1) NOT NULL DEFAULT 0,
                updated_at datetime NOT NULL,
                PRIMARY KEY  (folder_id),
                KEY normalized_name (normalized_name),
                KEY compact_name (compact_name),
                KEY folder_name (folder_name)
            ) {$charset_collate};";

            dbDelta($sql);
        }

        public static function get_index_table_name(): string
        {
            global $wpdb;
            return $wpdb->prefix . self::INDEX_TABLE_SUFFIX;
        }

        public function get_registration_pdf(string $trailer_number): array
        {
            $this->assert_valid_search_query($trailer_number);

            $matches = $this->search_trailer_folders($trailer_number, 5);
            if (empty($matches['results'])) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('No trailer folders matched "%s".', $trailer_number),
                    404
                );
            }

            $documents = $this->get_trailer_documents($matches['results'][0]['id']);
            $registration = $this->pick_registration_document($documents['documents']);
            if (!$registration) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Trailer "%s" does not have a registration PDF.', $matches['results'][0]['name']),
                    404
                );
            }

            return $this->download_document($registration['id']);
        }

        public function search_trailer_folders(string $query, int $limit = self::SEARCH_LIMIT_DEFAULT): array
        {
            global $wpdb;

            $query = trim($query);
            $this->assert_valid_search_query($query);

            if (strlen($query) < 4) {
                throw new Metro_Registration_Graph_Exception(
                    'Enter at least 4 characters to search trailer folders.',
                    400
                );
            }

            $limit = max(1, min(self::SEARCH_LIMIT_MAX, $limit));
            $status = $this->get_index_status();
            $query_upper = strtoupper($query);
            $query_compact = $this->compact_search_value($query);
            $rows = [];

            if ($status['row_count'] > 0) {
                $table_name = self::get_index_table_name();
                $like_normalized = '%' . $wpdb->esc_like($query_upper) . '%';
                $like_compact = '%' . $wpdb->esc_like($query_compact) . '%';
                $sql = $wpdb->prepare(
                    "SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator
                     FROM {$table_name}
                     WHERE normalized_name LIKE %s
                        OR compact_name LIKE %s
                     LIMIT %d",
                    $like_normalized,
                    $like_compact,
                    self::SEARCH_QUERY_ROW_LIMIT
                );
                $rows = $wpdb->get_results($sql, ARRAY_A) ?: [];
            } else {
                $fallback = $this->try_direct_folder_lookup($query);
                if ($fallback !== null) {
                    $rows[] = $fallback;
                } else {
                    throw new Metro_Registration_Graph_Exception(
                        'The trailer index is not built yet. Go to Settings -> Metro Registration Lookup Tool and rebuild the trailer index first. Exact folder lookups will work once the index or folder exists.',
                        503
                    );
                }
            }

            $matches = [];
            foreach ($rows as $row) {
                $scored_match = $this->score_folder_match($row, $query_upper, $query_compact);
                if ($scored_match === null) {
                    continue;
                }
                $matches[] = $scored_match;
            }

            usort($matches, static function (array $left, array $right): int {
                if ($left['score'] !== $right['score']) {
                    return $right['score'] <=> $left['score'];
                }

                if ($left['length_delta'] !== $right['length_delta']) {
                    return $left['length_delta'] <=> $right['length_delta'];
                }

                return strcmp($left['name'], $right['name']);
            });

            $total_matches = count($matches);
            $results = array_slice($matches, 0, $limit);

            return [
                'query' => $query,
                'total_matches' => $total_matches,
                'shown_count' => count($results),
                'results' => array_map([$this, 'format_folder_result'], $results),
                'inventory' => $status['summary'],
                'index_status' => [
                    'status' => $status['status'],
                    'last_completed_at' => $status['last_completed_at'],
                    'ready' => $status['row_count'] > 0,
                ],
            ];
        }

        public function get_trailer_documents(string $folder_id): array
        {
            $folder_id = trim($folder_id);
            if ($folder_id === '') {
                throw new Metro_Registration_Graph_Exception('Trailer folder ID is required.', 400);
            }

            $folder = $this->find_folder_by_id($folder_id);
            $access_token = $this->get_access_token();
            $context = $this->resolve_storage_context($access_token);

            if (!$folder) {
                $metadata = $this->graph_json(
                    sprintf(
                        '/drives/%s/items/%s?$select=id,name,folder',
                        rawurlencode($context['drive']['id']),
                        rawurlencode($folder_id)
                    ),
                    $access_token,
                    true
                );

                if ($metadata === null || !isset($metadata['folder'])) {
                    throw new Metro_Registration_Graph_Exception('Trailer folder not found.', 404);
                }

                $folder = [
                    'id' => $metadata['id'],
                    'name' => $metadata['name'],
                    'pattern' => $this->classify_folder_pattern($metadata['name']),
                    'length' => strlen($metadata['name']),
                    'has_letters' => preg_match('/[A-Za-z]/', $metadata['name']) === 1 ? 1 : 0,
                    'has_separator' => preg_match('/[-_\\s]/', $metadata['name']) === 1 ? 1 : 0,
                ];
            }

            $cached = $this->get_cached_documents($folder_id);
            if ($cached !== null) {
                return [
                    'folder' => $this->format_folder_result($folder),
                    'documents' => $cached,
                ];
            }

            $items = $this->list_children_by_item_id($context['drive']['id'], $folder_id, $access_token);
            $documents = [];

            foreach ($items as $item) {
                if (!isset($item['file'])) {
                    continue;
                }

                $documents[] = [
                    'id' => $item['id'],
                    'name' => $item['name'],
                    'web_url' => $item['webUrl'] ?? null,
                    'size' => isset($item['size']) ? (int) $item['size'] : null,
                    'last_modified' => $item['lastModifiedDateTime'] ?? null,
                    'content_type' => $item['file']['mimeType'] ?? null,
                    'is_pdf' => isset($item['name']) && strtolower(substr($item['name'], -4)) === '.pdf',
                    'document_type' => $this->detect_document_type($item['name'] ?? ''),
                ];
            }

            usort($documents, static function (array $left, array $right): int {
                $left_rank = ($left['document_type'] === 'Registration' ? 0 : 1) + ($left['is_pdf'] ? 0 : 2);
                $right_rank = ($right['document_type'] === 'Registration' ? 0 : 1) + ($right['is_pdf'] ? 0 : 2);
                if ($left_rank !== $right_rank) {
                    return $left_rank <=> $right_rank;
                }

                return strcmp($left['name'], $right['name']);
            });

            $this->set_cached_documents($folder_id, $documents);

            return [
                'folder' => $this->format_folder_result($folder),
                'documents' => $documents,
            ];
        }

        public function lookup_exact_trailer_batch(array $queries): array
        {
            global $wpdb;

            $queries = $this->normalize_batch_queries($queries);
            $status = $this->get_index_status();
            $resolved = [];
            $missing = [];
            $rows_by_normalized = [];
            $rows_by_compact = [];

            if ($status['row_count'] > 0) {
                $table_name = self::get_index_table_name();
                $normalized_values = array_values(array_unique(array_map('strtoupper', $queries)));
                $compact_values = array_values(array_unique(array_map([$this, 'compact_search_value'], $queries)));

                $normalized_placeholders = implode(', ', array_fill(0, count($normalized_values), '%s'));
                $compact_placeholders = implode(', ', array_fill(0, count($compact_values), '%s'));
                $sql = "
                    SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator,
                           normalized_name, compact_name
                    FROM {$table_name}
                    WHERE normalized_name IN ({$normalized_placeholders})
                       OR compact_name IN ({$compact_placeholders})
                ";
                $prepared = $wpdb->prepare($sql, array_merge($normalized_values, $compact_values));
                $rows = $wpdb->get_results($prepared, ARRAY_A) ?: [];

                foreach ($rows as $row) {
                    $rows_by_normalized[$row['normalized_name']][] = $row;
                    $rows_by_compact[$row['compact_name']][] = $row;
                }
            }

            foreach ($queries as $query) {
                $matched_row = $this->resolve_exact_folder_match(
                    $query,
                    $rows_by_normalized[strtoupper($query)] ?? [],
                    $rows_by_compact[$this->compact_search_value($query)] ?? []
                );

                if ($matched_row === null) {
                    $matched_row = $this->try_direct_folder_lookup($query);
                }

                if ($matched_row === null) {
                    $missing[] = $query;
                    continue;
                }

                $resolved[] = [
                    'requested' => $query,
                    'folder' => $this->format_folder_result($matched_row),
                ];
            }

            return [
                'mode' => 'exact_batch',
                'requested_count' => count($queries),
                'matched_count' => count($resolved),
                'missing_count' => count($missing),
                'results' => $resolved,
                'missing' => $missing,
                'can_download_all' => count($resolved) > 0 && count($resolved) < 100,
                'download_limit' => self::BULK_DOWNLOAD_LIMIT,
                'inventory' => $status['summary'],
                'index_status' => [
                    'status' => $status['status'],
                    'last_completed_at' => $status['last_completed_at'],
                    'ready' => $status['row_count'] > 0,
                ],
            ];
        }

        public function download_document(string $document_id): array
        {
            $document_id = trim($document_id);
            if ($document_id === '') {
                throw new Metro_Registration_Graph_Exception('Document ID is required.', 400);
            }

            $access_token = $this->get_access_token();
            $context = $this->resolve_storage_context($access_token);
            $metadata = $this->graph_json(
                sprintf(
                    '/drives/%s/items/%s?$select=id,name,webUrl,file,size,lastModifiedDateTime',
                    rawurlencode($context['drive']['id']),
                    rawurlencode($document_id)
                ),
                $access_token
            );

            $content = $this->download_binary(
                sprintf(
                    '/drives/%s/items/%s/content',
                    rawurlencode($context['drive']['id']),
                    rawurlencode($document_id)
                ),
                $access_token
            );

            return [
                'id' => $metadata['id'],
                'filename' => $metadata['name'],
                'content_type' => $metadata['file']['mimeType'] ?? 'application/octet-stream',
                'content' => $content,
                'size' => isset($metadata['size']) ? (int) $metadata['size'] : null,
                'last_modified' => $metadata['lastModifiedDateTime'] ?? null,
                'web_url' => $metadata['webUrl'] ?? null,
            ];
        }

        public function download_registration_batch(array $folder_ids): array
        {
            $folder_ids = array_values(array_unique(array_filter(array_map('trim', $folder_ids), 'strlen')));
            if (empty($folder_ids)) {
                throw new Metro_Registration_Graph_Exception('At least one trailer folder is required for bulk download.', 400);
            }

            if (count($folder_ids) > self::BULK_DOWNLOAD_LIMIT) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Bulk download is limited to %d trailers at a time.', self::BULK_DOWNLOAD_LIMIT),
                    400
                );
            }

            $temp_dir = trailingslashit(get_temp_dir()) . 'metro-registration-' . wp_generate_uuid4();
            if (!wp_mkdir_p($temp_dir)) {
                throw new Metro_Registration_Graph_Exception('Could not create a temporary download directory.', 500);
            }

            $written_files = [];
            $notes = [];

            try {
                foreach ($folder_ids as $folder_id) {
                    $documents = $this->get_trailer_documents($folder_id);
                    $registration = $this->pick_registration_document($documents['documents']);
                    if ($registration === null) {
                        $notes[] = sprintf('%s: registration PDF not found.', $documents['folder']['name']);
                        continue;
                    }

                    $file = $this->download_document($registration['id']);
                    $filename = $this->build_unique_export_filename(
                        $documents['folder']['name'],
                        $file['filename'],
                        array_keys($written_files)
                    );
                    $file_path = trailingslashit($temp_dir) . $filename;
                    file_put_contents($file_path, $file['content']);
                    $written_files[$filename] = $file_path;
                }

                if (!empty($notes)) {
                    $notes_path = trailingslashit($temp_dir) . 'missing-registrations.txt';
                    file_put_contents($notes_path, implode(PHP_EOL, $notes) . PHP_EOL);
                    $written_files['missing-registrations.txt'] = $notes_path;
                }

                $export_files = $written_files;
                unset($export_files['missing-registrations.txt']);
                if (empty($export_files)) {
                    throw new Metro_Registration_Graph_Exception('No registration PDFs were available to download.', 404);
                }

                $zip_path = trailingslashit($temp_dir) . 'metro-registration-documents.zip';
                $this->create_zip_archive($zip_path, $written_files, $temp_dir);
                $zip_content = file_get_contents($zip_path);
                if ($zip_content === false) {
                    throw new Metro_Registration_Graph_Exception('Could not read the generated ZIP archive.', 500);
                }

                return [
                    'filename' => 'metro-registration-documents-' . gmdate('Ymd-His') . '.zip',
                    'content_type' => 'application/zip',
                    'content' => $zip_content,
                ];
            } finally {
                $this->delete_directory($temp_dir);
            }
        }

        public function get_index_status(): array
        {
            global $wpdb;

            $state = get_option(self::INDEX_STATE_OPTION, []);
            $table_name = self::get_index_table_name();
            $table_exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table_name)) === $table_name;
            $row_count = 0;

            if ($table_exists) {
                $row_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");
            }

            return [
                'status' => $state['status'] ?? ($row_count > 0 ? 'ready' : 'empty'),
                'started_at' => $state['started_at'] ?? null,
                'last_completed_at' => $state['last_completed_at'] ?? null,
                'last_error' => $state['last_error'] ?? null,
                'processed' => (int) ($state['processed'] ?? 0),
                'row_count' => $row_count,
                'summary' => $state['summary'] ?? $this->empty_summary($row_count),
            ];
        }

        public function refresh_index_batch(bool $reset = false): array
        {
            global $wpdb;

            self::install_schema();

            $state = get_option(self::INDEX_STATE_OPTION, []);
            if ($reset || empty($state) || empty($state['next_url'])) {
                $access_token = $this->get_access_token();
                $context = $this->resolve_storage_context($access_token, true);
                $table_name = self::get_index_table_name();
                $wpdb->query("TRUNCATE TABLE {$table_name}");

                $state = [
                    'status' => 'running',
                    'started_at' => current_time('mysql', true),
                    'last_completed_at' => $state['last_completed_at'] ?? null,
                    'last_error' => null,
                    'processed' => 0,
                    'summary' => $this->empty_summary(0),
                    'next_url' => sprintf(
                        '/drives/%s/root:/%s:/children?$top=%d&$select=id,name,folder',
                        rawurlencode($context['drive']['id']),
                        $this->encode_graph_path($context['base_folder']),
                        self::INDEX_BATCH_SIZE
                    ),
                ];
                update_option(self::INDEX_STATE_OPTION, $state, false);
            }

            try {
                $access_token = $this->get_access_token();
                $payload = $this->graph_json($state['next_url'], $access_token);
                $folders = [];

                foreach ($payload['value'] ?? [] as $item) {
                    if (!isset($item['folder'], $item['id'], $item['name'])) {
                        continue;
                    }

                    $name = trim((string) $item['name']);
                    if ($name === '') {
                        continue;
                    }

                    $folders[] = [
                        'id' => (string) $item['id'],
                        'name' => $name,
                        'pattern' => $this->classify_folder_pattern($name),
                        'length' => strlen($name),
                        'has_letters' => preg_match('/[A-Za-z]/', $name) === 1 ? 1 : 0,
                        'has_separator' => preg_match('/[-_\\s]/', $name) === 1 ? 1 : 0,
                        'normalized_name' => strtoupper($name),
                        'compact_name' => $this->compact_search_value($name),
                    ];
                }

                if (!empty($folders)) {
                    $this->upsert_folder_rows($folders);
                }

                $state['processed'] = (int) $state['processed'] + count($folders);
                $state['next_url'] = $payload['@odata.nextLink'] ?? null;

                if (empty($state['next_url'])) {
                    $state['status'] = 'ready';
                    $state['last_completed_at'] = current_time('mysql', true);
                    $state['summary'] = $this->calculate_index_summary();
                } else {
                    $state['status'] = 'running';
                }

                update_option(self::INDEX_STATE_OPTION, $state, false);
                return $this->get_index_status();
            } catch (Throwable $exception) {
                $state['status'] = 'error';
                $state['last_error'] = $exception->getMessage();
                update_option(self::INDEX_STATE_OPTION, $state, false);
                throw $exception;
            }
        }

        private function upsert_folder_rows(array $folders): void
        {
            global $wpdb;

            $table_name = self::get_index_table_name();
            $updated_at = current_time('mysql', true);
            $chunks = array_chunk($folders, 250);

            foreach ($chunks as $chunk) {
                $placeholders = [];
                $values = [];

                foreach ($chunk as $folder) {
                    $placeholders[] = '(%s,%s,%s,%s,%s,%d,%d,%d,%s)';
                    $values[] = $folder['id'];
                    $values[] = $folder['name'];
                    $values[] = $folder['normalized_name'];
                    $values[] = $folder['compact_name'];
                    $values[] = $folder['pattern'];
                    $values[] = $folder['length'];
                    $values[] = $folder['has_letters'];
                    $values[] = $folder['has_separator'];
                    $values[] = $updated_at;
                }

                $sql = "
                    INSERT INTO {$table_name}
                        (folder_id, folder_name, normalized_name, compact_name, pattern, folder_length, has_letters, has_separator, updated_at)
                    VALUES " . implode(', ', $placeholders) . "
                    ON DUPLICATE KEY UPDATE
                        folder_name = VALUES(folder_name),
                        normalized_name = VALUES(normalized_name),
                        compact_name = VALUES(compact_name),
                        pattern = VALUES(pattern),
                        folder_length = VALUES(folder_length),
                        has_letters = VALUES(has_letters),
                        has_separator = VALUES(has_separator),
                        updated_at = VALUES(updated_at)
                ";

                $prepared = $wpdb->prepare($sql, $values);
                $wpdb->query($prepared);
            }
        }

        private function calculate_index_summary(): array
        {
            global $wpdb;

            $table_name = self::get_index_table_name();
            $rows = $wpdb->get_results(
                "SELECT folder_length, pattern, has_letters, has_separator, folder_name FROM {$table_name}",
                ARRAY_A
            );

            $summary = $this->empty_summary(count($rows));

            foreach ($rows as $row) {
                $length = (string) $row['folder_length'];
                $summary['length_counts'][$length] = ($summary['length_counts'][$length] ?? 0) + 1;

                if (($row['pattern'] ?? '') === 'Numeric only') {
                    $summary['numeric_only_count']++;
                } else {
                    $summary['alphanumeric_count']++;
                }

                if (strpos((string) $row['folder_name'], '-') !== false) {
                    $summary['hyphenated_count']++;
                }

                if (strpos((string) $row['folder_name'], '_') !== false) {
                    $summary['underscored_count']++;
                }

                if (preg_match('/\\s/', (string) $row['folder_name']) === 1) {
                    $summary['spaced_count']++;
                }
            }

            ksort($summary['length_counts']);
            return $summary;
        }

        private function try_direct_folder_lookup(string $query): ?array
        {
            if (strlen($query) < 3) {
                return null;
            }

            $access_token = $this->get_access_token();
            $context = $this->resolve_storage_context($access_token);
            $path = sprintf(
                '/drives/%s/root:/%s/%s?$select=id,name,folder',
                rawurlencode($context['drive']['id']),
                $this->encode_graph_path($context['base_folder']),
                rawurlencode(trim($query))
            );

            $payload = $this->graph_json($path, $access_token, true);
            if ($payload === null || !isset($payload['folder'])) {
                return null;
            }

            return [
                'id' => $payload['id'],
                'name' => $payload['name'],
                'pattern' => $this->classify_folder_pattern($payload['name']),
                'length' => strlen($payload['name']),
                'has_letters' => preg_match('/[A-Za-z]/', $payload['name']) === 1 ? 1 : 0,
                'has_separator' => preg_match('/[-_\\s]/', $payload['name']) === 1 ? 1 : 0,
            ];
        }

        private function normalize_batch_queries(array $queries): array
        {
            $normalized = [];
            $seen = [];

            foreach ($queries as $query) {
                $query = trim((string) $query);
                if ($query === '') {
                    continue;
                }

                $this->assert_valid_search_query($query);
                $dedupe_key = strtoupper($query);
                if (isset($seen[$dedupe_key])) {
                    continue;
                }

                $seen[$dedupe_key] = true;
                $normalized[] = $query;
            }

            if (empty($normalized)) {
                throw new Metro_Registration_Graph_Exception('Enter at least one trailer number for exact lookup.', 400);
            }

            if (count($normalized) > self::BATCH_QUERY_LIMIT) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Exact lookup is limited to %d trailer numbers at a time.', self::BATCH_QUERY_LIMIT),
                    400
                );
            }

            return array_values($normalized);
        }

        private function resolve_exact_folder_match(string $query, array $normalized_rows, array $compact_rows): ?array
        {
            $query_upper = strtoupper($query);

            foreach ($normalized_rows as $row) {
                if (strtoupper((string) $row['name']) === $query_upper) {
                    return $row;
                }
            }

            if (count($normalized_rows) === 1) {
                return $normalized_rows[0];
            }

            foreach ($compact_rows as $row) {
                if (strtoupper((string) $row['name']) === $query_upper) {
                    return $row;
                }
            }

            if (count($compact_rows) === 1) {
                return $compact_rows[0];
            }

            return null;
        }

        private function get_access_token(): string
        {
            $tenant_id = $this->required_config('METRO_GRAPH_TENANT_ID');
            $client_id = $this->required_config('METRO_GRAPH_CLIENT_ID');
            $client_secret = $this->required_config('METRO_GRAPH_CLIENT_SECRET');

            $response = $this->http_request(
                'POST',
                sprintf('https://login.microsoftonline.com/%s/oauth2/v2.0/token', rawurlencode($tenant_id)),
                [
                    'Content-Type' => 'application/x-www-form-urlencoded',
                ],
                http_build_query([
                    'client_id' => $client_id,
                    'client_secret' => $client_secret,
                    'scope' => 'https://graph.microsoft.com/.default',
                    'grant_type' => 'client_credentials',
                ], '', '&')
            );

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Graph authentication failed with HTTP %d.', $response['status']),
                    502,
                    $response['body']
                );
            }

            $payload = json_decode($response['body'], true);
            if (!is_array($payload) || empty($payload['access_token'])) {
                throw new Metro_Registration_Graph_Exception('Graph authentication response did not include an access token.', 502);
            }

            return $payload['access_token'];
        }

        private function resolve_storage_context(string $access_token, bool $force_refresh = false): array
        {
            $cache_key = $this->get_context_cache_key();
            if (!$force_refresh && function_exists('get_transient')) {
                $cached = get_transient($cache_key);
                if (is_array($cached) && isset($cached['site'], $cached['drive'], $cached['base_folder'])) {
                    return $cached;
                }
            }

            $site = $this->resolve_site($access_token);
            $drive = $this->resolve_drive($site['id'], $access_token);
            $context = [
                'site' => $site,
                'drive' => $drive,
                'base_folder' => $this->normalize_folder_path(
                    $this->optional_config('METRO_SHAREPOINT_BASE_FOLDER') ?: self::DEFAULT_BASE_FOLDER
                ),
            ];

            if (function_exists('set_transient')) {
                set_transient($cache_key, $context, self::CONTEXT_TTL);
            }

            return $context;
        }

        private function resolve_site(string $access_token): array
        {
            $site_id = $this->optional_config('METRO_SHAREPOINT_SITE_ID');
            if ($site_id) {
                return $this->graph_json(
                    sprintf('/sites/%s?$select=id,displayName,webUrl', rawurlencode($site_id)),
                    $access_token
                );
            }

            $hostname = $this->optional_config('METRO_SHAREPOINT_HOSTNAME');
            $site_path = $this->optional_config('METRO_SHAREPOINT_SITE_PATH');

            if ($hostname && $site_path) {
                $normalized_path = '/' . ltrim($site_path, '/');
                $encoded_segments = array_map('rawurlencode', array_filter(explode('/', $normalized_path), 'strlen'));

                return $this->graph_json(
                    sprintf('/sites/%s:/%s?$select=id,displayName,webUrl', $hostname, implode('/', $encoded_segments)),
                    $access_token
                );
            }

            if ($hostname) {
                return $this->graph_json(
                    sprintf('/sites/%s:?$select=id,displayName,webUrl', $hostname),
                    $access_token
                );
            }

            $sites = $this->graph_json('/sites?search=*', $access_token);
            if (empty($sites['value'][0])) {
                throw new Metro_Registration_Graph_Exception('No SharePoint site could be resolved.', 500);
            }

            return $sites['value'][0];
        }

        private function resolve_drive(string $site_id, string $access_token): array
        {
            $drive_id = $this->optional_config('METRO_SHAREPOINT_DRIVE_ID');
            if ($drive_id) {
                return $this->graph_json(
                    sprintf('/drives/%s?$select=id,name,webUrl', rawurlencode($drive_id)),
                    $access_token
                );
            }

            $drives = $this->graph_json(
                sprintf('/sites/%s/drives?$select=id,name,webUrl', rawurlencode($site_id)),
                $access_token
            );

            $library_name = $this->optional_config('METRO_SHAREPOINT_LIBRARY_NAME');
            foreach ($drives['value'] ?? [] as $drive) {
                if ($library_name && isset($drive['name']) && strcasecmp($drive['name'], $library_name) === 0) {
                    return $drive;
                }
            }

            if (!empty($drives['value'][0])) {
                return $drives['value'][0];
            }

            throw new Metro_Registration_Graph_Exception('No SharePoint document library could be resolved.', 500);
        }

        private function list_children_by_item_id(string $drive_id, string $item_id, string $access_token): array
        {
            $url = sprintf(
                '/drives/%s/items/%s/children?$top=999&$select=id,name,webUrl,folder,file,size,lastModifiedDateTime',
                rawurlencode($drive_id),
                rawurlencode($item_id)
            );

            return $this->paginate_graph_collection($url, $access_token);
        }

        private function paginate_graph_collection(string $path_or_url, string $access_token): array
        {
            $items = [];
            $next = $path_or_url;

            while ($next) {
                $payload = $this->graph_json($next, $access_token);
                foreach ($payload['value'] ?? [] as $item) {
                    $items[] = $item;
                }

                $next = $payload['@odata.nextLink'] ?? null;
            }

            return $items;
        }

        private function graph_json(string $path_or_url, string $access_token, bool $allow_not_found = false): ?array
        {
            $response = $this->graph_request($path_or_url, $access_token);

            if ($response['status'] === 404 && $allow_not_found) {
                return null;
            }

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Graph request failed with HTTP %d.', $response['status']),
                    502,
                    $response['body']
                );
            }

            $payload = json_decode($response['body'], true);
            if (!is_array($payload)) {
                throw new Metro_Registration_Graph_Exception('Graph returned an invalid JSON response.', 502);
            }

            return $payload;
        }

        private function download_binary(string $path_or_url, string $access_token): string
        {
            $response = $this->graph_request($path_or_url, $access_token);

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Graph file download failed with HTTP %d.', $response['status']),
                    502,
                    $response['body']
                );
            }

            return $response['body'];
        }

        private function graph_request(string $path_or_url, string $access_token): array
        {
            $url = strpos($path_or_url, 'http') === 0 ? $path_or_url : self::GRAPH_BASE_URL . $path_or_url;

            return $this->http_request(
                'GET',
                $url,
                [
                    'Authorization' => 'Bearer ' . $access_token,
                ]
            );
        }

        private function http_request(string $method, string $url, array $headers = [], ?string $body = null): array
        {
            if (function_exists('wp_remote_request')) {
                $response = wp_remote_request($url, [
                    'method' => $method,
                    'headers' => $headers,
                    'body' => $body,
                    'timeout' => 60,
                    'redirection' => 5,
                ]);

                if (is_wp_error($response)) {
                    throw new Metro_Registration_Graph_Exception($response->get_error_message(), 502);
                }

                return [
                    'status' => (int) wp_remote_retrieve_response_code($response),
                    'body' => (string) wp_remote_retrieve_body($response),
                ];
            }

            $formatted_headers = [];
            foreach ($headers as $name => $value) {
                $formatted_headers[] = $name . ': ' . $value;
            }

            $context = stream_context_create([
                'http' => [
                    'method' => $method,
                    'header' => implode("\r\n", $formatted_headers),
                    'content' => $body ?? '',
                    'ignore_errors' => true,
                    'timeout' => 60,
                ],
            ]);

            $response_body = file_get_contents($url, false, $context);
            $status = 0;
            foreach (($http_response_header ?? []) as $header) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                    $status = (int) $matches[1];
                    break;
                }
            }

            if ($response_body === false) {
                throw new Metro_Registration_Graph_Exception('HTTP request failed.', 502);
            }

            return [
                'status' => $status,
                'body' => $response_body,
            ];
        }

        private function score_folder_match(array $folder, string $query_upper, string $query_compact): ?array
        {
            $name = (string) $folder['name'];
            $name_upper = strtoupper($name);
            $compact = $this->compact_search_value($name);
            $score = null;
            $match_type = null;

            if ($name_upper === $query_upper) {
                $score = 1200;
                $match_type = 'Exact';
            } elseif ($compact === $query_compact) {
                $score = 1100;
                $match_type = 'Exact normalized';
            } elseif (strpos($name_upper, $query_upper) === 0) {
                $score = 950;
                $match_type = 'Starts with';
            } elseif (strpos($compact, $query_compact) === 0) {
                $score = 875;
                $match_type = 'Starts with (normalized)';
            } elseif (strpos($name_upper, $query_upper) !== false) {
                $score = 760;
                $match_type = 'Contains';
            } elseif (strpos($compact, $query_compact) !== false) {
                $score = 700;
                $match_type = 'Contains (normalized)';
            }

            if ($score === null) {
                return null;
            }

            if ((int) ($folder['has_letters'] ?? 0) === 0) {
                $score += 40;
            }

            return [
                'id' => (string) $folder['id'],
                'name' => $name,
                'pattern' => (string) ($folder['pattern'] ?? $this->classify_folder_pattern($name)),
                'length' => (int) ($folder['length'] ?? strlen($name)),
                'has_letters' => (int) ($folder['has_letters'] ?? (preg_match('/[A-Za-z]/', $name) === 1 ? 1 : 0)),
                'has_separator' => (int) ($folder['has_separator'] ?? (preg_match('/[-_\\s]/', $name) === 1 ? 1 : 0)),
                'score' => $score,
                'match_type' => $match_type,
                'length_delta' => abs(strlen($query_upper) - strlen($name)),
            ];
        }

        private function format_folder_result(array $folder): array
        {
            return [
                'id' => (string) $folder['id'],
                'name' => (string) $folder['name'],
                'pattern' => (string) $folder['pattern'],
                'match_type' => $folder['match_type'] ?? null,
                'length' => (int) $folder['length'],
                'has_letters' => (int) $folder['has_letters'] === 1,
                'has_separator' => (int) $folder['has_separator'] === 1,
            ];
        }

        private function empty_summary(int $row_count): array
        {
            return [
                'total_folders' => $row_count,
                'numeric_only_count' => 0,
                'alphanumeric_count' => 0,
                'hyphenated_count' => 0,
                'underscored_count' => 0,
                'spaced_count' => 0,
                'length_counts' => [],
            ];
        }

        private function classify_folder_pattern(string $name): string
        {
            if (preg_match('/^\\d+$/', $name) === 1) {
                return 'Numeric only';
            }

            if (preg_match('/^[A-Za-z0-9]+$/', $name) === 1) {
                return 'Alphanumeric';
            }

            if (strpos($name, '-') !== false) {
                return 'Hyphenated';
            }

            if (strpos($name, '_') !== false) {
                return 'Underscored';
            }

            if (preg_match('/\\s/', $name) === 1) {
                return 'Contains spaces';
            }

            return 'Custom';
        }

        private function detect_document_type(string $name): string
        {
            $name_upper = strtoupper($name);

            if (preg_match('/(^|[_\\-\\s])R([_\\-\\.]|$)/', $name_upper) === 1 || strpos($name_upper, 'REGISTRATION') !== false) {
                return 'Registration';
            }

            if (preg_match('/(^|[_\\-\\s])I([_\\-\\.]|$)/', $name_upper) === 1 || strpos($name_upper, 'INSURANCE') !== false) {
                return 'Insurance';
            }

            if (strpos($name_upper, 'TITLE') !== false) {
                return 'Title';
            }

            return 'Document';
        }

        private function pick_registration_document(array $documents): ?array
        {
            foreach ($documents as $document) {
                if (($document['document_type'] ?? null) === 'Registration' && !empty($document['is_pdf'])) {
                    return $document;
                }
            }

            foreach ($documents as $document) {
                if (!empty($document['is_pdf'])) {
                    return $document;
                }
            }

            return null;
        }

        private function build_unique_export_filename(string $folder_name, string $document_name, array $existing_names): string
        {
            $document_name = sanitize_file_name($document_name ?: 'registration.pdf');
            $extension = pathinfo($document_name, PATHINFO_EXTENSION);
            $stem = pathinfo($document_name, PATHINFO_FILENAME);
            $base = sanitize_file_name($folder_name . '-' . $stem);
            if ($base === '') {
                $base = 'registration-document';
            }

            $filename = $base . ($extension !== '' ? '.' . $extension : '');
            $counter = 2;
            while (in_array($filename, $existing_names, true)) {
                $filename = $base . '-' . $counter . ($extension !== '' ? '.' . $extension : '');
                $counter++;
            }

            return $filename;
        }

        private function create_zip_archive(string $zip_path, array $files, string $base_dir): void
        {
            if (class_exists('ZipArchive')) {
                $archive = new ZipArchive();
                if ($archive->open($zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                    throw new Metro_Registration_Graph_Exception('Could not create the ZIP archive.', 500);
                }

                foreach ($files as $archive_name => $file_path) {
                    $archive->addFile($file_path, $archive_name);
                }

                $archive->close();
                return;
            }

            require_once ABSPATH . 'wp-admin/includes/class-pclzip.php';
            $archive = new PclZip($zip_path);
            $result = $archive->create(array_values($files), PCLZIP_OPT_REMOVE_PATH, $base_dir);
            if ($result === 0) {
                throw new Metro_Registration_Graph_Exception('Could not create the ZIP archive.', 500, $archive->errorInfo(true));
            }
        }

        private function delete_directory(string $directory): void
        {
            if (!is_dir($directory)) {
                return;
            }

            $items = scandir($directory);
            if (!is_array($items)) {
                return;
            }

            foreach ($items as $item) {
                if ($item === '.' || $item === '..') {
                    continue;
                }

                $path = $directory . DIRECTORY_SEPARATOR . $item;
                if (is_dir($path)) {
                    $this->delete_directory($path);
                    continue;
                }

                @unlink($path);
            }

            @rmdir($directory);
        }

        private function compact_search_value(string $value): string
        {
            return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $value));
        }

        private function encode_graph_path(string $folder_path): string
        {
            return implode('/', array_map('rawurlencode', explode('/', $this->normalize_folder_path($folder_path))));
        }

        private function normalize_folder_path(string $folder_path): string
        {
            return implode('/', array_filter(array_map('trim', explode('/', $folder_path)), 'strlen'));
        }

        private function assert_valid_search_query(string $query): void
        {
            if (!preg_match('/^[A-Za-z0-9_\\-\\s]{1,50}$/', $query)) {
                throw new Metro_Registration_Graph_Exception(
                    'Only letters, numbers, spaces, underscores, and dashes are allowed in search.',
                    400
                );
            }

            if (preg_match('/[A-Za-z0-9]/', $query) !== 1) {
                throw new Metro_Registration_Graph_Exception(
                    'Enter at least one letter or number to search.',
                    400
                );
            }
        }

        private function find_folder_by_id(string $folder_id): ?array
        {
            global $wpdb;

            $table_name = self::get_index_table_name();
            $sql = $wpdb->prepare(
                "SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator
                 FROM {$table_name}
                 WHERE folder_id = %s
                 LIMIT 1",
                $folder_id
            );

            $row = $wpdb->get_row($sql, ARRAY_A);
            if (is_array($row)) {
                return $row;
            }

            return null;
        }

        private function get_context_cache_key(): string
        {
            return self::CONTEXT_TRANSIENT_PREFIX . md5($this->get_cache_signature());
        }

        private function get_documents_cache_key(string $folder_id): string
        {
            return self::DOCUMENTS_TRANSIENT_PREFIX . md5($this->get_cache_signature() . '|' . $folder_id);
        }

        private function get_cache_signature(): string
        {
            return implode('|', [
                $this->optional_config('METRO_SHAREPOINT_HOSTNAME') ?: '',
                $this->optional_config('METRO_SHAREPOINT_SITE_ID') ?: '',
                $this->optional_config('METRO_SHAREPOINT_SITE_PATH') ?: '',
                $this->optional_config('METRO_SHAREPOINT_DRIVE_ID') ?: '',
                $this->optional_config('METRO_SHAREPOINT_LIBRARY_NAME') ?: '',
                $this->optional_config('METRO_SHAREPOINT_BASE_FOLDER') ?: self::DEFAULT_BASE_FOLDER,
            ]);
        }

        private function get_cached_documents(string $folder_id): ?array
        {
            if (!function_exists('get_transient')) {
                return null;
            }

            $cached = get_transient($this->get_documents_cache_key($folder_id));
            return is_array($cached) ? $cached : null;
        }

        private function set_cached_documents(string $folder_id, array $documents): void
        {
            if (function_exists('set_transient')) {
                set_transient($this->get_documents_cache_key($folder_id), $documents, self::DOCUMENTS_TTL);
            }
        }

        private function required_config(string $name): string
        {
            $value = $this->optional_config($name);
            if (!$value) {
                throw new Metro_Registration_Graph_Exception(sprintf('Missing required config value: %s', $name), 500);
            }

            return $value;
        }

        private function optional_config(string $name): ?string
        {
            if (defined($name) && constant($name)) {
                return trim((string) constant($name));
            }

            $value = getenv($name);
            if ($value !== false && trim($value) !== '') {
                return trim($value);
            }

            if (function_exists('get_option') && class_exists('Metro_Registration_Settings')) {
                $settings = Metro_Registration_Settings::get_settings();
                if (isset($settings[$name]) && trim((string) $settings[$name]) !== '') {
                    return trim((string) $settings[$name]);
                }
            }

            return null;
        }
    }
}

if (!class_exists('Metro_Registration_Graph_Exception')) {
    class Metro_Registration_Graph_Exception extends Exception
    {
        private int $http_status;
        private ?string $raw_details;

        public function __construct(string $message, int $http_status = 500, ?string $raw_details = null)
        {
            parent::__construct($message);
            $this->http_status = $http_status;
            $this->raw_details = $raw_details;
        }

        public function get_http_status(): int
        {
            return $this->http_status;
        }

        public function get_raw_details(): ?string
        {
            return $this->raw_details;
        }
    }
}
