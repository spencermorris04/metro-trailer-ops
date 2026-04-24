<?php

if (!class_exists('Metro_Registration_Graph_Client')) {
    class Metro_Registration_Graph_Client
    {
        private const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
        private const BUSINESS_CENTRAL_BASE_URL = 'https://api.businesscentral.dynamics.com/v2.0';
        private const DEFAULT_BASE_FOLDER = 'FixedAssets';
        private const DOCUMENTS_TRANSIENT_PREFIX = 'metro_registration_documents_';
        private const CONTEXT_TRANSIENT_PREFIX = 'metro_registration_context_';
        private const DOCUMENTS_TTL = 900;
        private const CONTEXT_TTL = 3600;
        private const SEARCH_LIMIT_DEFAULT = 24;
        private const SEARCH_LIMIT_MAX = 60;
        private const SEARCH_QUERY_ROW_LIMIT = 250;
        private const BATCH_QUERY_LIMIT = 250;
        private const AVAILABILITY_BATCH_LIMIT = 80;
        private const BULK_DOWNLOAD_LIMIT = 99;
        private const INDEX_TABLE_SUFFIX = 'metro_registration_lookup_index';
        private const INDEX_STATE_OPTION = 'metro_registration_lookup_tool_index_state';
        private const INDEX_BATCH_SIZE = 999;
        private const ASSET_INDEX_TABLE_SUFFIX = 'metro_registration_lookup_bc_assets';
        private const ASSET_INDEX_STATE_OPTION = 'metro_registration_lookup_tool_bc_asset_index_state';
        private const ASSET_INDEX_BATCH_SIZE = 500;
        private const ASSET_SEARCH_QUERY_LIMIT = 250;

        public static function install_schema(): void
        {
            global $wpdb;

            require_once ABSPATH . 'wp-admin/includes/upgrade.php';

            $table_name = self::get_index_table_name();
            $asset_table_name = self::get_asset_index_table_name();
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
                has_registration_pdf tinyint(1) NULL DEFAULT NULL,
                has_fhwa_pdf tinyint(1) NULL DEFAULT NULL,
                documents_scanned_at datetime NULL DEFAULT NULL,
                updated_at datetime NOT NULL,
                PRIMARY KEY  (folder_id),
                KEY normalized_name (normalized_name),
                KEY compact_name (compact_name),
                KEY folder_name (folder_name)
            ) {$charset_collate};

            CREATE TABLE {$asset_table_name} (
                asset_no varchar(191) NOT NULL,
                service_item_number varchar(191) NOT NULL DEFAULT '',
                description varchar(255) NOT NULL DEFAULT '',
                make varchar(191) NOT NULL DEFAULT '',
                vehicle_year varchar(32) NOT NULL DEFAULT '',
                serial_vin varchar(191) NOT NULL DEFAULT '',
                registration_number varchar(191) NOT NULL DEFAULT '',
                normalized_asset_no varchar(191) NOT NULL,
                compact_asset_no varchar(191) NOT NULL,
                normalized_service_item_number varchar(191) NOT NULL,
                compact_service_item_number varchar(191) NOT NULL,
                normalized_serial_vin varchar(191) NOT NULL,
                compact_serial_vin varchar(191) NOT NULL,
                normalized_registration_number varchar(191) NOT NULL,
                compact_registration_number varchar(191) NOT NULL,
                updated_at datetime NOT NULL,
                PRIMARY KEY  (asset_no),
                KEY compact_asset_no (compact_asset_no),
                KEY compact_service_item_number (compact_service_item_number),
                KEY compact_serial_vin (compact_serial_vin),
                KEY compact_registration_number (compact_registration_number)
            ) {$charset_collate};";

            dbDelta($sql);
        }

        public static function get_index_table_name(): string
        {
            global $wpdb;
            return $wpdb->prefix . self::INDEX_TABLE_SUFFIX;
        }

        public static function get_asset_index_table_name(): string
        {
            global $wpdb;
            return $wpdb->prefix . self::ASSET_INDEX_TABLE_SUFFIX;
        }

        public function get_registration_pdf(string $trailer_number): array
        {
            $this->assert_valid_search_query($trailer_number);

            $batch = $this->lookup_exact_trailer_batch([$trailer_number]);
            $first = $batch['results'][0]['trailer'] ?? null;
            if (!$first || empty($first['folder']['id'])) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('No trailer folders matched "%s".', $trailer_number),
                    404
                );
            }

            $documents = $this->get_trailer_documents($first['folder']['id']);
            $registration = $this->pick_registration_document($documents['documents']);
            if (!$registration) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Trailer "%s" does not have a registration PDF.', $first['trailer_number']),
                    404
                );
            }

            return $this->download_document($registration['id']);
        }

        public function search_trailer_folders(string $query, int $limit = self::SEARCH_LIMIT_DEFAULT): array
        {
            $query = $this->strip_search_special_characters(trim($query));
            $this->assert_valid_search_query($query);

            if (strlen($query) < 4) {
                throw new Metro_Registration_Graph_Exception(
                    'Enter at least 4 characters to search trailer folders.',
                    400
                );
            }

            $limit = max(1, min(self::SEARCH_LIMIT_MAX, $limit));
            $asset_status = $this->get_bc_asset_index_status();
            $status = $this->get_index_status();
            $response = $asset_status['row_count'] > 0
                ? $this->build_asset_search_response($query, $limit, $asset_status, $status)
                : $this->build_legacy_folder_only_search_response($query, $limit, $status);

            if ($response['total_matches'] === 0) {
                $numeric_fallback = $this->build_numeric_search_fallback($query, 4);
                if ($numeric_fallback !== null) {
                    $fallback_response = $asset_status['row_count'] > 0
                        ? $this->build_asset_search_response($numeric_fallback, $limit, $asset_status, $status)
                        : $this->build_legacy_folder_only_search_response($numeric_fallback, $limit, $status);
                    if ($fallback_response['total_matches'] > 0) {
                        return $fallback_response;
                    }
                }
            }

            if ($response['total_matches'] === 0 && $asset_status['row_count'] > 0 && $status['row_count'] > 0) {
                $legacy_response = $this->build_legacy_folder_only_search_response($query, $limit, $status);
                if ($legacy_response['total_matches'] > 0) {
                    return $legacy_response;
                }
            }

            if (($asset_status['row_count'] ?? 0) === 0 && ($status['row_count'] ?? 0) === 0 && $response['total_matches'] === 0) {
                throw new Metro_Registration_Graph_Exception(
                    'The trailer and Business Central indexes are not built yet. Go to Settings -> Trailer Document Lookup Tool and rebuild both indexes first.',
                    503
                );
            }

            return $response;
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

                $folder = $this->build_folder_index_row(
                    (string) $metadata['id'],
                    (string) $metadata['name']
                );
                $this->upsert_folder_rows([$folder]);
            }

            $cached = $this->get_cached_documents($folder_id);
            if ($cached !== null) {
                $this->update_folder_document_flags_from_documents($folder_id, $cached);
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
            $this->update_folder_document_flags_from_documents($folder_id, $documents);

            return [
                'folder' => $this->format_folder_result($folder),
                'documents' => $documents,
            ];
        }

        public function get_document_availability_batch(array $folder_ids): array
        {
            $folder_ids = array_values(array_unique(array_filter(array_map('trim', $folder_ids), 'strlen')));
            if (empty($folder_ids)) {
                throw new Metro_Registration_Graph_Exception('At least one trailer folder is required.', 400);
            }

            if (count($folder_ids) > self::AVAILABILITY_BATCH_LIMIT) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Document availability lookup is limited to %d trailers at a time.', self::AVAILABILITY_BATCH_LIMIT),
                    400
                );
            }

            $results = [];
            foreach ($folder_ids as $folder_id) {
                $folder = $this->find_folder_by_id($folder_id);
                if ($folder === null) {
                    continue;
                }

                $has_registration = $this->normalize_nullable_bool($folder['has_registration_pdf'] ?? null);
                $has_fhwa = $this->normalize_nullable_bool($folder['has_fhwa_pdf'] ?? null);

                if ($has_registration === null || $has_fhwa === null) {
                    $documents = $this->get_trailer_documents($folder_id);
                    $has_registration = $this->has_document_type($documents['documents'], 'Registration');
                    $has_fhwa = $this->has_document_type($documents['documents'], 'FHWA Inspection');
                    $this->update_folder_document_flags($folder_id, $has_registration, $has_fhwa);
                }

                $results[] = [
                    'folder_id' => $folder_id,
                    'has_registration_pdf' => $has_registration,
                    'has_fhwa_pdf' => $has_fhwa,
                ];
            }

            return [
                'results' => $results,
            ];
        }

        public function lookup_exact_trailer_batch(array $queries): array
        {
            $queries = $this->normalize_batch_queries($queries);
            $asset_status = $this->get_bc_asset_index_status();
            $status = $this->get_index_status();
            $resolved = [];
            $missing = [];

            foreach ($queries as $query) {
                $matched_trailer = null;

                if ($asset_status['row_count'] > 0) {
                    $matched_trailer = $this->lookup_exact_asset_match($query, $status);
                }

                if ($matched_trailer === null) {
                    $matched_trailer = $this->build_legacy_folder_only_exact_match($query);
                }

                if ($matched_trailer === null) {
                    $missing[] = $query['input'];
                    continue;
                }

                $resolved[] = [
                    'requested' => $query['input'],
                    'trailer' => $matched_trailer,
                ];
            }

            $downloadable = array_values(array_filter($resolved, static function (array $item): bool {
                return !empty($item['trailer']['folder']['id']);
            }));

            return [
                'mode' => 'exact_batch',
                'requested_count' => count($queries),
                'matched_count' => count($resolved),
                'missing_count' => count($missing),
                'results' => $resolved,
                'missing' => $missing,
                'downloadable_count' => count($downloadable),
                'can_download_all' => count($downloadable) > 0 && count($downloadable) < 100,
                'download_limit' => self::BULK_DOWNLOAD_LIMIT,
                'inventory' => $status['summary'],
                'index_status' => [
                    'sharepoint' => [
                        'status' => $status['status'],
                        'last_completed_at' => $status['last_completed_at'],
                        'ready' => $status['row_count'] > 0,
                    ],
                    'business_central' => [
                        'status' => $asset_status['status'],
                        'last_completed_at' => $asset_status['last_completed_at'],
                        'ready' => $asset_status['row_count'] > 0,
                    ],
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
            $folder_paths = [];

            try {
                foreach ($folder_ids as $folder_id) {
                    $documents = $this->get_trailer_documents($folder_id);
                    $folder_name = (string) $documents['folder']['name'];
                    $archive_folder = $this->build_unique_export_directory($folder_name, array_keys($folder_paths));
                    $archive_folder_path = trailingslashit($temp_dir) . $archive_folder;

                    if (!wp_mkdir_p($archive_folder_path)) {
                        throw new Metro_Registration_Graph_Exception(
                            sprintf('Could not create an export folder for trailer %s.', $folder_name),
                            500
                        );
                    }

                    $folder_paths[$archive_folder] = $archive_folder_path;

                    if (empty($documents['documents'])) {
                        $notes[] = sprintf('%s: no files were available to include.', $folder_name);
                        continue;
                    }

                    $folder_written = 0;
                    $existing_names = [];
                    foreach ($documents['documents'] as $document_metadata) {
                        $file = $this->download_document((string) $document_metadata['id']);
                        $filename = $this->build_unique_document_filename(
                            (string) $file['filename'],
                            $existing_names
                        );
                        $file_path = trailingslashit($archive_folder_path) . $filename;
                        if (file_put_contents($file_path, $file['content']) === false) {
                            throw new Metro_Registration_Graph_Exception(
                                sprintf('Could not write %s for trailer %s.', $filename, $folder_name),
                                500
                            );
                        }

                        $written_files[$archive_folder . '/' . $filename] = $file_path;
                        $existing_names[] = $filename;
                        $folder_written++;
                    }

                    if ($folder_written === 0) {
                        $notes[] = sprintf('%s: no files were available to include.', $folder_name);
                    }
                }

                if (!empty($notes)) {
                    $notes_path = trailingslashit($temp_dir) . 'download-notes.txt';
                    file_put_contents($notes_path, implode(PHP_EOL, $notes) . PHP_EOL);
                    $written_files['download-notes.txt'] = $notes_path;
                }

                $export_files = $written_files;
                unset($export_files['download-notes.txt']);
                if (empty($export_files)) {
                    throw new Metro_Registration_Graph_Exception('No trailer documents were available to download.', 404);
                }

                $zip_path = trailingslashit($temp_dir) . 'metro-trailer-documents.zip';
                $this->create_zip_archive($zip_path, $written_files, $temp_dir);
                $zip_content = file_get_contents($zip_path);
                if ($zip_content === false) {
                    throw new Metro_Registration_Graph_Exception('Could not read the generated ZIP archive.', 500);
                }

                return [
                    'filename' => 'metro-trailer-documents-' . gmdate('Ymd-His') . '.zip',
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

        public function get_bc_asset_index_status(): array
        {
            global $wpdb;

            $state = get_option(self::ASSET_INDEX_STATE_OPTION, []);
            $table_name = self::get_asset_index_table_name();
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

                    $folders[] = $this->build_folder_index_row((string) $item['id'], $name);
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

        public function refresh_bc_asset_index_batch(bool $reset = false): array
        {
            global $wpdb;

            self::install_schema();

            $state = get_option(self::ASSET_INDEX_STATE_OPTION, []);
            if ($reset || empty($state) || empty($state['next_url'])) {
                $table_name = self::get_asset_index_table_name();
                $wpdb->query("TRUNCATE TABLE {$table_name}");

                $state = [
                    'status' => 'running',
                    'started_at' => current_time('mysql', true),
                    'last_completed_at' => $state['last_completed_at'] ?? null,
                    'last_error' => null,
                    'processed' => 0,
                    'next_url' => $this->build_bc_assets_collection_url(),
                ];
                update_option(self::ASSET_INDEX_STATE_OPTION, $state, false);
            }

            try {
                $access_token = $this->get_business_central_access_token();
                $payload = $this->business_central_json($state['next_url'], $access_token);
                $assets = [];

                foreach ($payload['value'] ?? [] as $item) {
                    $row = $this->build_bc_asset_index_row($item);
                    if ($row === null) {
                        continue;
                    }

                    $assets[] = $row;
                }

                if (!empty($assets)) {
                    $this->upsert_bc_asset_rows($assets);
                }

                $state['processed'] = (int) $state['processed'] + count($assets);
                $state['next_url'] = $payload['@odata.nextLink'] ?? null;

                if (empty($state['next_url'])) {
                    $state['status'] = 'ready';
                    $state['last_completed_at'] = current_time('mysql', true);
                } else {
                    $state['status'] = 'running';
                }

                update_option(self::ASSET_INDEX_STATE_OPTION, $state, false);
                return $this->get_bc_asset_index_status();
            } catch (Throwable $exception) {
                $state['status'] = 'error';
                $state['last_error'] = $exception->getMessage();
                update_option(self::ASSET_INDEX_STATE_OPTION, $state, false);
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
                    $placeholders[] = '(%s,%s,%s,%s,%s,%d,%d,%d,NULL,NULL,NULL,%s)';
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
                        (folder_id, folder_name, normalized_name, compact_name, pattern, folder_length, has_letters, has_separator, has_registration_pdf, has_fhwa_pdf, documents_scanned_at, updated_at)
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

        private function upsert_bc_asset_rows(array $assets): void
        {
            global $wpdb;

            $table_name = self::get_asset_index_table_name();
            $updated_at = current_time('mysql', true);
            $chunks = array_chunk($assets, 150);

            foreach ($chunks as $chunk) {
                $values = [];

                foreach ($chunk as $asset) {
                    $values[] = $asset['asset_no'];
                    $values[] = $asset['service_item_number'];
                    $values[] = $asset['description'];
                    $values[] = $asset['make'];
                    $values[] = $asset['vehicle_year'];
                    $values[] = $asset['serial_vin'];
                    $values[] = $asset['registration_number'];
                    $values[] = $asset['normalized_asset_no'];
                    $values[] = $asset['compact_asset_no'];
                    $values[] = $asset['normalized_service_item_number'];
                    $values[] = $asset['compact_service_item_number'];
                    $values[] = $asset['normalized_serial_vin'];
                    $values[] = $asset['compact_serial_vin'];
                    $values[] = $asset['normalized_registration_number'];
                    $values[] = $asset['compact_registration_number'];
                    $values[] = $updated_at;
                }

                $sql = "
                    INSERT INTO {$table_name}
                        (asset_no, service_item_number, description, make, vehicle_year, serial_vin, registration_number,
                         normalized_asset_no, compact_asset_no, normalized_service_item_number, compact_service_item_number,
                         normalized_serial_vin, compact_serial_vin, normalized_registration_number, compact_registration_number, updated_at)
                    VALUES " . implode(', ', array_fill(0, count($chunk), '(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)')) . "
                    ON DUPLICATE KEY UPDATE
                        service_item_number = VALUES(service_item_number),
                        description = VALUES(description),
                        make = VALUES(make),
                        vehicle_year = VALUES(vehicle_year),
                        serial_vin = VALUES(serial_vin),
                        registration_number = VALUES(registration_number),
                        normalized_asset_no = VALUES(normalized_asset_no),
                        compact_asset_no = VALUES(compact_asset_no),
                        normalized_service_item_number = VALUES(normalized_service_item_number),
                        compact_service_item_number = VALUES(compact_service_item_number),
                        normalized_serial_vin = VALUES(normalized_serial_vin),
                        compact_serial_vin = VALUES(compact_serial_vin),
                        normalized_registration_number = VALUES(normalized_registration_number),
                        compact_registration_number = VALUES(compact_registration_number),
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

            $folder = $this->build_folder_index_row((string) $payload['id'], (string) $payload['name']);
            $this->upsert_folder_rows([$folder]);

            return $folder;
        }

        private function update_folder_document_flags(string $folder_id, bool $has_registration, bool $has_fhwa): void
        {
            global $wpdb;

            $this->ensure_folder_index_row($folder_id);

            $wpdb->update(
                self::get_index_table_name(),
                [
                    'has_registration_pdf' => $has_registration ? 1 : 0,
                    'has_fhwa_pdf' => $has_fhwa ? 1 : 0,
                    'documents_scanned_at' => current_time('mysql', true),
                ],
                [
                    'folder_id' => $folder_id,
                ],
                [
                    '%d',
                    '%d',
                    '%s',
                ],
                [
                    '%s',
                ]
            );
        }

        private function update_folder_document_flags_from_documents(string $folder_id, array $documents): void
        {
            $this->update_folder_document_flags(
                $folder_id,
                $this->has_document_type($documents, 'Registration'),
                $this->has_document_type($documents, 'FHWA Inspection')
            );
        }

        private function build_asset_search_response(string $query, int $limit, array $asset_status, array $folder_status): array
        {
            $rows = $this->lookup_asset_search_rows($query, $asset_status);
            $matches = $this->score_asset_rows($rows, $query);
            $results = [];

            foreach (array_slice($matches, 0, $limit) as $match) {
                $results[] = $this->format_asset_result(
                    $match,
                    $this->find_best_folder_for_asset($match)
                );
            }

            return [
                'query' => $query,
                'total_matches' => count($matches),
                'shown_count' => count($results),
                'results' => $results,
                'inventory' => $folder_status['summary'],
                'index_status' => [
                    'sharepoint' => [
                        'status' => $folder_status['status'],
                        'last_completed_at' => $folder_status['last_completed_at'],
                        'ready' => $folder_status['row_count'] > 0,
                    ],
                    'business_central' => [
                        'status' => $asset_status['status'],
                        'last_completed_at' => $asset_status['last_completed_at'],
                        'ready' => $asset_status['row_count'] > 0,
                    ],
                ],
            ];
        }

        private function build_legacy_folder_only_search_response(string $query, int $limit, array $folder_status): array
        {
            $response = $this->build_folder_search_response($query, $limit, $folder_status);
            $response['results'] = array_map([$this, 'format_legacy_folder_as_trailer'], $response['results']);

            return $response;
        }

        private function lookup_asset_search_rows(string $query, array $asset_status): array
        {
            global $wpdb;

            if (($asset_status['row_count'] ?? 0) === 0) {
                return [];
            }

            $table_name = self::get_asset_index_table_name();
            $query_compact = $this->compact_search_value($query);
            $like_compact = '%' . $wpdb->esc_like($query_compact) . '%';
            $sql = $wpdb->prepare(
                "SELECT asset_no, service_item_number, description, make, vehicle_year, serial_vin, registration_number,
                        normalized_asset_no, compact_asset_no, normalized_service_item_number, compact_service_item_number,
                        normalized_serial_vin, compact_serial_vin, normalized_registration_number, compact_registration_number
                 FROM {$table_name}
                 WHERE compact_asset_no LIKE %s
                    OR compact_service_item_number LIKE %s
                    OR compact_serial_vin LIKE %s
                    OR compact_registration_number LIKE %s
                 LIMIT %d",
                $like_compact,
                $like_compact,
                $like_compact,
                $like_compact,
                self::ASSET_SEARCH_QUERY_LIMIT
            );

            return $wpdb->get_results($sql, ARRAY_A) ?: [];
        }

        private function score_asset_rows(array $rows, string $query): array
        {
            $query_upper = strtoupper($query);
            $query_compact = $this->compact_search_value($query);
            $matches = [];

            foreach ($rows as $row) {
                $match = $this->score_asset_match($row, $query_upper, $query_compact);
                if ($match === null) {
                    continue;
                }

                $matches[] = $match;
            }

            usort($matches, static function (array $left, array $right): int {
                if ($left['score'] !== $right['score']) {
                    return $right['score'] <=> $left['score'];
                }

                if ($left['length_delta'] !== $right['length_delta']) {
                    return $left['length_delta'] <=> $right['length_delta'];
                }

                return strcmp((string) $left['asset_no'], (string) $right['asset_no']);
            });

            return $matches;
        }

        private function score_asset_match(array $asset, string $query_upper, string $query_compact): ?array
        {
            $best = null;

            foreach ([
                'asset_no' => ['Trailer number', 1200, 980, 760],
                'service_item_number' => ['Service item', 1160, 940, 720],
                'serial_vin' => ['Serial/VIN', 1120, 900, 700],
                'registration_number' => ['Registration number', 1080, 860, 680],
            ] as $field => [$label, $exact_score, $starts_score, $contains_score]) {
                $normalized = strtoupper((string) ($asset['normalized_' . $field] ?? $asset[$field] ?? ''));
                $compact = (string) ($asset['compact_' . $field] ?? $this->compact_search_value((string) ($asset[$field] ?? '')));

                if ($normalized === '' && $compact === '') {
                    continue;
                }

                $score = null;
                if ($normalized === $query_upper || $compact === $query_compact) {
                    $score = $exact_score;
                } elseif (strpos($compact, $query_compact) === 0) {
                    $score = $starts_score;
                } elseif (strpos($compact, $query_compact) !== false) {
                    $score = $contains_score;
                }

                if ($score === null) {
                    continue;
                }

                if ($best === null || $score > $best['score']) {
                    $best = [
                        'score' => $score,
                        'match_field' => $label,
                    ];
                }
            }

            if ($best === null) {
                return null;
            }

            $best['asset_no'] = (string) $asset['asset_no'];
            $best['service_item_number'] = (string) $asset['service_item_number'];
            $best['description'] = (string) $asset['description'];
            $best['make'] = (string) $asset['make'];
            $best['vehicle_year'] = (string) $asset['vehicle_year'];
            $best['serial_vin'] = (string) $asset['serial_vin'];
            $best['registration_number'] = (string) $asset['registration_number'];
            $values = array_values(array_filter([
                strtoupper((string) $asset['asset_no']),
                strtoupper((string) $asset['service_item_number']),
                strtoupper((string) $asset['serial_vin']),
                strtoupper((string) $asset['registration_number']),
            ], 'strlen'));
            $best['length_delta'] = empty($values)
                ? 0
                : min(array_map(static function (string $value) use ($query_upper): int {
                    return abs(strlen($value) - strlen($query_upper));
                }, $values));
            $best['normalized_asset_no'] = (string) $asset['normalized_asset_no'];
            $best['compact_asset_no'] = (string) $asset['compact_asset_no'];
            $best['normalized_service_item_number'] = (string) $asset['normalized_service_item_number'];
            $best['compact_service_item_number'] = (string) $asset['compact_service_item_number'];
            $best['normalized_serial_vin'] = (string) $asset['normalized_serial_vin'];
            $best['compact_serial_vin'] = (string) $asset['compact_serial_vin'];
            $best['normalized_registration_number'] = (string) $asset['normalized_registration_number'];
            $best['compact_registration_number'] = (string) $asset['compact_registration_number'];

            return $best;
        }

        private function lookup_exact_asset_match(array $query, array $folder_status): ?array
        {
            $match = $this->find_exact_asset_candidate($query['query']);
            if ($match === null && !empty($query['numeric_fallback'])) {
                $match = $this->find_exact_asset_candidate($query['numeric_fallback']);
            }

            if ($match === null) {
                return null;
            }

            return $this->format_asset_result($match, $this->find_best_folder_for_asset($match, $folder_status['row_count'] === 0));
        }

        private function build_legacy_folder_only_exact_match(array $query): ?array
        {
            $matched_row = $this->find_exact_folder_by_name($query['query'], true);

            if ($matched_row === null && !empty($query['numeric_fallback'])) {
                $matched_row = $this->find_exact_folder_by_name($query['numeric_fallback'], true);
            }

            if ($matched_row === null) {
                return null;
            }

            return $this->format_legacy_folder_as_trailer($this->format_folder_result($matched_row));
        }

        private function find_exact_asset_candidate(string $query): ?array
        {
            global $wpdb;

            $query_compact = $this->compact_search_value($query);
            if ($query_compact === '') {
                return null;
            }

            $table_name = self::get_asset_index_table_name();
            $sql = $wpdb->prepare(
                "SELECT asset_no, service_item_number, description, make, vehicle_year, serial_vin, registration_number,
                        normalized_asset_no, compact_asset_no, normalized_service_item_number, compact_service_item_number,
                        normalized_serial_vin, compact_serial_vin, normalized_registration_number, compact_registration_number
                 FROM {$table_name}
                 WHERE compact_asset_no = %s
                    OR compact_service_item_number = %s
                    OR compact_serial_vin = %s
                    OR compact_registration_number = %s
                 LIMIT 20",
                $query_compact,
                $query_compact,
                $query_compact,
                $query_compact
            );

            $rows = $wpdb->get_results($sql, ARRAY_A) ?: [];
            if (empty($rows)) {
                return null;
            }

            $query_upper = strtoupper($query);
            $best = null;

            foreach ($rows as $row) {
                $match = $this->score_exact_asset_candidate($row, $query_upper, $query_compact);
                if ($match === null) {
                    continue;
                }

                if ($best === null || $match['score'] > $best['score']) {
                    $best = $match;
                }
            }

            return $best;
        }

        private function score_exact_asset_candidate(array $row, string $query_upper, string $query_compact): ?array
        {
            foreach ([
                'asset_no' => 400,
                'service_item_number' => 350,
                'serial_vin' => 300,
                'registration_number' => 250,
            ] as $field => $score) {
                $normalized = strtoupper((string) ($row['normalized_' . $field] ?? $row[$field] ?? ''));
                $compact = (string) ($row['compact_' . $field] ?? $this->compact_search_value((string) ($row[$field] ?? '')));

                if ($normalized === $query_upper || $compact === $query_compact) {
                    $row['score'] = $score;
                    return $row;
                }
            }

            return null;
        }

        private function find_best_folder_for_asset(array $asset, bool $allow_direct_lookup = false): ?array
        {
            return $this->find_best_folder_for_identifiers([
                (string) ($asset['asset_no'] ?? ''),
                (string) ($asset['service_item_number'] ?? ''),
            ], $allow_direct_lookup);
        }

        private function find_best_folder_for_identifiers(array $identifiers, bool $allow_direct_lookup = false): ?array
        {
            foreach ($identifiers as $identifier) {
                $identifier = trim((string) $identifier);
                if ($identifier === '') {
                    continue;
                }

                $folder = $this->find_exact_folder_by_name($identifier, $allow_direct_lookup);
                if ($folder !== null) {
                    return $folder;
                }
            }

            return null;
        }

        private function find_exact_folder_by_name(string $query, bool $allow_direct_lookup = false): ?array
        {
            global $wpdb;

            $table_name = self::get_index_table_name();
            $query_upper = strtoupper($query);
            $query_compact = $this->compact_search_value($query);
            $sql = $wpdb->prepare(
                "SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator,
                        has_registration_pdf, has_fhwa_pdf
                 FROM {$table_name}
                 WHERE normalized_name = %s
                    OR compact_name = %s
                 LIMIT 20",
                $query_upper,
                $query_compact
            );

            $rows = $wpdb->get_results($sql, ARRAY_A) ?: [];
            $matched = $this->resolve_exact_folder_match($query, $rows, $rows);
            if ($matched !== null) {
                return $matched;
            }

            if ($allow_direct_lookup) {
                return $this->try_direct_folder_lookup($query);
            }

            return null;
        }

        private function format_asset_result(array $asset, ?array $folder): array
        {
            $formatted_folder = $folder ? $this->format_folder_result($folder) : null;

            return [
                'trailer_number' => (string) ($asset['asset_no'] ?? ''),
                'service_item_number' => (string) ($asset['service_item_number'] ?? ''),
                'description' => (string) ($asset['description'] ?? ''),
                'make' => (string) ($asset['make'] ?? ''),
                'vehicle_year' => (string) ($asset['vehicle_year'] ?? ''),
                'serial_vin' => (string) ($asset['serial_vin'] ?? ''),
                'registration_number' => (string) ($asset['registration_number'] ?? ''),
                'match_field' => $asset['match_field'] ?? null,
                'folder' => $formatted_folder,
                'has_registration_pdf' => $formatted_folder['has_registration_pdf'] ?? null,
                'has_fhwa_pdf' => $formatted_folder['has_fhwa_pdf'] ?? null,
            ];
        }

        private function format_legacy_folder_as_trailer(array $folder): array
        {
            return [
                'trailer_number' => (string) $folder['name'],
                'service_item_number' => '',
                'description' => '',
                'make' => '',
                'vehicle_year' => '',
                'serial_vin' => '',
                'registration_number' => '',
                'match_field' => 'Trailer folder',
                'folder' => $folder,
                'has_registration_pdf' => $folder['has_registration_pdf'] ?? null,
                'has_fhwa_pdf' => $folder['has_fhwa_pdf'] ?? null,
            ];
        }

        private function normalize_batch_queries(array $queries): array
        {
            $normalized = [];
            $seen = [];

            foreach ($queries as $query) {
                $input = trim((string) $query);
                if ($input === '') {
                    continue;
                }

                $query = $this->strip_search_special_characters($input);
                $this->assert_valid_search_query($query);
                $dedupe_key = strtoupper($input);
                if (isset($seen[$dedupe_key])) {
                    continue;
                }

                $seen[$dedupe_key] = true;
                $normalized[] = [
                    'input' => $input,
                    'query' => $query,
                    'numeric_fallback' => $this->build_numeric_search_fallback($query, 1),
                ];
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

        private function lookup_exact_folder_candidate(string $query, array $rows_by_normalized, array $rows_by_compact): ?array
        {
            $matched_row = $this->resolve_exact_folder_match(
                $query,
                $rows_by_normalized[strtoupper($query)] ?? [],
                $rows_by_compact[$this->compact_search_value($query)] ?? []
            );

            if ($matched_row !== null) {
                return $matched_row;
            }

            return $this->try_direct_folder_lookup($query);
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

        private function normalize_nullable_bool($value): ?bool
        {
            if ($value === null || $value === '') {
                return null;
            }

            return (int) $value === 1;
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

        private function get_business_central_access_token(): string
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
                    'scope' => 'https://api.businesscentral.dynamics.com/.default',
                    'grant_type' => 'client_credentials',
                ], '', '&')
            );

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Business Central authentication failed with HTTP %d.', $response['status']),
                    502,
                    $response['body']
                );
            }

            $payload = json_decode($response['body'], true);
            if (!is_array($payload) || empty($payload['access_token'])) {
                throw new Metro_Registration_Graph_Exception('Business Central authentication response did not include an access token.', 502);
            }

            return $payload['access_token'];
        }

        private function build_bc_assets_collection_url(): string
        {
            $environment = rawurlencode($this->required_config('METRO_BC_ENVIRONMENT'));
            $company_path = $this->build_business_central_company_segment($this->required_config('METRO_BC_COMPANY'));
            $select = implode(',', [
                'No',
                'Description',
                'Make',
                'Vehicle_Year',
                'Serial_No',
                'Vehicle_Registration_No',
                'RMI_Service_Item_No',
            ]);

            return sprintf(
                '/%s/ODataV4/%s/FixedAssets?$select=%s&$top=%d',
                $environment,
                $company_path,
                $select,
                self::ASSET_INDEX_BATCH_SIZE
            );
        }

        private function build_business_central_company_segment(string $company): string
        {
            $escaped = str_replace("'", "''", trim($company));
            return "Company('" . rawurlencode($escaped) . "')";
        }

        private function build_bc_asset_index_row(array $item): ?array
        {
            $asset_no = trim((string) ($item['No'] ?? ''));
            if ($asset_no === '') {
                return null;
            }

            $service_item_number = trim((string) ($item['RMI_Service_Item_No'] ?? ''));
            $description = trim((string) ($item['Description'] ?? ''));
            $make = trim((string) ($item['Make'] ?? ''));
            $vehicle_year = trim((string) ($item['Vehicle_Year'] ?? ''));
            $serial_vin = trim((string) ($item['Serial_No'] ?? ''));
            $registration_number = trim((string) ($item['Vehicle_Registration_No'] ?? ''));

            return [
                'asset_no' => $asset_no,
                'service_item_number' => $service_item_number,
                'description' => $description,
                'make' => $make,
                'vehicle_year' => $vehicle_year,
                'serial_vin' => $serial_vin,
                'registration_number' => $registration_number,
                'normalized_asset_no' => strtoupper($asset_no),
                'compact_asset_no' => $this->compact_search_value($asset_no),
                'normalized_service_item_number' => strtoupper($service_item_number),
                'compact_service_item_number' => $this->compact_search_value($service_item_number),
                'normalized_serial_vin' => strtoupper($serial_vin),
                'compact_serial_vin' => $this->compact_search_value($serial_vin),
                'normalized_registration_number' => strtoupper($registration_number),
                'compact_registration_number' => $this->compact_search_value($registration_number),
            ];
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

        private function business_central_json(string $path_or_url, string $access_token): array
        {
            $response = $this->business_central_request($path_or_url, $access_token);

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new Metro_Registration_Graph_Exception(
                    sprintf('Business Central request failed with HTTP %d.', $response['status']),
                    502,
                    $response['body']
                );
            }

            $payload = json_decode($response['body'], true);
            if (!is_array($payload)) {
                throw new Metro_Registration_Graph_Exception('Business Central returned an invalid JSON response.', 502);
            }

            return $payload;
        }

        private function business_central_request(string $path_or_url, string $access_token): array
        {
            $url = strpos($path_or_url, 'http') === 0
                ? $path_or_url
                : self::BUSINESS_CENTRAL_BASE_URL . $path_or_url;

            return $this->http_request(
                'GET',
                $url,
                [
                    'Authorization' => 'Bearer ' . $access_token,
                    'Accept' => 'application/json',
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
                'has_registration_pdf' => $this->normalize_nullable_bool($folder['has_registration_pdf'] ?? null),
                'has_fhwa_pdf' => $this->normalize_nullable_bool($folder['has_fhwa_pdf'] ?? null),
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

            if (preg_match('/(^|[_\\-\\s])I([_\\-\\.]|$)/', $name_upper) === 1 || strpos($name_upper, 'INSPECTION') !== false || strpos($name_upper, 'FHWA') !== false) {
                return 'FHWA Inspection';
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

            return null;
        }

        private function find_document_by_type(array $documents, string $document_type): ?array
        {
            foreach ($documents as $document) {
                if (($document['document_type'] ?? null) === $document_type && !empty($document['is_pdf'])) {
                    return $document;
                }
            }

            return null;
        }

        private function has_document_type(array $documents, string $document_type): bool
        {
            return $this->find_document_by_type($documents, $document_type) !== null;
        }

        private function build_unique_export_directory(string $folder_name, array $existing_names): string
        {
            $base = sanitize_file_name($folder_name);
            if ($base === '') {
                $base = 'trailer';
            }

            $directory = $base;
            $counter = 2;
            while (in_array($directory, $existing_names, true)) {
                $directory = $base . '-' . $counter;
                $counter++;
            }

            return $directory;
        }

        private function build_unique_document_filename(string $document_name, array $existing_names): string
        {
            $document_name = sanitize_file_name($document_name ?: 'registration.pdf');
            $extension = pathinfo($document_name, PATHINFO_EXTENSION);
            $stem = pathinfo($document_name, PATHINFO_FILENAME);
            $base = sanitize_file_name($stem);
            if ($base === '') {
                $base = 'document';
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

        private function strip_search_special_characters(string $value): string
        {
            $value = preg_replace('/[^A-Za-z0-9_\\-\\s]/', '', $value);
            $value = preg_replace('/\\s+/', ' ', (string) $value);

            return trim((string) $value);
        }

        private function build_numeric_search_fallback(string $value, int $minimum_length): ?string
        {
            $digits = preg_replace('/\\D/', '', $value);
            if (!is_string($digits) || $digits === '' || $digits === $value || strlen($digits) < $minimum_length) {
                return null;
            }

            return $digits;
        }

        private function build_folder_search_response(string $query, int $limit, array $status): array
        {
            $rows = $this->lookup_search_rows($query, $status);
            $matches = $this->score_search_rows($rows, $query);
            $results = array_slice($matches, 0, $limit);

            return [
                'query' => $query,
                'total_matches' => count($matches),
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

        private function lookup_search_rows(string $query, array $status): array
        {
            global $wpdb;

            if (($status['row_count'] ?? 0) > 0) {
                $table_name = self::get_index_table_name();
                $query_upper = strtoupper($query);
                $query_compact = $this->compact_search_value($query);
                $like_normalized = '%' . $wpdb->esc_like($query_upper) . '%';
                $like_compact = '%' . $wpdb->esc_like($query_compact) . '%';
                $sql = $wpdb->prepare(
                    "SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator,
                            has_registration_pdf, has_fhwa_pdf
                     FROM {$table_name}
                     WHERE normalized_name LIKE %s
                        OR compact_name LIKE %s
                     LIMIT %d",
                    $like_normalized,
                    $like_compact,
                    self::SEARCH_QUERY_ROW_LIMIT
                );

                return $wpdb->get_results($sql, ARRAY_A) ?: [];
            }

            $fallback = $this->try_direct_folder_lookup($query);
            if ($fallback !== null) {
                return [$fallback];
            }

            return [];
        }

        private function score_search_rows(array $rows, string $query): array
        {
            $query_upper = strtoupper($query);
            $query_compact = $this->compact_search_value($query);
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

            return $matches;
        }

        private function build_folder_index_row(string $folder_id, string $name): array
        {
            $name = trim($name);

            return [
                'id' => $folder_id,
                'name' => $name,
                'pattern' => $this->classify_folder_pattern($name),
                'length' => strlen($name),
                'has_letters' => preg_match('/[A-Za-z]/', $name) === 1 ? 1 : 0,
                'has_separator' => preg_match('/[-_\\s]/', $name) === 1 ? 1 : 0,
                'normalized_name' => strtoupper($name),
                'compact_name' => $this->compact_search_value($name),
                'has_registration_pdf' => null,
                'has_fhwa_pdf' => null,
            ];
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
                "SELECT folder_id AS id, folder_name AS name, pattern, folder_length AS length, has_letters, has_separator,
                        has_registration_pdf, has_fhwa_pdf
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

        private function ensure_folder_index_row(string $folder_id): void
        {
            if ($this->find_folder_by_id($folder_id) !== null) {
                return;
            }

            $access_token = $this->get_access_token();
            $context = $this->resolve_storage_context($access_token);
            $metadata = $this->graph_json(
                sprintf(
                    '/drives/%s/items/%s?$select=id,name,folder',
                    rawurlencode($context['drive']['id']),
                    rawurlencode($folder_id)
                ),
                $access_token,
                true
            );

            if ($metadata === null || !isset($metadata['folder'], $metadata['id'], $metadata['name'])) {
                return;
            }

            $this->upsert_folder_rows([
                $this->build_folder_index_row((string) $metadata['id'], (string) $metadata['name']),
            ]);
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
